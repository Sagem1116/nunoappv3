import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/news")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const NEWS_API_KEY = process.env.NEWS_API_KEY;
        if (!NEWS_API_KEY) {
          return new Response("NEWS_API_KEY em falta", { status: 500 });
        }

        const url = new URL(request.url);
        const query = url.searchParams.get("q")?.trim();
        const pageSize = url.searchParams.get("pageSize") ?? "5";

        if (!query) {
          return new Response("Query de pesquisa em falta", { status: 400 });
        }

        const params = new URLSearchParams({
          apiKey: NEWS_API_KEY,
          q: query,
          language: "pt",
          sortBy: "publishedAt",
          pageSize,
        });

        const response = await fetch(`https://newsapi.org/v2/everything?${params.toString()}`);
        const data = await response.json();

        return new Response(JSON.stringify(data), {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
