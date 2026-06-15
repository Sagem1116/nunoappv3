import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Bold, GitBranch, Palette, Redo2, Type, Undo2, X, Plus, Minus } from "lucide-react";
import DOMPurify, { type Config } from "dompurify";

const COLORS = [
  { name: "Padrão", value: "" },
  { name: "Laranja", value: "#ff7a18" },
  { name: "Verde", value: "#34d399" },
  { name: "Azul", value: "#60a5fa" },
  { name: "Rosa", value: "#f472b6" },
  { name: "Vermelho", value: "#f87171" },
  { name: "Amarelo", value: "#fbbf24" },
];

const ALLOWED: Config = {
  ALLOWED_TAGS: ["b", "strong", "i", "em", "u", "br", "div", "p", "span", "font"],
  ALLOWED_ATTR: ["style", "color", "size"],
};

export function sanitizeNote(html: string): string {
  if (typeof window === "undefined") return html;
  return DOMPurify.sanitize(html, ALLOWED) as string;
}

export interface RichNoteEditorHandle {
  focus: () => void;
  undo: () => void;
  redo: () => void;
  selectTextRange: (start: number, end: number) => void;
}

interface Props {
  value: string;
  onChange: (html: string) => void;
  className?: string;
  autoFocus?: boolean;
  placeholder?: string;
}

export const RichNoteEditor = forwardRef<RichNoteEditorHandle, Props>(function RichNoteEditor(
  { value, onChange, className, autoFocus, placeholder },
  forwardedRef,
) {
  const ref = useRef<HTMLDivElement>(null);
  const lastSetValue = useRef("");

  useEffect(() => {
    if (ref.current && value !== lastSetValue.current && value !== ref.current.innerHTML) {
      ref.current.innerHTML = sanitizeNote(value || "");
      lastSetValue.current = value;
    }
  }, [value]);

  useEffect(() => {
    if (autoFocus && ref.current) ref.current.focus();
  }, [autoFocus]);

  const exec = (cmd: string, val?: string) => {
    ref.current?.focus();
    try {
      document.execCommand(cmd, false, val);
    } catch {
      return;
    }
    handleInput();
  };

  const handleInput = () => {
    if (!ref.current) return;
    const html = ref.current.innerHTML;
    lastSetValue.current = html;
    onChange(html);
  };

  const insertScheme = () => {
    const scheme = [
      '<div style="margin: 16px 0;">',
      "<div><b>PALAVRA-CHAVE</b></div>",
      '<div style="margin-left: 16px;">',
      "<div>├── Definição 1</div>",
      "<div>├── Definição 2</div>",
      "<div>└── Definição 3</div>",
      "</div>",
      "</div><div><br></div>",
    ].join("");
    exec("insertHTML", scheme);
  };

  useImperativeHandle(forwardedRef, () => ({
    focus: () => ref.current?.focus(),
    undo: () => exec("undo"),
    redo: () => exec("redo"),
    selectTextRange: (start, end) => {
      if (!ref.current) return;
      const walker = document.createTreeWalker(ref.current, NodeFilter.SHOW_TEXT);
      let offset = 0;
      let startNode: Node | null = null;
      let endNode: Node | null = null;
      let startOffset = 0;
      let endOffset = 0;
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const length = node.textContent?.length ?? 0;
        if (!startNode && start <= offset + length) {
          startNode = node;
          startOffset = Math.max(0, start - offset);
        }
        if (end <= offset + length) {
          endNode = node;
          endOffset = Math.max(0, end - offset);
          break;
        }
        offset += length;
      }
      if (!startNode || !endNode) return;
      const range = document.createRange();
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      ref.current.focus();
    },
  }));

  return (
    <div className={className}>
      <div className="sticky top-0 z-20 flex shrink-0 items-center gap-1 overflow-x-auto px-2 py-1 bg-[#2d2d2d] border-b border-black/40 text-xs text-neutral-300 shadow-md">
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            exec("undo");
          }}
          className="inline-flex shrink-0 items-center gap-1 px-2 py-1 rounded hover:bg-white/10"
          title="Retroceder (Ctrl+Z)"
          aria-label="Retroceder última alteração"
        >
          <Undo2 className="h-3.5 w-3.5" /> Retroceder
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            exec("redo");
          }}
          className="inline-flex shrink-0 items-center gap-1 px-2 py-1 rounded hover:bg-white/10"
          title="Avançar (Ctrl+Y)"
          aria-label="Avançar alteração"
        >
          <Redo2 className="h-3.5 w-3.5" /> Avançar
        </button>
        <span className="mx-1 h-4 w-px shrink-0 bg-white/15" />
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            insertScheme();
          }}
          className="inline-flex shrink-0 items-center gap-1 px-2 py-1 rounded hover:bg-white/10"
          title="Inserir esquema com palavra-chave e definições"
        >
          <GitBranch className="h-3.5 w-3.5" /> Esquema
        </button>
        <span className="mx-1 h-4 w-px shrink-0 bg-white/15" />
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            exec("bold");
          }}
          className="inline-flex shrink-0 items-center gap-1 px-2 py-1 rounded hover:bg-white/10"
          title="Negrito (Ctrl+B)"
        >
          <Bold className="h-3.5 w-3.5" /> Negrito
        </button>
        <span className="mx-1 h-4 w-px bg-white/15" />
        <label
          className="inline-flex shrink-0 items-center gap-1 px-2 py-1 rounded hover:bg-white/10"
          title="Tamanho da letra"
        >
          <Type className="h-3.5 w-3.5" />
          <select
            defaultValue="3"
            onChange={(e) => exec("fontSize", e.target.value)}
            className="bg-transparent text-xs focus:outline-none"
            aria-label="Tamanho da letra"
          >
            <option value="2">Pequena</option>
            <option value="3">Normal</option>
            <option value="4">Grande</option>
            <option value="5">Muito grande</option>
          </select>
        </label>
        <span className="mx-1 h-4 w-px bg-white/15" />
        <div className="relative group">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10"
            title="Cor do texto"
          >
            <Palette className="h-3.5 w-3.5" /> Cor
          </button>
          <div className="absolute left-0 top-full mt-1 hidden group-hover:flex flex-wrap gap-1 p-2 bg-[#2d2d2d] border border-black/40 rounded shadow-lg z-10 w-44">
            {COLORS.map((c) => (
              <button
                key={c.name}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  exec("foreColor", c.value || "inherit");
                }}
                className="h-6 w-6 rounded border border-white/20 hover:scale-110 transition-transform"
                style={{ background: c.value || "transparent" }}
                title={c.name}
              />
            ))}
          </div>
        </div>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={handleInput}
        data-placeholder={placeholder}
        className="flex-1 w-full p-4 bg-[#1e1e1e] text-neutral-100 font-mono text-sm leading-relaxed whitespace-pre-wrap focus:outline-none overflow-auto min-h-[200px] empty:before:content-[attr(data-placeholder)] empty:before:text-neutral-500"
        style={{ fontFamily: 'Consolas, "Courier New", monospace' }}
      />
    </div>
  );
});
