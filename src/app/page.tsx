import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-dvh flex items-center justify-center px-6">
      <div className="max-w-content text-center animate-fade-up">
        <p className="font-serif text-3xl text-ink mb-3">Fotos de boda</p>
        <p className="text-ink-soft mb-8">
          Esta aplicación recopila las fotografías de los invitados de forma
          privada y segura. Cada boda tiene su propio enlace y código QR.
        </p>
        <Link
          href="/admin"
          className="inline-block rounded-full bg-ink text-ivory px-6 py-3 font-medium hover:opacity-90 transition"
        >
          Panel del fotógrafo
        </Link>
      </div>
    </main>
  );
}
