import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { http } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function AuthCallback() {
  const done = useRef(false);
  const nav = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const code = searchParams.get("code");
    const sid = hashParams.get("session_id") || searchParams.get("session_id");

    const onSuccess = ({ data }) => {
      setUser(data);
      window.history.replaceState(null, "", "/dashboard");
      nav("/dashboard", { replace: true });
    };

    const onError = (err) => {
      setUser(false);
      const msg = err?.response?.data?.detail || "Google sign-in failed. Please try again.";
      window.history.replaceState(null, "", "/login");
      nav("/login", { replace: true, state: { error: msg } });
    };

    if (code) {
      const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      const redirect_uri = isLocal
        ? `${window.location.origin}/auth/callback`
        : "https://skemat.online/auth/callback";

      http.post("/auth/google/callback", { code, redirect_uri })
        .then(onSuccess)
        .catch(onError);
    } else if (sid) {
      http.post("/auth/google/session", { session_id: sid })
        .then(onSuccess)
        .catch(onError);
    } else {
      onError({ response: { data: { detail: "No authentication credentials received from Google." } } });
    }
  }, [nav, setUser]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground text-sm">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span>Completing Google sign-in...</span>
      </div>
    </div>
  );
}
