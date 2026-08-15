"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "No se pudo iniciar sesión");
      } else {
        router.push("/admin");
        router.refresh();
      }
    } catch {
      setError("Error de red");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh flex items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm animate-fade-up">
        <h1 className="font-serif text-3xl text-ink mb-6 text-center">
          Panel del fotógrafo
        </h1>
        <label className="block mb-4">
          <span className="text-sm text-ink-soft">Usuario</span>
          <input
            className="mt-1 w-full rounded-xl border border-ivory-200 bg-white px-4 py-3"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </label>
        <label className="block mb-6">
          <span className="text-sm text-ink-soft">Contraseña</span>
          <input
            type="password"
            className="mt-1 w-full rounded-xl border border-ivory-200 bg-white px-4 py-3"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error && (
          <p role="alert" className="mb-4 text-sm text-red-700 bg-red-50 rounded-lg px-4 py-3">
            {error}
          </p>
        )}
        <button
          disabled={loading}
          className="w-full rounded-full bg-ink text-ivory py-3 font-medium disabled:opacity-50"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
