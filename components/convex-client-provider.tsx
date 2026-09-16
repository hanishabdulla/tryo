"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useMemo, type ReactNode } from "react";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const client = useMemo(() => {
    if (!url) return null;
    return new ConvexReactClient(url);
  }, [url]);

  if (!url || !client) {
    return (
      <div className="min-h-screen bg-zinc-950 p-8 text-zinc-100">
        <h1 className="text-2xl font-semibold tracking-tight">Tryo POS</h1>
        <p className="mt-4 max-w-lg text-zinc-400">
          Add{" "}
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm text-[#34c68a]">
            NEXT_PUBLIC_CONVEX_URL
          </code>{" "}
          to{" "}
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm text-[#34c68a]">
            .env.local
          </code>
          . Run{" "}
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm text-[#34c68a]">
            npx convex dev
          </code>{" "}
          to create a deployment and sync environment variables.
        </p>
      </div>
    );
  }

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
