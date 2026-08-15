export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh px-6 py-12">
      <article className="max-w-content mx-auto prose-legal">
        {children}
        <p className="mt-10 text-sm">
          <a href="/" className="underline text-ink-soft">Volver</a>
        </p>
      </article>
    </main>
  );
}
