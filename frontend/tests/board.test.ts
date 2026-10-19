import { describe, it, expect } from "vitest";
import { moveTask, moveColumn, overdue, today } from "../src/lib/board";
import type { Board, Task } from "../src/types/index";

const createTask = (id: string, col: string): Task => ({
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

describe("Board Invariants and Drag-and-Drop Movement", () => {
  const createTestBoard = (): Board => ({
    title: "Test",
    columns: [
      { id: "a", title: "A" },
      { id: "b", title: "B" },
      { id: "c", title: "Custom completed", completed: true },
    ],
    tasks: [createTask("1", "a"), createTask("2", "a"), createTask("3", "b")],
    users: [],
    activity: [],
  });

  it("moves a task to another column and maintains immutability", () => {
    const board = createTestBoard();
    const snapshot = JSON.stringify(board);
    const moved = moveTask(board, "1", "b", "3");

    expect(moved.tasks.find((t) => t.id === "1")?.columnId).toBe("b");
    expect(moved.tasks.map((t) => t.id)).toEqual(["2", "1", "3"]);
    expect(JSON.stringify(board)).toBe(snapshot);
  });

  it("returns unchanged board when moving non-existent task or to non-existent column", () => {
    const board = createTestBoard();
    expect(moveTask(board, "1", "missing")).toEqual(board);
    expect(moveTask(board, "missing", "a")).toEqual(board);
  });

  it("reorders columns and ignores drops on invalid targets", () => {
    const board = createTestBoard();
    expect(moveColumn(board, "a", "task-id")).toEqual(board);
    expect(moveColumn(board, "a", "b").columns.map((c) => c.id)).toEqual(["b", "a", "c"]);
  });

  it("accepts tasks into an empty column", () => {
    const board = createTestBoard();
    expect(moveTask(board, "2", "c").tasks.find((t) => t.id === "2")?.columnId).toBe("c");
  });

  it("calculates overdue correctly based on completed column status and date", () => {
    const board = createTestBoard();
    expect(overdue({ ...createTask("x", "c"), dueDate: "2000-01-01" }, board)).toBe(false);
    expect(overdue({ ...createTask("x", "a"), dueDate: today() }, board)).toBe(false);
    expect(overdue({ ...createTask("x", "a"), dueDate: "2000-01-01" }, board)).toBe(true);
  });

  it("reorders tasks up and down within the same column", () => {
    const board = createTestBoard();
    expect(moveTask(board, "1", "a", "2").tasks.map((t) => t.id)).toEqual(["2", "1", "3"]);
    expect(moveTask(board, "2", "a", "1").tasks.map((t) => t.id)).toEqual(["2", "1", "3"]);
  });
});
