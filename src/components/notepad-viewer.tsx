import { useEffect, useRef, useState } from "react";
import { X, Save, Undo2, Redo2, Pencil, FileText } from "lucide-react";

interface NotepadViewerProps {
  title: string;
  initialContent: string;
  onClose: () => void;
  onSave: (content: string) => Promise<void> | void;
  onEditMeta?: () => void;
}

/**
 * Windows Notepad-style note viewer.
 * - Native textarea (browser undo/redo + Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z work).
 * - Toolbar undo/redo buttons trigger document.execCommand on the focused textarea.
 * - Save on Ctrl+S.
 */
export function NotepadViewer({ title, initialContent, onClose, onSave, onEditMeta }: NotepadViewerProps) {
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);
  const [confirmClose, setConfirmClose] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setContent(initialContent);
    setSaved(true);
  }, [initialContent]);

  useEffect(() => {
    setSaved(content === initialContent);
  }, [content, initialContent]);

  const save = async () => {
    if (saving || saved) return;
    setSaving(true);
    try {
      await onSave(content);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const tryClose = () => {
    if (saved) onClose();
    else setConfirmClose(true);
  };

  const saveAndClose = async () => {
    try {
      setSaving(true);
      await onSave(content);
      setSaved(true);
      setConfirmClose(false);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      } else if (e.key === "Escape") {
        tryClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, saved, saving]);

  const triggerCmd = (cmd: "undo" | "redo") => {
    textareaRef.current?.focus();
    try {
      document.execCommand(cmd);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4">
      <div className="w-full max-w-3xl h-[80vh] rounded-lg overflow-hidden border border-border shadow-2xl flex flex-col bg-[#1e1e1e]">
        {/* Title bar */}
        <div className="flex items-center justify-between bg-gradient-to-r from-primary/80 to-primary-glow/70 text-primary-foreground px-3 py-1.5 select-none">
          <div className="flex items-center gap-2 text-sm font-medium truncate">
            <FileText className="h-4 w-4" />
            <span className="truncate">{title || "Sem título"}{!saved && " •"} — Bloco de notas</span>
          </div>
          <button onClick={onClose} className="px-2 py-0.5 hover:bg-destructive/80 rounded-sm" title="Fechar (Esc)">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Menu/toolbar */}
        <div className="flex items-center gap-1 px-2 py-1 bg-[#2d2d2d] border-b border-black/40 text-xs text-neutral-300">
          <button onClick={() => triggerCmd("undo")} className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10" title="Anular (Ctrl+Z)">
            <Undo2 className="h-3.5 w-3.5" /> Anular
          </button>
          <button onClick={() => triggerCmd("redo")} className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10" title="Refazer (Ctrl+Y)">
            <Redo2 className="h-3.5 w-3.5" /> Refazer
          </button>
          <span className="mx-1 h-4 w-px bg-white/15" />
          <button
            onClick={save}
            disabled={saving || saved}
            className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10 disabled:opacity-40"
            title="Guardar (Ctrl+S)"
          >
            <Save className="h-3.5 w-3.5" /> {saving ? "A guardar..." : saved ? "Guardado" : "Guardar"}
          </button>
          {onEditMeta && (
            <button onClick={onEditMeta} className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10" title="Editar título / tags">
              <Pencil className="h-3.5 w-3.5" /> Editar metadados
            </button>
          )}
          <span className="ml-auto text-[10px] text-neutral-500">{content.length} caracteres</span>
        </div>

        {/* Editor */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          spellCheck={false}
          className="flex-1 w-full p-4 bg-[#1e1e1e] text-neutral-100 font-mono text-sm leading-relaxed resize-none focus:outline-none"
          style={{ fontFamily: 'Consolas, "Courier New", monospace' }}
          autoFocus
        />

        {/* Status bar */}
        <div className="px-3 py-1 text-[10px] text-neutral-400 bg-[#2d2d2d] border-t border-black/40 flex justify-between">
          <span>{saved ? "Pronto" : "Alterações não guardadas"}</span>
          <span>UTF-8 · Ctrl+Z anular · Ctrl+Y refazer · Ctrl+S guardar</span>
        </div>
      </div>
    </div>
  );
}
