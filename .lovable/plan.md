# Notificações Push com Firebase Cloud Messaging

Vais receber notificações no telemóvel mesmo com a app fechada, replicando o que o scheduler local já faz (pré-aviso/início de tarefas, prazos a chegar, resumo diário).

## O que precisas fazer (manual, antes de eu começar)

1. **Criar projeto Firebase** em https://console.firebase.google.com (gratuito).
2. Em *Project Settings → Cloud Messaging*: gerar **VAPID key pair** (Web Push certificates).
3. Em *Project Settings → Service Accounts*: gerar **private key** (JSON).
4. Copiar a config web (apiKey, authDomain, projectId, messagingSenderId, appId).
5. **Instalar a app no telemóvel** (Add to Home Screen). iOS exige 16.4+ e instalação como PWA.

Depois pedes-me os secrets — eu peço-tos via formulário seguro:
- `FIREBASE_SERVICE_ACCOUNT_JSON` (server)
- `VITE_FIREBASE_CONFIG` (client, JSON)
- `VITE_FIREBASE_VAPID_KEY` (client)

## O que eu construo

### 1. Cliente / PWA
- `public/firebase-messaging-sw.js` — service worker dedicado ao FCM (não interfere com o resto, sem cache app-shell).
- `src/lib/push.ts` — pede permissão, regista token FCM, guarda em BD.
- Botão "Ativar notificações no telemóvel" nas *Definições de Notificações*, ao lado do toggle atual.
- Listener `onMessage` para mostrar notificações quando a app está aberta em foreground no telemóvel.

### 2. Base de dados (migration)
- Tabela `push_subscriptions` (user_id, fcm_token, platform, user_agent, last_seen).
- Tabela `push_sent_log` (idempotência server-side, equivalente ao `markSent` do localStorage, para não duplicar push).
- RLS: cada user só vê/gere os próprios tokens.

### 3. Server route `/api/public/hooks/push-tick`
- Corre a cada minuto (pg_cron).
- Autenticada via `apikey` header (anon key) — bypass de /api/public/.
- Lê tarefas pending de todos os users com tokens registados, replica a lógica do `notification-scheduler.ts`:
  - pré-aviso (lead time por tarefa ou global)
  - início / fim
  - prazos a chegar (janela 1h/24h/72h)
  - resumo diário à hora configurada
- Respeita as `notifications:settings` por user → migro essas settings para uma coluna JSON em `profiles` ou nova tabela `notification_preferences` para o server conseguir lê-las.
- Envia via Firebase Admin SDK (`firebase-admin`) com service account.
- Marca enviadas em `push_sent_log` (idempotência).
- Remove tokens inválidos (erro `messaging/registration-token-not-registered`).

### 4. Cron job
- `pg_cron` a cada minuto a chamar o endpoint acima.

## Considerações

- **iOS**: só funciona se a app for instalada como PWA (Add to Home Screen) em iOS 16.4+. Em Safari mobile sem instalar, não há push.
- **Android Chrome**: funciona instalado ou não.
- O scheduler local atual mantém-se para desktop com app aberta — não removo nada.
- As preferências de notificação precisam de ir para a BD (hoje estão em localStorage do browser). Caso contrário o servidor não sabe quando avisar.

## Estrutura técnica resumida

```text
public/firebase-messaging-sw.js     ← SW dedicado FCM
src/lib/push.ts                     ← getToken, request permission
src/lib/firebase.ts                 ← init client SDK
src/components/notifications-settings.tsx  ← + secção "Telemóvel"
supabase/migrations/*.sql           ← push_subscriptions, push_sent_log,
                                      notification_preferences
src/routes/api/public/hooks/push-tick.ts   ← cron endpoint, firebase-admin
+ pg_cron schedule via supabase--insert
```

Confirma e avanço para build.
