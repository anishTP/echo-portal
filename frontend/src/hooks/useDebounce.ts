import { useState, useEffect, useRef, useCallback } from 'react';

const DEFAULT_DELAY = 2000; // 2 seconds as specified in data-model.md

/**
 * Debounce a value - returns the debounced value after delay.
 * Useful for auto-save where you want to wait until user stops typing.
 *
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 2000ms)
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number = DEFAULT_DELAY): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Returns a debounced callback function.
 * The callback will only be invoked after `delay` ms have passed without the function being called.
 *
 * @param callback - The function to debounce
 * @param delay - Delay in milliseconds (default: 2000ms)
 * @returns A debounced version of the callback
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number = DEFAULT_DELAY
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  }, [delay]);
}

/**
 * Returns both immediate and debounced execution.
 * Useful when you need to track "dirty" state immediately but save after delay.
 *
 * @param callback - The function to call after debounce
 * @param delay - Delay in milliseconds (default: 2000ms)
 * @returns Object with { trigger, cancel, isPending }
 */
export function useDebouncedSave<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number = DEFAULT_DELAY
): {
  trigger: (...args: Parameters<T>) => void;
  cancel: () => void;
  flush: () => void;
  isPending: boolean;
} {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  const pendingArgsRef = useRef<Parameters<T> | null>(null);
  const [isPending, setIsPending] = useState(false);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    pendingArgsRef.current = null;
    setIsPending(false);
  }, []);

  const flush = useCallback(() => {
    if (timeoutRef.current && pendingArgsRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      callbackRef.current(...pendingArgsRef.current);
      pendingArgsRef.current = null;
      setIsPending(false);
    }
  }, []);

  const trigger = useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    pendingArgsRef.current = args;
    setIsPending(true);

    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
      pendingArgsRef.current = null;
      setIsPending(false);
      timeoutRef.current = null;
    }, delay);
  }, [delay]);

  return { trigger, cancel, flush, isPending };
}
