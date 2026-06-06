import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Plus, Trash2, Pencil, X, Wallet, TrendingUp, TrendingDown, Search,
  Download, Upload,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Field, inputCls } from "@/routes/_app.notas";
import { exportTable, importTable } from "@/lib/data-io";

export const Route = createFileRoute("/_app/financas")({
  component: FinancasPage,
});

type TxType = "income" | "expense";
interface Tx {
  id: string;
  amount: number;
  type: TxType;
  category: string;
  description: string;
  occurred_at: string;
  created_at: string;
}

const CATEGORIES = [
  "comida", "transportes", "lazer", "casa", "saúde",
  "trabalho", "compras", "educação", "outros",
];

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(v);

function FinancasPage() {
  const { user } = useAuth();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tx | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | TxType>("all");
  const [filterCat, setFilterCat] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("transactions").select("*").order("occurred_at", { ascending: false });
    setTxs(((data as any[]) ?? []).map((t) => ({ ...t, amount: Number(t.amount) })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    let income = 0, expense = 0;
    for (const t of txs) {
      if (t.type === "income") income += t.amount;
      else expense += t.amount;
    }
    return { income, expense, balance: income - expense };
  }, [txs]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    txs.filter((t) => t.type === "expense").forEach((t) =>
      map.set(t.category, (map.get(t.category) ?? 0) + t.amount),
    );
    return Array.from(map, ([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [txs]);

  const monthly = useMemo(() => {
    const map = new Map<string, { month: string; income: number; expense: number }>();
    for (const t of txs) {
      const m = t.occurred_at.slice(0, 7);
      const row = map.get(m) ?? { month: m, income: 0, expense: 0 };
      if (t.type === "income") row.income += t.amount;
      else row.expense += t.amount;
      map.set(m, row);
    }
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [txs]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return txs.filter((t) => {
      if (filterType !== "all" && t.type !== filterType) return false;
      if (filterCat !== "all" && t.category !== filterCat) return false;
      if (!q) return true;
      return t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
    });
  }, [txs, search, filterType, filterCat]);

  const remove = async (id: string) => {
    if (!confirm("Eliminar transação?")) return;
    await supabase.from("transactions").delete().eq("id", id);
    setTxs((prev) => prev.filter((t) => t.id !== id));
  };

  const handleSave = async (data: Omit<Tx, "id" | "created_at">) => {
    if (!user) return;
    if (editing) {
      const { data: upd } = await supabase
        .from("transactions").update(data).eq("id", editing.id).select().single();
      if (upd) setTxs((prev) => prev.map((t) =>
        t.id === editing.id ? { ...(upd as any), amount: Number((upd as any).amount) } : t,
      ));
    } else {
      const { data: ins } = await supabase
        .from("transactions").insert({ ...data, user_id: user.id }).select().single();
      if (ins) setTxs((prev) => [{ ...(ins as any), amount: Number((ins as any).amount) }, ...prev]);
    }
    setOpen(false);
    setEditing(null);
  };

  const NEON = "hsl(var(--primary))";
  const NEON_GLOW = "#ff8a3d";
  const PIE_COLORS = ["#ff7a18", "#ff9248", "#ffaa6b", "#ffc28e", "#ffd9b1", "#ffe8cc", "#ffb380", "#ff944d", "#e85d1a"];

  return (
    <div className="page-enter space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold neon-text">Finanças</h1>
          <p className="text-sm text-muted-foreground">Controla as tuas entradas e gastos.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => exportTable("transactions")}
            className="inline-flex items-center gap-2 px-3 py-2.5 rounded-lg bg-input border border-border text-xs hover:border-primary/50"
          >
            <Download className="h-3.5 w-3.5" /> Exportar JSON
          </button>
          <button
            onClick={async () => { if (user) { await importTable("transactions", user.id); await load(); } }}
            className="inline-flex items-center gap-2 px-3 py-2.5 rounded-lg bg-input border border-border text-xs hover:border-primary/50"
          >
            <Upload className="h-3.5 w-3.5" /> Importar JSON
          </button>
          <button
            onClick={() => { setEditing(null); setOpen(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-medium text-sm hover:shadow-glow-strong transition-all"
          >
            <Plus className="h-4 w-4" /> Nova transação
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Wallet} label="Saldo total" value={fmt(stats.balance)}
          accent={stats.balance >= 0 ? "text-primary" : "text-destructive"} />
        <StatCard icon={TrendingUp} label="Entradas" value={fmt(stats.income)} accent="text-emerald-400" />
        <StatCard icon={TrendingDown} label="Gastos" value={fmt(stats.expense)} accent="text-orange-400" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-4">Gastos por categoria</h3>
          {byCategory.length === 0 ? (
            <EmptyChart label="Sem gastos registados" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95}
                  paddingAngle={2} stroke="hsl(var(--background))">
                  {byCategory.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  formatter={(v: number) => fmt(v)}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
          {byCategory.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {byCategory.map((c, i) => (
                <span key={c.name} className="text-[11px] flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-border">
                  <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  {c.name}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card p-5">
          <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-4">Evolução mensal</h3>
          {monthly.length === 0 ? (
            <EmptyChart label="Sem dados" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={monthly}>
                <defs>
                  <filter id="glow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  formatter={(v: number) => fmt(v)}
                />
                <Line type="monotone" dataKey="income" stroke="#34d399" strokeWidth={2} dot={{ r: 3 }} name="Entradas" />
                <Line type="monotone" dataKey="expense" stroke={NEON_GLOW} strokeWidth={2.5} dot={{ r: 3 }}
                  filter="url(#glow)" name="Gastos" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar descrição..."
            className="w-full pl-10 pr-3 py-2 rounded-lg bg-input border border-border focus:border-primary focus:outline-none text-sm" />
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)}
          className={inputCls + " md:w-40"}>
          <option value="all">Todos os tipos</option>
          <option value="income">Entradas</option>
          <option value="expense">Gastos</option>
        </select>
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
          className={inputCls + " md:w-48"}>
          <option value="all">Todas categorias</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-muted-foreground text-sm">A carregar...</div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Wallet className="h-10 w-10 mx-auto text-primary/60 mb-3" />
          <p className="text-muted-foreground">Sem transações.</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Data</th>
                <th className="text-left px-4 py-3">Descrição</th>
                <th className="text-left px-4 py-3">Categoria</th>
                <th className="text-right px-4 py-3">Valor</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-t border-border/50 hover:bg-accent/30 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {new Date(t.occurred_at).toLocaleDateString("pt-PT")}
                  </td>
                  <td className="px-4 py-3">{t.description || <span className="text-muted-foreground italic">—</span>}</td>
                  <td className="px-4 py-3">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent border border-primary/30">
                      {t.category}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right font-mono font-medium ${t.type === "income" ? "text-emerald-400" : "text-orange-400"}`}>
                    {t.type === "income" ? "+" : "−"}{fmt(t.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1 opacity-60 hover:opacity-100">
                      <button onClick={() => { setEditing(t); setOpen(true); }}
                        className="p-1.5 rounded hover:bg-accent hover:text-primary">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => remove(t.id)}
                        className="p-1.5 rounded hover:bg-destructive/20 hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <TxDialog
          initial={editing}
          onClose={() => { setOpen(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, accent,
}: { icon: typeof Wallet; label: string; value: string; accent: string }) {
  return (
    <div className="glass-card glass-card-hover p-5 flex items-center gap-4">
      <div className="h-12 w-12 rounded-xl grid place-items-center bg-gradient-to-br from-primary/20 to-primary-glow/10 border border-primary/30">
        <Icon className={`h-5 w-5 ${accent}`} />
      </div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold ${accent} font-mono`}>{value}</div>
      </div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return <div className="h-[260px] grid place-items-center text-sm text-muted-foreground">{label}</div>;
}

function TxDialog({
  initial, onClose, onSave,
}: {
  initial: Tx | null;
  onClose: () => void;
  onSave: (d: { amount: number; type: TxType; category: string; description: string; occurred_at: string }) => Promise<void>;
}) {
  const [amount, setAmount] = useState(initial?.amount.toString() ?? "");
  const [type, setType] = useState<TxType>(initial?.type ?? "expense");
  const [category, setCategory] = useState(initial?.category ?? "outros");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [date, setDate] = useState(initial?.occurred_at ?? new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = parseFloat(amount.replace(",", "."));
    if (!v || v <= 0) return;
    setBusy(true);
    await onSave({ amount: v, type, category, description: description.trim(), occurred_at: date });
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm grid place-items-center p-4">
      <form onSubmit={submit} className="glass-card neon-border w-full max-w-md p-6 space-y-4 page-enter">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold neon-text">
            {initial ? "Editar transação" : "Nova transação"}
          </h3>
          <button type="button" onClick={onClose} className="p-1 hover:text-primary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setType("expense")}
            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
              type === "expense" ? "bg-orange-500/20 border-orange-500/60 text-orange-300 shadow-glow" : "border-border text-muted-foreground hover:border-primary/40"
            }`}>
            <TrendingDown className="h-4 w-4 inline mr-1" /> Gasto
          </button>
          <button type="button" onClick={() => setType("income")}
            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
              type === "income" ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-300" : "border-border text-muted-foreground hover:border-primary/40"
            }`}>
            <TrendingUp className="h-4 w-4 inline mr-1" /> Entrada
          </button>
        </div>

        <Field label="Valor (€)">
          <input autoFocus value={amount} inputMode="decimal"
            onChange={(e) => setAmount(e.target.value)} placeholder="0,00"
            className={inputCls} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoria">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Data">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </Field>
        </div>

        <Field label="Descrição">
          <input value={description} maxLength={200}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Opcional"
            className={inputCls} />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm hover:bg-accent">
            Cancelar
          </button>
          <button type="submit" disabled={busy || !amount}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-primary to-primary-glow text-primary-foreground hover:shadow-glow-strong disabled:opacity-50">
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}
