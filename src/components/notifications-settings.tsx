import { useEffect, useState } from "react";
import { Bell, BellOff, Check, Send } from "lucide-react";
import {
  DEFAULT_SETTINGS,
  getPermissionState,
  loadSettings,
  notify,
  requestPermission,
  saveSettings,
  type NotificationPermissionState,
  type NotificationSettings,
} from "@/lib/notifications";

export function NotificationsSettings() {
  const [perm, setPerm] = useState<NotificationPermissionState>("default");
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    setPerm(getPermissionState());
    setSettings(loadSettings());
  }, []);

  const update = (patch: Partial<NotificationSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
  };

  const askPermission = async () => {
    const res = await requestPermission();
    setPerm(res);
    if (res === "granted") update({ enabled: true });
  };

  const unsupported = perm === "unsupported";

  return (
    <section className="glass-card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/15 grid place-items-center">
          <Bell className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium">Notificações desktop</h3>
          <p className="text-xs text-muted-foreground">
            Recebe avisos no PC quando a Nuno App está aberta (ou minimizada após instalar).
          </p>
        </div>
      </div>

      {unsupported && (
        <p className="text-xs text-amber-500/90 flex items-center gap-2">
          <BellOff className="h-3.5 w-3.5" /> Este browser não suporta notificações.
        </p>
      )}

      {!unsupported && perm !== "granted" && (
        <button
          type="button"
          onClick={askPermission}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Bell className="h-4 w-4" />
          {perm === "denied" ? "Permissão bloqueada — ativa nas definições do browser" : "Ativar notificações"}
        </button>
      )}

      {!unsupported && perm === "granted" && (
        <>
          <div className="flex items-center gap-2 text-xs text-emerald-500">
            <Check className="h-3.5 w-3.5" /> Notificações ativas neste dispositivo
          </div>

          <label className="flex items-center justify-between gap-3 py-2 border-t border-border/40">
            <div>
              <div className="text-sm font-medium">Mestre — receber notificações</div>
              <div className="text-xs text-muted-foreground">Desliga tudo de uma vez.</div>
            </div>
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => update({ enabled: e.target.checked })}
              className="h-4 w-4 accent-primary"
            />
          </label>

          <label className="flex items-center justify-between gap-3 py-2 border-t border-border/40">
            <div>
              <div className="text-sm font-medium">Tarefas com prazo a chegar</div>
              <div className="text-xs text-muted-foreground">Aviso uma vez por tarefa.</div>
            </div>
            <input
              type="checkbox"
              checked={settings.tasksEnabled}
              onChange={(e) => update({ tasksEnabled: e.target.checked })}
              className="h-4 w-4 accent-primary"
            />
          </label>

          <div className="flex items-center justify-between gap-3 pl-1">
            <span className="text-xs text-muted-foreground">Antecedência</span>
            <select
              value={settings.tasksWindowHours}
              onChange={(e) => update({ tasksWindowHours: Number(e.target.value) })}
              className="text-xs rounded-md bg-input/60 border border-border/60 px-2 py-1"
              disabled={!settings.tasksEnabled}
            >
              <option value={1}>1 hora antes</option>
              <option value={24}>1 dia antes</option>
              <option value={72}>3 dias antes</option>
            </select>
          </div>

          <label className="flex items-center justify-between gap-3 py-2 border-t border-border/40">
            <div>
              <div className="text-sm font-medium">Resumo diário</div>
              <div className="text-xs text-muted-foreground">Uma notificação por dia.</div>
            </div>
            <input
              type="checkbox"
              checked={settings.dailyEnabled}
              onChange={(e) => update({ dailyEnabled: e.target.checked })}
              className="h-4 w-4 accent-primary"
            />
          </label>

          <div className="flex items-center justify-between gap-3 pl-1">
            <span className="text-xs text-muted-foreground">Hora</span>
            <select
              value={settings.dailyHour}
              onChange={(e) => update({ dailyHour: Number(e.target.value) })}
              className="text-xs rounded-md bg-input/60 border border-border/60 px-2 py-1"
              disabled={!settings.dailyEnabled}
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() =>
              notify("Notificação de teste", {
                body: "Está tudo a funcionar 🎉",
                tag: "test",
                url: "/dashboard",
              })
            }
            className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-input/60 hover:bg-input transition-colors"
          >
            <Send className="h-3.5 w-3.5" /> Enviar notificação de teste
          </button>
        </>
      )}
    </section>
  );
}
