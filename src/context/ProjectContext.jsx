import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { http, errMsg, KIND_LABEL } from "@/lib/api";

const Ctx = createContext(null);

export function ProjectProvider({ children }) {
  const { pid } = useParams();
  const [project, setProject] = useState(null);
  const [error, setError] = useState(null);
  const [aiOpen, setAiOpen] = useState(null);
  const [chatOpen, setChatOpenState] = useState(() => {
    try {
      const saved = localStorage.getItem("bp:chat-open");
      return saved === null ? true : saved === "true";
    } catch {
      return true;
    }
  });

  const setChatOpen = useCallback((val) => {
    setChatOpenState((prev) => {
      const next = typeof val === "function" ? val(prev) : Boolean(val);
      try {
        localStorage.setItem("bp:chat-open", String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const { data } = await http.get(`/projects/${pid}`);
      setProject(data);
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    }
  }, [pid]);

  useEffect(() => {
    setProject(null);
    refresh();
  }, [refresh]);

  return (
    <Ctx.Provider value={{ pid, project, error, refresh, aiOpen, setAiOpen, chatOpen, setChatOpen }}>
      {children}
    </Ctx.Provider>
  );
}

export const useProject = () => useContext(Ctx);

export function announceImpact(impact) {
  if (!impact) return;
  const parts = [];
  if (impact.artifacts?.length) parts.push(impact.artifacts.map((k) => KIND_LABEL[k]).join(", "));
  if (impact.endpoints) parts.push(`${impact.endpoints} endpoint(s)`);
  if (impact.tasks) parts.push(`${impact.tasks} task(s)`);
  if (impact.tests) parts.push(`${impact.tests} test(s)`);
  if (parts.length) toast.warning(`Flagged for review: ${parts.join(" · ")}`, { duration: 6000 });
}

export function useArtifact(kind) {
  const { pid, refresh } = useProject();
  const [state, setState] = useState({ loading: true, error: null, artifact: null, content: null, approved: null });

  const load = useCallback(async () => {
    try {
      const { data } = await http.get(`/projects/${pid}/artifacts/${kind}`);
      setState({ loading: false, error: null, artifact: data.artifact, content: data.content, approved: data.approved_content });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: errMsg(e) }));
    }
  }, [pid, kind]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const h = (e) => e.detail?.kind === kind && load();
    window.addEventListener("bp:artifact", h);
    return () => window.removeEventListener("bp:artifact", h);
  }, [kind, load]);

  const save = useCallback(async (content, { summary = "", version = true, quiet = false } = {}) => {
    try {
      const { data } = await http.put(`/projects/${pid}/artifacts/${kind}`, { content, summary, version });
      setState((s) => ({ ...s, artifact: data.artifact, content: data.content }));
      if (!quiet) toast.success(version ? `Saved v${data.artifact.current_version}` : "Saved");
      announceImpact(data.impact);
      window.dispatchEvent(new CustomEvent("bp:docs-updated"));
      refresh();
      return data.content;
    } catch (e) {
      toast.error(errMsg(e));
      return null;
    }
  }, [pid, kind, refresh]);

  const approve = useCallback(async (note = "") => {
    try {
      await http.post(`/projects/${pid}/artifacts/${kind}/approve`, { note });
      toast.success(`${KIND_LABEL[kind]} approved`);
      await load();
      window.dispatchEvent(new CustomEvent("bp:docs-updated"));
      refresh();
      return true;
    } catch (e) {
      toast.error(errMsg(e));
      return false;
    }
  }, [pid, kind, load, refresh]);

  const resolveReview = useCallback(async () => {
    await http.post(`/projects/${pid}/artifacts/${kind}/resolve-review`);
    await load();
    refresh();
  }, [pid, kind, load, refresh]);

  return { ...state, setContent: (c) => setState((s) => ({ ...s, content: c })), load, save, approve, resolveReview };
}
