"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** ---- Tipos ---- */
interface EventInfo {
  slug: string;
  coupleName: string;
  weddingDate: string;
  coverImageUrl: string | null;
  logoUrl: string | null;
  accentColor: string;
  welcomeMessage: string;
  thankYouMessage: string;
  closesAt: string | null;
}
interface Limits {
  maxFileSizeBytes: number;
  maxFilesPerBatch: number;
  acceptedMimes: string[];
}
type ItemStatus = "queued" | "uploading" | "done" | "error";
interface Item {
  key: string;
  file: File;
  previewUrl: string | null;
  status: ItemStatus;
  progress: number;
  error?: string;
}

const ACCEPT = ".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif";
const MAX_RETRIES = 3;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function canPreview(file: File): boolean {
  // Safari/Chrome no pintan HEIC/HEIF: evitamos object URLs inútiles.
  const t = file.type.toLowerCase();
  const n = file.name.toLowerCase();
  if (t.includes("heic") || t.includes("heif")) return false;
  if (n.endsWith(".heic") || n.endsWith(".heif")) return false;
  return t.startsWith("image/");
}

export function Uploader({ slug, token }: { slug: string; token: string }) {
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [limits, setLimits] = useState<Limits | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [guestName, setGuestName] = useState("");
  const [consent, setConsent] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [phase, setPhase] = useState<"select" | "uploading" | "done">("select");
  const [globalError, setGlobalError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;

  /** Carga la información pública del evento. */
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/public/event?slug=${encodeURIComponent(slug)}&t=${encodeURIComponent(token)}`
        );
        const data = await res.json();
        if (!active) return;
        if (!res.ok || !data.ok) {
          setLoadError(data.error || "No se pudo cargar el evento");
        } else {
          setEvent(data.event);
          setLimits(data.limits);
        }
      } catch {
        if (active) setLoadError("Error de red al cargar el evento");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [slug, token]);

  // Aplica el color de acento del evento.
  useEffect(() => {
    if (event?.accentColor) {
      document.documentElement.style.setProperty("--accent", event.accentColor);
    }
  }, [event]);

  const addFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || !limits) return;
      setGlobalError(null);
      const incoming = Array.from(fileList);
      const accepted: Item[] = [];
      for (const file of incoming) {
        if (file.size > limits.maxFileSizeBytes) {
          setGlobalError(
            `"${file.name}" supera el máximo de ${formatBytes(limits.maxFileSizeBytes)}.`
          );
          continue;
        }
        accepted.push({
          key: crypto.randomUUID(),
          file,
          previewUrl: canPreview(file) ? URL.createObjectURL(file) : null,
          status: "queued",
          progress: 0,
        });
      }
      setItems((prev) => {
        const combined = [...prev, ...accepted];
        if (combined.length > limits.maxFilesPerBatch) {
          setGlobalError(
            `Máximo ${limits.maxFilesPerBatch} fotografías por tanda. Sube en varias veces.`
          );
          return combined.slice(0, limits.maxFilesPerBatch);
        }
        return combined;
      });
    },
    [limits]
  );

  const removeItem = useCallback((key: string) => {
    setItems((prev) => {
      const it = prev.find((i) => i.key === key);
      if (it?.previewUrl) URL.revokeObjectURL(it.previewUrl);
      return prev.filter((i) => i.key !== key);
    });
  }, []);

  const updateItem = useCallback((key: string, patch: Partial<Item>) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }, []);

  /** Sube un archivo con XHR (progreso) y reintentos con backoff. */
  const uploadOne = useCallback(
    (item: Item): Promise<boolean> => {
      const qs = new URLSearchParams({
        slug,
        t: token,
        key: item.key,
        name: item.file.name,
      });
      if (guestName.trim()) qs.set("guest", guestName.trim());
      const url = `/api/public/upload?${qs.toString()}`;

      const attempt = (tryNo: number): Promise<boolean> =>
        new Promise((resolve) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", url);
          xhr.setRequestHeader("Content-Type", "application/octet-stream");
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              updateItem(item.key, {
                progress: Math.round((e.loaded / e.total) * 100),
                status: "uploading",
              });
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              updateItem(item.key, { status: "done", progress: 100, error: undefined });
              resolve(true);
            } else {
              handleFail(tryNo, resolve, `Error ${xhr.status}`);
            }
          };
          xhr.onerror = () => handleFail(tryNo, resolve, "Error de red");
          xhr.ontimeout = () => handleFail(tryNo, resolve, "Tiempo de espera agotado");
          xhr.timeout = 120000;
          xhr.send(item.file);
        });

      const handleFail = (
        tryNo: number,
        resolve: (v: boolean) => void,
        msg: string
      ) => {
        if (tryNo < MAX_RETRIES) {
          const delay = 600 * Math.pow(2, tryNo); // backoff exponencial
          updateItem(item.key, {
            status: "uploading",
            error: `Reintentando (${tryNo + 1}/${MAX_RETRIES})…`,
          });
          setTimeout(() => attempt(tryNo + 1).then(resolve), delay);
        } else {
          updateItem(item.key, { status: "error", error: msg });
          resolve(false);
        }
      };

      return attempt(0);
    },
    [slug, token, guestName, updateItem]
  );

  /** Registra intención (consentimiento) y sube cada archivo por separado. */
  const startUpload = useCallback(async () => {
    if (!consent) {
      setGlobalError("Debes aceptar la casilla de autorización.");
      return;
    }
    if (items.length === 0) return;
    setGlobalError(null);
    setPhase("uploading");

    // 1) init (valida consentimiento, límites y estado del evento).
    try {
      const initRes = await fetch("/api/public/upload/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          token,
          guestName: guestName.trim(),
          consent: true,
          files: items.map((i) => ({
            idempotencyKey: i.key,
            originalName: i.file.name,
            sizeBytes: i.file.size,
            declaredMime: i.file.type || "application/octet-stream",
          })),
        }),
      });
      const initData = await initRes.json();
      if (!initRes.ok || !initData.ok) {
        setGlobalError(initData.error || "No se pudo iniciar la subida.");
        setPhase("select");
        return;
      }
    } catch {
      setGlobalError("Error de red al iniciar la subida.");
      setPhase("select");
      return;
    }

    // 2) Sube cada archivo (secuencial: más estable en móvil, no satura red).
    for (const it of itemsRef.current) {
      if (it.status === "done") continue;
      await uploadOne(it);
    }

    const allDone = itemsRef.current.every((i) => i.status === "done");
    if (allDone) setPhase("done");
    else setPhase("select"); // permite reintentar los fallidos
  }, [consent, items, slug, token, guestName, uploadOne]);

  const retryFailed = useCallback(async () => {
    setPhase("uploading");
    for (const it of itemsRef.current) {
      if (it.status === "error") {
        updateItem(it.key, { status: "queued", error: undefined, progress: 0 });
        await uploadOne(it);
      }
    }
    const allDone = itemsRef.current.every((i) => i.status === "done");
    setPhase(allDone ? "done" : "select");
  }, [uploadOne, updateItem]);

  const resetForMore = useCallback(() => {
    items.forEach((i) => i.previewUrl && URL.revokeObjectURL(i.previewUrl));
    setItems([]);
    setPhase("select");
    setGlobalError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [items]);

  const counts = useMemo(() => {
    const done = items.filter((i) => i.status === "done").length;
    const failed = items.filter((i) => i.status === "error").length;
    return { done, failed, total: items.length, pending: items.length - done };
  }, [items]);

  /** ---------- Render ---------- */
  if (loading) {
    return (
      <Centered>
        <p className="text-ink-soft">Cargando…</p>
      </Centered>
    );
  }
  if (loadError || !event || !limits) {
    return (
      <Centered>
        <div className="text-center max-w-content">
          <p className="font-serif text-2xl text-ink mb-2">Enlace no disponible</p>
          <p className="text-ink-soft">{loadError ?? "Evento no encontrado."}</p>
        </div>
      </Centered>
    );
  }

  const weddingDate = new Date(event.weddingDate).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <main className="min-h-dvh pb-24">
      {/* Portada */}
      <header className="relative">
        {event.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.coverImageUrl}
            alt=""
            className="h-56 w-full object-cover"
          />
        ) : (
          <div className="h-24" />
        )}
        <div className="px-6 pt-6 text-center animate-fade-up">
          {event.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.logoUrl} alt="" className="h-10 mx-auto mb-4 object-contain" />
          )}
          <h1 className="font-serif text-3xl sm:text-4xl text-ink">
            {event.coupleName}
          </h1>
          <p className="text-ink-faint mt-1">{weddingDate}</p>
          <p className="text-ink-soft mt-4 max-w-content mx-auto">
            {event.welcomeMessage}
          </p>
        </div>
      </header>

      <section className="max-w-content mx-auto px-6 mt-8">
        {phase === "done" ? (
          <div className="text-center animate-fade-up py-10">
            <p className="font-serif text-2xl text-ink mb-3">
              {event.thankYouMessage}
            </p>
            <p className="text-ink-soft mb-8">
              {counts.done} {counts.done === 1 ? "foto subida" : "fotos subidas"}.
            </p>
            <button
              onClick={resetForMore}
              className="rounded-full px-6 py-3 font-medium text-ivory"
              style={{ backgroundColor: "var(--accent)" }}
            >
              Añadir más fotografías
            </button>
          </div>
        ) : (
          <>
            {/* Nombre del invitado (opcional) */}
            <label className="block mb-5">
              <span className="text-sm text-ink-soft">Tu nombre (opcional)</span>
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Así sabremos quién las hizo"
                maxLength={60}
                className="mt-1 w-full rounded-xl border border-ivory-200 bg-white px-4 py-3 text-ink placeholder:text-ink-faint focus:border-accent"
              />
            </label>

            {/* Selección de fotos */}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              multiple
              className="sr-only"
              onChange={(e) => addFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-2xl border-2 border-dashed border-ivory-200 bg-white py-8 text-center hover:border-accent transition"
            >
              <span className="block font-serif text-xl text-ink">
                Seleccionar fotos
              </span>
              <span className="block text-sm text-ink-faint mt-1">
                JPG · PNG · WebP · HEIC — hasta{" "}
                {formatBytes(limits.maxFileSizeBytes)} por foto
              </span>
            </button>

            {globalError && (
              <p role="alert" className="mt-4 text-sm text-red-700 bg-red-50 rounded-lg px-4 py-3">
                {globalError}
              </p>
            )}

            {/* Miniaturas */}
            {items.length > 0 && (
              <>
                <div className="mt-6 flex items-center justify-between text-sm text-ink-soft">
                  <span>
                    {counts.done}/{counts.total} terminadas
                    {counts.failed > 0 && ` · ${counts.failed} con error`}
                  </span>
                  {phase === "select" && (
                    <button
                      onClick={() => {
                        items.forEach((i) => i.previewUrl && URL.revokeObjectURL(i.previewUrl));
                        setItems([]);
                      }}
                      className="underline text-ink-faint"
                    >
                      Vaciar
                    </button>
                  )}
                </div>

                <ul className="mt-3 grid grid-cols-3 gap-3">
                  {items.map((it) => (
                    <li key={it.key} className="relative">
                      <div className="aspect-square rounded-xl overflow-hidden bg-ivory-200 flex items-center justify-center">
                        {it.previewUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={it.previewUrl}
                            alt={it.file.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-[10px] text-ink-faint px-1 text-center">
                            {it.file.name.split(".").pop()?.toUpperCase()}
                          </span>
                        )}
                        {/* Overlay de progreso/estado */}
                        {it.status !== "queued" && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            {it.status === "done" && <Check />}
                            {it.status === "error" && <span className="text-white text-xs">Error</span>}
                            {it.status === "uploading" && (
                              <span className="text-white text-xs font-medium">
                                {it.progress}%
                              </span>
                            )}
                          </div>
                        )}
                        {phase === "select" && it.status !== "done" && (
                          <button
                            aria-label="Quitar"
                            onClick={() => removeItem(it.key)}
                            className="absolute top-1 right-1 h-6 w-6 rounded-full bg-white/90 text-ink text-sm leading-none"
                          >
                            ×
                          </button>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-ink-faint truncate">
                        {formatBytes(it.file.size)}
                      </p>
                      {it.error && (
                        <p className="text-[11px] text-red-700 truncate">{it.error}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {/* Consentimiento */}
            <div className="mt-8">
              <label className="flex gap-3 items-start text-sm text-ink-soft">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-1 h-5 w-5 accent-[color:var(--accent)]"
                />
                <span>
                  Al enviar estas imágenes confirmas que estás autorizado para
                  compartirlas con los novios y el fotógrafo. Las fotografías se
                  utilizarán exclusivamente en relación con este evento.
                </span>
              </label>
            </div>

            {/* Botón principal */}
            <button
              disabled={items.length === 0 || phase === "uploading" || !consent}
              onClick={counts.failed > 0 ? retryFailed : startUpload}
              className="mt-6 w-full rounded-full py-4 text-lg font-medium text-ivory disabled:opacity-40 transition"
              style={{ backgroundColor: "var(--accent)" }}
            >
              {phase === "uploading"
                ? `Subiendo… ${counts.done}/${counts.total}`
                : counts.failed > 0
                ? `Reintentar ${counts.failed} con error`
                : "Subir fotografías"}
            </button>

            <p className="mt-6 text-center text-xs text-ink-faint">
              <a href="/legal/privacidad" className="underline">Privacidad</a>
              {" · "}
              <a href="/legal/aviso-legal" className="underline">Aviso legal</a>
              {" · "}
              <a href="/legal/conservacion" className="underline">Conservación</a>
            </p>
          </>
        )}
      </section>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh flex items-center justify-center px-6">{children}</main>
  );
}

function Check() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 6L9 17l-5-5"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
