/* eslint-disable react/only-export-components -- Provider and its context hook are intentionally colocated. */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";
import { api, ApiError } from "../lib/api";
import type { Account } from "../lib/api";
interface Value {
  user: Account | null;
  loading: boolean;
  error: string;
  setUser: (user: Account | null) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}
const AuthContext = createContext<Value | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Account | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setError("");
    try {
      const response = await api<{ user: Account }>("/me");
      setUser(response.user);
    } catch (e) {
      setUser(null);
      if (!(e instanceof ApiError && e.status === 401))
        setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect -- Load the authenticated session from the API.
    void refresh();
    const expired = () => setUser(null);
    window.addEventListener("session-expired", expired);
    return () => window.removeEventListener("session-expired", expired);
  }, [refresh]);
  async function logout() {
    await api("/auth/logout", "POST");
    setUser(null);
  }
  return (
    <AuthContext.Provider
      value={{ user, loading, error, setUser, refresh, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is required");
  return value;
}
