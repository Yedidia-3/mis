import { useEffect } from "react";

/**
 * Re-runs `fn` when the browser tab regains focus and on a fixed interval.
 * Lets dashboards stay in sync across portals without a full page reload:
 * e.g. the Dean distributes → the Accountant's open tab refreshes on focus.
 *
 * `fn` must be stable — wrap it in useCallback in the caller.
 */
export function useAutoRefresh(fn: () => void, intervalMs = 20000) {
  useEffect(() => {
    const onFocus = () => fn();
    const onVisible = () => { if (document.visibilityState === "visible") fn(); };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    const id = window.setInterval(fn, intervalMs);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(id);
    };
  }, [fn, intervalMs]);
}
