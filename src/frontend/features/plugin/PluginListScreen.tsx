import TerminalIcon from '@cherrystudio/app-icons/icons/terminal';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { RouteHeader } from '@/frontend/appShell/header';
import { PluginIcon } from '@/frontend/components/PluginIcon';

import { BuiltinToolGroup } from './components/BuiltinToolGroup';
import { McpServerGroup } from './components/McpServerGroup';
import { PluginCatalogGroup } from './components/PluginCatalogGroup';
import { PluginGroup } from './components/PluginGroup';
import { PluginPage } from './components/PluginPage';
import { PluginRow } from './components/PluginRow';
import { SshConnectionGroup } from './components/SshConnectionGroup';

export function PluginListScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <>
      <RouteHeader title={t('plugins.title')} />
      <PluginPage testID="plugins-list">
        <PluginGroup title={t('execution.title')}>
          <PluginRow
            title={t('execution.title')}
            description={t('execution.summary')}
            icon={<PluginIcon glyph={TerminalIcon} />}
            onPress={() => router.push('/plugins/execution')}
            testID="plugins-execution"
          />
        </PluginGroup>
        <PluginCatalogGroup />
        <McpServerGroup />
        <SshConnectionGroup />
        <BuiltinToolGroup />
      </PluginPage>
    </>
  );
}
