"use client";

import { ConvexClientProvider } from "@/components/convex-client-provider";
import { TouchKeyboardProvider } from "@/components/touch/TouchKeyboard";
import PosApp from "@/components/pos/PosApp";

export default function Home() {
  return (
    <ConvexClientProvider>
      <TouchKeyboardProvider>
        <PosApp />
      </TouchKeyboardProvider>
    </ConvexClientProvider>
  );
}
