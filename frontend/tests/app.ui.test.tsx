import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";
import type { Board } from "../src/types";
const user = { id: 1, name: "Nam Hùng", email: "hung@example.com" };
let authenticated: boolean,
  version: number,
  board: Board,
  rejectSave: boolean,
  role: string;
const requests: { path: string; method: string; body: any }[] = [];
beforeEach(() => {
  window.history.replaceState({}, "", "/");
  authenticated = true;
  version = 1;
  rejectSave = false;
  role = "owner";
  requests.length = 0;
  board = {
    title: "Website DANAVA",
    columns: [
      { id: "todo", title: "Chưa bắt đầu" },
      { id: "done", title: "Hoàn thành", completed: true },
    ],
    tasks: [],
    users: [{ id: "1", name: user.name, initials: "NH" }],
    activity: [],
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options: RequestInit = {}) => {
      const path = String(url),
        method = options.method || "GET",
        body = options.body ? JSON.parse(String(options.body)) : undefined;
      requests.push({ path, method, body });
      const response = (value: unknown, status = 200) => ({
        ok: status < 400,
        status,
        json: async () => structuredClone(value),
      });
      if (path === "/sanctum/csrf-cookie") return response(null, 204);
      if (path === "/api/me")
        return authenticated
          ? response({ user })
          : response({ message: "Unauthenticated." }, 401);
      if (path === "/api/auth/login") {
        authenticated = true;
        return response({ user });
      }
      if (path === "/api/auth/logout") {
        authenticated = false;
        return response(null, 204);
      }
      if (path === "/api/workspaces")
        return response({
          workspaces: [
            {
              id: "space",
              name: "Đội sản phẩm",
              description: "Thiết kế và phát triển",
              color: "#567cc2",
              role,
              boards: [
                {
                  id: "board",
                  workspace_id: "space",
                  name: board.title,
                  color: "#567cc2",
                  favorite: false,
                  visited_at: null,
                },
              ],
            },
          ],
        });
      if (path === "/api/workspaces/space/boards")
        return response({ id: "board" }, 201);
      if (path === "/api/boards/board/visit") return response(null, 204);
      if (path === "/api/boards/board") {
        if (method === "PUT") {
          if (rejectSave)
            return response(
              { message: "Bảng đã thay đổi. Tải lại trước khi lưu lại." },
              409,
            );
          board = structuredClone(body.data);
          version++;
        }
        return response({
          id: "board",
          workspace_id: "space",
          role,
          version,
          data: board,
        });
      }
      throw new Error(`Unhandled request: ${method} ${path}`);
    }),
  );
});
describe("Laravel workspace UI flows", () => {
  it("requires login, opens a workspace, creates a board and logs out", async () => {
    authenticated = false;
    const u = userEvent.setup();
    render(<App />);
    await u.type(await screen.findByLabelText("Email"), "hung@example.com");
    await u.type(screen.getByLabelText("Mật khẩu"), "secret1234");
    await u.click(
      screen.getByRole("button", { name: "Đăng nhập", exact: true }),
    );
    await screen.findByText("Chào Hùng, bắt đầu thôi.");
    await u.click(
      (await screen.findAllByRole("link", { name: /Đội sản phẩm/ }))[0],
    );
    await screen.findByRole("heading", { level: 1, name: "Đội sản phẩm" });
    await u.click(screen.getByRole("button", { name: /Tạo bảng mới/ }));
    const modal = screen.getByRole("dialog", { name: "Tạo bảng Kanban" });
    await u.type(within(modal).getByLabelText("Tên bảng"), "Website");
    await u.click(within(modal).getByRole("button", { name: "Tạo mới" }));
    await screen.findByRole("heading", { name: "Website DANAVA" });
    expect(
      requests.find((r) => r.path === "/api/workspaces/space/boards")?.body
        .name,
    ).toBe("Website");
    await u.click(screen.getByRole("button", { name: "Đăng xuất" }));
    await screen.findByRole("heading", { name: "Chào mừng trở lại" });
  });
  it("persists a task with assignee, labels and checklist, then changes its status", async () => {
    window.history.replaceState({}, "", "/boards/board");
    const u = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { name: "Website DANAVA" });
    await u.click(
      screen.getAllByRole("button", { name: "Thêm công việc", exact: true })[0],
    );
    const modal = screen.getByRole("dialog", { name: "Tạo công việc mới" });
    expect(
      within(modal).getByRole("heading", { name: "Nội dung công việc" }),
    ).toBeTruthy();
    expect(
      within(modal).getByRole("heading", { name: "Phân loại & tiến độ" }),
    ).toBeTruthy();
    await u.type(
      within(modal).getByLabelText("Tên công việc"),
      "Thiết kế trang đăng nhập",
    );
    await u.selectOptions(within(modal).getByLabelText("Phụ trách chính"), "1");
    await u.type(within(modal).getByLabelText(/Nhãn công việc/), "UI, QA");
    await u.type(
      within(modal).getByLabelText("Thêm mục checklist"),
      "Kiểm tra mobile",
    );
    await u.click(within(modal).getByRole("button", { name: "Thêm bước" }));
    await u.click(within(modal).getByRole("button", { name: "Tạo công việc" }));
    const card = await screen.findByRole("button", {
      name: "Mở công việc: Thiết kế trang đăng nhập",
    });
    expect(board.tasks[0].assigneeId).toBe("1");
    expect(board.tasks[0].labels).toEqual(["UI", "QA"]);
    expect(board.tasks[0].checklist[0].text).toBe("Kiểm tra mobile");
    await u.click(card);
    const details = screen.getByRole("dialog", { name: "Chi tiết công việc" });
    await u.selectOptions(within(details).getByLabelText("Trạng thái"), "done");
    await u.click(
      within(details).getByRole("button", { name: "Lưu công việc" }),
    );
    await waitFor(() => expect(board.tasks[0].columnId).toBe("done"));
    expect(
      requests.filter((r) => r.method === "PUT").map((r) => r.body.version),
    ).toEqual([1, 2]);
  });
  it("keeps an unsaved draft visible when server reports a version conflict", async () => {
    window.history.replaceState({}, "", "/boards/board");
    const u = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { name: "Website DANAVA" });
    await u.click(
      screen.getAllByRole("button", { name: "Thêm công việc", exact: true })[0],
    );
    const modal = screen.getByRole("dialog", { name: "Tạo công việc mới" });
    await u.type(
      within(modal).getByLabelText("Tên công việc"),
      "Bản nháp cần giữ",
    );
    rejectSave = true;
    await u.click(within(modal).getByRole("button", { name: "Tạo công việc" }));
    await within(modal).findByRole("alert");
    expect(
      (within(modal).getByLabelText("Tên công việc") as HTMLInputElement).value,
    ).toBe("Bản nháp cần giữ");
    expect(board.tasks).toHaveLength(0);
  });
  it("disables writes for viewers and preserves the selected theme", async () => {
    role = "viewer";
    window.history.replaceState({}, "", "/boards/board");
    const u = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { name: "Website DANAVA" });
    for (const b of screen.getAllByRole("button", {
      name: "Thêm công việc",
      exact: true,
    }))
      expect((b as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Đổi tên bảng" })).toBeNull();
    await u.click(
      screen.getByRole("button", { name: "Đổi giao diện sáng tối" }),
    );
    expect(localStorage.getItem("danava-theme")).toBe("light");
    expect(requests.some((r) => r.method === "PUT")).toBe(false);
  });
});
