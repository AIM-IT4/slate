import { createRef, useImperativeHandle, type Ref } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import type { ResolvedFile } from '@/shared/contracts/file';

import { useSaveFileToDevice } from '../useSaveFileToDevice';

const mockSave = jest.fn();
const mockToast = { show: jest.fn() };
jest.mock('../saveFileToDevice', () => ({
  saveFileToDevice: (...args: unknown[]) => mockSave(...args),
}));
jest.mock('@cherrystudio/ui/components', () => ({ useToast: () => ({ toast: mockToast }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { name: string }) => (values ? `${key}:${values.name}` : key),
  }),
}));

type Save = ReturnType<typeof useSaveFileToDevice>;
function Probe({ ref }: { ref: Ref<Save> }) {
  const value = useSaveFileToDevice();
  useImperativeHandle(ref, () => value);
  return null;
}
const file = { uri: 'file:///private/id.mp4', entry: { filename: 'reel.mp4' } } as ResolvedFile;
beforeEach(() => {
  jest.clearAllMocks();
  mockSave.mockResolvedValue('reel.mp4');
});

it('serializes rapid presses and reports success only after the full copy completes', async () => {
  let finish!: (name: string) => void;
  mockSave.mockReturnValue(
    new Promise<string>((resolve) => {
      finish = resolve;
    }),
  );
  const ref = createRef<Save>();
  let renderer!: ReactTestRenderer;
  let task!: Promise<void>;
  act(() => {
    renderer = create(<Probe ref={ref} />);
  });
  act(() => {
    task = ref.current!.save(file);
    void ref.current!.save(file);
  });
  expect(mockSave).toHaveBeenCalledTimes(1);
  expect(ref.current!.isSaving).toBe(true);
  expect(mockToast.show).not.toHaveBeenCalled();
  await act(async () => {
    finish('reel (1).mp4');
    await task;
  });
  expect(mockToast.show).toHaveBeenCalledWith({
    label: 'fileViewer.savedToDevice:reel (1).mp4',
    variant: 'success',
  });
  expect(ref.current!.isSaving).toBe(false);
  act(() => renderer.unmount());
});

it('keeps picker cancellation quiet and never shows success for a failed copy', async () => {
  const ref = createRef<Save>();
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(<Probe ref={ref} />);
  });
  mockSave.mockRejectedValueOnce(new Error('cancelled'));
  await act(async () => {
    await ref.current!.save(file);
  });
  expect(mockToast.show).not.toHaveBeenCalled();
  mockSave.mockRejectedValueOnce(new Error('disk full'));
  await act(async () => {
    await ref.current!.save(file);
  });
  expect(mockToast.show).toHaveBeenCalledWith({
    label: 'fileViewer.saveFailed',
    variant: 'danger',
  });
  expect(ref.current!.isSaving).toBe(false);
  act(() => renderer.unmount());
});

it('aborts pending picker work and suppresses feedback after unmount', async () => {
  let finish!: (name: string) => void;
  mockSave.mockReturnValue(
    new Promise<string>((resolve) => {
      finish = resolve;
    }),
  );
  const ref = createRef<Save>();
  let renderer!: ReactTestRenderer;
  let task!: Promise<void>;
  act(() => {
    renderer = create(<Probe ref={ref} />);
  });
  act(() => {
    task = ref.current!.save(file);
  });
  const signal = mockSave.mock.calls[0][1] as AbortSignal;
  act(() => renderer.unmount());
  expect(signal.aborted).toBe(true);
  await act(async () => {
    finish('reel.mp4');
    await task;
  });
  expect(mockToast.show).not.toHaveBeenCalled();
});
