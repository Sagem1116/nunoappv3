import { useRouterState } from "@tanstack/react-router";
import { GlobalSearch } from "./global-search";
import { ThemeSwitcher } from "./theme-switcher";

const titles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/notas": "Notas",
  "/ficheiros": "Ficheiros",
  "/links": "Links",
  "/tarefas": "Tarefas",
  "/financas": "Finanças",
  "/viagens": "Travel Planner",
  "/projetos": "Projetos",
};

export function TopBar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const title = titles[pathname] ?? "Nuno App";

  return (
    <header className="h-16 sticky top-0 z-10 flex items-center justify-between gap-4 px-6 border-b border-border bg-background/60 backdrop-blur-xl">
      <h1 className="text-lg font-medium tracking-wide shrink-0">
        <span className="text-muted-foreground">/</span>{" "}
        <span className="neon-text">{title}</span>
      </h1>
      <div className="flex-1 flex justify-center">
        <GlobalSearch />
      </div>
      <div className="flex items-center gap-3">
        <ThemeSwitcher />
        <div className="text-xs text-muted-foreground hidden md:block">Life OS</div>
      </div>
    </header>
  );
}
