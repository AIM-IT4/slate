import base64
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import threading
import unittest
import urllib.request
import urllib.error

TEMP = tempfile.TemporaryDirectory()
os.environ['SLATE_WORKSPACE'] = TEMP.name
os.environ['SLATE_TOKEN_SHA256'] = hashlib.sha256(b'test-key').hexdigest()
spec = importlib.util.spec_from_file_location('executor', Path(__file__).with_name('server.py'))
app = importlib.util.module_from_spec(spec)
spec.loader.exec_module(app)


class ExecutionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.http = app.ThreadingHTTPServer(('127.0.0.1', 0), app.Handler)
        cls.base = f'http://127.0.0.1:{cls.http.server_port}'
        threading.Thread(target=cls.http.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()

    def rpc(self, method, params=None, authorized=True):
        headers = {'Content-Type': 'application/json'}
        if authorized:
            headers['Authorization'] = 'Bearer test-key'
        req = urllib.request.Request(self.base+'/mcp', data=json.dumps({'jsonrpc':'2.0','id':1,'method':method,'params':params or {}}).encode(), headers=headers)
        return json.load(urllib.request.urlopen(req))['result']

    def tool(self, name, args):
        return self.rpc('tools/call', {'name':name,'arguments':args})

    def test_auth_and_discovery(self):
        with self.assertRaises(urllib.error.HTTPError) as error:
            self.rpc('tools/list', authorized=False)
        self.assertEqual(error.exception.code, 401)
        self.assertEqual(len(self.rpc('tools/list')['tools']), 7)
        self.assertEqual(self.rpc('initialize', {'protocolVersion':'2025-03-26'})['protocolVersion'], '2025-03-26')

    def test_shell_output_idempotency_and_environment(self):
        request = {'command':"printf 'hello'; printf 'error' >&2; test -z \"$SLATE_TOKEN_SHA256\"", 'request_id':'hello'}
        a = self.tool('run_command', request)
        b = self.tool('run_command', request)
        self.assertEqual(a, b)
        output = json.loads(a['content'][0]['text'])
        self.assertEqual((output['stdout'], output['stderr'], output['exit_code']), ('hello','error',0))
        self.assertTrue(self.tool('run_command', {**request, 'command':'false'})['isError'])

    def test_timeout_and_bounded_output(self):
        output = json.loads(self.tool('run_command', {'command':'sleep 5', 'timeout_seconds':1, 'request_id':'timeout'})['content'][0]['text'])
        self.assertTrue(output['timed_out'])
        self.assertEqual(output['state'], 'exited')
        result = self.tool('run_command', {'command':"python3 -c \"print('a'*100000)\"", 'request_id':'big'})
        output = json.loads(result['content'][0]['text'])
        self.assertTrue(output['truncated'])
        self.assertLessEqual(len(output['stdout']), app.LIMIT)

    def test_workspace_paths_download_and_inline_image(self):
        self.assertTrue(self.tool('read_workspace_file', {'path':'../outside'})['isError'])
        self.tool('write_workspace_file', {'path':'output/a.txt','content':'saved'})
        self.assertEqual(self.tool('read_workspace_file', {'path':'output/a.txt'})['content'][0]['text'], 'saved')
        content = self.tool('show_workspace_file', {'path':'output/a.txt'})['content']
        url = content[0]['uri']
        self.assertEqual(urllib.request.urlopen(url).read(), b'saved')
        with self.assertRaises(urllib.error.HTTPError):
            urllib.request.urlopen(url.replace('signature=', 'signature=bad'))
        png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=')
        (app.ROOT/'plot.png').write_bytes(png)
        content = self.tool('show_workspace_file', {'path':'plot.png'})['content']
        self.assertEqual(content[0]['type'], 'image')
        self.assertEqual(base64.b64decode(content[0]['data']), png)


if __name__ == '__main__':
    unittest.main()
