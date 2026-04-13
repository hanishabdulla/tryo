import { ConvexClientProvider } from "@/components/convex-client-provider";
import { DashboardNav } from "./dashboard-nav";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ConvexClientProvider>
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="dashboard-no-print">
          <DashboardNav />
        </div>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </div>
    </ConvexClientProvider>
  );
}
