import { useState } from "react";
import { Layers3, LockKeyhole } from "lucide-react";
import { api, csrf } from "../lib/api";
import type { Account } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
export function LoginPage() {
  const { setUser, error: connectionError, refresh } = useAuth();
  const [signup, setSignup] = useState(false),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main className="login-layout">
      <section className="login-story">
        <a className="brand home-brand" href="/">
          <span className="brand-mark">D</span>
          <span>
            DANAVA <small>WORK</small>
          </span>
        </a>
        <div>
          <span className="eyebrow">MỖI DỰ ÁN. MỘT KHÔNG GIAN.</span>
          <h1>
            Cùng một mục tiêu.
            <br />
            Rõ từng công việc.
          </h1>
          <p>
            Tập trung dự án, thành viên và tiến độ vào một nơi. Bắt đầu từ không
            gian làm việc của bạn.
          </p>
          <div className="login-workspace-example">
            <Layers3 />
            <div>
              <strong>Không gian làm việc</strong>
              <span>Dự án → Bảng Kanban → Công việc</span>
            </div>
          </div>
        </div>
        <small>DANAVA WORK · Dành cho đội ngũ của bạn</small>
      </section>
      <section className="login-form-area">
        <form
          className="login-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setBusy(true);
            try {
              await csrf();
              const result = await api<{ user: Account }>(
                signup ? "/auth/register" : "/auth/login",
                "POST",
                signup
                  ? {
                      name,
                      email,
                      password,
                      password_confirmation: confirmation,
                    }
                  : { email, password },
              );
              setUser(result.user);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <span className="login-lock">
            <LockKeyhole size={22} />
          </span>
          <h2>{signup ? "Tạo tài khoản" : "Chào mừng trở lại"}</h2>
          <p>
            {signup
              ? "Tạo tài khoản để bắt đầu không gian đầu tiên."
              : "Đăng nhập để mở không gian làm việc của bạn."}
          </p>
          {connectionError && (
            <div className="inline-error" role="alert">
              {connectionError}
              <button
                type="button"
                className="text-button"
                onClick={() => void refresh()}
              >
                Thử kết nối lại
              </button>
            </div>
          )}
          {signup && (
            <label>
              Họ và tên
              <input
                required
                autoComplete="name"
                value={name}
                maxLength={100}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="ban@danava.vn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Mật khẩu
            <input
              type="password"
              required
              minLength={8}
              autoComplete={signup ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {signup && (
            <label>
              Nhập lại mật khẩu
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </label>
          )}
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button login-submit" disabled={busy}>
            {busy ? "Đang xử lý…" : signup ? "Tạo tài khoản" : "Đăng nhập"}
          </button>
          <div className="login-switch">
            {signup ? "Đã có tài khoản?" : "Chưa có tài khoản?"}{" "}
            <button
              type="button"
              onClick={() => {
                setSignup(!signup);
                setError("");
              }}
            >
              {signup ? "Đăng nhập" : "Đăng ký"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
