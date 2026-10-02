import { useState } from "react";
import type { ReactNode } from "react";
import {
  AlignLeft,
  CalendarDays,
  Check,
  CheckSquare2,
  CircleDot,
  MessageSquare,
  Plus,
  Tag,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";
import type { Board, Task } from "../types";
import { Modal } from "./ui/Modal";

export function TaskEditor({
  task,
  board,
  onClose,
  onSave,
  onDelete,
  busy,
  readOnly,
  actor,
  error,
}: {
  task: Task;
  board: Board;
  onClose: () => void;
  onSave: (task: Task) => Promise<boolean>;
  onDelete: (task: Task) => Promise<boolean>;
  busy: boolean;
  readOnly: boolean;
  actor: string;
  error?: string;
}) {
  const [draft, setDraft] = useState<Task>(structuredClone(task));
  const [labelsText, setLabelsText] = useState(task.labels.join(", "));
  const [item, setItem] = useState("");
  const [comment, setComment] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState("");
  const exists = board.tasks.some((value) => value.id === task.id);
  const checklistDone = draft.checklist.filter((value) => value.done).length;
  const checklistProgress = draft.checklist.length
    ? Math.round((checklistDone / draft.checklist.length) * 100)
    : 0;
  const update = (value: Partial<Task>) =>
    setDraft((current) => ({ ...current, ...value }));

  async function save() {
    if (!draft.title.trim()) {
      setNotice("Vui lòng nhập tên công việc.");
      return;
    }
    setNotice("");
    const saved = await onSave({
      ...draft,
      title: draft.title.trim(),
      labels: labelsText
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    });
    if (saved) onClose();
  }

  function addChecklistItem() {
    if (!item.trim()) return;
    update({
      checklist: [
        ...draft.checklist,
        { id: crypto.randomUUID(), text: item.trim(), done: false },
      ],
    });
    setItem("");
  }

  function addComment() {
    if (!comment.trim()) return;
    update({
      comments: [
        ...draft.comments,
        {
          id: crypto.randomUUID(),
          author: actor,
          body: comment.trim(),
          createdAt: new Date().toISOString(),
        },
      ],
    });
    setComment("");
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={exists ? "Chi tiết công việc" : "Tạo công việc mới"}
      description="Điền đầy đủ thông tin trong một biểu mẫu duy nhất"
      wide
    >
      <form
        className="task-form task-editor-form"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={readOnly || busy} className="task-editor-layout">
          <div className="task-editor-main">
            <section className="task-editor-panel">
              <SectionHeading
                icon={<AlignLeft size={17} />}
                title="Nội dung công việc"
                detail="Tên, mục tiêu và kết quả cần hoàn thành"
              />
              <label className="task-title-field">
                Tên công việc <span aria-hidden="true">*</span>
                <input
                  autoFocus
                  aria-label="Tên công việc"
                  required
                  maxLength={180}
                  value={draft.title}
                  onChange={(event) => update({ title: event.target.value })}
                  placeholder="Ví dụ: Hoàn thiện giao diện trang đăng nhập"
                />
              </label>
              <label>
                Mô tả chi tiết
                <textarea
                  aria-label="Mô tả chi tiết"
                  rows={7}
                  maxLength={5000}
                  value={draft.description}
                  onChange={(event) =>
                    update({ description: event.target.value })
                  }
                  placeholder="Mục tiêu, yêu cầu, tài liệu liên quan và kết quả bàn giao…"
                />
              </label>
            </section>

            <section className="task-editor-panel">
              <div className="checklist-heading-row">
                <SectionHeading
                  icon={<CheckSquare2 size={17} />}
                  title="Các bước thực hiện"
                  detail={`${checklistDone}/${draft.checklist.length} mục hoàn thành`}
                />
                <strong>{checklistProgress}%</strong>
              </div>
              <div className="checklist-progress" aria-hidden="true">
                <span style={{ width: `${checklistProgress}%` }} />
              </div>
              {draft.checklist.map((value) => (
                <div key={value.id} className="checklist-row">
                  <input
                    type="checkbox"
                    aria-label={`Hoàn thành: ${value.text}`}
                    checked={value.done}
                    onChange={(event) =>
                      update({
                        checklist: draft.checklist.map((current) =>
                          current.id === value.id
                            ? { ...current, done: event.target.checked }
                            : current,
                        ),
                      })
                    }
                  />
                  <input
                    aria-label="Nội dung checklist"
                    value={value.text}
                    onChange={(event) =>
                      update({
                        checklist: draft.checklist.map((current) =>
                          current.id === value.id
                            ? { ...current, text: event.target.value }
                            : current,
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Xóa checklist: ${value.text}`}
                    onClick={() =>
                      update({
                        checklist: draft.checklist.filter(
                          (current) => current.id !== value.id,
                        ),
                      })
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              <div className="inline-form task-add-row">
                <input
                  aria-label="Thêm mục checklist"
                  value={item}
                  onChange={(event) => setItem(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addChecklistItem();
                    }
                  }}
                  placeholder="Thêm một bước cần làm…"
                />
                <button
                  type="button"
                  className="secondary-button"
                  onClick={addChecklistItem}
                >
                  <Plus size={16} /> Thêm bước
                </button>
              </div>
            </section>

            <section className="task-editor-panel">
              <SectionHeading
                icon={<MessageSquare size={17} />}
                title="Trao đổi"
                detail="Bình luận được lưu cùng công việc"
              />
              <div className="task-comments-list">
                {draft.comments.length ? (
                  draft.comments.map((value) => (
                    <article className="comment" key={value.id}>
                      <span className="comment-avatar">
                        {value.author.slice(0, 1).toUpperCase()}
                      </span>
                      <div>
                        <header>
                          <strong>{value.author}</strong>
                          <time>
                            {new Date(value.createdAt).toLocaleString("vi-VN", {
                              timeZone: "Asia/Ho_Chi_Minh",
                            })}
                          </time>
                        </header>
                        <p>{value.body}</p>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="task-empty-note">Chưa có trao đổi nào.</p>
                )}
              </div>
              <div className="inline-form task-add-row">
                <input
                  aria-label="Nội dung bình luận"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addComment();
                    }
                  }}
                  placeholder="Viết bình luận hoặc ghi chú bàn giao…"
                  maxLength={2000}
                />
                <button
                  type="button"
                  className="secondary-button"
                  onClick={addComment}
                >
                  Thêm bình luận
                </button>
              </div>
              <p className="help-text">
                Checklist và bình luận được ghi nhận khi bấm Lưu công việc.
              </p>
            </section>
          </div>

          <aside className="task-editor-sidebar">
            <section className="task-editor-panel">
              <SectionHeading
                compact
                icon={<CircleDot size={17} />}
                title="Phân loại & tiến độ"
                detail="Cập nhật một lần tại đây"
              />
              <label>
                <FieldTitle icon={<CircleDot size={14} />} title="Trạng thái" />
                <select
                  aria-label="Trạng thái"
                  value={draft.columnId}
                  onChange={(event) => update({ columnId: event.target.value })}
                >
                  {board.columns.map((column) => (
                    <option key={column.id} value={column.id}>
                      {column.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <FieldTitle icon={<Tag size={14} />} title="Mức ưu tiên" />
                <select
                  aria-label="Mức ưu tiên"
                  value={draft.priority}
                  onChange={(event) =>
                    update({ priority: event.target.value as Task["priority"] })
                  }
                >
                  {["Thấp", "Bình thường", "Cao", "Khẩn cấp"].map(
                    (priority) => (
                      <option key={priority}>{priority}</option>
                    ),
                  )}
                </select>
              </label>
              <label>
                <FieldTitle
                  icon={<UserRound size={14} />}
                  title="Phụ trách chính"
                />
                <select
                  aria-label="Phụ trách chính"
                  value={draft.assigneeId}
                  onChange={(event) =>
                    update({
                      assigneeId: event.target.value,
                      collaborators: draft.collaborators.filter(
                        (id) => id !== event.target.value,
                      ),
                    })
                  }
                >
                  <option value="">Chưa phân công</option>
                  {board.users.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <FieldTitle
                  icon={<CalendarDays size={14} />}
                  title="Hạn hoàn thành"
                />
                <input
                  aria-label="Hạn hoàn thành"
                  type="date"
                  value={draft.dueDate}
                  onChange={(event) => update({ dueDate: event.target.value })}
                />
              </label>
              <label>
                <FieldTitle icon={<Tag size={14} />} title="Nhãn công việc" />
                <input
                  aria-label="Nhãn công việc"
                  value={labelsText}
                  onChange={(event) => setLabelsText(event.target.value)}
                  placeholder="UI/UX, Backend, Khẩn cấp"
                />
                <small>Ngăn cách các nhãn bằng dấu phẩy.</small>
              </label>
            </section>

            <section className="task-editor-panel">
              <SectionHeading
                compact
                icon={<UsersRound size={17} />}
                title="Người phối hợp"
                detail="Có thể chọn nhiều thành viên"
              />
              <div className="collaborator-list">
                {board.users
                  .filter((member) => member.id !== draft.assigneeId)
                  .map((member) => (
                    <label key={member.id} className="collaborator-option">
                      <input
                        type="checkbox"
                        checked={draft.collaborators.includes(member.id)}
                        onChange={(event) =>
                          update({
                            collaborators: event.target.checked
                              ? [...draft.collaborators, member.id]
                              : draft.collaborators.filter(
                                  (id) => id !== member.id,
                                ),
                          })
                        }
                      />
                      <span className="collaborator-avatar">
                        {member.initials}
                      </span>
                      <span>{member.name}</span>
                    </label>
                  ))}
                {!board.users.length && (
                  <p className="task-empty-note">
                    Thêm thành viên vào không gian để phân công.
                  </p>
                )}
              </div>
            </section>
          </aside>
        </fieldset>

        {(notice || error) && (
          <p role="alert" className="error-message task-editor-error">
            {notice || error}
          </p>
        )}
        <footer className="modal-footer task-editor-footer">
          {!readOnly && exists && (
            <button
              type="button"
              className="danger-button"
              disabled={busy}
              onClick={() => setConfirm(true)}
            >
              <Trash2 size={16} /> Xóa công việc
            </button>
          )}
          <div className="footer-spacer" />
          {readOnly && <span className="read-only-note">Chế độ chỉ xem</span>}
          <button type="button" className="secondary-button" onClick={onClose}>
            Đóng
          </button>
          {!readOnly && (
            <button className="primary-button" disabled={busy}>
              <Check size={16} />
              {busy ? "Đang lưu…" : exists ? "Lưu công việc" : "Tạo công việc"}
            </button>
          )}
        </footer>
      </form>

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Xóa công việc?"
        description="Công việc, checklist và bình luận sẽ bị xóa khỏi bảng."
      >
        <div className="modal-body">
          <p>{draft.title}</p>
          <div className="modal-footer">
            <button
              className="secondary-button"
              onClick={() => setConfirm(false)}
            >
              Giữ lại
            </button>
            <button
              className="danger-button"
              disabled={busy}
              onClick={async () => {
                if (await onDelete(task)) {
                  setConfirm(false);
                  onClose();
                }
              }}
            >
              Xóa công việc
            </button>
          </div>
        </div>
      </Modal>
    </Modal>
  );
}

function SectionHeading({
  icon,
  title,
  detail,
  compact = false,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  compact?: boolean;
}) {
  return (
    <div className={`task-section-heading ${compact ? "compact" : ""}`}>
      <span className="task-section-icon">{icon}</span>
      <div>
        <h3>{title}</h3>
        <p>{detail}</p>
      </div>
    </div>
  );
}

function FieldTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <span className="field-label-icon">
      {icon} {title}
    </span>
  );
}
