"use client";

import { ConvexClientProvider } from "@/components/convex-client-provider";
import PosApp from "@/components/pos/PosApp";

export default function Home() {
  return (
    <ConvexClientProvider>
      <PosApp />
    </ConvexClientProvider>
  );
}
