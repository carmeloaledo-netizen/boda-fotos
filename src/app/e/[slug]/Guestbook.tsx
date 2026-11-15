"use client";

import { useState } from "react";

/**
 * Libro de firmas digital: un invitado deja un mensaje/felicitación para
 * los novios. Solo texto. Se renderiza dentro de la página del invitado,
 * debajo del área de fotos. Es independiente de la subida de fotos: se
 * puede dejar un mensaje aunque no se suba ninguna foto.
 */
export function Guestbook({
  slug,
  token,
}: {
  slug: string;
  token: string;
}) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [phase, setPhase] = useState<"write" | "sending" | "done">("write");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!message.trim()) {
      setError("Escribe un mensaje antes de enviar.");
      return;
    }
    setError(null);
    setPhase("sending");
    try {
      const res = await fetch("/api/public/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          token,
          guestName: name.trim(),
          message: message.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error || "No se pudo enviar el mensaje.");
        setPhase("write");
        return;
      }
      setPhase("done");
    } catch {
      setError("Error de red al enviar el mensaje.");
      setPhase("write");
    }
  }

  return (
    <section className="max-w-content mx-auto px-6 mt-4 mb-16">
      <div className="rounded-2xl border border-ivory-200 bg-white p-6">
        {phase === "done" ? (
          <div className="text-center py-4 animate-fade-up">
            <p className="font-serif text-xl text-ink mb-2">¡Mensaje enviado!</p>
            <p className="text-sm text-ink-soft">
              Gracias por tus palabras. Los novios las leerán.
            </p>
            <button
              onClick={() => {
                setName("");
                setMessage("");
                setPhase("write");
              }}
              className="mt-4 text-sm underline text-ink-faint"
            >
              Dejar otro mensaje
            </button>
          </div>
        ) : (
          <>
            <p className="font-serif text-xl text-ink">Deja un mensaje a los novios</p>
            <p className="text-sm text-ink-soft mt-1">
              Una felicitación, un recuerdo, un buen deseo… se lo haremos llegar.
            </p>

            <label className="block mt-4">
              <span className="text-sm text-ink-soft">Tu nombre (opcional)</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                placeholder="¿Quién escribe?"
                className="mt-1 w-full rounded-xl border border-ivory-200 bg-white px-4 py-3 text-ink placeholder:text-ink-faint focus:border-accent"
              />
            </label>

            <label className="block mt-4">
              <span className="text-sm text-ink-soft">Tu mensaje</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={1000}
                rows={4}
                placeholder="Escribe aquí tu felicitación para los novios…"
                className="mt-1 w-full rounded-xl border border-ivory-200 bg-white px-4 py-3 text-ink placeholder:text-ink-faint focus:border-accent resize-none"
              />
              <span className="block text-right text-xs text-ink-faint mt-1">
                {message.length}/1000
              </span>
            </label>

            {error && (
              <p role="alert" className="mt-3 text-sm text-red-700 bg-red-50 rounded-lg px-4 py-3">
                {error}
              </p>
            )}

            <button
              disabled={phase === "sending" || !message.trim()}
              onClick={submit}
              className="mt-4 w-full rounded-full py-3.5 text-lg font-medium text-ivory disabled:opacity-40 transition"
              style={{ backgroundColor: "var(--accent)" }}
            >
              {phase === "sending" ? "Enviando…" : "Enviar mensaje"}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
