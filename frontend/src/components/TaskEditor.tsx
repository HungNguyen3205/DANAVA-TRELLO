import { useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
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
  onSave: (t: Task) => Promise<boolean>;
  onDelete: (t: Task) => Promise<boolean>;
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
  const update = (value: Partial<Task>) =>
    setDraft((d) => ({ ...d, ...value }));
  async function save() {
    if (!draft.title.trim()) {
      setNotice("Vui lòng nhập tên công việc.");
      return;
    }
    if (
      await onSave({
        ...draft,
        title: draft.title.trim(),
        labels: labelsText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      })
    )
      onClose();
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={
        board.tasks.some((t) => t.id === task.id)
          ? "Chi tiết công việc"
          : "Tạo công việc"
      }
      description="Thông tin, người phụ trách và tiến độ"
      wide
    >
      <form
        className="task-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={readOnly || busy}>
          <label>
            Tên công việc
            <input
              autoFocus
              required
              maxLength={180}
              value={draft.title}
              onChange={(e) => update({ title: e.target.value })}
              placeholder="Cần hoàn thành việc gì?"
            />
          </label>
          <label>
            Mô tả
            <textarea
              rows={3}
              maxLength={5000}
              value={draft.description}
              onChange={(e) => update({ description: e.target.value })}
              placeholder="Mục tiêu, yêu cầu và kết quả cần đạt"
            />
          </label>
          <div className="form-grid">
            <label>
              Trạng thái
              <select
                value={draft.columnId}
                onChange={(e) => update({ columnId: e.target.value })}
              >
                {board.columns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Mức ưu tiên
              <select
                value={draft.priority}
                onChange={(e) =>
                  update({ priority: e.target.value as Task["priority"] })
                }
              >
                {["Thấp", "Bình thường", "Cao", "Khẩn cấp"].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label>
              Phụ trách chính
              <select
                value={draft.assigneeId}
                onChange={(e) =>
                  update({
                    assigneeId: e.target.value,
                    collaborators: draft.collaborators.filter(
                      (id) => id !== e.target.value,
                    ),
                  })
                }
              >
                <option value="">Chưa phân công</option>
                {board.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Hạn hoàn thành
              <input
                type="date"
                value={draft.dueDate}
                onChange={(e) => update({ dueDate: e.target.value })}
              />
            </label>
          </div>
          <label>
            Nhãn (ngăn cách bằng dấu phẩy)
            <input
              value={labelsText}
              onChange={(e) => setLabelsText(e.target.value)}
              placeholder="Marketing, Kỹ thuật"
            />
          </label>
          <div className="collaborators">
            <span>Người phối hợp</span>
            {board.users
              .filter((u) => u.id !== draft.assigneeId)
              .map((u) => (
                <label key={u.id} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={draft.collaborators.includes(u.id)}
                    onChange={(e) =>
                      update({
                        collaborators: e.target.checked
                          ? [...draft.collaborators, u.id]
                          : draft.collaborators.filter((id) => id !== u.id),
                      })
                    }
                  />
                  {u.name}
                </label>
              ))}
          </div>
          <section className="editor-section">
            <h3>
              Checklist{" "}
              <span>
                {draft.checklist.filter((i) => i.done).length}/
                {draft.checklist.length}
              </span>
            </h3>
            {draft.checklist.map((i) => (
              <div key={i.id} className="checklist-row">
                <input
                  type="checkbox"
                  aria-label={`Hoàn thành: ${i.text}`}
                  checked={i.done}
                  onChange={(e) =>
                    update({
                      checklist: draft.checklist.map((v) =>
                        v.id === i.id ? { ...v, done: e.target.checked } : v,
                      ),
                    })
                  }
                />
                <input
                  aria-label="Nội dung checklist"
                  value={i.text}
                  onChange={(e) =>
                    update({
                      checklist: draft.checklist.map((v) =>
                        v.id === i.id ? { ...v, text: e.target.value } : v,
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Xóa checklist: ${i.text}`}
                  onClick={() =>
                    update({
                      checklist: draft.checklist.filter((v) => v.id !== i.id),
                    })
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <div className="inline-form">
              <input
                aria-label="Thêm mục checklist"
                value={item}
                onChange={(e) => setItem(e.target.value)}
                placeholder="Thêm một bước cần làm"
              />
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  if (item.trim()) {
                    update({
                      checklist: [
                        ...draft.checklist,
                        {
                          id: crypto.randomUUID(),
                          text: item.trim(),
                          done: false,
                        },
                      ],
                    });
                    setItem("");
                  }
                }}
              >
                <Plus size={16} />
                Thêm
              </button>
            </div>
          </section>
          <section className="editor-section">
            <h3>Bình luận</h3>
            {draft.comments.map((c) => (
              <div className="comment" key={c.id}>
                <strong>{c.author}</strong>
                <time>
                  {new Date(c.createdAt).toLocaleString("vi-VN", {
                    timeZone: "Asia/Ho_Chi_Minh",
                  })}
                </time>
                <p>{c.body}</p>
              </div>
            ))}
            <div className="inline-form">
              <input
                aria-label="Nội dung bình luận"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Trao đổi về công việc"
                maxLength={2000}
              />
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  if (comment.trim()) {
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
                }}
              >
                Thêm
              </button>
            </div>
            <p className="help-text">
              Các thay đổi và bình luận được ghi nhận khi bấm Lưu.
            </p>
          </section>
        </fieldset>
        {(notice || error) && (
          <p role="alert" className="error-message">
            {notice || error}
          </p>
        )}
        <footer className="modal-footer">
          {!readOnly && board.tasks.some((t) => t.id === task.id) && (
            <button
              type="button"
              className="danger-button"
              disabled={busy}
              onClick={() => setConfirm(true)}
            >
              <Trash2 size={16} />
              Xóa
            </button>
          )}
          <div className="footer-spacer" />
          <button type="button" className="secondary-button" onClick={onClose}>
            Đóng
          </button>
          {!readOnly && (
            <button className="primary-button" disabled={busy}>
              <Check size={16} />
              {busy ? "Đang lưu…" : "Lưu công việc"}
            </button>
          )}
        </footer>
      </form>
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Xóa công việc?"
        description="Công việc sẽ bị xóa khỏi bảng."
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
