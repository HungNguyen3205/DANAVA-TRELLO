import assert from "node:assert/strict";
import { moveTask, moveColumn, overdue, today } from "../src/lib/board.ts";
import type { Board, Task } from "../src/types/index.ts";
const task = (id: string, col: string): Task => ({
  id,
  columnId: col,
  title: id,
  description: "",
  priority: "Cao",
  labels: [],
  assigneeId: "",
  collaborators: [],
  dueDate: "",
  checklist: [],
  comments: [],
});
const board: Board = {
  title: "Test",
  columns: [
    { id: "a", title: "A" },
    { id: "b", title: "B" },
    { id: "c", title: "Custom completed", completed: true },
  ],
  tasks: [task("1", "a"), task("2", "a"), task("3", "b")],
  users: [],
  activity: [],
};
const snapshot = JSON.stringify(board);
const moved = moveTask(board, "1", "b", "3");
assert.equal(moved.tasks.find((t) => t.id === "1")?.columnId, "b");
assert.deepEqual(
  moved.tasks.map((t) => t.id),
  ["2", "1", "3"],
);
assert.equal(
  JSON.stringify(board),
  snapshot,
  "Original board must remain immutable",
);
assert.equal(moveTask(board, "1", "missing"), board);
assert.equal(moveTask(board, "missing", "a"), board);
assert.equal(
  moveColumn(board, "a", "task-id"),
  board,
  "Dropping on an invalid target must not reorder columns",
);
assert.deepEqual(
  moveColumn(board, "a", "b").columns.map((c) => c.id),
  ["b", "a", "c"],
);
assert.equal(
  moveTask(board, "2", "c").tasks.find((t) => t.id === "2")?.columnId,
  "c",
  "Empty column must accept tasks",
);
assert.equal(
  overdue({ ...task("x", "c"), dueDate: "2000-01-01" }, board),
  false,
  "Custom completed column must not be overdue",
);
assert.equal(
  overdue({ ...task("x", "a"), dueDate: today() }, board),
  false,
  "Today is not overdue for date-only deadlines",
);
assert.equal(
  overdue({ ...task("x", "a"), dueDate: "2000-01-01" }, board),
  true,
);
assert.deepEqual(
  moveTask(board, "1", "a", "2").tasks.map((t) => t.id),
  ["2", "1", "3"],
  "Move down within the same column",
);
assert.deepEqual(
  moveTask(board, "2", "a", "1").tasks.map((t) => t.id),
  ["2", "1", "3"],
  "Move up within the same column",
);
console.log("Board invariants passed (11 checks).");
