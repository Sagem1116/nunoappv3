
## Objetivo

Tornar a Nuno App instalável no Windows (ícone próprio, abre em janela sem barra do browser) e capaz de enviar notificações desktop nativas para:
1. Tarefas com prazo a chegar
2. Resumo diário (uma notificação por dia)

> Nota: a app **não** vai ficar como ícone permanente no tray do Windows — isso só é possível com Electron. Aqui terás um ícone no ambiente de trabalho / menu Iniciar, e a janela parece uma app nativa quando aberta.

---

## Parte 1 — Instalabilidade (PWA)

Adicionar metadados mínimos para o Chrome/Edge mostrarem "Instalar Nuno App":

- `public/manifest.webmanifest` com nome, ícones, `display: standalone`, `theme_color`, `background_color`.
- Ícones em `public/` (192x192 e 512x512) gerados a partir do logo atual (gradiente primário com sparkle).
- Tags no `<head>` do `__root.tsx`: `<link rel="manifest">`, `theme-color`, `apple-touch-icon`.
- Botão "Instalar app" no topo (TopBar), visível só quando o browser dispara `beforeinstallprompt`. Esconde-se depois de instalada.

Não adiciono service worker nem cache offline — só metadados de instalação, conforme regra do projeto para apps puramente instaláveis.

---

## Parte 2 — Infraestrutura de notificações

### Estratégia

Notificações locais via `Notification API` do browser, agendadas pelo cliente quando a app está aberta (ou na janela PWA instalada). Sem push server, sem custos, sem chaves VAPID.

> Isto significa: as notificações de tarefas e resumo diário disparam quando a janela da PWA está aberta em background. Funciona bem porque a PWA instalada continua a correr em janela própria mesmo minimizada. Se quiseres notificações com a app **fechada**, precisamos depois de Web Push (Firebase) — fica como evolução futura.

### Componentes

1. **`src/lib/notifications.ts`** — wrapper único:
   - `requestPermission()` — pede permissão ao utilizador.
   - `notify(title, options)` — dispara notificação se permissão concedida.
   - `getPermissionState()` — devolve `granted | denied | default`.

2. **`src/components/notifications-settings.tsx`** — painel em `/dashboard` (ou nova secção em Settings) com:
   - Botão "Ativar notificações desktop" (pede permissão).
   - Toggle "Lembretes de tarefas com prazo" + seletor de antecedência (1h, 1 dia, 3 dias antes).
   - Toggle "Resumo diário" + seletor de hora (default 09:00).
   - Estado guardado em `localStorage` (`notifications:settings`).

3. **Scheduler no `_app.tsx`** — `useEffect` que corre a cada 5 minutos enquanto a app está aberta:
   - Lê settings do `localStorage`.
   - Para **tarefas**: query a `tasks` (não concluídas com `due_date` dentro da janela escolhida), dispara notificação ao clicar abre `/tarefas`. Marca em `localStorage` `notified:task:{id}:{window}` para não repetir.
   - Para **resumo diário**: se hora atual ≥ hora configurada e ainda não foi enviado hoje (`notified:daily:YYYY-MM-DD`), agrega:
     - nº de tarefas com prazo hoje
     - nº de notícias novas (último fetch)
     - nº de viagens nos próximos 7 dias
     Dispara 1 notificação que abre `/dashboard`.

### Comportamento de clique

`notification.onclick` foca a janela existente e navega para a rota relevante usando `router.navigate`.

---

## Parte 3 — UX

- Banner discreto no Dashboard (primeiro login pós-deploy): "Instala a Nuno App no teu PC para acesso rápido + ativa notificações". Dispensável.
- Indicador no TopBar: ícone de sino com badge se permissão = `default`, verde se `granted`.

---

## Detalhes técnicos

**Ficheiros novos:**
- `public/manifest.webmanifest`
- `public/icon-192.png`, `public/icon-512.png` (gerados via imagegen)
- `src/lib/notifications.ts`
- `src/components/notifications-settings.tsx`
- `src/components/install-pwa-button.tsx`

**Ficheiros editados:**
- `src/routes/__root.tsx` — adicionar `<link rel="manifest">`, `theme-color`, `apple-touch-icon` no `head()`.
- `src/routes/_app.tsx` — montar o scheduler de notificações (intervalo de 5 min).
- `src/components/top-bar.tsx` — adicionar `<InstallPwaButton />` e indicador de notificações.
- `src/routes/_app.dashboard.tsx` — secção "Notificações" com `<NotificationsSettings />`.

**Restrições respeitadas:**
- Sem service worker (`vite-plugin-pwa` não é adicionado).
- Sem alterações de backend; tudo client-side.
- Sem novas dependências npm.

---

## Limitações honestas

| O que pedes | Esta solução faz? |
|---|---|
| Ícone no ambiente de trabalho Windows | Sim, após "Instalar" no Chrome/Edge |
| Abrir em janela própria com sidebar | Sim |
| Notificações desktop | Sim, quando a janela PWA está aberta (mesmo minimizada) |
| Ícone permanente no tray (canto inferior direito) | **Não** — requer Electron |
| Notificações com app fechada | **Não** nesta versão — requer Web Push |

Se mais tarde quiseres tray real ou notificações com app totalmente fechada, criamos um plano separado para Electron ou Firebase Cloud Messaging.
