import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Runs an async loader once on mount and exposes loading/error/data state.
 *
 * Deliberately mount-scoped so sections do not re-request every time the tab
 * regains focus. Guards against setting state after unmount and ignores stale
 * responses when `reload` is called rapidly.
 */
export default function useAsyncSection(loader, { enabled = true, deps = [] } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);

  const mounted = useRef(true);
  const requestId = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);

    try {
      const result = await loader();
      if (!mounted.current || id !== requestId.current) return;
      setData(result);
    } catch (err) {
      if (!mounted.current || id !== requestId.current) return;
      // A cancellation is not a user-visible failure.
      if (err && err.code === 'CANCELLED') return;
      setError(err);
    } finally {
      if (mounted.current && id === requestId.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (enabled) run();
  }, [enabled, run]);

  return { data, loading, error, reload: run, setData };
}