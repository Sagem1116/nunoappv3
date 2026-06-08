import { useEffect, useRef } from "react";
import { Bold, Palette } from "lucide-react";
import DOMPurify from "dompurify";

const COLORS = [
  { name: "Padrão", value: "" },
  { name: "Laranja", value: "#ff7a18" },
  { name: "Verde", value: "#34d399" },
  { name: "Azul", value: "#60a5fa" },
  { name: "Rosa", value: "#f472b6" },
  { name: "Vermelho", value: "#f87171" },
  { name: "Amarelo", value: "#fbbf24" },
];

const ALLOWED = {
  ALLOWED_TAGS: ["b", "strong", "i", "em", "u", "br", "div", "p", "span", "font"],
  ALLOWED_ATTR: ["style", "color"],
};

export function sanitizeNote(html: string): string {
  if (typeof window === "undefined") return html;
  return DOMPurify.sanitize(html, ALLOWED as any) as unknown as string;
}

interface Props {
  value: string;
  onChange: (html: string) => void;
  className?: string;
  autoFocus?: boolean;
  placeholder?: string;
}

export function RichNoteEditor({ value, onChange, className, autoFocus, placeholder }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const lastSetValue = useRef(value);

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
    } catch {}
    handleInput();
  };

  const handleInput = () => {
    if (!ref.current) return;
    const html = ref.current.innerHTML;
    lastSetValue.current = html;
    onChange(html);
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-1 px-2 py-1 bg-[#2d2d2d] border-b border-black/40 text-xs text-neutral-300">
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); exec("bold"); }}
          className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10"
          title="Negrito (Ctrl+B)"
        >
          <Bold className="h-3.5 w-3.5" /> Negrito
        </button>
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
        className="flex-1 w-full p-4 bg-[#1e1e1e] text-neutral-100 font-mono text-sm leading-relaxed focus:outline-none overflow-auto min-h-[200px] empty:before:content-[attr(data-placeholder)] empty:before:text-neutral-500"
        style={{ fontFamily: 'Consolas, "Courier New", monospace' }}
      />
    </div>
  );
}
