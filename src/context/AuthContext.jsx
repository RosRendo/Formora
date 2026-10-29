import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { http } from "@/lib/api";

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const check = useCallback(async () => {
    try {
      const { data } = await http.get("/auth/me");
      setUser(data);
    } catch {
      setUser(false);
    }
  }, []);

  useEffect(() => {
    // Skip /me while returning from Google; AuthCallback exchanges the session first.
    if (window.location.hash?.includes("session_id=")) return;
    check();
  }, [check]);

  const logout = async () => {
    await http.post("/auth/logout").catch(() => {});
    setUser(false);
  };

  return <Ctx.Provider value={{ user, setUser, logout, check }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
