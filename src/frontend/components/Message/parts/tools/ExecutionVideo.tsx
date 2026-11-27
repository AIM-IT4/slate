import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { withUniwind } from 'uniwind';

const VideoWebView = withUniwind(WebView);

/** Use the bundled native WebView's media player for generated HTTPS video files. */
export function ExecutionVideo({ uri }: { uri: string }) {
  const web = useRef<WebView>(null);
  const [ratio, setRatio] = useState(16 / 9);
  const pause = useCallback(() => {
    web.current?.injectJavaScript("document.querySelector('video')?.pause(); true;");
  }, []);
  useFocusEffect(useCallback(() => pause, [pause]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') pause();
    });
    return () => subscription.remove();
  }, [pause]);
  // The URL is data in a quoted HTML attribute, including signed download query parameters.
  const escaped = uri
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"></head><body style="margin:0;background:transparent;width:100vw;height:100vh;overflow:hidden"><video controls playsinline preload="metadata" style="width:100%;height:100%;object-fit:contain" src="${escaped}"></video><script>document.querySelector('video').addEventListener('loadedmetadata',function(){window.ReactNativeWebView.postMessage(JSON.stringify({width:this.videoWidth,height:this.videoHeight}));});</script></body></html>`;
  return (
    <View
      className="w-full overflow-hidden rounded-md bg-secondary"
      style={{ aspectRatio: ratio }}
      testID="execution-inline-video"
    >
      <VideoWebView
        ref={web}
        source={{ html, baseUrl: new URL(uri).origin }}
        originWhitelist={['https://*', 'about:blank']}
        onShouldStartLoadWithRequest={(request) =>
          request.url === 'about:blank' ||
          request.url === new URL(uri).origin ||
          request.url === new URL(uri).origin + '/'
        }
        onMessage={(event) => {
          try {
            const { width, height } = JSON.parse(event.nativeEvent.data);
            if (typeof width === 'number' && typeof height === 'number' && width > 0 && height > 0)
              setRatio(Math.min(3, Math.max(0.3, width / height)));
          } catch {
            // Ignore messages that do not carry video dimensions.
          }
        }}
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction
        javaScriptEnabled
        mixedContentMode="never"
        allowFileAccess={false}
        allowUniversalAccessFromFileURLs={false}
        setSupportMultipleWindows={false}
        scrollEnabled={false}
        className="flex-1 bg-secondary"
        containerClassName="flex-1"
        incognito
        sharedCookiesEnabled={false}
        thirdPartyCookiesEnabled={false}
      />
    </View>
  );
}
