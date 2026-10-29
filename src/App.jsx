import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ProjectProvider } from "@/context/ProjectContext";
import AppShell from "@/components/layout/AppShell";
import { PageLoading } from "@/components/common";
import Login from "@/pages/Login";
import AuthCallback from "@/pages/AuthCallback";
import Dashboard from "@/pages/Dashboard";
import Projects from "@/pages/Projects";
import NewProject from "@/pages/NewProject";
import Overview from "@/pages/Overview";
import Brief from "@/pages/Brief";
import Requirements from "@/pages/Requirements";
import Features from "@/pages/Features";
import TechStack from "@/pages/TechStack";
import Architecture from "@/pages/Architecture";
import DatabaseDesigner from "@/pages/DatabaseDesigner";
import ApiExplorer from "@/pages/ApiExplorer";
import ModuleDocs from "@/pages/ModuleDocs";
import Roadmap from "@/pages/Roadmap";
import DecisionLog from "@/pages/DecisionLog";
import ProjectSettings from "@/pages/ProjectSettings";
import LaterPhase from "@/pages/LaterPhase";

function Protected({ children }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (user === null) return <PageLoading />;
  if (user === false) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  return children;
}

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protected><AppShell /></Protected>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/new" element={<NewProject />} />
      </Route>
      <Route path="/p/:pid" element={<Protected><ProjectProvider><AppShell /></ProjectProvider></Protected>}>
        <Route index element={<Overview />} />
        <Route path="brief" element={<Brief />} />
        <Route path="requirements" element={<Requirements />} />
        <Route path="features" element={<Features />} />
        <Route path="stack" element={<TechStack />} />
        <Route path="architecture" element={<Architecture />} />
        <Route path="database" element={<DatabaseDesigner />} />
        <Route path="api" element={<ApiExplorer />} />
        <Route path="docs" element={<ModuleDocs />} />
        <Route path="roadmap" element={<Roadmap />} />
        <Route path="decisions" element={<DecisionLog />} />
        <Route path="settings" element={<ProjectSettings />} />
        <Route path=":later" element={<LaterPhase />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <AuthProvider>
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
        <Toaster position="bottom-right" />
      </AuthProvider>
    </ThemeProvider>
  );
}
