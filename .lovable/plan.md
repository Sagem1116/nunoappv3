## Módulos a adicionar

### 1. Tarefas (`/tarefas`)
Tabela `tasks` no Supabase com RLS por `user_id`:
- `id, user_id, title, description, priority (low|medium|high), due_date, status (pending|done), created_at, updated_at`

UI:
- Botão "Nova tarefa" → diálogo (shadcn Dialog + Form + Zod)
- Tabs **Hoje / Semana / Mês**
  - Hoje: lista das tarefas com `due_date = hoje` + atrasadas
  - Semana: agrupado por dia (Seg–Dom da semana corrente)
  - Mês: grelha 7×N tipo calendário, com pontos coloridos por prioridade
- Filtros (barra superior): prioridade, estado, intervalo de datas
- Checkbox neon para marcar concluído (toggle status)
- Edição inline (clicar no card abre o diálogo)
- Cores por prioridade: baixa=primary, média=amarelo neon, alta=vermelho neon

### 2. Viagens (`/viagens`)
Duas tabelas:
- `trips`: `id, user_id, destination, start_date, end_date, budget, notes, created_at`
- `trip_items`: `id, trip_id, user_id, kind (checklist|link|idea), label, url?, done (bool), created_at`

UI:
- Lista de viagens em cards neon (destino, datas, orçamento, badge Futura/Em curso/Passada)
- Botão "Nova viagem" → diálogo
- Clicar num card → rota `/viagens/$id` com:
  - Cabeçalho com info da viagem (editável)
  - 3 secções: **Checklist** (itens com checkbox), **Links úteis** (label + url), **Ideias** (texto)
  - Adicionar/remover/marcar itens com sync optimistic via React Query

### Stack
- Supabase (tabelas + RLS + migrações)
- React Query para fetch/mutate (já no projeto)
- shadcn: Dialog, Form, Input, Textarea, Select, Tabs, Checkbox, Calendar, Popover, Badge
- date-fns para semana/mês
- Estilo neon consistente com `neon-text`, `neon-border`, `glass-card` já existentes em `styles.css`

### Ficheiros a criar
```
supabase/migrations/<ts>_tasks_and_trips.sql
src/lib/api/tasks.ts          (queries/mutations)
src/lib/api/trips.ts
src/components/tasks/task-dialog.tsx
src/components/tasks/task-card.tsx
src/components/tasks/task-filters.tsx
src/components/tasks/views/{daily,weekly,monthly}-view.tsx
src/components/trips/trip-dialog.tsx
src/components/trips/trip-card.tsx
src/components/trips/trip-item-list.tsx
src/routes/_app.tarefas.tsx   (substituir placeholder)
src/routes/_app.viagens.tsx   (substituir placeholder)
src/routes/_app.viagens.$tripId.tsx
```

Confirmas para avançar?