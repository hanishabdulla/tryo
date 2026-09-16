"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const nextPath = searchParams.get("next") || "/dashboard/daily";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await fetch("/api/dashboard-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!r.ok) {
        setError(data.error || "Sign-in failed");
        return;
      }
      const dest = nextPath.startsWith("/") ? nextPath : "/dashboard/daily";
      router.replace(dest);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image
            src="/brand/tryo-wordmark.png"
            alt="Tryo"
            width={485}
            height={240}
            priority
            unoptimized
            className="h-14 w-auto select-none"
          />
          <h1 className="mt-6 text-xl font-semibold tracking-tight text-white">
            Dashboard sign-in
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500">
            Sales reports and menu settings.
          </p>
        </div>
        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6 shadow-2xl shadow-black/40"
        >
          <label className="block text-sm font-medium text-zinc-300">
            Password
            <input
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-white/[0.08] bg-black/30 px-4 text-white outline-none transition-colors focus:border-[#00955e]/70"
              disabled={loading}
            />
          </label>
          {error ? (
            <p className="text-sm font-medium text-red-400" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading || password.length === 0}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-[#00955e] text-sm font-bold text-white shadow-[var(--tryo-glow)] transition-colors hover:bg-[#007a4c] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <Link
          href="/"
          className="mt-6 block text-center text-sm text-zinc-500 transition-colors hover:text-zinc-300"
        >
          ← Back to till
        </Link>
      </div>
    </div>
  );
}

export default function DashboardLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-zinc-500">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
