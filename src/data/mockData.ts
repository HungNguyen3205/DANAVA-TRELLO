import type { Board } from "../types";
const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const demoBoard: Board = {
  title: "Kế hoạch DANAVA",
  columns: [
    { id: "todo", title: "Chưa bắt đầu" },
    { id: "in-progress", title: "Đang thực hiện" },
    { id: "review", title: "Chờ duyệt" },
    { id: "done", title: "Hoàn thành", completed: true },
  ],
  users: [
    { id: "hung", name: "Nam Hùng", initials: "NH" },
    { id: "khoa", name: "Anh Khoa", initials: "AK" },
    { id: "nga", name: "Minh Nga", initials: "MN" },
  ],
  tasks: [
    {
      id: "t1",
      columnId: "todo",
      title: "Tổng hợp 100 địa điểm tại Đà Nẵng",
      description:
        "Dữ liệu minh họa. Tổng hợp thông tin liên hệ và nhóm dịch vụ.",
      priority: "Cao",
      labels: ["Kinh doanh"],
      assigneeId: "nga",
      collaborators: [],
      dueDate: day(3),
      checklist: [
        { id: "c1", text: "Thống nhất các trường thông tin", done: true },
        { id: "c2", text: "Kiểm tra thông tin liên hệ", done: false },
      ],
      comments: [],
    },
    {
      id: "t2",
      columnId: "todo",
      title: "Chuẩn bị nội dung DANAVA Studio",
      description: "Dữ liệu minh họa cho bảng công việc.",
      priority: "Bình thường",
      labels: ["Marketing"],
      assigneeId: "khoa",
      collaborators: [],
      dueDate: day(2),
      checklist: [],
      comments: [],
    },
    {
      id: "t3",
      columnId: "in-progress",
      title: "Thiết kế lại website danava.vn",
      description:
        "Tập trung vào trải nghiệm tìm địa điểm và đăng ký trải nghiệm.",
      priority: "Cao",
      labels: ["Sản phẩm"],
      assigneeId: "hung",
      collaborators: [],
      dueDate: day(-1),
      checklist: [
        { id: "c3", text: "Thiết kế bố cục trang chủ", done: true },
        { id: "c4", text: "Kiểm tra giao diện điện thoại", done: false },
      ],
      comments: [],
    },
    {
      id: "t4",
      columnId: "in-progress",
      title: "Kiểm thử thanh toán online",
      description: "Kiểm tra luồng thanh toán và xác nhận giao dịch.",
      priority: "Khẩn cấp",
      labels: ["Kỹ thuật"],
      assigneeId: "hung",
      collaborators: [],
      dueDate: day(1),
      checklist: [],
      comments: [],
    },
    {
      id: "t5",
      columnId: "review",
      title: "Hoàn thiện báo cáo công nợ",
      description: "Dữ liệu mẫu, không phải báo cáo tài chính thực tế.",
      priority: "Bình thường",
      labels: ["Kế toán"],
      assigneeId: "nga",
      collaborators: [],
      dueDate: day(0),
      checklist: [],
      comments: [],
    },
    {
      id: "t6",
      columnId: "done",
      title: "Thống nhất kế hoạch triển khai",
      description: "Công việc minh họa đã hoàn thành.",
      priority: "Thấp",
      labels: ["Quản lý"],
      assigneeId: "khoa",
      collaborators: [],
      dueDate: day(-2),
      checklist: [],
      comments: [],
    },
  ],
  activity: [],
};
export const emptyBoard: Board = {
  ...demoBoard,
  tasks: [],
  users: [],
  activity: [],
};
