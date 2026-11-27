import { createConcurrencySlots } from '@/backend/utils/concurrencySlots';

// Dictation and video/file transcription share one native recognizer and decoder directory.
const asrWork = createConcurrencySlots(1);
export const acquireAsrWork = asrWork.acquire;
