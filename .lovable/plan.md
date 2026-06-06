# Plano — Horas em tarefas + notificações início/fim

## 1. Horas nas tarefas

`tasks.due_date` é `DATE`. Adiciono duas colunas opcionais via migração:

- `start_time TIME NULL`
- `end_time TIME NULL`

**UI (`_app.tarefas.tsx`, diálogo):**
- Dois `<input type="time">` ("Início" e "Fim"), só ativos se houver `due_date`.
- Validação: se ambos preenchidos, `end_time > start_time`.
- Cartões/listas mostram `09:00–10:30` ao lado da data.

## 2. Notificações de início e fim

Estender `notification-scheduler.ts`:

- **Pré-aviso de início** — dispara 5 min antes de `due_date + start_time` (configurável: 0/5/10/15). Key `task-pre:{id}`.
- **Início** — dispara em `due_date + start_time` (±5 min de tolerância). Key `task-start:{id}`.
- **Fim** — dispara em `due_date + end_time`. Key `task-end:{id}`.
- Só `status = pending`. Ignora se já passou >1h.
- Adiciono listener `visibilitychange` em `_app.tsx` para correr o check quando a aba volta ao foco.

**Settings (`notifications.ts` + `notifications-settings.tsx`):**
- Toggle "Avisar ao começar tarefa" (default on)
- Toggle "Avisar ao terminar tarefa" (default on)
- Selector "Pré-aviso antes de começar": 0 / **5 (default)** / 10 / 15 min
- Mantém o existente "Prazo a chegar".

## 3. Melhorias adicionais aprovadas (a + c + d)

**a. Filtro por prioridade** — opção "Notificar só tarefas de prioridade alta". Aplica-se aos avisos de prazo, início e fim.

**c. Snooze ao clicar** — botões de acção nativos não são fiáveis em todos os browsers, por isso ao **clicar na notificação** abre `/tarefas` com um toast a oferecer "Adiar 10 min". O snooze remove a key `notifications:sent` correspondente e agenda re-disparo daqui a 10 min (guardado em `localStorage` `notifications:snooze`).

**d. Pré-aviso configurável** — já coberto acima (selector 0/5/10/15 min, default 5).

## Ficheiros afectados

**Migração:**
- `ALTER TABLE public.tasks ADD COLUMN start_time TIME, ADD COLUMN end_time TIME;`

**Frontend:**
- `src/routes/_app.tarefas.tsx` — inputs de hora + render.
- `src/lib/notifications.ts` — novas chaves: `taskStartEnabled`, `taskEndEnabled`, `startLeadMinutes`, `priorityHighOnly`; helpers `snooze(key, minutes)`.
- `src/lib/notification-scheduler.ts` — `checkTaskStart`, `checkTaskEnd`, processar snoozes pendentes, filtrar por prioridade.
- `src/components/notifications-settings.tsx` — novos toggles + selectors.
- `src/routes/_app.tsx` — listener `visibilitychange`.

## Limitações honestas

- Notificações só com a PWA aberta (mesmo minimizada). App fechada requer Web Push — fica para mais tarde.
- Precisão ±5 min (intervalo do scheduler). Suficiente para começar/acabar tarefas; se quiseres precisão ao segundo posso usar `setTimeout` por tarefa.
