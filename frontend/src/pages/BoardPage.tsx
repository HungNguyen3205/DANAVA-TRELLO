import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Columns3,
  History,
  List,
  Pencil,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "../components/AppHeader";
import { KanbanBoard } from "../components/kanban/KanbanBoard";
import { TaskEditor } from "../components/TaskEditor";
import { Modal } from "../components/ui/Modal";
import { useAuth } from "../contexts/AuthContext";
import { useBoard } from "../lib/useBoard";
import { api } from "../lib/api";
import { overdue, today } from "../lib/board";
import type { Board, Column, Task } from "../types";
export function BoardPage() {
  const { boardId } = useParams();
  return <BoardContent key={boardId} id={boardId!} />;
}
function BoardContent({ id }: { id: string }) {
  const { row, error, busy, loading, reload, save } = useBoard(id);
  const { user } = useAuth();
  const [query, setQuery] = useState(""),
    [view, setView] = useState("kanban"),
    [person, setPerson] = useState(""),
    [priority, setPriority] = useState(""),
    [due, setDue] = useState("");
  const [editor, setEditor] = useState<{
      task: Task;
      board: Board;
      version: number;
    } | null>(null),
    [columnEditor, setColumnEditor] = useState<{
      column: Column;
      board: Board;
      version: number;
    } | null>(null),
    [rename, setRename] = useState<{
      title: string;
      board: Board;
      version: number;
    } | null>(null),
    [history, setHistory] = useState(false),
    [editError, setEditError] = useState("");
  useEffect(() => {
    void api(`/boards/${id}/visit`, "POST").catch(() => {});
  }, [id]);
  if (loading)
    return (
      <div className="workspace-shell">
        <AppHeader />
        <div className="directory-empty">Đang tải bảng…</div>
      </div>
    );
  if (!row)
    return (
      <div className="workspace-shell">
        <AppHeader />
        <div className="directory-empty">
          <h1>Không mở được bảng</h1>
          <p role="alert">{error}</p>
          <button className="secondary-button" onClick={() => void reload()}>
            Thử lại
          </button>
          <Link to="/">Về không gian làm việc</Link>
        </div>
      </div>
    );
  const board = row.data,
    readOnly = row.role === "viewer",
    disabled = readOnly || busy;
  const completed = board.tasks.filter(
    (t) => board.columns.find((c) => c.id === t.columnId)?.completed,
  ).length;
  const visible = board.tasks.filter(
    (t) =>
      `${t.title} ${t.description} ${t.labels.join(" ")}`
        .toLocaleLowerCase("vi")
        .includes(query.toLocaleLowerCase("vi")) &&
      (!person ||
        t.assigneeId === person ||
        t.collaborators.includes(person)) &&
      (!priority || t.priority === priority) &&
      (!due || (due === "late" ? overdue(t, board) : t.dueDate === today())),
  );
  function openTask(task: Task) {
    setEditError("");
    setEditor({
      task: structuredClone(task),
      board: structuredClone(board),
      version: row!.version,
    });
  }
  function addTask(columnId: string) {
    if (disabled) return;
    openTask({
      id: crypto.randomUUID(),
      columnId,
      title: "",
      description: "",
      priority: "Bình thường",
      labels: [],
      assigneeId: "",
      collaborators: [],
      dueDate: "",
      checklist: [],
      comments: [],
    });
  }
  function openColumn(column: Column | null) {
    if (disabled) return;
    setEditError("");
    setColumnEditor({
      column: column
        ? { ...column }
        : { id: crypto.randomUUID(), title: "", completed: false },
      board: structuredClone(board),
      version: row!.version,
    });
  }
  async function commit(next: Board, activity: string, version?: number) {
    if (readOnly) return false;
    const ok = await save(next, activity, version);
    if (ok) toast.success("Đã lưu thay đổi");
    return ok;
  }
  return (
    <div className="workspace-shell board-shell">
      <AppHeader>
        <Link
          className="board-breadcrumb"
          to={`/workspaces/${row.workspace_id}`}
        >
          <ArrowLeft size={16} />
          Không gian làm việc
        </Link>
      </AppHeader>
      <main className="board-main">
        <div className="board-page-heading">
          <div>
            <div className="eyebrow">
              BẢNG LÀM VIỆC{" "}
              <span className="board-access">
                {readOnly ? "CHỈ XEM" : "NHÓM RIÊNG TƯ"}
              </span>
            </div>
            <div className="board-title-row">
              <h1>{board.title}</h1>
              {!readOnly && (
                <button
                  className="icon-button"
                  aria-label="Đổi tên bảng"
                  disabled={busy}
                  onClick={() => {
                    setEditError("");
                    setRename({
                      title: board.title,
                      board: structuredClone(board),
                      version: row.version,
                    });
                  }}
                >
                  <Pencil size={17} />
                </button>
              )}
            </div>
            <p>
              {board.tasks.length} công việc · {board.users.length} thành viên ·{" "}
              {completed} hoàn thành
            </p>
          </div>
          <div className="board-heading-actions">
            <div className="member-stack">
              {board.users.slice(0, 4).map((u) => (
                <span className="account-avatar" key={u.id} title={u.name}>
                  {u.initials}
                </span>
              ))}
            </div>
            <button
              className="secondary-button"
              onClick={() => setHistory(true)}
            >
              <History size={17} />
              Hoạt động
            </button>
            <button
              className="primary-button"
              disabled={disabled}
              onClick={() => addTask(board.columns[0].id)}
            >
              <Plus size={17} />
              Thêm công việc
            </button>
          </div>
        </div>
        <div className="board-progress">
          <span
            style={{
              width: `${board.tasks.length ? (completed / board.tasks.length) * 100 : 0}%`,
            }}
          />
        </div>
        <div className="board-toolbar">
          <div className="view-tabs">
            <button
              className={view === "kanban" ? "selected" : ""}
              onClick={() => setView("kanban")}
            >
              <Columns3 size={17} />
              Kanban
            </button>
            <button
              className={view === "list" ? "selected" : ""}
              onClick={() => setView("list")}
            >
              <List size={17} />
              Danh sách
            </button>
          </div>
          <div className="board-filters">
            <div className="directory-search">
              <Search size={16} />
              <input
                aria-label="Tìm công việc"
                placeholder="Tìm công việc…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <select
              aria-label="Lọc thành viên"
              value={person}
              onChange={(e) => setPerson(e.target.value)}
            >
              <option value="">Mọi thành viên</option>
              {board.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Lọc ưu tiên"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="">Mọi ưu tiên</option>
              {["Thấp", "Bình thường", "Cao", "Khẩn cấp"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <select
              aria-label="Lọc hạn"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            >
              <option value="">Mọi thời hạn</option>
              <option value="today">Hôm nay</option>
              <option value="late">Quá hạn</option>
            </select>
            {(query || person || priority || due) && (
              <button
                className="text-button"
                onClick={() => {
                  setQuery("");
                  setPerson("");
                  setPriority("");
                  setDue("");
                }}
              >
                Xóa lọc
              </button>
            )}
            <button
              className="icon-button"
              disabled={busy}
              aria-label="Tải lại bảng"
              onClick={() => void reload()}
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
        {error && (
          <div className="inline-error" role="alert">
            {error}
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                setEditor(null);
                setColumnEditor(null);
                setRename(null);
                void reload();
              }}
            >
              Đóng bản nháp và tải lại
            </button>
          </div>
        )}
        {busy && (
          <div className="saving-indicator" role="status">
            Đang lưu dữ liệu…
          </div>
        )}
        {view === "kanban" ? (
          <KanbanBoard
            board={board}
            visibleTasks={visible}
            onOpen={openTask}
            onAdd={addTask}
            onColumn={openColumn}
            onSave={(b, a) => commit(b, a, row.version)}
            disabled={disabled || !!(query || person || priority || due)}
          />
        ) : (
          <div className="board-table-wrap">
            <table className="board-table">
              <thead>
                <tr>
                  <th>Công việc</th>
                  <th>Trạng thái</th>
                  <th>Phụ trách</th>
                  <th>Ưu tiên</th>
                  <th>Thời hạn</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <button
                        className="table-task-button"
                        onClick={() => openTask(t)}
                      >
                        {board.columns.find((c) => c.id === t.columnId)
                          ?.completed && <CheckCircle2 size={15} />}
                        <strong>{t.title}</strong>
                      </button>
                    </td>
                    <td>
                      {board.columns.find((c) => c.id === t.columnId)?.title}
                    </td>
                    <td>
                      {board.users.find((u) => u.id === t.assigneeId)?.name ||
                        "Chưa phân công"}
                    </td>
                    <td>{t.priority}</td>
                    <td className={overdue(t, board) ? "overdue" : ""}>
                      {t.dueDate || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visible.length && (
              <div className="directory-empty">Không có công việc phù hợp.</div>
            )}
          </div>
        )}
      </main>
      {editor && (
        <TaskEditor
          key={editor.task.id}
          task={editor.task}
          board={editor.board}
          onClose={() => !busy && setEditor(null)}
          onSave={(t) =>
            commit(
              {
                ...editor.board,
                tasks: editor.board.tasks.some((v) => v.id === t.id)
                  ? editor.board.tasks.map((v) => (v.id === t.id ? t : v))
                  : [...editor.board.tasks, t],
              },
              `Lưu công việc: ${t.title}`,
              editor.version,
            )
          }
          onDelete={(t) =>
            commit(
              {
                ...editor.board,
                tasks: editor.board.tasks.filter((v) => v.id !== t.id),
              },
              `Xóa công việc: ${t.title}`,
              editor.version,
            )
          }
          busy={busy}
          readOnly={readOnly}
          actor={user!.name}
          error={error}
        />
      )}{" "}
      {columnEditor && (
        <Modal
          open
          onClose={() => !busy && setColumnEditor(null)}
          title="Cài đặt cột"
          description="Sắp xếp từng bước trong quy trình làm việc."
        >
          <form
            className="directory-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const { column, board: snapshot, version } = columnEditor;
              if (
                await commit(
                  {
                    ...snapshot,
                    columns: snapshot.columns.some((c) => c.id === column.id)
                      ? snapshot.columns.map((c) =>
                          c.id === column.id ? column : c,
                        )
                      : [...snapshot.columns, column],
                  },
                  `Cập nhật cột: ${column.title}`,
                  version,
                )
              )
                setColumnEditor(null);
            }}
          >
            <label>
              Tên cột
              <input
                autoFocus
                required
                maxLength={80}
                value={columnEditor.column.title}
                onChange={(e) =>
                  setColumnEditor({
                    ...columnEditor,
                    column: { ...columnEditor.column, title: e.target.value },
                  })
                }
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={!!columnEditor.column.completed}
                onChange={(e) =>
                  setColumnEditor({
                    ...columnEditor,
                    column: {
                      ...columnEditor.column,
                      completed: e.target.checked,
                    },
                  })
                }
              />
              Công việc trong cột này đã hoàn thành
            </label>
            <p className="help-text">
              Chỉ xóa được cột trống; bảng phải còn ít nhất một cột.
            </p>
            {(error || editError) && (
              <p role="alert" className="error-message">
                {error || editError}
              </p>
            )}
            <footer className="modal-footer">
              {columnEditor.board.columns.some(
                (c) => c.id === columnEditor.column.id,
              ) && (
                <button
                  type="button"
                  className="danger-button"
                  disabled={busy}
                  onClick={async () => {
                    const { column, board: snapshot, version } = columnEditor;
                    if (
                      snapshot.columns.length === 1 ||
                      snapshot.tasks.some((t) => t.columnId === column.id)
                    ) {
                      setEditError(
                        "Hãy chuyển hết công việc sang cột khác và giữ lại ít nhất một cột.",
                      );
                      return;
                    }
                    if (
                      await commit(
                        {
                          ...snapshot,
                          columns: snapshot.columns.filter(
                            (c) => c.id !== column.id,
                          ),
                        },
                        `Xóa cột: ${column.title}`,
                        version,
                      )
                    )
                      setColumnEditor(null);
                  }}
                >
                  Xóa cột trống
                </button>
              )}
              <button className="primary-button" disabled={busy}>
                Lưu cột
              </button>
            </footer>
          </form>
        </Modal>
      )}
      {rename && (
        <Modal
          open
          onClose={() => !busy && setRename(null)}
          title="Đổi tên bảng"
        >
          <form
            className="directory-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await commit(
                  { ...rename.board, title: rename.title },
                  "Đổi tên bảng",
                  rename.version,
                )
              )
                setRename(null);
            }}
          >
            <label>
              Tên bảng
              <input
                required
                maxLength={100}
                value={rename.title}
                onChange={(e) =>
                  setRename({ ...rename, title: e.target.value })
                }
              />
            </label>
            {error && (
              <p role="alert" className="error-message">
                {error}
              </p>
            )}
            <button className="primary-button" disabled={busy}>
              Lưu tên bảng
            </button>
          </form>
        </Modal>
      )}
      {history && (
        <Modal
          open
          onClose={() => setHistory(false)}
          title="Hoạt động của bảng"
          description="Các thay đổi đã được lưu thành công."
        >
          <div className="directory-form">
            {board.activity.length ? (
              board.activity.map((a) => (
                <div className="history-entry" key={a.id}>
                  <span className="status-dot" />
                  <div>
                    <strong>{a.author}</strong>
                    <p>{a.text}</p>
                    <time>{new Date(a.createdAt).toLocaleString("vi-VN")}</time>
                  </div>
                </div>
              ))
            ) : (
              <p className="help-text">Chưa có hoạt động.</p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
