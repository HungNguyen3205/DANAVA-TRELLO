import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";
describe("DANAVA board workflows", () => {
  it("creates a task with assignee, two labels and checklist, then edits it", async () => {
    const u = userEvent.setup();
    render(<App />);
    await u.click(screen.getByRole("button", { name: "Tạo công việc" }));
    const modal = screen.getByRole("dialog", { name: "Tạo công việc" });
    await u.type(within(modal).getByLabelText("Tên công việc"), "Kiểm thử mới");
    await u.selectOptions(
      within(modal).getByLabelText("Phụ trách chính"),
      "hung",
    );
    await u.type(
      within(modal).getByLabelText("Nhãn (ngăn cách bằng dấu phẩy)"),
      "Kỹ thuật, QA",
    );
    await u.type(
      within(modal).getByRole("textbox", { name: "Thêm mục checklist" }),
      "Kiểm tra mobile",
    );
    await u.click(
      within(modal).getAllByRole("button", { name: "Thêm", exact: true })[0],
    );
    await u.click(within(modal).getByRole("button", { name: "Lưu công việc" }));
    const card = screen.getByRole("button", {
      name: "Mở công việc: Kiểm thử mới",
    });
    expect(within(card).getByText("QA")).toBeTruthy();
    await u.click(card);
    const details = screen.getByRole("dialog", { name: "Chi tiết công việc" });
    expect(
      (within(details).getByLabelText("Phụ trách chính") as HTMLSelectElement)
        .value,
    ).toBe("hung");
    await u.click(
      within(details).getByRole("checkbox", {
        name: "Hoàn thành: Kiểm tra mobile",
      }),
    );
    await u.selectOptions(within(details).getByLabelText("Trạng thái"), "done");
    await u.click(
      within(details).getByRole("button", { name: "Lưu công việc" }),
    );
    expect(
      within(screen.getByRole("region", { name: "Hoàn thành" })).getByRole(
        "button",
        { name: "Mở công việc: Kiểm thử mới" },
      ),
    ).toBeTruthy();
  });
  it("filters cards and supports mobile menu and persistent theme preference", async () => {
    const u = userEvent.setup();
    render(<App />);
    await u.type(
      screen.getByRole("textbox", { name: "Tìm công việc" }),
      "thanh toán",
    );
    expect(
      screen.getByRole("button", {
        name: "Mở công việc: Kiểm thử thanh toán online",
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: "Mở công việc: Thiết kế lại website danava.vn",
      }),
    ).toBeNull();
    await u.click(screen.getByRole("button", { name: "Bỏ lọc" }));
    await u.selectOptions(
      screen.getByRole("combobox", { name: "Giao diện" }),
      "dark",
    );
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("danava-theme")).toBe("dark");
    await u.click(screen.getByRole("button", { name: "Mở menu" }));
    expect(document.querySelector(".sidebar-open")).toBeTruthy();
    await u.click(
      screen.getAllByRole("button", { name: "Đóng menu", exact: true })[0],
    );
    expect(document.querySelector(".sidebar-open")).toBeNull();
  });
  it("renames a column and preserves custom completion status", async () => {
    const u = userEvent.setup();
    render(<App />);
    await u.click(
      screen.getByRole("button", { name: "Cài đặt cột: Chưa bắt đầu" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Cài đặt cột" });
    await u.clear(within(dialog).getByLabelText("Tên cột"));
    await u.type(within(dialog).getByLabelText("Tên cột"), "Đã xử lý");
    await u.click(
      within(dialog).getByRole("checkbox", {
        name: "Cột này đánh dấu công việc hoàn thành",
      }),
    );
    await u.click(within(dialog).getByRole("button", { name: "Lưu cột" }));
    expect(document.querySelectorAll(".column-done").length).toBe(2);
  });
});
