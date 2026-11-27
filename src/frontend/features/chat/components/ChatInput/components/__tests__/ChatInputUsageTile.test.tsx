import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { ChatInputUsageTile } from '../ChatInputUsageTile';

const mockPush = jest.fn();
let mockResult: any;
const mockQuery = jest.fn((_path: string, _options: any) => mockResult);
jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('@/frontend/data', () => ({
  useQuery: (path: string, options: any) => mockQuery(path, options),
}));
jest.mock('@/frontend/hooks/useCurrentTime', () => ({ useCurrentTime: () => Date.now() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en-US' } }),
}));
jest.mock('@cherrystudio/app-icons/icons/activity', () => () => null);
jest.mock('@cherrystudio/ui/components', () => {
  const React = jest.requireActual('react');
  const Button = ({ children, ...props }: any) =>
    React.createElement('UsageButton', props, children);
  Button.Label = function UsageLabel({ children, ...props }: any) {
    return React.createElement('UsageLabel', props, children);
  };
  return { Button };
});

describe('ChatInputUsageTile', () => {
  let renderer: ReactTestRenderer;
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 10, 27, 12));
    mockQuery.mockClear();
    mockPush.mockClear();
    mockResult = { data: undefined, isError: false };
  });
  afterEach(() => {
    act(() => renderer.unmount());
    jest.useRealTimers();
  });
  it('shows recorded tokens and each currency, limits the query to today, and opens statistics', () => {
    mockResult.data = {
      buckets: [{ totalTokens: 1_200_000 }],
      costTotals: [
        { currency: 'USD', total: 1.25 },
        { currency: 'CNY', total: 2 },
      ],
    };
    act(() => {
      renderer = create(<ChatInputUsageTile />);
    });
    const label = renderer.root.findByType('UsageLabel' as never).props.children;
    expect(label).toContain('1.2M');
    expect(label).toContain('$1.25');
    expect(label).toContain('CN¥2.00');
    expect(mockQuery.mock.calls[0][1].query).toMatchObject({
      from: new Date(2026, 10, 27).getTime(),
      to: new Date(2026, 10, 28).getTime() - 1,
    });
    act(() => renderer.root.findByType('UsageButton' as never).props.onPress());
    expect(mockPush).toHaveBeenCalledWith('/home/ai-usage');
    jest.setSystemTime(new Date(2026, 10, 28, 0, 1));
    act(() => renderer.update(<ChatInputUsageTile />));
    expect(mockQuery.mock.calls.at(-1)?.[1].query.from).toBe(new Date(2026, 10, 28).getTime());
  });
  it('does not report missing usage as zero or invent a cost, and keeps the error shortcut usable', () => {
    act(() => {
      renderer = create(<ChatInputUsageTile />);
    });
    expect(renderer.root.findByType('UsageLabel' as never).props.children).toContain('—');
    mockResult = { data: { buckets: [{ totalTokens: 70 }], costTotals: [] }, isError: false };
    act(() => renderer.update(<ChatInputUsageTile />));
    const label = renderer.root.findByType('UsageLabel' as never).props.children;
    expect(label).toContain('70');
    expect(label).not.toContain('$');
    mockResult = { data: undefined, isError: true };
    act(() => renderer.update(<ChatInputUsageTile />));
    expect(renderer.root.findByType('UsageLabel' as never).props.children).toBe('aiUsage.title');
    expect(renderer.root.findByType('UsageButton' as never).props.accessibilityLabel).toContain(
      'aiUsage.loadError',
    );
  });
});
