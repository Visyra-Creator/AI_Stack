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
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveTimeRef = useRef<number>(0);

  const executeSave = useCallback(
    async (saveOperation: () => Promise<void>) => {
      // Prevent duplicate saves within debounce window
      const now = Date.now();
      if (now - lastSaveTimeRef.current < debounceMs) {
        return;
      }
      lastSaveTimeRef.current = now;

      // Clear any pending debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Show loading immediately
      setIsSaving(true);
      onSaveStart?.();

      // Execute save in background (non-blocking)
      debounceTimerRef.current = setTimeout(async () => {
        try {
          await saveOperation();
          onSaveSuccess?.();
        } catch (error) {
          onSaveError?.(error instanceof Error ? error : new Error(String(error)));
        } finally {
          setIsSaving(false);
        }
      }, 0);
    },
    [debounceMs, onSaveStart, onSaveSuccess, onSaveError]
  );

  const cleanup = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  }, []);

  return {
    isSaving,
    executeSave,
    cleanup,
  };
}

