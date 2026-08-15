"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** Lee el token CSRF de la cookie no-httpOnly. */
function getCsrf(): string {
  const m = document.cookie.match(/(?:^|;\s*)bf_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

async function apiMutate(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": getCsrf(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && data.ok, data, status: res.status };
}

interface EventRow {
  id: string;
  slug: string;
  coupleName: string;
  weddingDate: string;
  isActive: boolean;
  closesAt: string | null;
  uploadsCount: number;
  publicUrl: string;
}

const emptyForm = {
  slug: "",
  coupleName: "",
  weddingDate: "",
  driveFolderId: "",
  closesAt: "",
  accentColor: "#8C7B6B",
  welcomeMessage: "",
  thankYouMessage: "",
  coverImageUrl: "",
  logoUrl: "",
};

export function AdminDashboard() {
  const router = useRouter();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...emptyForm });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [gStatus, setGStatus] = useState<{
    connected: boolean;
    mode: string;
    email: string | null;
    hasCredentials?: boolean;
  } | null>(null);

  const loadGoogle = useCallback(async () => {
    const res = await fetch("/api/admin/google/status");
    if (res.ok) setGStatus(await res.json());
  }, []);

  useEffect(() => {
    loadGoogle();
  }, [loadGoogle]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/events");
    if (res.status === 401) {
      router.push("/admin/login");
      return;
    }
    const data = await res.json();
    setEvents(data.events ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setFormError(null);
    const payload: Record<string, unknown> = {
      slug: form.slug,
      coupleName: form.coupleName,
      weddingDate: form.weddingDate,
      driveFolderId: form.driveFolderId,
      accentColor: form.accentColor,
      isActive: true,
    };
    if (form.closesAt) payload.closesAt = form.closesAt;
    if (form.welcomeMessage) payload.welcomeMessage = form.welcomeMessage;
    if (form.thankYouMessage) payload.thankYouMessage = form.thankYouMessage;
    if (form.coverImageUrl) payload.coverImageUrl = form.coverImageUrl;
    if (form.logoUrl) payload.logoUrl = form.logoUrl;

    const { ok, data } = await apiMutate("/api/admin/events", "POST", payload);
    setCreating(false);
    if (!ok) {
      setFormError((data.issues && data.issues.join(", ")) || data.error || "Error al crear");
      return;
    }
    if (data.driveFolderAccessible === false) {
      setFormError(
        "Evento creado, pero no se pudo verificar acceso a la carpeta de Drive. Revisa el ID y los permisos."
      );
    }
    setForm({ ...emptyForm });
    await load();
  }

  async function logout() {
    await apiMutate("/api/admin/logout", "POST");
    router.push("/admin/login");
  }

  return (
    <main className="min-h-dvh px-4 sm:px-8 py-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-serif text-3xl text-ink">Eventos</h1>
        <button onClick={logout} className="text-sm text-ink-soft underline">
          Salir
        </button>
      </div>

      {/* Estado de conexión con Google Drive */}
      {gStatus && (
        <div
          className={`mb-6 rounded-2xl border p-5 ${
            gStatus.connected
              ? "border-green-200 bg-green-50"
              : "border-amber-300 bg-amber-50"
          }`}
        >
          {gStatus.mode === "service_account" ? (
            <p className="text-sm text-ink">
              {gStatus.connected
                ? "Drive conectado mediante cuenta de servicio (Unidad compartida)."
                : "Falta configurar GOOGLE_DRIVE_SHARED_DRIVE_ID en el servidor."}
            </p>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink">
                {gStatus.connected ? (
                  <>
                    <strong>Google Drive conectado</strong>
                    {gStatus.email ? ` · ${gStatus.email}` : ""}
                  </>
                ) : gStatus.hasCredentials ? (
                  <>
                    <strong>Google Drive sin conectar.</strong> Conéctalo para
                    que las fotos se guarden en tu Drive.
                  </>
                ) : (
                  <>
                    Faltan las credenciales de Google (CLIENT_ID/SECRET) en el
                    servidor.
                  </>
                )}
              </p>
              {gStatus.hasCredentials && (
                <a
                  href="/api/admin/google/connect"
                  className="text-sm rounded-full bg-ink text-ivory px-4 py-2 font-medium"
                >
                  {gStatus.connected ? "Reconectar" : "Conectar Google Drive"}
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* Crear evento */}
      <details className="mb-8 rounded-2xl border border-ivory-200 bg-white p-5">
        <summary className="cursor-pointer font-medium text-ink">
          Crear nueva boda
        </summary>
        <form onSubmit={createEvent} className="mt-4 grid sm:grid-cols-2 gap-4">
          <Field label="Nombre de la pareja" required>
            <input className={inputCls} value={form.coupleName}
              onChange={(e) => setForm({ ...form, coupleName: e.target.value })} />
          </Field>
          <Field label="Identificador (slug)" hint="minúsculas-y-guiones" required>
            <input className={inputCls} value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="laura-pablo-2026" />
          </Field>
          <Field label="Fecha de la boda" required>
            <input type="date" className={inputCls} value={form.weddingDate}
              onChange={(e) => setForm({ ...form, weddingDate: e.target.value })} />
          </Field>
          <Field label="Cierre de subidas (opcional)">
            <input type="datetime-local" className={inputCls} value={form.closesAt}
              onChange={(e) => setForm({ ...form, closesAt: e.target.value })} />
          </Field>
          <Field label="ID carpeta de Google Drive" required>
            <input className={inputCls} value={form.driveFolderId}
              onChange={(e) => setForm({ ...form, driveFolderId: e.target.value })}
              placeholder="1AbC..." />
          </Field>
          <Field label="Color principal">
            <input type="color" className="h-11 w-20 rounded" value={form.accentColor}
              onChange={(e) => setForm({ ...form, accentColor: e.target.value })} />
          </Field>
          <Field label="URL portada (opcional)">
            <input className={inputCls} value={form.coverImageUrl}
              onChange={(e) => setForm({ ...form, coverImageUrl: e.target.value })} />
          </Field>
          <Field label="URL logo (opcional)">
            <input className={inputCls} value={form.logoUrl}
              onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} />
          </Field>
          <Field label="Mensaje de bienvenida (opcional)">
            <input className={inputCls} value={form.welcomeMessage}
              onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })} />
          </Field>
          <Field label="Mensaje de agradecimiento (opcional)">
            <input className={inputCls} value={form.thankYouMessage}
              onChange={(e) => setForm({ ...form, thankYouMessage: e.target.value })} />
          </Field>
          {formError && (
            <p className="sm:col-span-2 text-sm text-red-700 bg-red-50 rounded-lg px-4 py-3">
              {formError}
            </p>
          )}
          <div className="sm:col-span-2">
            <button disabled={creating}
              className="rounded-full bg-ink text-ivory px-6 py-3 font-medium disabled:opacity-50">
              {creating ? "Creando…" : "Crear boda"}
            </button>
          </div>
        </form>
      </details>

      {/* Lista */}
      {loading ? (
        <p className="text-ink-soft">Cargando…</p>
      ) : events.length === 0 ? (
        <p className="text-ink-soft">Aún no hay eventos.</p>
      ) : (
        <ul className="space-y-4">
          {events.map((ev) => (
            <li key={ev.id} className="rounded-2xl border border-ivory-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-serif text-xl text-ink">{ev.coupleName}</p>
                  <p className="text-sm text-ink-faint">
                    {new Date(ev.weddingDate).toLocaleDateString("es-ES")} ·{" "}
                    {ev.uploadsCount} fotos ·{" "}
                    <span className={ev.isActive ? "text-green-700" : "text-red-700"}>
                      {ev.isActive ? "activo" : "desactivado"}
                    </span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <a href={`/api/admin/events/${ev.id}/qr?format=png`}
                    className="text-sm rounded-full border border-ivory-200 px-3 py-1.5">QR PNG</a>
                  <a href={`/api/admin/events/${ev.id}/qr?format=svg`}
                    className="text-sm rounded-full border border-ivory-200 px-3 py-1.5">QR SVG</a>
                  <a href={`/api/admin/events/${ev.id}/export`}
                    className="text-sm rounded-full border border-ivory-200 px-3 py-1.5">CSV</a>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <code className="text-xs bg-ivory-100 rounded px-2 py-1 break-all flex-1 min-w-0">
                  {ev.publicUrl}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(ev.publicUrl)}
                  className="text-sm rounded-full border border-ivory-200 px-3 py-1.5">
                  Copiar
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <ActionButton onClick={async () => {
                  await apiMutate(`/api/admin/events/${ev.id}`, "PATCH", { isActive: !ev.isActive });
                  load();
                }}>
                  {ev.isActive ? "Desactivar" : "Activar"}
                </ActionButton>
                <ActionButton onClick={async () => {
                  if (!confirm("Regenerar el token invalidará el QR y enlace actuales. ¿Continuar?")) return;
                  await apiMutate(`/api/admin/events/${ev.id}/token`, "POST");
                  load();
                }}>
                  Regenerar token
                </ActionButton>
                <ActionButton onClick={() => setOpenId(openId === ev.id ? null : ev.id)}>
                  {openId === ev.id ? "Ocultar detalle" : "Ver detalle"}
                </ActionButton>
                <ActionButton onClick={async () => {
                  if (!confirm(
                    `Vaciar en Drive la carpeta de fotos de "${ev.coupleName}". ` +
                    "Esto BORRA las fotos en Drive. Asegúrate de haberlas descargado antes. ¿Continuar?"
                  )) return;
                  const purgeRecords = confirm(
                    "¿Borrar también el histórico de registros de esta boda? " +
                    "(Aceptar = sí; Cancelar = conservar el histórico/CSV)"
                  );
                  const { ok, data } = await apiMutate(
                    `/api/admin/events/${ev.id}/empty-drive`, "POST", { purgeRecords }
                  );
                  alert(ok ? "Carpeta vaciada en Drive." : (data.error || "No se pudo vaciar."));
                  load();
                }}>
                  Vaciar en Drive
                </ActionButton>
              </div>

              {openId === ev.id && <EventDetail id={ev.id} onChange={load} />}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

const inputCls =
  "mt-1 w-full rounded-xl border border-ivory-200 bg-white px-3 py-2 text-ink";

function Field({
  label, hint, required, children,
}: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="text-ink-soft">
        {label}{required && <span className="text-red-600"> *</span>}
        {hint && <span className="text-ink-faint"> · {hint}</span>}
      </span>
      {children}
    </label>
  );
}

function ActionButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="text-sm rounded-full bg-ivory-100 hover:bg-ivory-200 px-4 py-1.5 text-ink transition">
      {children}
    </button>
  );
}

interface DetailData {
  event: { driveFolderId: string; accentColor: string };
  stats: { completed: number; totalBytes: number };
  failed: { id: string; originalName: string; errorMessage: string | null; updatedAt: string }[];
  recent: {
    id: string; originalName: string; storedName: string | null;
    guestName: string | null; sizeBytes: number | null; status: string; createdAt: string;
  }[];
}

function EventDetail({ id, onChange }: { id: string; onChange: () => void }) {
  const [data, setData] = useState<DetailData | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/admin/events/${id}`);
    const d = await res.json();
    if (d.ok) setData(d as DetailData);
  }, [id]);

  useEffect(() => { reload(); }, [reload]);

  if (!data) return <p className="mt-4 text-sm text-ink-faint">Cargando detalle…</p>;

  const mb = (data.stats.totalBytes / (1024 * 1024)).toFixed(1);

  return (
    <div className="mt-4 border-t border-ivory-200 pt-4">
      <p className="text-sm text-ink-soft">
        {data.stats.completed} fotos completadas · ~{mb} MB · carpeta Drive{" "}
        <code className="text-xs">{data.event.driveFolderId}</code>
      </p>

      {data.failed.length > 0 && (
        <div className="mt-3">
          <p className="text-sm font-medium text-red-700">Errores</p>
          <ul className="text-xs text-ink-soft mt-1 space-y-1">
            {data.failed.map((f) => (
              <li key={f.id}>{f.originalName}: {f.errorMessage}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-sm font-medium text-ink mt-4">Últimas subidas</p>
      <ul className="mt-1 divide-y divide-ivory-200">
        {data.recent.map((u) => (
          <li key={u.id} className="py-2 flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0">
              <span className="block truncate text-ink">{u.originalName}</span>
              <span className="text-xs text-ink-faint">
                {u.guestName ? `${u.guestName} · ` : ""}
                {u.sizeBytes ? `${(u.sizeBytes / (1024 * 1024)).toFixed(1)} MB · ` : ""}
                {u.status}
              </span>
            </span>
            <button
              className="text-xs text-red-700 underline shrink-0"
              onClick={async () => {
                if (!confirm("Eliminar SOLO el registro (no borra el archivo de Drive)?")) return;
                await apiMutate(`/api/admin/events/${id}?uploadId=${u.id}`, "DELETE");
                await reload();
                onChange();
              }}>
              Borrar registro
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
