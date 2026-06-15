import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  Check,
  ChevronRight,
  Download,
  FileText,
  FolderPlus,
  HelpCircle,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { RichNoteEditor } from "@/components/rich-note-editor";

export const Route = createFileRoute("/_app/estudos/ri")({ component: RIPage });

type ReviewStatus = "unreviewed" | "correct" | "incorrect";
type NoteType = "notes" | "material" | "reflection";
type Module = { id: string; title: string; position: number; created_at: string };
type Note = {
  id: string;
  module_id: string;
  title: string;
  content: string;
  content_type: NoteType;
  position: number;
};
type Question = {
  id: string;
  module_id: string;
  question: string;
  answer: string;
  review_status: ReviewStatus;
  position: number;
};
type Section = NoteType | "tests";

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-ring";
const exportSchema = z.object({
  version: z.literal(1),
  area: z.literal("relacoes-internacionais"),
  modules: z.array(
    z.object({
      title: z.string().min(1).max(120),
      position: z.number().int(),
      notes: z.array(
        z.object({
          title: z.string().min(1).max(160),
          content: z.string(),
          content_type: z.enum(["notes", "material", "reflection"]).default("notes"),
          position: z.number().int(),
        }),
      ),
      questions: z.array(
        z.object({
          question: z.string().min(1).max(2000),
          answer: z.string().min(1).max(5000),
          review_status: z.enum(["unreviewed", "correct", "incorrect"]),
          position: z.number().int(),
        }),
      ),
    }),
  ),
});

function RIPage() {
  const { user } = useAuth();
  const [modules, setModules] = useState<Module[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [section, setSection] = useState<Section>("notes");
  const [loading, setLoading] = useState(true);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const [moduleResult, noteResult, questionResult] = await Promise.all([
      supabase.from("ri_modules").select("*").order("position"),
      supabase.from("ri_notes").select("*").order("position"),
      supabase.from("ri_questions").select("*").order("position"),
    ]);
    const error = moduleResult.error || noteResult.error || questionResult.error;
    if (error) toast.error("Não foi possível carregar Relações Internacionais.");
    setModules((moduleResult.data as Module[]) ?? []);
    setNotes((noteResult.data as Note[]) ?? []);
    setQuestions((questionResult.data as Question[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const selected = modules.find((module) => module.id === selectedId) ?? null;
  const moduleNotes = useMemo(
    () => notes.filter((note) => note.module_id === selectedId && note.content_type === section),
    [notes, selectedId, section],
  );
  const moduleQuestions = useMemo(
    () => questions.filter((question) => question.module_id === selectedId),
    [questions, selectedId],
  );

  const createModule = async () => {
    if (!user || !newModuleTitle.trim()) return;
    const { data, error } = await supabase
      .from("ri_modules")
      .insert({
        user_id: user.id,
        title: newModuleTitle.trim(),
        position: modules.length,
      })
      .select()
      .single();
    if (error || !data) return toast.error("Não foi possível criar o módulo.");
    setModules((current) => [...current, data as Module]);
    setNewModuleTitle("");
    toast.success("Módulo criado.");
  };

  const renameModule = async (id: string, title: string) => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    const { error } = await supabase.from("ri_modules").update({ title: cleanTitle }).eq("id", id);
    if (error) {
      toast.error("Não foi possível renomear o módulo.");
      return;
    }
    setModules((current) =>
      current.map((module) => (module.id === id ? { ...module, title: cleanTitle } : module)),
    );
    setRenamingId(null);
  };

  const deleteModule = async (module: Module) => {
    if (!confirm(`Eliminar o módulo “${module.title}” e todo o seu conteúdo?`)) return;
    const { error } = await supabase.from("ri_modules").delete().eq("id", module.id);
    if (error) return toast.error("Não foi possível eliminar o módulo.");
    setModules((current) => current.filter((item) => item.id !== module.id));
    setNotes((current) => current.filter((note) => note.module_id !== module.id));
    setQuestions((current) => current.filter((question) => question.module_id !== module.id));
    if (selectedId === module.id) setSelectedId(null);
  };

  const moveModule = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= modules.length) return;
    const next = [...modules];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    const ordered = next.map((module, position) => ({ ...module, position }));
    setModules(ordered);
    const results = await Promise.all(
      ordered.map((module) =>
        supabase.from("ri_modules").update({ position: module.position }).eq("id", module.id),
      ),
    );
    if (results.some((result) => result.error)) {
      toast.error("Não foi possível guardar a nova ordem.");
      void load();
    }
  };

  const exportAll = () => {
    const payload = {
      version: 1 as const,
      area: "relacoes-internacionais" as const,
      exported_at: new Date().toISOString(),
      modules: modules.map((module) => ({
        title: module.title,
        position: module.position,
        notes: notes
          .filter((note) => note.module_id === module.id)
          .map(({ title, content, content_type, position }) => ({
            title,
            content,
            content_type,
            position,
          })),
        questions: questions
          .filter((question) => question.module_id === module.id)
          .map(({ question, answer, review_status, position }) => ({
            question,
            answer,
            review_status,
            position,
          })),
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `estudos-ri-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importAll = async (file: File) => {
    if (!user) return;
    try {
      const parsed = exportSchema.parse(JSON.parse(await file.text()));
      for (const module of parsed.modules.sort((a, b) => a.position - b.position)) {
        const { data: insertedModule, error } = await supabase
          .from("ri_modules")
          .insert({
            user_id: user.id,
            title: module.title,
            position: modules.length + module.position,
          })
          .select()
          .single();
        if (error || !insertedModule) throw error ?? new Error("module");
        if (module.notes.length) {
          const { error: noteError } = await supabase.from("ri_notes").insert(
            module.notes.map((note) => ({
              ...note,
              module_id: insertedModule.id,
              user_id: user.id,
            })),
          );
          if (noteError) throw noteError;
        }
        if (module.questions.length) {
          const { error: questionError } = await supabase.from("ri_questions").insert(
            module.questions.map((question) => ({
              ...question,
              module_id: insertedModule.id,
              user_id: user.id,
            })),
          );
          if (questionError) throw questionError;
        }
      }
      await load();
      toast.success("Conteúdo importado com sucesso.");
    } catch {
      toast.error("Ficheiro JSON inválido ou incompatível.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (selected) {
    return (
      <div className="page-enter space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedId(null)}
              aria-label="Voltar aos módulos"
            >
              <ArrowLeft />
            </Button>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Estudos / Relações Internacionais</p>
              <h1 className="truncate text-2xl font-bold neon-text">{selected.title}</h1>
            </div>
          </div>
        </header>
        <div className="flex gap-2 border-b border-border">
          <Button
            variant="ghost"
            onClick={() => setSection("notes")}
            className={
              section === "notes"
                ? "border-b-2 border-primary text-primary rounded-none"
                : "rounded-none text-muted-foreground"
            }
          >
            <FileText /> Notas
          </Button>
          <Button
            variant="ghost"
            onClick={() => setSection("tests")}
            className={
              section === "tests"
                ? "border-b-2 border-primary text-primary rounded-none"
                : "rounded-none text-muted-foreground"
            }
          >
            <HelpCircle /> Testes
          </Button>
        </div>
        {section === "notes" ? (
          <NotesPanel
            moduleId={selected.id}
            userId={user?.id}
            notes={moduleNotes}
            setNotes={setNotes}
          />
        ) : (
          <QuestionsPanel
            moduleId={selected.id}
            userId={user?.id}
            questions={moduleQuestions}
            setQuestions={setQuestions}
          />
        )}
      </div>
    );
  }

  return (
    <div className="page-enter space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Estudos</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold neon-text">
            <BookOpen /> Relações Internacionais (RI)
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Módulos de aprendizagem com notas e revisão ativa.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportAll}>
            <Download /> Exportar JSON
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload /> Importar JSON
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importAll(file);
            }}
          />
        </div>
      </header>

      <div className="glass-card flex flex-col gap-3 p-4 sm:flex-row">
        <input
          className={inputClass}
          value={newModuleTitle}
          maxLength={120}
          onChange={(event) => setNewModuleTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void createModule();
          }}
          placeholder="Nome do novo módulo…"
        />
        <Button onClick={() => void createModule()} disabled={!newModuleTitle.trim()}>
          <FolderPlus /> Criar módulo
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">A carregar módulos…</p>
      ) : modules.length === 0 ? (
        <div className="glass-card grid min-h-56 place-items-center p-8 text-center">
          <div>
            <BookOpen className="mx-auto mb-3 h-9 w-9 text-primary" />
            <h2 className="font-semibold">Começa pelo primeiro módulo</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Cria uma pasta de aprendizagem para um tema de RI.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((module, index) => {
            const noteCount = notes.filter((note) => note.module_id === module.id).length;
            const questionCount = questions.filter(
              (question) => question.module_id === module.id,
            ).length;
            return (
              <article
                key={module.id}
                className="glass-card group p-4 transition hover:border-primary/50 hover:shadow-glow"
              >
                <div className="flex items-start gap-3">
                  <Button
                    variant="ghost"
                    className="h-auto flex-1 justify-start p-0 text-left whitespace-normal"
                    onClick={() => setSelectedId(module.id)}
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent text-primary">
                      <BookOpen />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{module.title}</span>
                      <span className="mt-1 block text-xs font-normal text-muted-foreground">
                        {noteCount} notas · {questionCount} perguntas
                      </span>
                    </span>
                    <ChevronRight className="text-muted-foreground" />
                  </Button>
                </div>
                <div className="mt-4 flex items-center justify-end gap-1 border-t border-border pt-3">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={index === 0}
                    onClick={() => void moveModule(index, -1)}
                    aria-label="Mover para cima"
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={index === modules.length - 1}
                    onClick={() => void moveModule(index, 1)}
                    aria-label="Mover para baixo"
                  >
                    <ArrowDown />
                  </Button>
                  {renamingId === module.id ? (
                    <RenameInput
                      module={module}
                      onSave={renameModule}
                      onCancel={() => setRenamingId(null)}
                    />
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setRenamingId(module.id)}
                      aria-label="Renomear"
                    >
                      <Pencil />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => void deleteModule(module)}
                    aria-label="Eliminar"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RenameInput({
  module,
  onSave,
  onCancel,
}: {
  module: Module;
  onSave: (id: string, title: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(module.title);
  return (
    <div className="flex flex-1 items-center gap-1">
      <input
        autoFocus
        className={`${inputClass} h-8 py-1`}
        value={title}
        maxLength={120}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") void onSave(module.id, title);
          if (event.key === "Escape") onCancel();
        }}
      />
      <Button variant="ghost" size="icon-sm" onClick={() => void onSave(module.id, title)}>
        <Check />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={onCancel}>
        <X />
      </Button>
    </div>
  );
}

function NotesPanel({
  moduleId,
  userId,
  notes,
  setNotes,
}: {
  moduleId: string;
  userId?: string;
  notes: Note[];
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>;
}) {
  const [activeId, setActiveId] = useState<string | null>(notes[0]?.id ?? null);
  const active = notes.find((note) => note.id === activeId) ?? null;
  const add = async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("ri_notes")
      .insert({
        module_id: moduleId,
        user_id: userId,
        title: "Nova nota",
        content: "",
        position: notes.length,
      })
      .select()
      .single();
    if (error || !data) return toast.error("Não foi possível criar a nota.");
    setNotes((current) => [...current, data as Note]);
    setActiveId(data.id);
  };
  const update = async (note: Note, changes: Partial<Pick<Note, "title" | "content">>) => {
    setNotes((current) =>
      current.map((item) => (item.id === note.id ? { ...item, ...changes } : item)),
    );
    const { error } = await supabase.from("ri_notes").update(changes).eq("id", note.id);
    if (error) toast.error("Não foi possível guardar a nota.");
  };
  const remove = async (note: Note) => {
    if (!confirm(`Eliminar a nota “${note.title}”?`)) return;
    const { error } = await supabase.from("ri_notes").delete().eq("id", note.id);
    if (error) return toast.error("Não foi possível eliminar a nota.");
    setNotes((current) => current.filter((item) => item.id !== note.id));
    setActiveId(null);
  };
  return (
    <div className="grid min-h-[520px] gap-4 lg:grid-cols-[260px_1fr]">
      <aside className="glass-card p-3">
        <Button className="w-full" onClick={() => void add()}>
          <Plus /> Nova nota
        </Button>
        <div className="mt-3 space-y-1">
          {notes.map((note) => (
            <Button
              key={note.id}
              variant="ghost"
              className={`w-full justify-start truncate ${activeId === note.id ? "bg-accent text-primary" : ""}`}
              onClick={() => setActiveId(note.id)}
            >
              <FileText /> <span className="truncate">{note.title}</span>
            </Button>
          ))}
        </div>
      </aside>
      <section className="glass-card overflow-hidden">
        {active ? (
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-2 border-b border-border p-3">
              <input
                className={`${inputClass} border-transparent bg-transparent text-base font-semibold`}
                value={active.title}
                maxLength={160}
                onChange={(event) =>
                  setNotes((current) =>
                    current.map((item) =>
                      item.id === active.id ? { ...item, title: event.target.value } : item,
                    ),
                  )
                }
                onBlur={(event) =>
                  void update(active, { title: event.target.value.trim() || "Sem título" })
                }
              />
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                onClick={() => void remove(active)}
              >
                <Trash2 />
              </Button>
            </div>
            <RichNoteEditor
              className="flex flex-1 flex-col"
              value={active.content}
              onChange={(content) =>
                setNotes((current) =>
                  current.map((item) => (item.id === active.id ? { ...item, content } : item)),
                )
              }
              placeholder="Escreve livremente…"
            />
            <div className="flex justify-end border-t border-border p-3">
              <Button onClick={() => void update(active, { content: active.content })}>
                Guardar nota
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid h-full min-h-80 place-items-center text-sm text-muted-foreground">
            Cria ou seleciona uma nota.
          </div>
        )}
      </section>
    </div>
  );
}

function QuestionsPanel({
  moduleId,
  userId,
  questions,
  setQuestions,
}: {
  moduleId: string;
  userId?: string;
  questions: Question[];
  setQuestions: React.Dispatch<React.SetStateAction<Question[]>>;
}) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState("");
  const [editAnswer, setEditAnswer] = useState("");
  const add = async () => {
    if (!userId || !question.trim() || !answer.trim()) return;
    const { data, error } = await supabase
      .from("ri_questions")
      .insert({
        module_id: moduleId,
        user_id: userId,
        question: question.trim(),
        answer: answer.trim(),
        position: questions.length,
      })
      .select()
      .single();
    if (error || !data) return toast.error("Não foi possível criar a pergunta.");
    setQuestions((current) => [...current, data as Question]);
    setQuestion("");
    setAnswer("");
  };
  const setStatus = async (item: Question, review_status: ReviewStatus) => {
    const { error } = await supabase
      .from("ri_questions")
      .update({ review_status })
      .eq("id", item.id);
    if (error) return toast.error("Não foi possível guardar a revisão.");
    setQuestions((current) =>
      current.map((currentItem) =>
        currentItem.id === item.id ? { ...currentItem, review_status } : currentItem,
      ),
    );
  };
  const startEdit = (item: Question) => {
    setEditingId(item.id);
    setEditQuestion(item.question);
    setEditAnswer(item.answer);
  };
  const saveEdit = async (item: Question) => {
    if (!editQuestion.trim() || !editAnswer.trim()) return;
    const changes = { question: editQuestion.trim(), answer: editAnswer.trim() };
    const { error } = await supabase.from("ri_questions").update(changes).eq("id", item.id);
    if (error) return toast.error("Não foi possível editar a pergunta.");
    setQuestions((current) =>
      current.map((currentItem) =>
        currentItem.id === item.id ? { ...currentItem, ...changes } : currentItem,
      ),
    );
    setEditingId(null);
  };
  const remove = async (item: Question) => {
    if (!confirm("Eliminar esta pergunta?")) return;
    const { error } = await supabase.from("ri_questions").delete().eq("id", item.id);
    if (!error)
      setQuestions((current) => current.filter((currentItem) => currentItem.id !== item.id));
  };
  return (
    <div className="space-y-4">
      <div className="glass-card grid gap-3 p-4">
        <h2 className="font-semibold">Nova pergunta</h2>
        <textarea
          className={inputClass}
          rows={2}
          value={question}
          maxLength={2000}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Escreve a pergunta…"
        />
        <textarea
          className={inputClass}
          rows={3}
          value={answer}
          maxLength={5000}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="Resposta correta…"
        />
        <div className="flex justify-end">
          <Button onClick={() => void add()} disabled={!question.trim() || !answer.trim()}>
            <Plus /> Adicionar pergunta
          </Button>
        </div>
      </div>
      {questions.length === 0 ? (
        <div className="glass-card grid min-h-48 place-items-center text-sm text-muted-foreground">
          Ainda não existem perguntas neste módulo.
        </div>
      ) : (
        <div className="grid gap-3">
          {questions.map((item, index) => {
            const isRevealed = revealed.has(item.id);
            return (
              <article key={item.id} className="glass-card p-4">
                <div className="flex gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-primary">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    {editingId === item.id ? (
                      <div className="grid gap-3">
                        <textarea
                          className={inputClass}
                          rows={2}
                          value={editQuestion}
                          maxLength={2000}
                          onChange={(event) => setEditQuestion(event.target.value)}
                        />
                        <textarea
                          className={inputClass}
                          rows={3}
                          value={editAnswer}
                          maxLength={5000}
                          onChange={(event) => setEditAnswer(event.target.value)}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => void saveEdit(item)}>
                            <Check /> Guardar
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                            <X /> Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="font-medium whitespace-pre-wrap">{item.question}</p>
                    )}
                    {editingId !== item.id && isRevealed ? (
                      <div className="mt-4 rounded-lg border border-border bg-muted/40 p-4">
                        <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
                          Resposta
                        </p>
                        <p className="whitespace-pre-wrap text-sm">{item.answer}</p>
                      </div>
                    ) : editingId !== item.id ? (
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => setRevealed((current) => new Set(current).add(item.id))}
                      >
                        Ver resposta
                      </Button>
                    ) : null}
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {isRevealed && (
                        <>
                          <Button
                            variant={item.review_status === "correct" ? "default" : "outline"}
                            size="sm"
                            onClick={() => void setStatus(item, "correct")}
                          >
                            <Check /> Correta
                          </Button>
                          <Button
                            variant={item.review_status === "incorrect" ? "destructive" : "outline"}
                            size="sm"
                            onClick={() => void setStatus(item, "incorrect")}
                          >
                            <X /> Incorreta
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              void setStatus(item, "unreviewed");
                              setRevealed((current) => {
                                const next = new Set(current);
                                next.delete(item.id);
                                return next;
                              });
                            }}
                          >
                            <RotateCcw /> Rever depois
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => startEdit(item)}
                        aria-label="Editar pergunta"
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="ml-auto text-destructive hover:text-destructive"
                        onClick={() => void remove(item)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
