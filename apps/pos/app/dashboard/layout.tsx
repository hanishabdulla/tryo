import { ConvexClientProvider } from "@/components/convex-client-provider";
import { TouchKeyboardProvider } from "@/components/touch/TouchKeyboard";
import { DashboardNav } from "./dashboard-nav";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ConvexClientProvider>
      <TouchKeyboardProvider>
        <div className="min-h-screen bg-zinc-950 text-zinc-100">
          <div className="dashboard-no-print">
            <DashboardNav />
          </div>
          {/* The trailing space keeps content clear of the on-screen keyboard. */}
          <main className="mx-auto max-w-6xl px-4 py-8 pb-[calc(2rem+var(--osk-inset,0px))]">
            {children}
          </main>
        </div>
      </TouchKeyboardProvider>
    </ConvexClientProvider>
  );
}
