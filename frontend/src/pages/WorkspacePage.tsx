import { useCallback, useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowUpRight,
  Clock3,
  FolderKanban,
  LayoutGrid,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Star,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "../components/AppHeader";
import { Modal } from "../components/ui/Modal";
import { api } from "../lib/api";
import type { BoardSummary, Member, Workspace } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
const colors = [
  "#df773e",
  "#567cc2",
  "#4b9a83",
  "#8a6abd",
  "#bc6587",
  "#687888",
];
type EditForm = {
  kind: "workspace" | "board" | "settings";
  workspace?: Workspace;
  name: string;
  description: string;
  color: string;
};
export function WorkspacePage() {
  const { workspaceId } = useParams();
  return (
    <DirectoryPage key={workspaceId || "home"} workspaceId={workspaceId} />
  );
}
function DirectoryPage({ workspaceId }: { workspaceId?: string }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const view = workspaceId ? "all" : params.get("view") || "all";
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [form, setForm] = useState<EditForm | null>(null),
    [busy, setBusy] = useState(false),
    [formError, setFormError] = useState(""),
    [memberWorkspace, setMemberWorkspace] = useState<Workspace | null>(null);
  const reload = useCallback(async () => {
    try {
      const data = await api<{ workspaces: Workspace[] }>("/workspaces");
      setWorkspaces(data.workspaces);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect -- Synchronize with remote workspace data.
    void reload();
  }, [reload]);
  const selected = workspaces.find((w) => w.id === workspaceId),
    allBoards = workspaces.flatMap((w) => w.boards);
  const matches = (b: BoardSummary) =>
    b.name.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi"));
  const favorites = allBoards.filter((b) => b.favorite && matches(b));
  const recent = allBoards
    .filter((b) => b.visited_at && matches(b))
    .sort((a, b) => String(b.visited_at).localeCompare(String(a.visited_at)))
    .slice(0, 8);
  function openForm(kind: EditForm["kind"], workspace?: Workspace) {
    setFormError("");
    setForm({
      kind,
      workspace,
      name: kind === "settings" ? workspace!.name : "",
      description: kind === "settings" ? workspace!.description || "" : "",
      color: workspace?.color || colors[0],
    });
  }
  async function favorite(b: BoardSummary) {
    try {
      await api(`/boards/${b.id}/favorite`, "PUT", { favorite: !b.favorite });
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  function cards(boards: BoardSummary[]) {
    return boards.map((b) => (
      <article className="board-tile" key={b.id}>
        <Link to={`/boards/${b.id}`} className="board-tile-link">
          <div className="board-cover" style={{ backgroundColor: b.color }}>
            <div className="cover-columns" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <ArrowUpRight size={19} />
          </div>
          <div className="board-tile-body">
            <strong>{b.name}</strong>
            <small>
              {workspaces.find((w) => w.id === b.workspace_id)?.name}
            </small>
          </div>
        </Link>
        <button
          className={`favorite-button ${b.favorite ? "is-favorite" : ""}`}
          aria-label={`${b.favorite ? "Bỏ" : "Thêm"} yêu thích ${b.name}`}
          onClick={() => void favorite(b)}
        >
          <Star size={17} fill={b.favorite ? "currentColor" : "none"} />
        </button>
      </article>
    ));
  }
  return (
    <div className="workspace-shell">
      <AppHeader>
        <div className="directory-search">
          <Search size={17} />
          <input
            aria-label="Tìm bảng"
            placeholder="Tìm bảng làm việc…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button
          className="primary-button"
          onClick={() => openForm("workspace")}
        >
          <Plus size={17} />
          <span>Tạo không gian</span>
        </button>
      </AppHeader>
      <div className="directory-layout">
        <aside className="directory-sidebar">
          <div className="sidebar-caption">TỔNG QUAN</div>
          <Link
            className={
              !workspaceId && view === "all"
                ? "directory-nav active"
                : "directory-nav"
            }
            to="/"
          >
            <LayoutGrid size={18} />
            Tất cả bảng<span>{allBoards.length}</span>
          </Link>
          <button
            className={`directory-nav ${view === "favorites" ? "active" : ""}`}
            onClick={() => {
              navigate("/?view=favorites");
            }}
          >
            <Star size={18} />
            Đã đánh dấu
          </button>
          <button
            className={`directory-nav ${view === "recent" ? "active" : ""}`}
            onClick={() => {
              navigate("/?view=recent");
            }}
          >
            <Clock3 size={18} />
            Đã xem gần đây
          </button>
          <div className="sidebar-caption workspace-caption">
            KHÔNG GIAN LÀM VIỆC
            <button
              className="icon-button"
              aria-label="Thêm không gian"
              onClick={() => openForm("workspace")}
            >
              <Plus size={16} />
            </button>
          </div>
          {workspaces.map((w) => (
            <Link
              key={w.id}
              className={`directory-nav ${w.id === workspaceId ? "active" : ""}`}
              to={`/workspaces/${w.id}`}
            >
              <span
                className="workspace-initial small"
                style={{ background: w.color }}
              >
                {w.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="workspace-nav-name">{w.name}</span>
              <span>{w.boards.length}</span>
            </Link>
          ))}
          <div className="sidebar-foot">
            <span className="status-dot" />
            Không gian riêng của đội ngũ<p>Mọi công việc, cùng một hướng.</p>
          </div>
        </aside>
        <main className="directory-main">
          <div className="directory-heading">
            <div>
              <span className="eyebrow">KHÔNG GIAN CỦA BẠN</span>
              <h1>
                {selected
                  ? selected.name
                  : `Chào ${user?.name.split(" ").at(-1)}, bắt đầu thôi.`}
              </h1>
              <p>
                {selected
                  ? selected.description ||
                    "Quản lý các bảng và thành viên trong không gian này."
                  : "Một nơi cho dự án, ý tưởng và những việc cần hoàn thành."}
              </p>
            </div>
            <span className="directory-count">
              <FolderKanban size={20} />
              {selected ? selected.boards.length : allBoards.length} bảng
            </span>
          </div>
          {error && (
            <div role="alert" className="inline-error">
              {error}
              <button className="text-button" onClick={() => void reload()}>
                Thử lại
              </button>
            </div>
          )}
          {selected && !loading && (
            <section className="workspace-overview-card">
              <div
                className="workspace-overview-accent"
                style={{ background: selected.color }}
              />
              <div className="workspace-overview-identity">
                <span
                  className="workspace-initial overview-initial"
                  style={{ background: selected.color }}
                >
                  {selected.name.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <span className="eyebrow">THÔNG TIN KHÔNG GIAN</span>
                  <h2>{selected.name}</h2>
                  <p>
                    {selected.description ||
                      "Chưa có mô tả. Hãy thêm mục tiêu hoặc phạm vi dự án để mọi thành viên cùng nắm rõ."}
                  </p>
                </div>
              </div>
              <div className="workspace-overview-stats">
                <div>
                  <FolderKanban size={18} />
                  <span>
                    <strong>{selected.boards.length}</strong>
                    Bảng Kanban
                  </span>
                </div>
                <div>
                  <Star size={18} />
                  <span>
                    <strong>
                      {selected.boards.filter((board) => board.favorite).length}
                    </strong>
                    Đã đánh dấu
                  </span>
                </div>
                <div>
                  <ShieldCheck size={18} />
                  <span>
                    <strong>
                      {selected.role === "owner"
                        ? "Chủ sở hữu"
                        : selected.role === "admin"
                          ? "Quản trị"
                          : selected.role === "viewer"
                            ? "Chỉ xem"
                            : "Chỉnh sửa"}
                    </strong>
                    Quyền của bạn
                  </span>
                </div>
              </div>
              <div className="workspace-overview-actions">
                {selected.role !== "viewer" && (
                  <button
                    className="primary-button"
                    onClick={() => openForm("board", selected)}
                  >
                    <Plus size={16} /> Tạo bảng
                  </button>
                )}
                <button
                  className="secondary-button"
                  onClick={() => setMemberWorkspace(selected)}
                >
                  <Users size={16} /> Thành viên
                </button>
                {["owner", "admin"].includes(selected.role) && (
                  <button
                    className="secondary-button"
                    onClick={() => openForm("settings", selected)}
                  >
                    <Settings2 size={16} /> Cài đặt
                  </button>
                )}
              </div>
            </section>
          )}
          {loading ? (
            <div className="directory-empty">Đang tải không gian…</div>
          ) : (
            <>
              {workspaceId && !selected ? (
                <div className="directory-empty">
                  Không tìm thấy không gian hoặc bạn không còn quyền truy cập.
                  <Link to="/">Về trang chủ</Link>
                </div>
              ) : (
                <>
                  {!workspaceId &&
                    (view === "all" || view === "favorites") &&
                    favorites.length > 0 && (
                      <section className="directory-section">
                        <h2>
                          <Star size={19} />
                          Bảng đã đánh dấu
                        </h2>
                        <div className="boards-grid">{cards(favorites)}</div>
                      </section>
                    )}
                  {!workspaceId &&
                    (view === "all" || view === "recent") &&
                    recent.length > 0 && (
                      <section className="directory-section">
                        <h2>
                          <Clock3 size={19} />
                          Tiếp tục công việc
                        </h2>
                        <div className="boards-grid">
                          {cards(recent.slice(0, view === "all" ? 4 : 8))}
                        </div>
                      </section>
                    )}
                  {view === "all" &&
                    (selected ? [selected] : workspaces).map((w) => (
                      <section
                        key={w.id}
                        className="directory-section workspace-section"
                      >
                        <div className="section-heading">
                          <Link
                            to={`/workspaces/${w.id}`}
                            className="workspace-section-title"
                          >
                            <span
                              className="workspace-initial"
                              style={{ background: w.color }}
                            >
                              {w.name.slice(0, 1).toUpperCase()}
                            </span>
                            <div>
                              <h2>{w.name}</h2>
                              <small>
                                {w.boards.length} bảng ·{" "}
                                {w.role === "owner"
                                  ? "Chủ sở hữu"
                                  : w.role === "admin"
                                    ? "Quản trị viên"
                                    : w.role === "viewer"
                                      ? "Chỉ xem"
                                      : "Thành viên"}
                              </small>
                            </div>
                          </Link>
                          <div className="section-actions">
                            <button
                              className="secondary-button"
                              onClick={() => setMemberWorkspace(w)}
                            >
                              <Users size={15} />
                              Thành viên
                            </button>
                            {["owner", "admin"].includes(w.role) && (
                              <button
                                className="icon-button"
                                aria-label={`Cài đặt ${w.name}`}
                                onClick={() => openForm("settings", w)}
                              >
                                <Settings2 size={17} />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="boards-grid">
                          {cards(w.boards.filter(matches))}
                          {w.role !== "viewer" && !query && (
                            <button
                              className="create-board-tile"
                              onClick={() => openForm("board", w)}
                            >
                              <span>
                                <Plus size={22} />
                              </span>
                              <strong>Tạo bảng mới</strong>
                              <small>Khởi đầu một dự án</small>
                            </button>
                          )}
                        </div>
                        {query && !w.boards.some(matches) && (
                          <p className="help-text">
                            Không có bảng phù hợp với “{query}”.
                          </p>
                        )}
                      </section>
                    ))}
                  {!workspaces.length && !error && (
                    <div className="directory-empty">
                      <FolderKanban size={44} />
                      <h2>Không gian đầu tiên của bạn</h2>
                      <p>
                        Tạo không gian cho đội ngũ, sau đó thêm bảng cho từng dự
                        án.
                      </p>
                      <button
                        className="primary-button"
                        onClick={() => openForm("workspace")}
                      >
                        <Plus size={17} />
                        Tạo không gian làm việc
                      </button>
                    </div>
                  )}
                  {view !== "all" &&
                    (view === "favorites" ? favorites : recent).length ===
                      0 && (
                      <div className="directory-empty">
                        <h2>
                          {view === "favorites"
                            ? "Chưa có bảng được đánh dấu"
                            : "Chưa có bảng đã xem"}
                        </h2>
                        <p>
                          {view === "favorites"
                            ? "Bấm ngôi sao trên một bảng để truy cập nhanh tại đây."
                            : "Mở một bảng để tiếp tục công việc từ trang này."}
                        </p>
                      </div>
                    )}
                </>
              )}
            </>
          )}
        </main>
      </div>
      {form && (
        <Modal
          open
          onClose={() => !busy && setForm(null)}
          title={
            form.kind === "board"
              ? "Tạo bảng Kanban"
              : form.kind === "settings"
                ? "Cài đặt không gian"
                : "Tạo không gian làm việc"
          }
          description={
            form.kind === "board"
              ? `Trong ${form.workspace?.name}`
              : "Sắp xếp các dự án theo đội ngũ hoặc mục tiêu."
          }
        >
          <form
            className="directory-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setFormError("");
              try {
                if (form.kind === "board") {
                  const b = await api<{ id: string }>(
                    `/workspaces/${form.workspace!.id}/boards`,
                    "POST",
                    { name: form.name, color: form.color },
                  );
                  navigate(`/boards/${b.id}`);
                } else {
                  await api(
                    form.kind === "settings"
                      ? `/workspaces/${form.workspace!.id}`
                      : "/workspaces",
                    form.kind === "settings" ? "PATCH" : "POST",
                    {
                      name: form.name,
                      description: form.description,
                      color: form.color,
                    },
                  );
                  await reload();
                }
                setForm(null);
              } catch (e) {
                setFormError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              {form.kind === "board" ? "Tên bảng" : "Tên không gian"}
              <input
                required
                autoFocus
                maxLength={100}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={
                  form.kind === "board"
                    ? "Ví dụ: Website DANAVA"
                    : "Ví dụ: Đội phát triển sản phẩm"
                }
              />
            </label>
            {form.kind !== "board" && (
              <label>
                Mô tả
                <textarea
                  maxLength={1000}
                  rows={3}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </label>
            )}
            <fieldset className="color-picker">
              <legend>Màu nhận diện</legend>
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Màu ${c}`}
                  aria-pressed={form.color === c}
                  style={{ background: c }}
                  onClick={() => setForm({ ...form, color: c })}
                >
                  {form.color === c ? "✓" : ""}
                </button>
              ))}
            </fieldset>
            {formError && (
              <p className="error-message" role="alert">
                {formError}
              </p>
            )}
            <footer className="modal-footer">
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() => setForm(null)}
              >
                Hủy
              </button>
              <button className="primary-button" disabled={busy}>
                {busy
                  ? "Đang lưu…"
                  : form.kind === "settings"
                    ? "Lưu thay đổi"
                    : "Tạo mới"}
              </button>
            </footer>
          </form>
        </Modal>
      )}
      {memberWorkspace && (
        <Members
          workspace={memberWorkspace}
          onClose={() => {
            setMemberWorkspace(null);
            void reload();
          }}
        />
      )}
    </div>
  );
}
function Members({
  workspace,
  onClose,
}: {
  workspace: Workspace;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<Member[]>([]),
    [email, setEmail] = useState(""),
    [role, setRole] = useState("editor"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const admin = ["owner", "admin"].includes(workspace.role);
  const reload = useCallback(async () => {
    try {
      const r = await api<{ members: Member[] }>(
        `/workspaces/${workspace.id}/members`,
      );
      setMembers(r.members);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [workspace.id]);
  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect -- Synchronize with remote workspace data.
    void reload();
  }, [reload]);
  async function change(target: string, nextRole: string) {
    setBusy(true);
    setError("");
    try {
      await api(`/workspaces/${workspace.id}/members`, "PUT", {
        email: target,
        role: nextRole,
      });
      setEmail("");
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Thành viên không gian"
      description={workspace.name}
    >
      <div className="directory-form">
        {loading ? (
          <p>Đang tải thành viên…</p>
        ) : (
          members.map((m) => (
            <div className="member-row" key={m.id}>
              <span className="account-avatar">{m.name[0]}</span>
              <div>
                <strong>{m.name}</strong>
                <small>{m.email}</small>
              </div>
              {admin && m.role !== "owner" ? (
                <select
                  aria-label={`Quyền của ${m.name}`}
                  disabled={busy}
                  value={m.role}
                  onChange={(e) => void change(m.email, e.target.value)}
                >
                  <option value="admin">Quản trị</option>
                  <option value="editor">Chỉnh sửa</option>
                  <option value="viewer">Chỉ xem</option>
                  <option value="remove">Gỡ thành viên</option>
                </select>
              ) : (
                <small>{m.role === "owner" ? "Chủ sở hữu" : m.role}</small>
              )}
            </div>
          ))
        )}
        {admin && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void change(email, role);
            }}
          >
            <h3>Thêm thành viên</h3>
            <p className="help-text">
              Nhập email của người đã đăng ký tài khoản DANAVA WORK. Thành viên
              sẽ truy cập được mọi bảng trong không gian này.
            </p>
            <label>
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Quyền truy cập
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="editor">Chỉnh sửa công việc</option>
                <option value="viewer">Chỉ xem</option>
                <option value="admin">Quản trị không gian</option>
              </select>
            </label>
            <button className="primary-button" disabled={busy || loading}>
              Thêm thành viên
            </button>
          </form>
        )}
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
