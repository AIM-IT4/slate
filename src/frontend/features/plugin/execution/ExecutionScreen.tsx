import { Button, Input, useToast } from '@cherrystudio/ui/components';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { RouteHeader } from '@/frontend/appShell/header';
import { useMcpServersApi, useMcpServerMutations } from '@/frontend/hooks/mcp/useMcpServers';

import { PluginPage } from '../components/PluginPage';

export const EXECUTION_ENDPOINT = 'https://slate-execution.onrender.com/mcp';

export function ExecutionScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { toast } = useToast();
  const { servers, isLoading } = useMcpServersApi();
  const { createServer, updateServer } = useMcpServerMutations();
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const server = servers.find((entry) => entry.endpointUrl === EXECUTION_ENDPOINT);

  async function connect() {
    if (busy || isLoading || !key.trim()) return;
    setBusy(true);
    try {
      const configuration = {
        name: 'Slate Cloud Execution',
        endpointUrl: EXECUTION_ENDPOINT,
        isEnabled: true,
        headers: { Authorization: `Bearer ${key.trim()}` },
      };
      const connected = server
        ? await updateServer(server.id, configuration)
        : await createServer(configuration);
      setKey('');
      router.replace({ pathname: '/plugins/mcp/[serverId]', params: { serverId: connected.id } });
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
          <Text className="text-sm text-muted-foreground">{EXECUTION_ENDPOINT}</Text>
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
            <Button
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: '/plugins/mcp/[serverId]',
                  params: { serverId: server.id },
                })
              }
            >
              {t('settings.mcp.tabs.configuration')}
            </Button>
          ) : null}
          <Text className="text-sm text-muted-foreground">{t('execution.use')}</Text>
        </View>
      </PluginPage>
    </>
  );
}
