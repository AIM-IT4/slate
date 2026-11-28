import { useToast } from '@cherrystudio/ui/components';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ResolvedFile } from '@/shared/contracts/file';

import { saveFileToDevice } from './saveFileToDevice';

/** One save at a time; dismissing the system picker is quiet and never reports success. */
export function useSaveFileToDevice() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const pending = useRef<AbortController | undefined>(undefined);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pending.current?.abort();
    };
  }, []);
  const save = useCallback(
    async (file: ResolvedFile) => {
      if (pending.current) return;
      const controller = new AbortController();
      pending.current = controller;
      setIsSaving(true);
      try {
        const name = await saveFileToDevice(file, controller.signal);
        if (mounted.current && !controller.signal.aborted)
          toast.show({ label: t('fileViewer.savedToDevice', { name }), variant: 'success' });
      } catch (error) {
        if (mounted.current && !controller.signal.aborted && !/cancel/i.test(String(error)))
          toast.show({ label: t('fileViewer.saveFailed'), variant: 'danger' });
      } finally {
        if (pending.current === controller) pending.current = undefined;
        if (mounted.current) setIsSaving(false);
      }
    },
    [t, toast],
  );
  return { isSaving, save };
}
