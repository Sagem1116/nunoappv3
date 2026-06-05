import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hello World" },
      { name: "description", content: "A minimal React + TypeScript application." },
      { property: "og:title", content: "Hello World" },
      { property: "og:description", content: "A minimal React + TypeScript application." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <h1 className="text-4xl font-bold text-foreground">Hello World</h1>
    </div>
  );
}
