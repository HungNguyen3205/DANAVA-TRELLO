export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
const base = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
function csrfToken() {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith("XSRF-TOKEN="))
    ?.split("=")
    .slice(1)
    .join("=");
}
export async function csrf() {
  const response = await fetch(`${base}/sanctum/csrf-cookie`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok)
    throw new ApiError(
      "Không khởi tạo được phiên đăng nhập. Kiểm tra backend Laravel.",
      response.status,
    );
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  try {
    if (!["GET", "HEAD"].includes(method) && !csrfToken()) await csrf();
    const token = csrfToken();
    const response = await fetch(`${base}/api${path}`, {
      method,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { "X-XSRF-TOKEN": decodeURIComponent(token) } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.status === 204) return undefined as T;
    const data = await response
      .json()
      .catch(() => ({ message: "Backend trả về phản hồi không hợp lệ." }));
    if (!response.ok) {
      if (response.status === 401 && !path.startsWith("/auth/"))
        window.dispatchEvent(new Event("session-expired"));
      const detail = data.errors
        ? Object.values(data.errors).flat()[0]
        : data.message;
      throw new ApiError(
        String(detail || "Không thực hiện được yêu cầu."),
        response.status,
      );
    }
    return data as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(
      "Không kết nối được backend Laravel. Hãy khởi động backend và kiểm tra địa chỉ API.",
      0,
    );
  }
}
export interface Account {
  id: number;
  name: string;
  email: string;
}
export interface BoardSummary {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  favorite: boolean;
  visited_at: string | null;
}
export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  color: string;
  role: "owner" | "admin" | "editor" | "viewer";
  boards: BoardSummary[];
}
export interface Member extends Account {
  role: Workspace["role"];
}
