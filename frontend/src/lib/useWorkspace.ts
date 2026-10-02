import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { demoBoard, emptyBoard } from "../data/mockData";
import type { Board } from "../types";
export interface WorkspaceRow {
  id: string;
  owner_id: string;
  title: string;
  data: Board;
  version: number;
}
export function useWorkspace() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [rows, setRows] = useState<WorkspaceRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [board, setBoard] = useState<Board>(() =>
    structuredClone(supabase ? emptyBoard : demoBoard),
  );
  const [role, setRole] = useState(supabase ? "viewer" : "admin");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!!supabase);
  const [error, setError] = useState("");
  const current = useRef<WorkspaceRow | null>(null);
  const saving = useRef(false);
  const requestEpoch = useRef(0);
  const actor = session?.user.email || "Bạn (demo)";
  useEffect(() => {
    if (!supabase) return;
    let live = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (live) {
        setSession(data.session);
        setAuthReady(true);
        if (error) setError(error.message);
      }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, value) => {
      setSession(value);
      setAuthReady(true);
    });
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, []);
  const reload = useCallback(async () => {
    if (!supabase || !session) return;
    const epoch = ++requestEpoch.current;
    setLoading(true);
    setError("");
    const result = await supabase
      .from("workspaces")
      .select("*")
      .order("created_at");
    if (epoch !== requestEpoch.current || saving.current) return;
    if (result.error) {
      setError("Không tải được bảng. Kiểm tra cấu hình database và thử lại.");
      setLoading(false);
      return;
    }
    const list = result.data as WorkspaceRow[];
    setRows(list);
    const row = list.find((r) => r.id === selected) || list[0] || null;
    current.current = row;
    setSelected(row?.id || null);
    setBoard(row?.data || structuredClone(emptyBoard));
    if (row) {
      const r = await supabase.rpc("workspace_role", { workspace: row.id });
      if (epoch !== requestEpoch.current || saving.current) return;
      setRole(r.data || "viewer");
    } else setRole("viewer");
    setLoading(false);
  }, [session, selected]);
  useEffect(() => {
    // Synchronize the external authenticated workspace after login or selection.
    // oxlint-disable-next-line react/set-state-in-effect
    if (session) void reload();
    else {
      current.current = null;
      setRows([]);
      if (authReady) setLoading(false);
    }
  }, [session, reload, authReady]);
  useEffect(() => {
    if (!supabase || !selected) return;
    const channel = supabase
      .channel(`board-${selected}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "workspaces",
          filter: `id=eq.${selected}`,
        },
        () => {
          if (!saving.current) void reload();
        },
      )
      .subscribe();
    // Polling is a fallback if Realtime has not been enabled in the dashboard.
    const timer = setInterval(() => {
      if (!saving.current && document.visibilityState === "visible")
        void reload();
    }, 30000);
    return () => {
      clearInterval(timer);
      void supabase!.removeChannel(channel);
    };
  }, [selected, reload]);
  async function save(next: Board): Promise<boolean> {
    if (saving.current) return false;
    if (!supabase) {
      setBoard(next);
      return true;
    }
    if (!current.current || role === "viewer") {
      setError("Bạn không có quyền chỉnh sửa bảng này.");
      return false;
    }
    saving.current = true;
    ++requestEpoch.current;
    const base = current.current;
    setBusy(true);
    setError("");
    try {
      const result = await supabase.rpc("save_board", {
        workspace: base.id,
        expected_version: base.version,
        board_data: next,
      });
      if (result.error) throw result.error;
      current.current = {
        ...base,
        data: next,
        version: result.data,
      };
      setBoard(next);
      return true;
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : String((e as { message?: string })?.message || e);
      setError(
        message.includes("CONFLICT")
          ? "Bảng đã được người khác cập nhật. Nội dung đang nhập vẫn được giữ. Tải lại bảng trước khi lưu lại."
          : "Không lưu được dữ liệu. Nội dung đang nhập vẫn được giữ; vui lòng thử lại.",
      );
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
      setLoading(false);
    }
  }
  function chooseWorkspace(id: string) {
    if (saving.current) return;
    ++requestEpoch.current;
    current.current = null;
    setRole("viewer");
    setBoard(structuredClone(emptyBoard));
    setLoading(true);
    setSelected(id);
  }
  async function createWorkspace(title: string) {
    if (!supabase) return false;
    setBusy(true);
    setError("");
    const result = await supabase.rpc("create_workspace", {
      workspace_title: title,
      board_data: structuredClone(emptyBoard),
    });
    setBusy(false);
    if (result.error) {
      setError(result.error.message);
      return false;
    }
    chooseWorkspace(result.data);
    return true;
  }
  return {
    session,
    authReady,
    rows,
    selected,
    setSelected: chooseWorkspace,
    board,
    role,
    busy,
    loading,
    error,
    setError,
    actor,
    save,
    reload,
    createWorkspace,
    demo: !supabase,
  };
}
