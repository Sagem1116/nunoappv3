import { useEffect, useState } from "react";
import { X, Save, Pencil, FileText } from "lucide-react";
import { RichNoteEditor } from "@/components/rich-note-editor";

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

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4">
      <div className="w-full max-w-3xl h-[80vh] rounded-lg overflow-hidden border border-border shadow-2xl flex flex-col bg-[#1e1e1e]">
        {/* Title bar */}
        <div className="flex items-center justify-between bg-gradient-to-r from-primary/80 to-primary-glow/70 text-primary-foreground px-3 py-1.5 select-none">
          <div className="flex items-center gap-2 text-sm font-medium truncate">
            <FileText className="h-4 w-4" />
            <span className="truncate">{title || "Sem título"}{!saved && " •"} — Bloco de notas</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={save}
              disabled={saving || saved}
              className="px-2 py-0.5 hover:bg-white/20 rounded-sm disabled:opacity-40 text-xs inline-flex items-center gap-1"
              title="Guardar (Ctrl+S)"
            >
              <Save className="h-3.5 w-3.5" /> {saving ? "..." : saved ? "Guardado" : "Guardar"}
            </button>
            {onEditMeta && (
              <button onClick={onEditMeta} className="px-2 py-0.5 hover:bg-white/20 rounded-sm" title="Editar título / tags">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            <button onClick={tryClose} className="px-2 py-0.5 hover:bg-destructive/80 rounded-sm" title="Fechar (Esc)">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Rich Editor (with B + cor toolbar) */}
        <RichNoteEditor
          value={content}
          onChange={setContent}
          className="flex flex-col flex-1 min-h-0"
          autoFocus
          placeholder="Escreve a tua nota..."
        />


        {/* Status bar */}
        <div className="px-3 py-1 text-[10px] text-neutral-400 bg-[#2d2d2d] border-t border-black/40 flex justify-between">
          <span>{saved ? "Pronto" : "Alterações não guardadas"}</span>
          <span>UTF-8 · Ctrl+Z anular · Ctrl+Y refazer · Ctrl+S guardar</span>
        </div>
      </div>

      {confirmClose && (
        <div className="fixed inset-0 z-[60] bg-black/70 grid place-items-center p-4">
          <div className="w-full max-w-sm rounded-lg border border-border bg-background shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-primary/80 to-primary-glow/70 text-primary-foreground px-3 py-1.5 text-sm font-medium">
              Bloco de notas
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm">
                Pretendes guardar as alterações em <span className="font-medium">{title || "Sem título"}</span>?
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setConfirmClose(false)}
                  className="px-3 py-1.5 rounded text-sm border border-border hover:bg-accent"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => { setConfirmClose(false); onClose(); }}
                  className="px-3 py-1.5 rounded text-sm border border-destructive/60 text-destructive hover:bg-destructive/10"
                >
                  Descartar
                </button>
                <button
                  onClick={saveAndClose}
                  disabled={saving}
                  className="px-3 py-1.5 rounded text-sm bg-gradient-to-r from-primary to-primary-glow text-primary-foreground hover:shadow-glow-strong disabled:opacity-50"
                >
                  {saving ? "A guardar..." : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

