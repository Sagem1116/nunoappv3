import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Mail, Send, Archive, Trash2, MailOpen, Search, Plus, LogOut, RefreshCw } from "lucide-react";
import { connectAppUser } from "@/integrations/lovable/appUserConnectorClient";
import {
  startEmailConnect,
  saveEmailConnection,
  listEmailConnections,
  disconnectEmail,
  listMessages,
  getMessage,
  sendMessage,
  modifyMessage,
} from "@/lib/email.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/email")({
  component: EmailPage,
  head: () => ({ meta: [{ title: "Email" }] }),
});

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";

type Provider = "gmail" | "outlook";

function EmailPage() {
  const qc = useQueryClient();
  const startConnectFn = useServerFn(startEmailConnect);
  const saveConnFn = useServerFn(saveEmailConnection);
  const listConnFn = useServerFn(listEmailConnections);
  const disconnectFn = useServerFn(disconnectEmail);
  const listFn = useServerFn(listMessages);
  const getFn = useServerFn(getMessage);
  const sendFn = useServerFn(sendMessage);
  const modifyFn = useServerFn(modifyMessage);

  const [activeProvider, setActiveProvider] = useState<Provider | null>(null);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<{ to: string; subject: string; id?: string } | null>(null);

  const connQ = useQuery({
    queryKey: ["email-connections"],
    queryFn: () => listConnFn(),
  });

  // Auto-select first connection
  if (!activeProvider && connQ.data?.connections.length) {
    setActiveProvider(connQ.data.connections[0].provider as Provider);
  }

  const inboxQ = useQuery({
    queryKey: ["email-inbox", activeProvider, appliedSearch],
    queryFn: () => listFn({ data: { provider: activeProvider!, query: appliedSearch || undefined } }),
    enabled: !!activeProvider,
  });

  const msgQ = useQuery({
    queryKey: ["email-msg", activeProvider, selectedId],
    queryFn: () => getFn({ data: { provider: activeProvider!, id: selectedId! } }),
    enabled: !!activeProvider && !!selectedId,
  });

  const connectMut = useMutation({
    mutationFn: async (provider: Provider) => {
      const result = await connectAppUser({
        connectorId: provider === "gmail" ? "google_mail" : "microsoft_outlook",
        gatewayBaseUrl: GATEWAY_BASE_URL,
        start: (targetOrigin) => startConnectFn({ data: { provider, targetOrigin } }),
      });
      if (!result.success || !result.connectionAPIKey) throw new Error(result.error || "Falhou");
      await saveConnFn({ data: { provider, connectionApiKey: result.connectionAPIKey } });
      return provider;
    },
    onSuccess: (provider) => {
      toast.success(`${provider === "gmail" ? "Gmail" : "Outlook"} ligado`);
      setActiveProvider(provider);
      qc.invalidateQueries({ queryKey: ["email-connections"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disconnectMut = useMutation({
    mutationFn: (provider: Provider) => disconnectFn({ data: { provider } }),
    onSuccess: () => {
      toast.success("Desligado");
      setActiveProvider(null);
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ["email-connections"] });
    },
  });

  const sendMut = useMutation({
    mutationFn: (d: { to: string; subject: string; body: string; replyToId?: string }) =>
      sendFn({ data: { provider: activeProvider!, ...d } }),
    onSuccess: () => {
      toast.success("Email enviado");
      setComposeOpen(false);
      setReplyTo(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const modifyMut = useMutation({
    mutationFn: (d: { id: string; action: "markRead" | "markUnread" | "archive" | "trash" }) =>
      modifyFn({ data: { provider: activeProvider!, ...d } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-inbox"] });
      setSelectedId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const connections = connQ.data?.connections ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Mail className="h-6 w-6" /> Email
        </h1>
        <div className="flex items-center gap-2">
          {!connections.some((c) => c.provider === "gmail") && (
            <Button variant="outline" size="sm" onClick={() => connectMut.mutate("gmail")} disabled={connectMut.isPending}>
              <Plus className="h-4 w-4 mr-1" /> Ligar Gmail
            </Button>
          )}
          {!connections.some((c) => c.provider === "outlook") && (
            <Button variant="outline" size="sm" onClick={() => connectMut.mutate("outlook")} disabled={connectMut.isPending}>
              <Plus className="h-4 w-4 mr-1" /> Ligar Outlook
            </Button>
          )}
        </div>
      </div>

      {connections.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <Mail className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-4">
            Liga uma conta para começares a ler e responder a emails.
          </p>
        </div>
      ) : (
        <>
          {/* Account tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {connections.map((c) => (
              <button
                key={c.id}
                onClick={() => { setActiveProvider(c.provider as Provider); setSelectedId(null); }}
                className={[
                  "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border",
                  activeProvider === c.provider
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border hover:bg-accent",
                ].join(" ")}
              >
                <Mail className="h-3.5 w-3.5" />
                <span className="capitalize">{c.provider}</span>
                {c.email_address && <span className="opacity-70 text-xs">· {c.email_address}</span>}
              </button>
            ))}
            {activeProvider && (
              <Button
                variant="ghost" size="sm"
                onClick={() => disconnectMut.mutate(activeProvider)}
                disabled={disconnectMut.isPending}
              >
                <LogOut className="h-4 w-4 mr-1" /> Desligar
              </Button>
            )}
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Pesquisar emails..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") setAppliedSearch(search); }}
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => setAppliedSearch(search)}>
              Pesquisar
            </Button>
            <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["email-inbox"] })}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={() => { setReplyTo(null); setComposeOpen(true); }}>
              <Send className="h-4 w-4 mr-1" /> Novo
            </Button>
          </div>

          {/* List + detail */}
          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              {inboxQ.isLoading ? (
                <div className="p-6 text-sm text-muted-foreground text-center">A carregar...</div>
              ) : inboxQ.error ? (
                <div className="p-6 text-sm text-destructive">{(inboxQ.error as Error).message}</div>
              ) : (
                <ul className="divide-y divide-border max-h-[70vh] overflow-y-auto">
                  {(inboxQ.data?.messages ?? []).map((m: any) => (
                    <li
                      key={m.id}
                      onClick={() => setSelectedId(m.id)}
                      className={[
                        "p-3 cursor-pointer hover:bg-accent/40 transition-colors",
                        selectedId === m.id && "bg-accent",
                        m.unread && "font-semibold",
                      ].filter(Boolean).join(" ")}
                    >
                      <div className="text-xs text-muted-foreground truncate">{m.from}</div>
                      <div className="text-sm truncate">{m.subject || "(sem assunto)"}</div>
                      <div className="text-xs text-muted-foreground truncate">{m.snippet}</div>
                    </li>
                  ))}
                  {(inboxQ.data?.messages ?? []).length === 0 && (
                    <li className="p-6 text-sm text-muted-foreground text-center">Sem emails</li>
                  )}
                </ul>
              )}
            </div>

            <div className="rounded-lg border border-border bg-card p-4 min-h-[300px]">
              {!selectedId ? (
                <div className="text-sm text-muted-foreground text-center py-12">
                  Seleciona um email
                </div>
              ) : msgQ.isLoading ? (
                <div className="text-sm text-muted-foreground">A carregar...</div>
              ) : msgQ.data ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold">{msgQ.data.subject || "(sem assunto)"}</h2>
                      <div className="text-xs text-muted-foreground">De: {msgQ.data.from}</div>
                      <div className="text-xs text-muted-foreground">Para: {msgQ.data.to}</div>
                      <div className="text-xs text-muted-foreground">{msgQ.data.date}</div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="outline" onClick={() => {
                        setReplyTo({ to: msgQ.data!.from, subject: `Re: ${msgQ.data!.subject}`, id: msgQ.data!.id });
                        setComposeOpen(true);
                      }}>
                        <Send className="h-3.5 w-3.5 mr-1" /> Responder
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => modifyMut.mutate({ id: selectedId, action: "markRead" })}>
                        <MailOpen className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => modifyMut.mutate({ id: selectedId, action: "archive" })}>
                        <Archive className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => modifyMut.mutate({ id: selectedId, action: "trash" })}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="border-t border-border pt-3">
                    {msgQ.data.bodyHtml ? (
                      <iframe
                        title="email"
                        srcDoc={msgQ.data.bodyHtml}
                        sandbox=""
                        className="w-full min-h-[400px] bg-white rounded"
                      />
                    ) : (
                      <pre className="whitespace-pre-wrap text-sm font-sans">{msgQ.data.bodyText}</pre>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}

      <ComposeDialog
        open={composeOpen}
        onOpenChange={(o) => { setComposeOpen(o); if (!o) setReplyTo(null); }}
        initial={replyTo}
        pending={sendMut.isPending}
        onSend={(d) => sendMut.mutate({ ...d, replyToId: replyTo?.id })}
      />
    </div>
  );
}

function ComposeDialog({
  open, onOpenChange, initial, pending, onSend,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: { to: string; subject: string; id?: string } | null;
  pending: boolean;
  onSend: (d: { to: string; subject: string; body: string }) => void;
}) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  // reset when open
  if (open && initial && to === "" && subject === "") {
    setTo(initial.to);
    setSubject(initial.subject);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => {
      onOpenChange(o);
      if (!o) { setTo(""); setSubject(""); setBody(""); }
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Responder" : "Nova mensagem"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Para" value={to} onChange={(e) => setTo(e.target.value)} />
          <Input placeholder="Assunto" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <Textarea placeholder="Mensagem..." rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={pending || !to || !body} onClick={() => onSend({ to, subject, body })}>
            <Send className="h-4 w-4 mr-1" /> Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
