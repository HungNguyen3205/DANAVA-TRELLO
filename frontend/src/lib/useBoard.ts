import { useCallback, useEffect, useRef, useState } from "react";
import type { Board } from "../types";
import { api, ApiError } from "./api";
export interface BoardResponse {
  id: string;
  workspace_id: string;
  version: number;
  role: string;
  data: Board;
}
export function useBoard(id: string) {
  const [row, setRow] = useState<BoardResponse | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const epoch = useRef(0),
    saving = useRef(false);
  const reload = useCallback(
    async (silent = false) => {
      const key = ++epoch.current;
      try {
        const result = await api<BoardResponse>(`/boards/${id}`);
        if (key === epoch.current && !saving.current) {
          setRow(result);
          if (!silent) setError("");
        }
      } catch (e) {
        if (key === epoch.current) {
          setError((e as Error).message);
          if (e instanceof ApiError && [401, 403, 404].includes(e.status))
            setRow(null);
        }
      } finally {
        if (key === epoch.current) setLoading(false);
      }
    },
    [id],
  );
  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect -- Synchronize this route with server data.
    void reload();
    const timer = setInterval(() => {
      if (!saving.current && document.visibilityState === "visible")
        void reload(true);
    }, 30000);
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps -- This counter invalidates in-flight requests, not a DOM ref.
      ++epoch.current;
      clearInterval(timer);
    };
  }, [reload]);
  async function save(next: Board, activity: string, version = row?.version) {
    if (saving.current || version === undefined) return false;
    saving.current = true;
    ++epoch.current;
    setBusy(true);
    setError("");
    try {
      const result = await api<BoardResponse>(`/boards/${id}`, "PUT", {
        version,
        data: next,
        activity,
      });
      setRow(result);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return { row, error, busy, loading, reload, save };
}
