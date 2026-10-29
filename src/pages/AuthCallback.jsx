import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { http } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function AuthCallback() {
  const done = useRef(false);
  const nav = useNavigate();
  const { setUser } = useAuth();
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const sid = new URLSearchParams(window.location.hash.slice(1)).get("session_id");
    http.post("/auth/google/session", { session_id: sid })
      .then(({ data }) => { setUser(data); window.history.replaceState(null, "", "/dashboard"); nav("/dashboard", { replace: true }); })
      .catch(() => { setUser(false); window.history.replaceState(null, "", "/login"); nav("/login", { replace: true, state: { error: "Google sign-in failed. Please try again." } }); });
  }, [nav, setUser]);
  return null;
}
