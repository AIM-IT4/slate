import { Button, Input, useToast } from '@cherrystudio/ui/components';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { RouteHeader } from '@/frontend/appShell/header';
import { chatHref } from '@/frontend/appShell/navigation/chat';
import { AgentPickerSheet } from '@/frontend/components/AgentPicker';
import { queryKeys, useApiClient, useBackendModule } from '@/frontend/data';
import { useAgentsApi } from '@/frontend/hooks/agent';
import { useMcpServersApi, useMcpServerMutations } from '@/frontend/hooks/mcp/useMcpServers';
import { SLATE_EXECUTION_ENDPOINT, isSlateExecutionEndpoint } from '@/shared/utils/slateExecution';

import { PluginPage } from '../components/PluginPage';
import { enableExecutionForAgent } from './enableExecution';

const EXECUTION_ENDPOINT = SLATE_EXECUTION_ENDPOINT;

export function ExecutionScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { toast } = useToast();
  const mcp = useBackendModule('mcp');
  const api = useApiClient();
  const queryClient = useQueryClient();
  const agents = useAgentsApi();
  const [pickAgent, setPickAgent] = useState(false);
  const [connected, setConnected] = useState(false);
  const [savedId, setSavedId] = useState<string>();
  const { servers, isLoading } = useMcpServersApi();
  const { createServer, updateServer } = useMcpServerMutations();
  const [key, setKey] = useState('');
  const [endpoint, setEndpoint] = useState(EXECUTION_ENDPOINT);
  const [busy, setBusy] = useState(false);
  const server = servers.find((entry) => entry.endpointUrl === endpoint.trim());

  async function connect() {
    if (busy || isLoading || !key.trim()) return;
    setBusy(true);
    try {
      const url = new URL(endpoint.trim());
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
        throw new Error('Invalid execution endpoint');
      const configuration = {
        name: 'Slate Cloud Execution',
        endpointUrl: endpoint.trim(),
        isEnabled: true,
        disabledTools: [],
        headers: { Authorization: `Bearer ${key.trim()}` },
      };
      await mcp.getServerInfo(configuration);
      if (server?.origin !== 'builtin' && server?.oauth) await mcp.disconnectOAuth(server.id);
      const saved = server
        ? await updateServer(server.id, configuration)
        : await createServer(configuration);
      setKey('');
      setSavedId(saved.id);
      await mcp.listTools(saved.id);
      setConnected(true);
      setPickAgent(true);
    } catch {
      toast.show({ label: t('execution.failed'), variant: 'danger' });
    } finally {
      setBusy(false);
    }
  }

  async function enableForAgent(agentId: string) {
    const serverId = server?.id ?? savedId;
    if (!serverId || busy) return;
    setBusy(true);
    try {
      await updateServer(serverId, { isEnabled: true, disabledTools: [] });
      await enableExecutionForAgent(api, mcp, serverId, agentId);
      await queryClient.invalidateQueries({ queryKey: queryKeys.agents.toolBindings(agentId) });
      router.push(chatHref({ kind: 'draft', agentId }));
    } catch {
      toast.show({ label: t('execution.failed'), variant: 'danger' });
    } finally {
      setBusy(false);
    }
  }

  async function testSaved() {
    if (!server || busy) return;
    setBusy(true);
    try {
      await mcp.getServerInfo({ endpointUrl: endpoint.trim(), headers: server.headers });
      if (isSlateExecutionEndpoint(endpoint) && server.origin !== 'builtin' && server.oauth)
        await mcp.disconnectOAuth(server.id);
      const tools = await mcp.listTools(server.id);
      if (!tools.some((tool) => tool.name === 'run_command'))
        throw new Error('Missing command tool');
      setConnected(true);
      setPickAgent(true);
    } catch {
      toast.show({ label: t('execution.failed'), variant: 'danger' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <RouteHeader title={t('execution.title')} />
      <PluginPage testID="execution-setup">
        <View className="gap-4">
          <Text className="text-base text-foreground">{t('execution.description')}</Text>
          <Input
            accessibilityLabel={t('settings.mcp.fields.endpointUrl')}
            placeholder={t('settings.mcp.fields.endpointUrl')}
            value={endpoint}
            onChangeText={(value) => {
              setEndpoint(value);
              setConnected(false);
              setSavedId(undefined);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            testID="execution-endpoint"
          />
          <Text className="text-sm text-muted-foreground">{t('execution.storage')}</Text>
          <Input
            accessibilityLabel={t('execution.key')}
            placeholder={t('execution.key')}
            type="password"
            visibilityAccessibilityLabels={{
              show: t('ssh.showPassword'),
              hide: t('ssh.hidePassword'),
            }}
            value={key}
            onChangeText={setKey}
            testID="execution-access-key"
          />
          <Button
            onPress={() => void connect()}
            disabled={busy || isLoading || !key.trim()}
            loading={busy}
            testID="execution-connect"
          >
            {t('execution.connect')}
          </Button>
          {server ? (
            <Button variant="secondary" onPress={() => void testSaved()} disabled={busy}>
              {t('execution.enable')}
            </Button>
          ) : null}
          {connected ? (
            <Text className="text-sm text-success">{t('settings.mcp.list.status.connected')}</Text>
          ) : null}
          <Text className="text-sm text-muted-foreground">{t('execution.use')}</Text>
          {pickAgent ? (
            <AgentPickerSheet
              open
              title={t('execution.enable')}
              onClose={() => setPickAgent(false)}
              onSelect={(agentId) => void enableForAgent(agentId)}
              catalog={{
                items: agents.agents
                  .filter((agent) => agent.mode === 'standard')
                  .map((agent) => ({
                    ...agent,
                    configuration: agent.model ? ('available' as const) : ('unavailable' as const),
                  })),
                isLoading: agents.isLoading,
                isError: Boolean(agents.error),
                refetch: agents.refetch,
              }}
            />
          ) : null}
        </View>
      </PluginPage>
    </>
  );
}
