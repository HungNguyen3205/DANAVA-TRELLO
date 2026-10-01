import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCheck,
  CheckSquare,
  ChevronLeft,
  CircleHelp,
  LayoutDashboard,
  List,
  Menu,
  Moon,
  Plus,
  Search,
  Sun,
  Users,
  X,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { KanbanBoard } from "./components/kanban/KanbanBoard";
import { TaskEditor } from "./components/TaskEditor";
import { Modal } from "./components/ui/Modal";
import { useWorkspace } from "./lib/useWorkspace";
import { logActivity, overdue, today } from "./lib/board";
import { supabase } from "./lib/supabase";
import type { Board, Column, Task } from "./types";
import "./App.css";

export default function App() {
  const w = useWorkspace();
  const { board } = w;
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("danava-theme") || "system";
    } catch {
      return "system";
    }
  });
  const [mobile, setMobile] = useState(false),
    [panel, setPanel] = useState(() => window.innerWidth >= 1100),
    [view, setView] = useState("board"),
    [section, setSection] = useState("board");
  const [search, setSearch] = useState(""),
    [person, setPerson] = useState(""),
    [priority, setPriority] = useState(""),
    [due, setDue] = useState("");
  const [edit, setEdit] = useState<Task | null>(null),
    [column, setColumn] = useState<Column | null | undefined>(undefined),
    [members, setMembers] = useState(false),
    [settings, setSettings] = useState(false);
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [inviteRole, setInviteRole] = useState("editor"),
    [permissionRows, setPermissionRows] = useState<
      { email: string; role: string }[]
    >([]);
  const [newBoard, setNewBoard] = useState(false),
    [boardTitle, setBoardTitle] = useState("");
  const editable = w.role !== "viewer" && !w.loading;
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      document.documentElement.classList.toggle(
        "dark",
        theme === "dark" || (theme === "system" && media.matches),
      );
    apply();
    media.addEventListener("change", apply);
    try {
      localStorage.setItem("danava-theme", theme);
    } catch {}
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    if (members && supabase && w.selected) {
      void supabase
        .from("workspace_members")
        .select("email,role")
        .eq("workspace_id", w.selected)
        .then(({ data, error }) => {
          if (error) toast.error("Không tải được danh sách quyền");
          else setPermissionRows(data || []);
        });
    }
  }, [members, w.selected]);
  const tasks = useMemo(
    () =>
      board.tasks.filter(
        (t) =>
          (!search ||
            `${t.title} ${t.description} ${t.labels.join(" ")}`
              .toLocaleLowerCase("vi")
              .includes(search.toLocaleLowerCase("vi"))) &&
          (!person ||
            t.assigneeId === person ||
            t.collaborators.includes(person)) &&
          (!priority || t.priority === priority) &&
          (!due ||
            (due === "late" ? overdue(t, board) : t.dueDate === today())) &&
          (section !== "mine" || t.assigneeId === person),
      ),
    [board, search, person, priority, due, section],
  );
  const done = board.tasks.filter(
      (t) => board.columns.find((c) => c.id === t.columnId)?.completed,
    ).length,
    late = board.tasks.filter((t) => overdue(t, board)).length;
  async function commit(next: Board, text: string) {
    const result = await w.save(logActivity(next, text, w.actor));
    if (result) toast.success(w.demo ? "Đã cập nhật bản demo" : "Đã lưu");
    return result;
  }
  function addTask(columnId: string) {
    if (!editable) return;
    setEdit({
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
  function clearFilters() {
    setSearch("");
    setPerson("");
    setPriority("");
    setDue("");
    setSection("board");
  }
  const filtered = !!search || !!person || !!priority || !!due;
  if (!w.authReady)
    return <div className="auth-screen">Đang kiểm tra đăng nhập…</div>;
  if (!w.demo && !w.session)
    return (
      <>
        <Toaster richColors />
        <AuthScreen />
      </>
    );
  function nav(id: string) {
    setSection(id);
    setMobile(false);
    if (id === "mine") {
      setPerson(board.users[0]?.id || "");
      setView("list");
    } else setPerson("");
  }
  return (
    <div className="app-shell">
      <Toaster richColors position="bottom-right" />
      <aside className={`sidebar ${mobile ? "sidebar-open" : ""}`}>
        <div className="brand">
          <span className="brand-mark">D</span>
          <div>
            DANAVA<span>WORKSPACE</span>
          </div>
          <button
            className="icon-button mobile-only"
            onClick={() => setMobile(false)}
            aria-label="Đóng menu"
          >
            <X size={20} />
          </button>
        </div>
        <p className="nav-caption">KHÔNG GIAN LÀM VIỆC</p>
        <nav>
          <button
            className={section === "overview" ? "active" : ""}
            onClick={() => nav("overview")}
          >
            <LayoutDashboard size={19} />
            Tổng quan
          </button>
          <button
            className={section === "mine" ? "active" : ""}
            onClick={() => nav("mine")}
          >
            <CheckSquare size={19} />
            Việc theo người
          </button>
          <button
            className={section === "board" ? "active" : ""}
            onClick={() => nav("board")}
          >
            <List size={19} />
            Bảng công việc
            <span className="nav-count">{board.tasks.length}</span>
          </button>
          <button
            onClick={() => {
              setName("");
              setMembers(true);
              setMobile(false);
            }}
          >
            <Users size={19} />
            Thành viên
          </button>
        </nav>
        <p className="nav-caption">BẢNG HIỆN TẠI</p>
        {w.demo ? (
          <div className="workspace-item">Kế hoạch DANAVA · Demo</div>
        ) : (
          <>
            <select
              disabled={w.busy}
              aria-label="Chọn bảng"
              value={w.selected || ""}
              onChange={(e) => {
                setEdit(null);
                w.setSelected(e.target.value);
              }}
            >
              {w.rows.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
            <button className="add-card" onClick={() => setNewBoard(true)}>
              <Plus size={16} />
              Tạo bảng riêng
            </button>
          </>
        )}
        <div className="sidebar-bottom">
          <button className="nav-settings" onClick={() => setSettings(true)}>
            <CircleHelp size={18} />
            Cài đặt & hướng dẫn
          </button>
          <div className="profile">
            <span className="avatar">
              {w.demo ? "DM" : w.actor.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <strong>{w.demo ? "Dữ liệu mẫu" : w.actor}</strong>
              <small>
                {w.demo
                  ? "Không lưu sau khi tải lại"
                  : w.role === "viewer"
                    ? "Chỉ xem"
                    : w.role === "admin"
                      ? "Quản trị"
                      : "Thành viên"}
              </small>
            </div>
          </div>
          {!w.demo && (
            <button
              className="text-button"
              onClick={() => void supabase!.auth.signOut()}
            >
              Đăng xuất
            </button>
          )}
        </div>
      </aside>
      {mobile && (
        <button
          className="sidebar-backdrop"
          onClick={() => setMobile(false)}
          aria-label="Đóng menu"
        />
      )}
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-only"
              onClick={() => setMobile(true)}
              aria-label="Mở menu"
            >
              <Menu size={21} />
            </button>
            <span>Không gian DANAVA</span>
            <span>/</span>
            <strong>Công việc</strong>
          </div>
          <div className="top-actions">
            <select
              className="theme-select"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              aria-label="Giao diện"
            >
              <option value="system">Theo hệ thống</option>
              <option value="light">Sáng</option>
              <option value="dark">Tối</option>
            </select>
            <button
              className="icon-button"
              aria-label="Chuyển sáng tối"
              onClick={() =>
                setTheme(
                  document.documentElement.classList.contains("dark")
                    ? "light"
                    : "dark",
                )
              }
            >
              {document.documentElement.classList.contains("dark") ? (
                <Sun size={18} />
              ) : (
                <Moon size={18} />
              )}
            </button>
            <button
              className="primary-button"
              disabled={
                !editable ||
                w.busy ||
                !board.columns.length ||
                (!w.demo && !w.selected)
              }
              onClick={() => addTask(board.columns[0].id)}
            >
              <Plus size={18} />
              <span>Tạo công việc</span>
            </button>
          </div>
        </header>
        <div className="page-heading">
          <div>
            <div className="eyebrow">DANAVA / WORK</div>
            <h1>
              {section === "overview"
                ? "Tổng quan công việc"
                : section === "mine"
                  ? "Công việc theo người"
                  : board.title}
            </h1>
            <p>
              {board.tasks.length} công việc · {board.users.length} người trong
              danh sách phân công
            </p>
          </div>
          <div className="heading-avatars">
            {board.users.slice(0, 4).map((u) => (
              <span className="avatar" title={u.name} key={u.id}>
                {u.initials}
              </span>
            ))}
            <button
              className="icon-button"
              aria-label="Quản lý thành viên"
              onClick={() => {
                setName("");
                setMembers(true);
              }}
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
        {w.demo && (
          <div className="demo-banner">
            <CircleHelp size={17} />
            <span>
              <strong>Dữ liệu mẫu.</strong> Thao tác để trải nghiệm; dữ liệu sẽ
              đặt lại khi tải trang. Kết nối Supabase để lưu và làm việc nhóm.
            </span>
          </div>
        )}
        {w.error && (
          <div role="alert" className="error-banner">
            <span>{w.error}</span>
            <button
              className="secondary-button"
              onClick={() => void w.reload()}
            >
              Tải lại bảng
            </button>
          </div>
        )}
        <div className="stats-row">
          {[
            {
              label: "Tổng công việc",
              value: board.tasks.length,
              icon: <List size={18} />,
              style: "",
            },
            {
              label: "Chưa hoàn thành",
              value: board.tasks.length - done,
              icon: <CheckSquare size={18} />,
              style: "",
            },
            {
              label: "Quá hạn",
              value: late,
              icon: <CalendarDays size={18} />,
              style: "stat-alert",
            },
            {
              label: "Hoàn thành",
              value: done,
              icon: <CheckCheck size={18} />,
              style: "stat-done",
            },
          ].map((s) => (
            <div className={`stat ${s.style}`} key={s.label}>
              <div>
                {s.label}
                {s.icon}
              </div>
              <strong>{s.value.toString().padStart(2, "0")}</strong>
            </div>
          ))}
        </div>
        {!w.demo && !w.selected && !w.loading ? (
          <div className="empty-workspace">
            <h2>Bắt đầu với một bảng riêng</h2>
            <p>Bảng chỉ hiển thị cho bạn và các email được cấp quyền.</p>
            <button
              className="primary-button"
              onClick={() => setNewBoard(true)}
            >
              <Plus size={18} />
              Tạo bảng công việc
            </button>
          </div>
        ) : (
          <>
            <div className="toolbar">
              <div className="view-tabs">
                <button
                  className={view === "board" ? "selected" : ""}
                  onClick={() => setView("board")}
                >
                  <LayoutDashboard size={16} />
                  Kanban
                </button>
                <button
                  className={view === "list" ? "selected" : ""}
                  onClick={() => setView("list")}
                >
                  <List size={16} />
                  Danh sách
                </button>
              </div>
              <div className="filter-controls">
                <div className="search-box">
                  <Search size={17} />
                  <input
                    aria-label="Tìm công việc"
                    placeholder="Tìm công việc…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select
                  aria-label="Lọc người phụ trách"
                  value={person}
                  onChange={(e) => setPerson(e.target.value)}
                >
                  <option value="">Tất cả người</option>
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
                  <option value="late">Quá hạn</option>
                  <option value="today">Hôm nay</option>
                </select>
                {filtered && (
                  <button className="text-button" onClick={clearFilters}>
                    Bỏ lọc
                  </button>
                )}
                <button
                  className="icon-button"
                  onClick={() => setPanel(!panel)}
                  aria-label={
                    panel ? "Ẩn lịch và hoạt động" : "Mở lịch và hoạt động"
                  }
                >
                  <CalendarDays size={18} />
                </button>
              </div>
            </div>
            {filtered && (
              <p className="filter-note">
                {tasks.length} kết quả. Bỏ bộ lọc để sắp xếp bằng kéo thả.
              </p>
            )}
            <div className="workspace-layout">
              <div className="board-area" aria-busy={w.busy}>
                {w.loading && !board.tasks.length ? (
                  <p className="loading-state">Đang tải bảng…</p>
                ) : view === "board" && section !== "overview" ? (
                  <KanbanBoard
                    board={board}
                    visibleTasks={tasks}
                    onOpen={setEdit}
                    onAdd={addTask}
                    onColumn={(c) => {
                      if (editable) {
                        setColumn(c);
                        setName(c?.title || "");
                      }
                    }}
                    onSave={commit}
                    disabled={!editable || w.busy || filtered}
                  />
                ) : (
                  <TaskList board={board} tasks={tasks} onOpen={setEdit} />
                )}
              </div>
              {panel && (
                <aside className="right-panel">
                  <div className="panel-title">
                    <h2>Lịch công việc</h2>
                    <button
                      className="icon-button"
                      onClick={() => setPanel(false)}
                      aria-label="Đóng lịch"
                    >
                      <ChevronLeft size={16} />
                    </button>
                  </div>
                  <Calendar />
                  <h3>Sắp đến hạn</h3>
                  <div className="upcoming">
                    {board.tasks
                      .filter(
                        (t) =>
                          t.dueDate &&
                          !board.columns.find((c) => c.id === t.columnId)
                            ?.completed,
                      )
                      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
                      .slice(0, 4)
                      .map((t) => (
                        <button key={t.id} onClick={() => setEdit(t)}>
                          <span
                            className={
                              overdue(t, board) ? "due-bar late" : "due-bar"
                            }
                          />
                          <span>
                            <strong>{t.title}</strong>
                            <small>
                              {t.dueDate.split("-").reverse().join("/")}
                            </small>
                          </span>
                        </button>
                      ))}
                  </div>
                  <h3>Hoạt động gần đây</h3>
                  {board.activity.length ? (
                    board.activity.slice(0, 5).map((a) => (
                      <div className="activity" key={a.id}>
                        <span />
                        <div>
                          <p>{a.text}</p>
                          <small>
                            {a.author} ·{" "}
                            {new Date(a.createdAt).toLocaleTimeString("vi-VN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: "Asia/Ho_Chi_Minh",
                            })}
                          </small>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="help-text">
                      Chưa có hoạt động. Bắt đầu bằng một công việc mới.
                    </p>
                  )}
                </aside>
              )}
            </div>
          </>
        )}
      </main>
      {edit && (
        <TaskEditor
          key={edit.id}
          task={edit}
          board={board}
          actor={w.actor}
          error={w.error}
          readOnly={!editable}
          busy={w.busy}
          onClose={() => setEdit(null)}
          onSave={async (task) => {
            const existing = board.tasks.find((t) => t.id === task.id);
            if (
              (!existing && edit.title) ||
              (existing && JSON.stringify(existing) !== JSON.stringify(edit))
            ) {
              toast.error(
                "Công việc này đã thay đổi. Đóng và mở lại để lấy bản mới; hãy sao chép nội dung đang nhập trước.",
              );
              return false;
            }
            return commit(
              {
                ...board,
                tasks: existing
                  ? board.tasks.map((t) => (t.id === task.id ? task : t))
                  : [...board.tasks, task],
              },
              `Cập nhật: ${task.title}`,
            );
          }}
          onDelete={async (task) =>
            commit(
              { ...board, tasks: board.tasks.filter((t) => t.id !== task.id) },
              `Xóa: ${task.title}`,
            )
          }
        />
      )}
      <Modal
        open={column !== undefined}
        onClose={() => setColumn(undefined)}
        title={column ? "Cài đặt cột" : "Thêm cột"}
      >
        <form
          className="modal-body"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            const next = column
              ? board.columns.map((c) =>
                  c.id === column.id ? { ...column, title: name.trim() } : c,
                )
              : [
                  ...board.columns,
                  { id: crypto.randomUUID(), title: name.trim() },
                ];
            if (await commit({ ...board, columns: next }, "Cập nhật các cột"))
              setColumn(undefined);
          }}
        >
          <label>
            Tên cột
            <input
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          {column && (
            <>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={!!column.completed}
                  onChange={(e) =>
                    setColumn({ ...column, completed: e.target.checked })
                  }
                />
                Cột này đánh dấu công việc hoàn thành
              </label>
              <p className="help-text">
                Chỉ xóa được cột trống. Chuyển công việc sang cột khác trước.
              </p>
            </>
          )}
          <div className="modal-footer">
            {column && (
              <button
                type="button"
                className="danger-button"
                disabled={
                  w.busy ||
                  board.columns.length < 2 ||
                  board.tasks.some((t) => t.columnId === column.id)
                }
                onClick={async () => {
                  if (
                    await commit(
                      {
                        ...board,
                        columns: board.columns.filter(
                          (c) => c.id !== column.id,
                        ),
                      },
                      `Xóa cột: ${column.title}`,
                    )
                  )
                    setColumn(undefined);
                }}
              >
                Xóa cột trống
              </button>
            )}
            <button className="primary-button" disabled={w.busy}>
              Lưu cột
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        open={members}
        onClose={() => setMembers(false)}
        title="Thành viên & phân công"
        description="Danh sách phân công và quyền truy cập được quản lý riêng."
      >
        <div className="modal-body">
          <h3>Danh sách phân công</h3>
          {board.users.map((u) => (
            <div className="member-row" key={u.id}>
              <span className="avatar">{u.initials}</span>
              <span>{u.name}</span>
              {editable && (
                <button
                  className="icon-button"
                  aria-label={`Bỏ người phân công: ${u.name}`}
                  onClick={() =>
                    void commit(
                      {
                        ...board,
                        users: board.users.filter((v) => v.id !== u.id),
                        tasks: board.tasks.map((t) => ({
                          ...t,
                          assigneeId: t.assigneeId === u.id ? "" : t.assigneeId,
                          collaborators: t.collaborators.filter(
                            (id) => id !== u.id,
                          ),
                        })),
                      },
                      `Bỏ người phân công: ${u.name}`,
                    )
                  }
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
          {editable && (
            <form
              className="inline-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!name.trim()) return;
                if (
                  await commit(
                    {
                      ...board,
                      users: [
                        ...board.users,
                        {
                          id: crypto.randomUUID(),
                          name: name.trim(),
                          initials: name
                            .trim()
                            .split(/\s+/)
                            .slice(-2)
                            .map((s) => s[0])
                            .join("")
                            .toUpperCase(),
                        },
                      ],
                    },
                    "Thêm người phân công",
                  )
                )
                  setName("");
              }}
            >
              <input
                aria-label="Tên người phân công"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Họ tên"
                maxLength={80}
              />
              <button className="secondary-button" disabled={w.busy}>
                Thêm
              </button>
            </form>
          )}
          {!w.demo && (
            <>
              <h3 className="section-space">Quyền truy cập bảng</h3>
              <p className="help-text">
                Email được cấp quyền đăng nhập bằng tài khoản Supabase của họ.
                Thao tác này không gửi email.
              </p>
              {permissionRows.map((r) => (
                <div className="permission-row" key={r.email}>
                  <span>{r.email}</span>
                  <small>{r.role}</small>
                </div>
              ))}
              {w.role === "admin" && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const result = await supabase!.rpc("set_workspace_member", {
                      workspace: w.selected,
                      member_email: email.trim().toLowerCase(),
                      member_role: inviteRole,
                    });
                    if (result.error) toast.error(result.error.message);
                    else {
                      toast.success("Đã cấp quyền");
                      setPermissionRows((r) =>
                        inviteRole === "remove"
                          ? r.filter(
                              (i) => i.email !== email.trim().toLowerCase(),
                            )
                          : [
                              ...r.filter(
                                (i) => i.email !== email.trim().toLowerCase(),
                              ),
                              {
                                email: email.trim().toLowerCase(),
                                role: inviteRole,
                              },
                            ],
                      );
                      setEmail("");
                    }
                  }}
                >
                  <label>
                    Email
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </label>
                  <label>
                    Quyền
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                    >
                      <option value="editor">Chỉnh sửa bảng</option>
                      <option value="viewer">Chỉ xem</option>
                      <option value="remove">Thu hồi quyền</option>
                    </select>
                  </label>
                  <button className="primary-button">Áp dụng quyền</button>
                </form>
              )}
            </>
          )}
        </div>
      </Modal>
      <Modal
        open={settings}
        onClose={() => setSettings(false)}
        title="Cài đặt & hướng dẫn"
      >
        <div className="modal-body">
          <label>
            Giao diện
            <select value={theme} onChange={(e) => setTheme(e.target.value)}>
              <option value="system">Theo hệ thống</option>
              <option value="light">Sáng</option>
              <option value="dark">Tối</option>
            </select>
          </label>
          <p>
            Bấm thẻ để chỉnh sửa. Kéo bằng biểu tượng tay nắm để sắp xếp. Dùng
            trường Trạng thái trong chi tiết để chuyển cột trên điện thoại.
          </p>
          <p>
            {w.demo
              ? "Bản demo không lưu dữ liệu sau khi tải lại. Xem README để cấu hình Supabase và sử dụng bảng dùng chung."
              : "Dữ liệu được lưu khi bạn bấm Lưu. Nếu có xung đột, tải lại bảng để lấy phiên bản mới trước khi thử lại."}
          </p>
          <p className="help-text">
            Bản này hỗ trợ mô tả, phân công, checklist và bình luận. Tệp đính
            kèm chưa được triển khai.
          </p>
        </div>
      </Modal>
      <Modal
        open={newBoard}
        onClose={() => setNewBoard(false)}
        title="Tạo bảng riêng"
      >
        <form
          className="modal-body"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!boardTitle.trim()) return;
            if (await w.createWorkspace(boardTitle.trim())) {
              setNewBoard(false);
              setBoardTitle("");
            }
          }}
        >
          <label>
            Tên bảng
            <input
              required
              maxLength={100}
              value={boardTitle}
              onChange={(e) => setBoardTitle(e.target.value)}
            />
          </label>
          <p className="help-text">
            Bảng mới trống; bạn là quản trị viên. Thêm tên vào danh sách phân
            công, rồi cấp quyền cho email cần tham gia.
          </p>
          <button className="primary-button" disabled={w.busy}>
            Tạo bảng
          </button>
        </form>
      </Modal>
    </div>
  );
}
function TaskList({
  board,
  tasks,
  onOpen,
}: {
  board: Board;
  tasks: Task[];
  onOpen: (t: Task) => void;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Công việc</th>
            <th>Trạng thái</th>
            <th>Phụ trách</th>
            <th>Hạn</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id}>
              <td>
                <button className="table-task" onClick={() => onOpen(t)}>
                  {t.title}
                  <small>
                    {t.priority} · {t.labels.join(", ")}
                  </small>
                </button>
              </td>
              <td>{board.columns.find((c) => c.id === t.columnId)?.title}</td>
              <td>
                {board.users.find((u) => u.id === t.assigneeId)?.name ||
                  "Chưa giao"}
              </td>
              <td className={overdue(t, board) ? "overdue" : ""}>
                {t.dueDate ? t.dueDate.split("-").reverse().join("/") : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!tasks.length && (
        <div className="column-empty">Không có công việc phù hợp.</div>
      )}
    </div>
  );
}
function Calendar() {
  const iso = today();
  const [y, m, d] = iso.split("-").map(Number);
  const count = new Date(y, m, 0).getDate(),
    offset = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  return (
    <div className="mini-calendar">
      <strong>
        Tháng {m}, {y}
      </strong>
      <div>
        {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((v) => (
          <span className="calendar-weekday" key={v}>
            {v}
          </span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {Array.from({ length: count }, (_, i) => (
          <span key={i} className={i + 1 === d ? "calendar-today" : ""}>
            {i + 1}
          </span>
        ))}
      </div>
    </div>
  );
}
function AuthScreen() {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [signup, setSignup] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <main className="auth-screen">
      <form
        className="auth-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMessage("");
          try {
            const r = signup
              ? await supabase!.auth.signUp({ email, password })
              : await supabase!.auth.signInWithPassword({ email, password });
            if (r.error) setMessage(r.error.message);
            else if (signup && !r.data.session)
              setMessage("Kiểm tra email để xác nhận tài khoản rồi đăng nhập.");
          } catch {
            setMessage("Không kết nối được máy chủ. Vui lòng thử lại.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <span className="brand-mark">D</span>
        <h1>DANAVA WORK</h1>
        <p>
          {signup
            ? "Tạo tài khoản"
            : "Đăng nhập để vào các bảng được cấp quyền"}
        </p>
        <label>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <label>
          Mật khẩu
          <input
            type="password"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={signup ? "new-password" : "current-password"}
          />
        </label>
        {message && <p role="alert">{message}</p>}
        <button className="primary-button" disabled={busy}>
          {busy ? "Đang xử lý…" : signup ? "Tạo tài khoản" : "Đăng nhập"}
        </button>
        <button
          type="button"
          className="text-button"
          onClick={() => setSignup(!signup)}
        >
          {signup ? "Đã có tài khoản? Đăng nhập" : "Chưa có tài khoản? Đăng ký"}
        </button>
      </form>
    </main>
  );
}
