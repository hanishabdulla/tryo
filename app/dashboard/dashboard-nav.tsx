"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const linkClass =
  "inline-flex min-h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold transition-colors";

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
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        <Link
          href="/"
          className="text-sm font-semibold text-zinc-400 hover:text-white"
        >
          ← POS
        </Link>
        <span className="text-lg font-semibold tracking-tight text-white">
          Dashboard
        </span>
      </div>
      <nav className="flex flex-wrap items-center gap-2">
        <Link
          href="/dashboard/daily"
          className={[
            linkClass,
            path === "/dashboard/daily"
              ? "bg-[#00955e] text-white shadow-[var(--tryo-glow)]"
              : "border border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-[#00955e]/40",
          ].join(" ")}
        >
          Daily summary
        </Link>
        <Link
          href="/dashboard/monthly"
          className={[
            linkClass,
            path === "/dashboard/monthly"
              ? "bg-[#00955e] text-white shadow-[var(--tryo-glow)]"
              : "border border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-[#00955e]/40",
          ].join(" ")}
        >
          Range & Excel
        </Link>
        <Link
          href="/dashboard/menu"
          className={[
            linkClass,
            path === "/dashboard/menu"
              ? "bg-[#00955e] text-white shadow-[var(--tryo-glow)]"
              : "border border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-[#00955e]/40",
          ].join(" ")}
        >
          Menu
        </Link>
        <button
          type="button"
          onClick={() => void logout()}
          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-zinc-600 bg-zinc-900 px-4 text-sm font-semibold text-zinc-300 hover:border-red-500/40 hover:text-red-200"
        >
          Sign out
        </button>
      </nav>
    </header>
  );
}
