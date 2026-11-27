import type { McpModule } from '@/shared/contracts/mcp';
import type { ApiClient } from '@/shared/data/api/types';
import { enablesMcpServer } from '@/shared/utils/agentMcpBinding';

/** Discover the saved connection before enabling it for the explicitly selected Agent. */
export async function enableExecutionForAgent(
  api: Pick<ApiClient, 'get' | 'post'>,
  mcp: Pick<McpModule, 'listTools'>,
  serverId: string,
  agentId: string,
): Promise<void> {
  const agent = await api.get(`/agents/${agentId}`);
  if (agent.mode !== 'standard' || !agent.model)
    throw new Error('Choose a configured standard Agent');
  const tools = await mcp.listTools(serverId);
  if (!tools.some((tool) => tool.name === 'run_command'))
    throw new Error('Execution command tool is unavailable');
  const binding = await api.post(`/agents/${agentId}/tool-bindings`, {
    body: {
      source: 'mcp',
      serverId,
      enabled: true,
      approval: 'ask',
      displayNameSnapshot: 'Slate Cloud Execution',
    },
  });
  if (!enablesMcpServer(binding)) throw new Error('Execution binding could not be enabled');
}
