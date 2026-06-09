import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  authorizeAppUserOAuth,
  callAsAppUser,
} from "@/integrations/lovable/appUserConnector";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";

type Provider = "gmail" | "outlook";

const PROVIDER_CONFIG: Record<Provider, {
  connectorId: string;
  clientIdEnv: string;
  scopes: string[];
}> = {
  gmail: {
    connectorId: "google_mail",
    clientIdEnv: "GOOGLE_APP_USER_CONNECTOR_CLIENT_ID",
    scopes: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
  },
  outlook: {
    connectorId: "microsoft_outlook",
    clientIdEnv: "MICROSOFT_APP_USER_CONNECTOR_CLIENT_ID",
    scopes: [
      "offline_access",
      "Mail.ReadWrite",
      "Mail.Send",
      "User.Read",
    ],
  },
};

// ---------- OAuth ----------
export const startEmailConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { provider: Provider; targetOrigin: string }) =>
    z.object({
      provider: z.enum(["gmail", "outlook"]),
      targetOrigin: z.string().url(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const cfg = PROVIDER_CONFIG[data.provider];
    const clientId = process.env[cfg.clientIdEnv];
    if (!clientId) {
      throw new Error(
        `${cfg.clientIdEnv} não está configurado. Configure as credenciais OAuth de ${data.provider}.`,
      );
    }
    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: cfg.connectorId,
      appUserId: context.userId,
      connectorClientId: clientId,
      returnUrl: data.targetOrigin + "/email",
      responseMode: "web_message",
      webMessageTargetOrigin: data.targetOrigin,
      credentialsConfiguration: { scopes: cfg.scopes },
    });
    return { authorizationUrl };
  });

export const saveEmailConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { provider: Provider; connectionApiKey: string }) =>
    z.object({
      provider: z.enum(["gmail", "outlook"]),
      connectionApiKey: z.string().min(1).max(500),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // try to detect email address
    let email: string | null = null;
    try {
      if (data.provider === "gmail") {
        const r = await callAsAppUser({
          gatewayBaseUrl: GATEWAY_BASE_URL,
          connectionAPIKey: data.connectionApiKey,
          connectorId: "google_mail",
          path: "/gmail/v1/users/me/profile",
        });
        if (r.ok) {
          const j = await r.json() as { emailAddress?: string };
          email = j.emailAddress ?? null;
        }
      } else {
        const r = await callAsAppUser({
          gatewayBaseUrl: GATEWAY_BASE_URL,
          connectionAPIKey: data.connectionApiKey,
          connectorId: "microsoft_outlook",
          path: "/me",
        });
        if (r.ok) {
          const j = await r.json() as { mail?: string; userPrincipalName?: string };
          email = j.mail ?? j.userPrincipalName ?? null;
        }
      }
    } catch { /* ignore */ }

    const { error } = await supabase.from("email_connections").upsert({
      user_id: userId,
      provider: data.provider,
      connection_api_key: data.connectionApiKey,
      email_address: email,
    }, { onConflict: "user_id,provider" });
    if (error) throw new Error(error.message);
    return { ok: true, email };
  });

export const listEmailConnections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("email_connections")
      .select("id, provider, email_address, created_at")
      .order("created_at");
    if (error) throw new Error(error.message);
    return { connections: data ?? [] };
  });

export const disconnectEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { provider: Provider }) =>
    z.object({ provider: z.enum(["gmail", "outlook"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("email_connections")
      .delete()
      .eq("user_id", userId)
      .eq("provider", data.provider);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Helpers ----------
async function getKey(supabase: any, userId: string, provider: Provider): Promise<string> {
  const { data, error } = await supabase
    .from("email_connections")
    .select("connection_api_key")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Sem ligação ${provider}`);
  return data.connection_api_key as string;
}

function decodeB64Url(s: string): string {
  try {
    const pad = s.length % 4 === 2 ? "==" : s.length % 4 === 3 ? "=" : "";
    return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64").toString("utf-8");
  } catch { return ""; }
}

function encodeB64Url(s: string): string {
  return Buffer.from(s, "utf-8").toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ---------- List inbox ----------
export const listMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { provider: Provider; query?: string; pageToken?: string }) =>
    z.object({
      provider: z.enum(["gmail", "outlook"]),
      query: z.string().max(500).optional(),
      pageToken: z.string().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const key = await getKey(context.supabase, context.userId, data.provider);
    if (data.provider === "gmail") {
      const params = new URLSearchParams({ maxResults: "25" });
      if (data.query) params.set("q", data.query);
      if (data.pageToken) params.set("pageToken", data.pageToken);
      const listRes = await callAsAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionAPIKey: key,
        connectorId: "google_mail",
        path: `/gmail/v1/users/me/messages?${params}`,
      });
      if (!listRes.ok) throw new Error(`Gmail list ${listRes.status}: ${await listRes.text()}`);
      const list = await listRes.json() as { messages?: { id: string }[]; nextPageToken?: string };
      const ids = (list.messages ?? []).slice(0, 25).map((m) => m.id);
      const metas = await Promise.all(ids.map(async (id) => {
        const r = await callAsAppUser({
          gatewayBaseUrl: GATEWAY_BASE_URL,
          connectionAPIKey: key,
          connectorId: "google_mail",
          path: `/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        });
        if (!r.ok) return null;
        const m = await r.json() as any;
        const headers: { name: string; value: string }[] = m.payload?.headers ?? [];
        const h = (n: string) => headers.find((x) => x.name.toLowerCase() === n.toLowerCase())?.value ?? "";
        return {
          id: m.id as string,
          threadId: m.threadId as string,
          subject: h("Subject"),
          from: h("From"),
          date: h("Date"),
          snippet: (m.snippet as string) ?? "",
          unread: (m.labelIds ?? []).includes("UNREAD"),
        };
      }));
      return { messages: metas.filter(Boolean), nextPageToken: list.nextPageToken ?? null };
    } else {
      const params = new URLSearchParams({
        $top: "25",
        $select: "id,subject,from,receivedDateTime,bodyPreview,isRead",
        $orderby: "receivedDateTime desc",
      });
      if (data.query) params.set("$search", `"${data.query.replace(/"/g, "")}"`);
      const url = data.pageToken ?? `/me/messages?${params}`;
      const r = await callAsAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionAPIKey: key,
        connectorId: "microsoft_outlook",
        path: url,
      });
      if (!r.ok) throw new Error(`Outlook list ${r.status}: ${await r.text()}`);
      const j = await r.json() as any;
      const messages = (j.value ?? []).map((m: any) => ({
        id: m.id,
        threadId: m.conversationId ?? m.id,
        subject: m.subject ?? "",
        from: m.from?.emailAddress ? `${m.from.emailAddress.name ?? ""} <${m.from.emailAddress.address}>` : "",
        date: m.receivedDateTime ?? "",
        snippet: m.bodyPreview ?? "",
        unread: !m.isRead,
      }));
      return { messages, nextPageToken: j["@odata.nextLink"] ?? null };
    }
  });

// ---------- Get message ----------
export const getMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { provider: Provider; id: string }) =>
    z.object({
      provider: z.enum(["gmail", "outlook"]),
      id: z.string().min(1).max(500),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const key = await getKey(context.supabase, context.userId, data.provider);
    if (data.provider === "gmail") {
      const r = await callAsAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionAPIKey: key,
        connectorId: "google_mail",
        path: `/gmail/v1/users/me/messages/${data.id}?format=full`,
      });
      if (!r.ok) throw new Error(`Gmail get ${r.status}`);
      const m = await r.json() as any;
      const headers: { name: string; value: string }[] = m.payload?.headers ?? [];
      const h = (n: string) => headers.find((x) => x.name.toLowerCase() === n.toLowerCase())?.value ?? "";
      // find body
      let bodyText = "";
      let bodyHtml = "";
      const walk = (p: any) => {
        if (!p) return;
        if (p.mimeType === "text/plain" && p.body?.data) bodyText += decodeB64Url(p.body.data);
        if (p.mimeType === "text/html" && p.body?.data) bodyHtml += decodeB64Url(p.body.data);
        if (Array.isArray(p.parts)) p.parts.forEach(walk);
      };
      walk(m.payload);
      if (!bodyText && !bodyHtml && m.payload?.body?.data) bodyText = decodeB64Url(m.payload.body.data);
      return {
        id: m.id, threadId: m.threadId,
        subject: h("Subject"), from: h("From"), to: h("To"), date: h("Date"),
        bodyText, bodyHtml,
      };
    } else {
      const r = await callAsAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionAPIKey: key,
        connectorId: "microsoft_outlook",
        path: `/me/messages/${data.id}`,
      });
      if (!r.ok) throw new Error(`Outlook get ${r.status}`);
      const m = await r.json() as any;
      return {
        id: m.id, threadId: m.conversationId ?? m.id,
        subject: m.subject ?? "",
        from: m.from?.emailAddress ? `${m.from.emailAddress.name ?? ""} <${m.from.emailAddress.address}>` : "",
        to: (m.toRecipients ?? []).map((r: any) => r.emailAddress?.address).filter(Boolean).join(", "),
        date: m.receivedDateTime ?? "",
        bodyText: m.body?.contentType === "Text" ? (m.body?.content ?? "") : "",
        bodyHtml: m.body?.contentType === "HTML" ? (m.body?.content ?? "") : "",
      };
    }
  });

// ---------- Send / Reply ----------
export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    provider: Provider; to: string; subject: string; body: string;
    replyToId?: string;
  }) =>
    z.object({
      provider: z.enum(["gmail", "outlook"]),
      to: z.string().min(3).max(500),
      subject: z.string().max(500),
      body: z.string().max(50000),
      replyToId: z.string().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const key = await getKey(context.supabase, context.userId, data.provider);
    if (data.provider === "gmail") {
      const raw = encodeB64Url(
        [
          `To: ${data.to}`,
          `Subject: ${data.subject}`,
          'Content-Type: text/plain; charset="UTF-8"',
          "",
          data.body,
        ].join("\r\n"),
      );
      const r = await callAsAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionAPIKey: key,
        connectorId: "google_mail",
        path: "/gmail/v1/users/me/messages/send",
        init: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ raw }),
        },
      });
      if (!r.ok) throw new Error(`Gmail send ${r.status}: ${await r.text()}`);
      return { ok: true };
    } else {
      if (data.replyToId) {
        const r = await callAsAppUser({
          gatewayBaseUrl: GATEWAY_BASE_URL,
          connectionAPIKey: key,
          connectorId: "microsoft_outlook",
          path: `/me/messages/${data.replyToId}/reply`,
          init: {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ comment: data.body }),
          },
        });
        if (!r.ok) throw new Error(`Outlook reply ${r.status}: ${await r.text()}`);
        return { ok: true };
      }
      const r = await callAsAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionAPIKey: key,
        connectorId: "microsoft_outlook",
        path: "/me/sendMail",
        init: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: {
              subject: data.subject,
              body: { contentType: "Text", content: data.body },
              toRecipients: [{ emailAddress: { address: data.to } }],
            },
          }),
        },
      });
      if (!r.ok) throw new Error(`Outlook send ${r.status}: ${await r.text()}`);
      return { ok: true };
    }
  });

// ---------- Modify (read/archive/trash) ----------
export const modifyMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    provider: Provider; id: string;
    action: "markRead" | "markUnread" | "archive" | "trash";
  }) =>
    z.object({
      provider: z.enum(["gmail", "outlook"]),
      id: z.string().min(1).max(500),
      action: z.enum(["markRead", "markUnread", "archive", "trash"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const key = await getKey(context.supabase, context.userId, data.provider);
    if (data.provider === "gmail") {
      if (data.action === "trash") {
        const r = await callAsAppUser({
          gatewayBaseUrl: GATEWAY_BASE_URL,
          connectionAPIKey: key,
          connectorId: "google_mail",
          path: `/gmail/v1/users/me/messages/${data.id}/trash`,
          init: { method: "POST" },
        });
        if (!r.ok) throw new Error(`Gmail trash ${r.status}`);
        return { ok: true };
      }
      const body: { addLabelIds: string[]; removeLabelIds: string[] } = { addLabelIds: [], removeLabelIds: [] };
      if (data.action === "markRead") body.removeLabelIds.push("UNREAD");
      if (data.action === "markUnread") body.addLabelIds.push("UNREAD");
      if (data.action === "archive") body.removeLabelIds.push("INBOX");
      const r = await callAsAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionAPIKey: key,
        connectorId: "google_mail",
        path: `/gmail/v1/users/me/messages/${data.id}/modify`,
        init: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      });
      if (!r.ok) throw new Error(`Gmail modify ${r.status}`);
      return { ok: true };
    } else {
      if (data.action === "trash") {
        const r = await callAsAppUser({
          gatewayBaseUrl: GATEWAY_BASE_URL,
          connectionAPIKey: key,
          connectorId: "microsoft_outlook",
          path: `/me/messages/${data.id}/move`,
          init: {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ destinationId: "deleteditems" }),
          },
        });
        if (!r.ok) throw new Error(`Outlook trash ${r.status}`);
        return { ok: true };
      }
      if (data.action === "archive") {
        const r = await callAsAppUser({
          gatewayBaseUrl: GATEWAY_BASE_URL,
          connectionAPIKey: key,
          connectorId: "microsoft_outlook",
          path: `/me/messages/${data.id}/move`,
          init: {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ destinationId: "archive" }),
          },
        });
        if (!r.ok) throw new Error(`Outlook archive ${r.status}`);
        return { ok: true };
      }
      const r = await callAsAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionAPIKey: key,
        connectorId: "microsoft_outlook",
        path: `/me/messages/${data.id}`,
        init: {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isRead: data.action === "markRead" }),
        },
      });
      if (!r.ok) throw new Error(`Outlook modify ${r.status}`);
      return { ok: true };
    }
  });
