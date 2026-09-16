"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/dashboard/daily", label: "Daily" },
  { href: "/dashboard/monthly", label: "Date range" },
  { href: "/dashboard/menu", label: "Menu" },
];

export function DashboardNav() {
  const path = usePathname();
  const router = useRouter();
  if (path === "/dashboard/login") {
    return null;
  }

  async function logout() {
    await fetch("/api/dashboard-auth", { method: "DELETE" });
    router.replace("/dashboard/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-zinc-950/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/daily" aria-label="Tryo dashboard">
            <Image
              src="/brand/tryo-wordmark.png"
              alt="Tryo"
              width={485}
              height={240}
              priority
              unoptimized
              className="h-8 w-auto select-none"
            />
          </Link>
          <div className="hidden h-6 w-px bg-white/10 sm:block" />
          <span className="hidden text-sm font-medium text-zinc-400 sm:inline">Dashboard</span>
        </div>
        <nav className="flex items-center gap-1 rounded-xl bg-white/[0.03] p-1 ring-1 ring-inset ring-white/[0.06]">
          {LINKS.map((link) => {
            const active = path === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "inline-flex h-9 items-center rounded-lg px-3.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-white/[0.09] text-white shadow-sm"
                    : "text-zinc-400 hover:text-white",
                ].join(" ")}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-xl px-3 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/[0.05] hover:text-white"
          >
            ← Till
          </Link>
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex h-10 items-center rounded-xl border border-white/[0.08] px-3.5 text-sm font-medium text-zinc-300 transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-200"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
