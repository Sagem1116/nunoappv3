import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function pickJsonFile(): Promise<unknown | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        const text = await file.text();
        resolve(JSON.parse(text));
      } catch (e) {
        toast.error("Ficheiro JSON inválido");
        resolve(null);
      }
    };
    input.click();
  });
}

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

type Table = "notes" | "links" | "transactions";

const ALLOWED_FIELDS: Record<Table, string[]> = {
  notes: ["title", "content", "tags"],
  links: ["title", "url", "description", "tags"],
  transactions: ["amount", "type", "category", "description", "occurred_at"],
};

export async function exportTable(table: Table) {
  const { data, error } = await supabase.from(table).select("*").order("created_at", { ascending: false });
  if (error) { toast.error(error.message); return; }
  downloadJson(`${table}-${stamp()}.json`, { version: 1, table, exported_at: new Date().toISOString(), items: data ?? [] });
  toast.success(`${(data ?? []).length} item(s) exportados`);
}

export async function importTable(table: Table, userId: string) {
  const parsed = await pickJsonFile();
  if (!parsed) return;
  const items: any[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as any)?.items)
      ? (parsed as any).items
      : [];
  if (!items.length) { toast.error("Sem itens para importar"); return; }
  const allowed = ALLOWED_FIELDS[table];
  const rows = items.map((it) => {
    const row: Record<string, unknown> = { user_id: userId };
    for (const k of allowed) if (it[k] !== undefined && it[k] !== null) row[k] = it[k];
    return row;
  }).filter((r) => allowed.some((k) => r[k] !== undefined));
  if (!rows.length) { toast.error("Estrutura JSON não reconhecida"); return; }
  const { error } = await supabase.from(table).insert(rows as any);
  if (error) { toast.error(error.message); return; }
  toast.success(`${rows.length} item(s) importados`);
}

export function exportData(filename: string, data: unknown) {
  downloadJson(`${filename}-${stamp()}.json`, data);
}
