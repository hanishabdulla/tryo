"use client";

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
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4">
      <h1 className="text-2xl font-bold text-white">Dashboard sign-in</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Enter the dashboard password to view finances.
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block text-sm font-medium text-zinc-300">
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 h-12 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-white outline-none focus:border-[#00955e]/70"
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
          className="flex h-12 w-full items-center justify-center rounded-xl bg-[#00955e] text-sm font-bold text-white shadow-[var(--tryo-glow)] hover:bg-[#007a4c] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <Link
        href="/"
        className="mt-8 text-center text-sm text-zinc-500 hover:text-zinc-300"
      >
        ← Back to POS
      </Link>
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
