import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { TopBar } from "@/components/top-bar";
import { runWeeklyAutoExports } from "@/lib/data-io";
import { runScheduledChecks } from "@/lib/notification-scheduler";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth", replace: true });
  }, [loading, session, navigate]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (session) {
      void runWeeklyAutoExports();
      const t = setInterval(() => { void runWeeklyAutoExports(); }, 60 * 60 * 1000);
      return () => clearInterval(t);
    }
  }, [session]);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    void runScheduledChecks(uid);
    const t = setInterval(() => { void runScheduledChecks(uid); }, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [session?.user?.id]);

  if (loading || !session) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="neon-text text-sm tracking-widest animate-pulse">CARREGANDO</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex w-full">
      <AppSidebar mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar onMenuClick={() => setMobileMenuOpen((prev) => !prev)} />
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
