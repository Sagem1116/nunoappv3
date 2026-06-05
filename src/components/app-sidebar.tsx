import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  StickyNote,
  FolderOpen,
  Link2,
  CheckSquare,
  Wallet,
  Plane,
  FolderKanban,
  LogOut,
  Sparkles,
  Brain,
  Ticket,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Notas", url: "/notas", icon: StickyNote },
  { title: "Ficheiros", url: "/ficheiros", icon: FolderOpen },
  { title: "Links", url: "/links", icon: Link2 },
  { title: "Tarefas", url: "/tarefas", icon: CheckSquare },
  { title: "Finanças", url: "/financas", icon: Wallet },
  { title: "Travel Planner", url: "/viagens", icon: Plane },
  { title: "Reservas", url: "/reservas", icon: Ticket },
  { title: "Projetos", url: "/projetos", icon: FolderKanban },
  { title: "Nuno AI", url: "/ai", icon: Brain },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { signOut, user } = useAuth();

  return (
    <aside className="hidden md:flex flex-col w-64 shrink-0 h-screen sticky top-0 border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-2 px-5 h-16 border-b border-sidebar-border">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary-glow grid place-items-center shadow-glow">
          <Sparkles className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="font-semibold tracking-wide text-sidebar-foreground">
          Nuno<span className="neon-text"> App</span>
        </span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const active = pathname === item.url || pathname.startsWith(item.url + "/");
          return (
            <Link
              key={item.url}
              to={item.url}
              className={[
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground neon-border"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/40",
              ].join(" ")}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border">
        <div className="px-3 py-2 text-xs text-muted-foreground truncate">
          {user?.email}
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}
