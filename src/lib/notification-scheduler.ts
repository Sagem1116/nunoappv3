import { supabase } from "@/integrations/supabase/client";
import {
  loadSettings,
  notify,
  getPermissionState,
  hasSent,
  markSent,
} from "./notifications";

interface TaskRow {
  id: string;
  title: string;
  due_date: string | null;
  status: string;
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function checkTasks(userId: string, windowHours: number) {
  const now = Date.now();
  const cutoff = new Date(now + windowHours * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("tasks")
    .select("id,title,due_date,status")
    .eq("user_id", userId)
    .eq("status", "pending")
    .not("due_date", "is", null)
    .lte("due_date", cutoff);
  const tasks = (data ?? []) as TaskRow[];
  for (const t of tasks) {
    if (!t.due_date) continue;
    const dueMs = new Date(t.due_date).getTime();
    if (dueMs < now - 60 * 60 * 1000) continue; // skip very overdue (already past)
    const key = `task:${t.id}:${windowHours}`;
    if (hasSent(key)) continue;
    notify("Tarefa com prazo a chegar", {
      body: `${t.title} — ${new Date(t.due_date).toLocaleString("pt-PT")}`,
      tag: key,
      url: "/tarefas",
    });
    markSent(key);
  }
}

async function checkDaily(userId: string, hour: number) {
  const now = new Date();
  if (now.getHours() < hour) return;
  const key = `daily:${todayKey()}`;
  if (hasSent(key)) return;

  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const [tasksRes, tripsRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "pending")
      .gte("due_date", startOfDay)
      .lte("due_date", endOfDay),
    supabase
      .from("trips")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("start_date", startOfDay.slice(0, 10))
      .lte("start_date", in7days.slice(0, 10)),
  ]);

  const tasksToday = tasksRes.count ?? 0;
  const upcomingTrips = tripsRes.count ?? 0;

  const parts: string[] = [];
  parts.push(`${tasksToday} tarefa(s) hoje`);
  if (upcomingTrips > 0) parts.push(`${upcomingTrips} viagem(ns) próximas`);

  notify("Bom dia! O teu resumo de hoje", {
    body: parts.join(" · "),
    tag: key,
    url: "/dashboard",
  });
  markSent(key);
}

export async function runScheduledChecks(userId: string | undefined) {
  if (!userId) return;
  if (getPermissionState() !== "granted") return;
  const settings = loadSettings();
  if (!settings.enabled) return;
  try {
    if (settings.tasksEnabled) await checkTasks(userId, settings.tasksWindowHours);
    if (settings.dailyEnabled) await checkDaily(userId, settings.dailyHour);
  } catch (e) {
    console.warn("notification scheduler error", e);
  }
}
