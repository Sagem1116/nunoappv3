import { createFileRoute, notFound } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import { MapPin, Calendar as CalIcon, Wallet, Globe, Sparkles, Plane, Coffee, Truck, Activity, FileText } from "lucide-react";
import { getPublicTrip } from "@/lib/trip-share.functions";

export const Route = createFileRoute("/viagem/$slug")({
  loader: async ({ params }) => {
    const result = await getPublicTrip({ data: { slug: params.slug } });
    if (!result.trip) throw notFound();
    return result;
  },
  head: ({ loaderData }) => {
    const trip = loaderData?.trip as any;
    if (!trip) return {};
    const title = `${trip.name || trip.destination} — Viagem partilhada`;
    const desc = trip.description || `${trip.destination}${trip.start_date ? ` — ${trip.start_date}` : ""}`;
    return {
      meta: [
        { title },
        { name: "description", content: desc.slice(0, 160) },
        { property: "og:title", content: title },
        { property: "og:description", content: desc.slice(0, 160) },
        ...(trip.cover_image ? [{ property: "og:image", content: trip.cover_image }] : []),
      ],
    };
  },
  component: PublicTripPage,
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-bold">Viagem não encontrada</h1>
        <p className="text-muted-foreground text-sm mt-2">O link pode ter expirado ou ter sido revogado.</p>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-bold">Erro</h1>
        <p className="text-muted-foreground text-sm mt-2">{error?.message}</p>
      </div>
    </div>
  ),
});

const ICONS: Record<string, typeof Activity> = {
  activity: Activity,
  restaurant: Coffee,
  transport: Truck,
  flight: Plane,
  note: FileText,
};

function PublicTripPage() {
  const { trip, days, planItems } = Route.useLoaderData() as any;

  const itemsByDay = (planItems as any[]).reduce<Record<string, any[]>>((acc, item) => {
    (acc[item.day_id] ||= []).push(item);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/40 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="neon-text font-semibold">Nuno App</span>
            <span className="text-muted-foreground">· Viagem partilhada</span>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Read-only</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        {trip.cover_image && (
          <img src={trip.cover_image} alt="" className="w-full h-64 object-cover rounded-2xl border border-border" />
        )}

        <div className="glass-card neon-border p-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            <span className="neon-text">{trip.name || trip.destination}</span>
          </h1>
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
            {trip.destination && (
              <span className="flex items-center gap-1.5"><Globe className="h-4 w-4" /> {trip.destination}</span>
            )}
            {trip.start_date && (
              <span className="flex items-center gap-1.5">
                <CalIcon className="h-4 w-4" />
                {format(parseISO(trip.start_date), "d MMM yyyy", { locale: pt })}
                {trip.end_date && trip.end_date !== trip.start_date && (
                  <> – {format(parseISO(trip.end_date), "d MMM yyyy", { locale: pt })}</>
                )}
              </span>
            )}
            {trip.budget != null && (
              <span className="flex items-center gap-1.5">
                <Wallet className="h-4 w-4" />
                {Number(trip.budget).toLocaleString("pt-PT", { style: "currency", currency: trip.currency ?? "EUR" })}
              </span>
            )}
          </div>
          {trip.description && <p className="mt-4 text-sm">{trip.description}</p>}
        </div>

        {(days as any[]).length > 0 && (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Itinerário</h2>
            {(days as any[]).map((d) => (
              <div key={d.id} className="glass-card p-5">
                <div className="flex items-baseline justify-between gap-2 mb-3">
                  <h3 className="font-semibold">{d.title || `Dia ${d.day_order + 1}`}</h3>
                  {d.day_date && (
                    <span className="text-xs text-muted-foreground">
                      {format(parseISO(d.day_date), "d MMM yyyy", { locale: pt })}
                    </span>
                  )}
                </div>
                {d.notes && <p className="text-xs text-muted-foreground mb-3">{d.notes}</p>}
                <ul className="space-y-2">
                  {(itemsByDay[d.id] ?? []).map((item) => {
                    const Icon = ICONS[item.item_type] ?? Activity;
                    return (
                      <li key={item.id} className="flex items-start gap-3 p-2 rounded-lg bg-accent/30">
                        <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{item.title}</div>
                          {item.location && <div className="text-xs text-muted-foreground">{item.location}</div>}
                          {item.description && <div className="text-xs text-muted-foreground mt-1">{item.description}</div>}
                        </div>
                        {item.scheduled_at && (
                          <span className="text-xs text-muted-foreground shrink-0">
                            {format(parseISO(item.scheduled_at), "HH:mm")}
                          </span>
                        )}
                      </li>
                    );
                  })}
                  {(itemsByDay[d.id] ?? []).length === 0 && (
                    <li className="text-xs text-muted-foreground italic">Sem itens</li>
                  )}
                </ul>
              </div>
            ))}
          </section>
        )}

        <footer className="text-center text-xs text-muted-foreground py-8">
          Criado em Nuno App
        </footer>
      </main>
    </div>
  );
}
