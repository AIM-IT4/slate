import type { RuntimeTool } from '@/backend/ai/agent/runtime';
import { createAgentRuntimeToolResolver } from '@/backend/ai/agent/tools/runtimeTools';
import type { McpRuntimeToolSelection } from '@/backend/ai/mcp';
import type { AgentToolBinding } from '@/shared/data/types/agentToolBinding';

jest.mock('@/backend/services/builtInMcp', () => ({ resolveBuiltInPluginGuides: () => [] }));

import type { McpModule } from '@/shared/contracts/mcp';
import type { ApiClient } from '@/shared/data/api/types';
import { enablesMcpServer } from '@/shared/utils/agentMcpBinding';
import { isSlateExecutionEndpoint } from '@/shared/utils/slateExecution';

import { enableExecutionForAgent } from '../enableExecution';

const serverId = '00000000-0000-4000-8000-000000000001';
const agentId = '00000000-0000-4000-8000-000000000002';

function setup() {
  const rows = new Map<string, unknown>();
  const post = jest.fn(async (path, options) => {
    const binding = { ...options.body, agentId };
    rows.set(path, binding);
    return binding;
  });
  const get = jest.fn(async () => ({
    mode: 'standard',
    model: { providerId: 'anthropic', modelId: 'test' },
  }));
  const listTools = jest.fn(async () => [{ name: 'run_command' }, { name: 'command_status' }]);
  const api = { get, post } as unknown as Pick<ApiClient, 'get' | 'post'>;
  const mcp = { listTools } as Pick<McpModule, 'listTools'>;
  return { api, mcp, rows, post, get, listTools };
}

test('connects the selected Agent to the discovered command server with normal approvals', async () => {
  const { api, mcp, rows, post } = setup();
  await enableExecutionForAgent(api, mcp, serverId, agentId);
  const binding = rows.get(`/agents/${agentId}/tool-bindings`) as Parameters<
    typeof enablesMcpServer
  >[0];
  expect(enablesMcpServer(binding)).toBe(true);
  expect(binding).toMatchObject({ source: 'mcp', serverId, agentId, approval: 'ask' });
  expect(post).toHaveBeenCalledTimes(1);
});

test('refuses to bind a connection that has no execution command', async () => {
  const { api, mcp, listTools, post } = setup();
  listTools.mockResolvedValue([]);
  await expect(enableExecutionForAgent(api, mcp, serverId, agentId)).rejects.toThrow('unavailable');
  expect(post).not.toHaveBeenCalled();
});

test('keeps the Agent unbound when connection discovery fails', async () => {
  const { api, mcp, listTools, post } = setup();
  listTools.mockRejectedValue(new Error('Connection failed'));
  await expect(enableExecutionForAgent(api, mcp, serverId, agentId)).rejects.toThrow(
    'Connection failed',
  );
  expect(post).not.toHaveBeenCalled();
});

test('reconnecting uses the existing single-binding upsert', async () => {
  const { api, mcp, rows } = setup();
  await enableExecutionForAgent(api, mcp, serverId, agentId);
  await enableExecutionForAgent(api, mcp, serverId, agentId);
  expect(rows.size).toBe(1);
});

test.each([
  'https://slate-execution.onrender.com/mcp',
  'https://slate-execution.onrender.com/mcp/',
])('recognizes the bearer-auth execution endpoint %s', (endpoint) => {
  expect(isSlateExecutionEndpoint(endpoint)).toBe(true);
});

test.each([
  'https://slate-execution.onrender.com.example.test/mcp',
  'https://example.test/mcp',
  'http://slate-execution.onrender.com/mcp',
])('keeps OAuth options available for other endpoints %s', (endpoint) => {
  expect(isSlateExecutionEndpoint(endpoint)).toBe(false);
});

test('the normal Agent tool resolver exposes run_command after setup creates its binding', async () => {
  const { api, mcp, rows } = setup();
  const resolver = createAgentRuntimeToolResolver({
    servers: {
      list: async () => ({
        items: [
          {
            id: serverId,
            name: 'Slate Cloud Execution',
            origin: 'remote',
            endpointUrl: 'https://slate-execution.onrender.com/mcp',
            isEnabled: true,
            disabledTools: [],
            createdAt: '2026-11-27T00:00:00Z',
            updatedAt: '2026-11-27T00:00:00Z',
          },
        ],
      }),
    },
    bindings: {
      list: async () => ({ items: [...rows.values()] as AgentToolBinding[] }),
      resolveMcpTool: async () => ({
        enabled: [...rows.values()].some((row) => enablesMcpServer(row as AgentToolBinding)),
        approval: 'ask',
      }),
    },
    getMcpRuntime: () => ({
      listExecutableToolDescriptors: async () => [
        {
          serverId,
          rawToolName: 'run_command',
          displayName: 'run_command',
          description: 'Run bash',
          endpointUrl: 'https://slate-execution.onrender.com/mcp',
          generation: 1,
          inputSchema: { type: 'object' },
        },
      ],
      createRuntimeTools: (selections: readonly McpRuntimeToolSelection[]) =>
        selections.map((selection) => ({
          ...selection,
          providerName: selection.descriptor.rawToolName,
        })) as unknown as RuntimeTool[],
    }),
  });
  expect((await resolver.resolve(agentId)).tools).toHaveLength(0);
  await enableExecutionForAgent(api, mcp, serverId, agentId);
  expect((await resolver.resolve(agentId)).tools.map((tool) => tool.providerName)).toEqual([
    'run_command',
  ]);
});
