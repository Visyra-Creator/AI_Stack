import { useCallback, useRef, useState } from 'react';

interface OptimisticSaveOptions {
  onSaveStart?: () => void;
  onSaveSuccess?: () => void;
  onSaveError?: (error: Error) => void;
  debounceMs?: number;
}

/**
 * Hook for optimistic saves with debouncing and loading state.
 * - Shows loading immediately when save starts
 * - Closes modal/form optimistically (doesn't wait for storage)
 * - Performs storage operation in background
 * - Prevents multiple rapid clicks
 */
export function useOptimisticSave(options: OptimisticSaveOptions = {}) {
  const {
    onSaveStart,
    onSaveSuccess,
    onSaveError,
    debounceMs = 300,
  } = options;

  const [isSaving, setIsSaving] = useState(false);
  const lastSaveTimeRef = useRef<number>(0);
  const savingRef = useRef(false);

  const executeSave = useCallback(
    async (saveOperation: () => Promise<void>) => {
      if (savingRef.current) {
        return;
      }

      // Prevent duplicate saves within debounce window
      const now = Date.now();
      if (now - lastSaveTimeRef.current < debounceMs) {
        return;
      }
      lastSaveTimeRef.current = now;

      // Show loading immediately
      savingRef.current = true;
      setIsSaving(true);
      onSaveStart?.();

      try {
        await saveOperation();
        onSaveSuccess?.();
      } catch (error) {
        onSaveError?.(error instanceof Error ? error : new Error(String(error)));
      } finally {
        savingRef.current = false;
        setIsSaving(false);
      }
    },
    [debounceMs, onSaveStart, onSaveSuccess, onSaveError]
  );

  const cleanup = useCallback(() => {
    savingRef.current = false;
  }, []);

  return {
    isSaving,
    executeSave,
    cleanup,
  };
}

