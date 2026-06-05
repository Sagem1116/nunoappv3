import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  Download,
  Trash2,
  UploadCloud,
  Folder,
  FileText,
  Image as ImageIcon,
  Video,
  Eye,
  Search,
  Tag,
  Sparkles,
  Plus,
  ChevronRight,
  Home,
  FolderOpen,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { TagInput } from "@/components/tag-input";

const BUCKET_NAME = "user-files";
const ACCEPTED_TYPES = "application/pdf,image/*,video/*,.doc,.docx,.xls,.xlsx,.ppt,.pptx";

type FileMetadata = {
  user_id: string;
  folder?: string;
  project?: string;
  tags?: string[];
  original_name?: string;
};

type StoredFile = {
  id: string;
  name: string;
  path: string;
  updated_at: string;
  created_at: string;
  size: number;
  mimeType: string;
  metadata: FileMetadata;
};

export const Route = createFileRoute("/_app/ficheiros")({
  component: FilesRoute,
});

function FilesRoute() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [folder, setFolder] = useState("");
  const [project, setProject] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [editingTagsFile, setEditingTagsFile] = useState<StoredFile | null>(null);
  const [search, setSearch] = useState("");
  const [selectedFolder, setSelectedFolder] = useState("all");
  const [selectedProject, setSelectedProject] = useState("all");
  const [selectedTag, setSelectedTag] = useState("all");
  const [dragActive, setDragActive] = useState(false);
  const [previewFile, setPreviewFile] = useState<StoredFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    if (!user) return;
    fetchFiles();
  }, [user]);

  const parseFile = (item: any, userId: string, meta?: FileMetadata): StoredFile => {
    return {
      id: item.id ?? item.name,
      name: item.name,
      path: `${userId}/${item.name}`,
      updated_at: item.updated_at,
      created_at: item.created_at,
      size: item.metadata?.size ?? 0,
      mimeType: item.metadata?.mimetype || "application/octet-stream",
      metadata: meta ?? { user_id: userId },
    };
  };


  const fetchFiles = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setMessage(null);

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(user.id, { limit: 200, offset: 0, sortBy: { column: "name", order: "asc" } });

    if (error) {
      setMessage("Não foi possível carregar os ficheiros. Tenta novamente.");
      console.error(error);
      setFiles([]);
    } else {
      const items = data ?? [];
      const paths = items.map((it) => `${user.id}/${it.name}`);
      const { data: metaRows } = await (supabase as any)
        .from("file_metadata")
        .select("path, original_name, folder, project, tags")
        .in("path", paths);
      const metaByPath = new Map<string, FileMetadata>(
        (metaRows ?? []).map((r: any) => [r.path, {
          user_id: user.id,
          folder: r.folder ?? "",
          project: r.project ?? "",
          tags: (r.tags ?? []) as string[],
          original_name: r.original_name ?? "",
        }])
      );
      setFiles(items.map((item) => parseFile(item, user.id, metaByPath.get(`${user.id}/${item.name}`))));
    }

    setLoading(false);
  }, [user]);

  const createFilePath = (file: File) => {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    return `${user?.id}/${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`;
  };

  const uploadFiles = useCallback(
    async (selectedFiles: FileList | File[]) => {
      if (!user || selectedFiles.length === 0) return;
      setUploading(true);
      setMessage(null);

      const tagList = tags.map((t) => t.trim()).filter(Boolean);
      const metadata: FileMetadata = {
        user_id: user.id,
        folder: folder.trim() || "Sem pasta",
        project: project.trim() || "",
        tags: tagList,
      };

      const uploadResults = await Promise.all(
        Array.from(selectedFiles).map(async (file) => {
          const path = createFilePath(file);
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(path, file, {
              cacheControl: "3600",
              upsert: false,
            });

          let metaError: any = null;
          if (!uploadError) {
            try {
              const { data: metaData, error } = await (supabase as any)
                .from("file_metadata")
                .insert({
                  user_id: user.id,
                  path,
                  original_name: file.name,
                  folder: metadata.folder ?? "",
                  project: metadata.project ?? "",
                  tags: tagList,
                })
                .select()
                .single();
              metaError = error ?? null;
              if (metaError) console.error("file_metadata insert error:", metaError);
            } catch (err) {
              metaError = err;
              console.error("file_metadata insert threw:", err);
            }
          }

          return { file, uploadError, metaError, path, uploadData };
        }),
      );

      const failedUploads = uploadResults.filter((r) => r.uploadError);
      const failedMeta = uploadResults.filter((r) => r.metaError);
      if (failedUploads.length > 0) {
        console.error("Upload errors:", failedUploads.map((r) => r.uploadError));
        setMessage(`Falha no upload de ${failedUploads.length} ficheiro(s).`);
      } else if (failedMeta.length > 0) {
        console.error("Metadata errors:", failedMeta.map((r) => r.metaError));
        setMessage("Upload concluído mas ocorreu um erro ao guardar metadados. Tenta novamente.");
        // Do not clear folder/project/tags so user can retry
      } else {
        setMessage("Upload concluído com sucesso.");
        setFolder("");
        setProject("");
        setTags([]);
      }

      await fetchFiles();
      setUploading(false);
    },
    [folder, project, tags, user, fetchFiles],
  );

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles) return;
    uploadFiles(selectedFiles);
    event.target.value = "";
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    if (!event.dataTransfer.files.length) return;
    uploadFiles(event.dataTransfer.files);
  };

  const getSignedUrl = async (path: string) => {
    const { data, error } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(path, 60);
    if (error) {
      console.error(error);
      setMessage("Não foi possível gerar o link de acesso.");
      return null;
    }
    return data.signedUrl;
  };

  const handlePreview = async (file: StoredFile) => {
    setPreviewLoading(true);
    setPreviewFile(file);
    const url = await getSignedUrl(file.path);
    setPreviewUrl(url);
    setPreviewLoading(false);
  };

  const handleDownload = async (file: StoredFile) => {
    const url = await getSignedUrl(file.path);
    if (!url) return;
    window.open(url, "_blank", "noreferrer");
  };

  const handleDelete = async (file: StoredFile) => {
    const confirm = window.confirm(`Eliminar ${file.metadata.original_name ?? file.name}?`);
    if (!confirm) return;
    const { error } = await supabase.storage.from(BUCKET_NAME).remove([file.path]);
    if (error) {
      console.error(error);
      setMessage("Não foi possível eliminar o ficheiro.");
      return;
    }
    await (supabase as any).from("file_metadata").delete().eq("path", file.path);
    setMessage("Ficheiro eliminado.");
    await fetchFiles();
  };

  const updateFileTags = async (file: StoredFile, nextTags: string[]) => {
    const { error } = await (supabase as any)
      .from("file_metadata")
      .update({ tags: nextTags })
      .eq("path", file.path);
    if (error) {
      console.error(error);
      setMessage("Não foi possível guardar as tags.");
      return;
    }
    setFiles((prev) =>
      prev.map((f) => (f.path === file.path ? { ...f, metadata: { ...f.metadata, tags: nextTags } } : f)),
    );
    setEditingTagsFile(null);
  };


  const folderOptions = useMemo(
    () => Array.from(new Set(files.map((file) => file.metadata.folder || "Sem pasta"))).sort(),
    [files],
  );

  const projectOptions = useMemo(
    () => Array.from(new Set(files.map((file) => file.metadata.project || "Sem projeto"))).sort(),
    [files],
  );

  const tagOptions = useMemo(
    () =>
      Array.from(
        new Set(
          files.flatMap((file) =>
            (file.metadata.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
          ),
        ),
      ).sort(),
    [files],
  );

  const filteredFiles = useMemo(() => {
    return files.filter((file) => {
      const f = file.metadata.folder || "Sem pasta";
      if (selectedFolder !== "all") {
        // Match exact folder OR descendants ("X/..." starts with "X/")
        if (f !== selectedFolder && !f.startsWith(selectedFolder + "/")) return false;
      }
      if (selectedProject !== "all" && (file.metadata.project || "Sem projeto") !== selectedProject) {
        return false;
      }
      if (selectedTag !== "all") {
        const tagsList = file.metadata.tags ?? [];
        if (!tagsList.includes(selectedTag)) return false;
      }
      if (!search) return true;
      const needle = search.toLowerCase();
      return [file.metadata.original_name, file.name, file.metadata.folder, file.metadata.project, ...(file.metadata.tags ?? [])]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(needle));
    });
  }, [files, selectedFolder, selectedProject, selectedTag, search]);

  // Folder navigation: derive sub-folders one level below current selection
  const currentPath = selectedFolder === "all" ? "" : selectedFolder;
  const subFolders = useMemo(() => {
    const set = new Set<string>();
    files.forEach((f) => {
      const p = f.metadata.folder || "Sem pasta";
      if (currentPath === "") {
        // Show top-level segment
        set.add(p.split("/")[0]);
      } else if (p === currentPath || !p.startsWith(currentPath + "/")) {
        return;
      } else {
        const rest = p.slice(currentPath.length + 1);
        set.add(currentPath + "/" + rest.split("/")[0]);
      }
    });
    set.delete(currentPath);
    return Array.from(set).sort();
  }, [files, currentPath]);

  const breadcrumbs = useMemo(() => {
    if (!currentPath) return [] as { label: string; path: string }[];
    const parts = currentPath.split("/");
    return parts.map((p, i) => ({ label: p, path: parts.slice(0, i + 1).join("/") }));
  }, [currentPath]);

  const formatSize = (value: number) => {
    if (value > 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)} GB`;
    if (value > 1_000_000) return `${(value / 1_000_000).toFixed(2)} MB`;
    if (value > 1_000) return `${(value / 1_000).toFixed(2)} KB`;
    return `${value} B`;
  };

  const getIconByType = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return <ImageIcon className="h-6 w-6 text-primary" />;
    if (mimeType.startsWith("video/")) return <Video className="h-6 w-6 text-primary" />;
    if (mimeType === "application/pdf") return <FileText className="h-6 w-6 text-primary" />;
    return <FileText className="h-6 w-6 text-primary" />;
  };

  const getDisplayName = (file: StoredFile) => file.metadata.original_name || file.name;

  return (
    <div className="page-enter space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Gerir ficheiros pessoais</p>
          <h1 className="text-3xl font-semibold neon-text">Ficheiros</h1>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:shadow-glow"
          >
            <UploadCloud className="h-4 w-4" />
            Upload de ficheiros
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_TYPES}
            className="sr-only"
            onChange={handleFileInputChange}
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <section
          className={`glass-card p-6 border border-border transition ${
            dragActive ? "shadow-glow" : ""
          }`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border bg-background/50 p-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-accent text-primary">
              <Plus className="h-7 w-7" />
            </div>
            <div>
              <p className="text-lg font-semibold">Arrasta e larga os ficheiros aqui</p>
              <p className="text-sm text-muted-foreground">
                PDFs, imagens, vídeos, Word, Excel, PowerPoint
              </p>
            </div>
            <p className="text-xs text-muted-foreground">Cada ficheiro é guardado apenas para o teu utilizador.</p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm text-muted-foreground">
              Pasta
              <input
                value={folder}
                onChange={(event) => setFolder(event.target.value)}
                placeholder="Ex. Documentos importantes"
                className="input-style w-full"
              />
            </label>
            <label className="grid gap-1 text-sm text-muted-foreground">
              Projeto
              <input
                value={project}
                onChange={(event) => setProject(event.target.value)}
                placeholder="Ex. Projeto Nuno"
                className="input-style w-full"
              />
            </label>
            <div className="sm:col-span-2 grid gap-1 text-sm text-muted-foreground">
              <span>Tags</span>
              <TagInput value={tags} onChange={setTags} suggestions={tagOptions} placeholder="Adicionar tag e Enter" />
            </div>

          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Organiza por pasta, projeto e tags antes do upload.
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground transition hover:bg-secondary/90 disabled:opacity-60"
            >
              <UploadCloud className="h-4 w-4" />
              {uploading ? "A carregar..." : "Escolher ficheiros"}
            </button>
          </div>
        </section>

        <aside className="glass-card p-6 space-y-5">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Folder className="h-5 w-5" />
            <div>
              <p className="text-sm font-semibold">Filtros</p>
              <p className="text-xs">Navega a tua biblioteca usando pasta, projeto ou tags.</p>
            </div>
          </div>

          <div className="grid gap-4">
            <label className="grid gap-2 text-sm text-muted-foreground">
              Procurar
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nome, pasta ou projeto"
                  className="input-style w-full pl-10"
                />
              </div>
            </label>

            <label className="grid gap-2 text-sm text-muted-foreground">
              Pasta
              <select
                value={selectedFolder}
                onChange={(event) => setSelectedFolder(event.target.value)}
                className="input-style w-full"
              >
                <option value="all">Todas</option>
                {folderOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm text-muted-foreground">
              Projeto
              <select
                value={selectedProject}
                onChange={(event) => setSelectedProject(event.target.value)}
                className="input-style w-full"
              >
                <option value="all">Todos</option>
                {projectOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm text-muted-foreground">
              Tags
              <select
                value={selectedTag}
                onChange={(event) => setSelectedTag(event.target.value)}
                className="input-style w-full"
              >
                <option value="all">Todas</option>
                {tagOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="rounded-3xl border border-border bg-background/50 p-4 text-sm text-muted-foreground">
            <p className="font-medium">Dica</p>
            <p className="mt-2">Os ficheiros são guardados no teu bucket Supabase e cada utilizador só vê os seus próprios conteúdos.</p>
          </div>
        </aside>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Explorar ficheiros</p>
          <p className="text-sm text-muted-foreground mt-1">{filteredFiles.length} ficheiros encontrados</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-background/70 px-3 py-1 text-xs text-muted-foreground shadow-glow">
            <Sparkles className="h-4 w-4 text-primary" />
            Arrasta, pesquisa e organiza o teu drive.
          </div>
          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={[
                'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition',
                viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'bg-background/60 text-muted-foreground',
              ].join(' ')}
            >
              Grid
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={[
                'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition',
                viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'bg-background/60 text-muted-foreground',
              ].join(' ')}
            >
              Lista
            </button>
          </div>
        </div>
      </div>

      {/* Folder breadcrumbs + subfolder chips */}
      <div className="glass-card p-4 space-y-3">
        <nav className="flex items-center flex-wrap gap-1 text-sm">
          <button onClick={() => setSelectedFolder("all")}
            className={["inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-accent/60",
              currentPath === "" ? "text-primary" : "text-muted-foreground"].join(" ")}>
            <Home className="h-3.5 w-3.5" /> Raiz
          </button>
          {breadcrumbs.map((b, i) => (
            <span key={b.path} className="flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
              <button onClick={() => setSelectedFolder(b.path)}
                className={["px-2 py-1 rounded hover:bg-accent/60",
                  i === breadcrumbs.length - 1 ? "text-primary font-medium" : "text-muted-foreground"].join(" ")}>
                {b.label}
              </button>
            </span>
          ))}
        </nav>
        {subFolders.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {subFolders.map((sf) => {
              const leaf = currentPath ? sf.slice(currentPath.length + 1) : sf;
              return (
                <button key={sf} onClick={() => setSelectedFolder(sf)}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border hover:border-primary/60 hover:text-primary transition-all">
                  <FolderOpen className="h-3.5 w-3.5" />
                  {leaf}
                </button>
              );
            })}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          Dica: usa “/” no nome da pasta para criar subpastas (ex.: <code>Trabalho/Projetos</code>).
        </p>
      </div>

      {message ? (
        <div className="rounded-3xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary-foreground">
          {message}
        </div>
      ) : null}

      <div className="">
        {loading ? (
          <div className="glass-card p-10 text-center text-muted-foreground">A carregar ficheiros...</div>
        ) : filteredFiles.length === 0 ? (
          <div className="glass-card p-10 text-center text-muted-foreground">Sem ficheiros. Carrega o primeiro ficheiro para ativar a tua biblioteca.</div>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {filteredFiles.map((file) => (
              <div key={file.id} className="glass-card glass-card-hover overflow-hidden rounded-3xl p-4 transition hover:-translate-y-1">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-accent text-primary shadow-glow">
                      {getIconByType(file.mimeType)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{getDisplayName(file)}</p>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{file.metadata.folder || "Sem pasta"}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-secondary px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-secondary-foreground">
                    {formatSize(file.size)}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {file.metadata.project ? (
                    <span className="rounded-full border border-border px-2 py-1">{file.metadata.project}</span>
                  ) : null}
                  {(file.metadata.tags ?? [])
                    .filter(Boolean)
                    .map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-1">
                        <Tag className="h-3.5 w-3.5" />
                        {tag}
                      </span>
                    ))}
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handlePreview(file)}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm text-muted-foreground transition hover:border-primary hover:text-primary"
                  >
                    <Eye className="h-4 w-4" />
                    Ver
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload(file)}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:shadow-glow"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingTagsFile(file)}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm text-muted-foreground transition hover:border-primary hover:text-primary"
                  >
                    <Tag className="h-4 w-4" />
                    Editar tags
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(file)}
                    className="inline-flex items-center gap-2 rounded-full border border-destructive/70 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive transition hover:bg-destructive/20"
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar
                  </button>

                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-card p-4">
            <table className="w-full table-auto text-sm">
              <thead>
                <tr className="text-muted-foreground text-left">
                  <th className="py-3">Ficheiro</th>
                  <th className="py-3">Pasta</th>
                  <th className="py-3">Projeto</th>
                  <th className="py-3">Tags</th>
                  <th className="py-3">Tamanho</th>
                  <th className="py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map((file) => (
                  <tr key={file.id} className="border-t border-border">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-primary">{getIconByType(file.mimeType)}</div>
                        <div>
                          <div className="font-medium">{getDisplayName(file)}</div>
                          <div className="text-xs text-muted-foreground">{file.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3">{file.metadata.folder || 'Sem pasta'}</td>
                    <td className="py-3">{file.metadata.project || ''}</td>
                    <td className="py-3">{(file.metadata.tags ?? []).join(', ')}</td>
                    <td className="py-3">{formatSize(file.size)}</td>
                    <td className="py-3">
                      <div className="inline-flex items-center gap-2">
                        <button onClick={() => handlePreview(file)} className="text-muted-foreground hover:text-primary">Ver</button>
                        <button onClick={() => handleDownload(file)} className="text-primary font-semibold">Download</button>
                        <button onClick={() => setEditingTagsFile(file)} className="text-muted-foreground hover:text-primary">Tags</button>
                        <button onClick={() => handleDelete(file)} className="text-destructive">Eliminar</button>
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {previewFile ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-border bg-background p-6 shadow-glow">
            <button
              type="button"
              onClick={() => {
                setPreviewFile(null);
                setPreviewUrl(null);
              }}
              className="absolute right-4 top-4 rounded-full border border-border bg-background p-2 text-muted-foreground hover:text-primary"
            >
              ✕
            </button>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-lg font-semibold">Pré-visualização</p>
                <p className="text-sm text-muted-foreground">{getDisplayName(previewFile)}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDownload(previewFile)}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:shadow-glow"
              >
                <Download className="h-4 w-4" />
                Download
              </button>
            </div>
            {previewLoading || !previewUrl ? (
              <div className="flex min-h-[260px] items-center justify-center rounded-3xl border border-border bg-background/80 text-sm text-muted-foreground">
                {previewLoading ? "A gerar pré-visualização..." : "Preparar pré-visualização..."}
              </div>
            ) : previewFile.mimeType.startsWith("image/") ? (
              <img src={previewUrl} alt={getDisplayName(previewFile)} className="mx-auto max-h-[620px] rounded-3xl object-contain" />
            ) : previewFile.mimeType.startsWith("video/") ? (
              <video
                controls
                src={previewUrl}
                className="mx-auto max-h-[620px] rounded-3xl bg-black"
              />
            ) : previewFile.mimeType === "application/pdf" ? (
              <iframe src={previewUrl} className="h-[640px] w-full rounded-3xl border border-border" />
            ) : (
              <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-3xl border border-border bg-background/80 text-sm text-muted-foreground">
                <p>Pré-visualização não disponível para este tipo de ficheiro.</p>
                <p>Clica em Download para abrir no visor do teu dispositivo.</p>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {editingTagsFile && (
        <EditFileTagsDialog
          file={editingTagsFile}
          suggestions={tagOptions}
          onClose={() => setEditingTagsFile(null)}
          onSave={(next) => updateFileTags(editingTagsFile, next)}
        />
      )}
    </div>
  );
}

function EditFileTagsDialog({
  file,
  suggestions,
  onClose,
  onSave,
}: {
  file: StoredFile;
  suggestions: string[];
  onClose: () => void;
  onSave: (tags: string[]) => Promise<void> | void;
}) {
  const [tags, setTags] = useState<string[]>(file.metadata.tags ?? []);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    await onSave(tags);
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm grid place-items-center p-4">
      <div className="glass-card neon-border w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold neon-text">Editar tags</h3>
          <button onClick={onClose} className="p-1 hover:text-primary">✕</button>
        </div>
        <p className="text-xs text-muted-foreground truncate">{file.metadata.original_name || file.name}</p>
        <TagInput value={tags} onChange={setTags} suggestions={suggestions} />
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm hover:bg-accent">Cancelar</button>
          <button
            onClick={save}
            disabled={busy}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-primary to-primary-glow text-primary-foreground hover:shadow-glow-strong disabled:opacity-50"
          >
            {busy ? "A guardar..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

