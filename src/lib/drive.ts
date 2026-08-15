import { google, type drive_v3 } from "googleapis";
import type { Readable } from "node:stream";
import { env } from "./env";
import { getGoogleRefreshToken } from "./config";

/**
 * Cliente de Google Drive mediante OAuth 2.0 con el refresh token del
 * fotógrafo. Todas las credenciales viven SOLO en el servidor.
 *
 * Estrategia de subida: se pasa un stream de Node directamente a
 * drive.files.create. La librería oficial usa el protocolo de subida
 * resumible por debajo y NO bufferiza el archivo completo en memoria,
 * lo que permite archivos grandes en Cloud Run sin agotar RAM.
 */

let cachedDrive: drive_v3.Drive | null = null;
let cachedKey = ""; // "sa" o el propio refresh token, para invalidar caché

/**
 * Modo mock: cuando DRIVE_MOCK=1 no se contacta con Google. Sirve para
 * tests E2E y desarrollo sin credenciales reales. NUNCA activar en producción.
 */
export function isDriveMock(): boolean {
  return process.env.DRIVE_MOCK === "1";
}

/** Invalida la caché del cliente (tras reconectar Google en el panel). */
export function resetDriveCache(): void {
  cachedDrive = null;
  cachedKey = "";
}

/**
 * Construye el cliente de Drive según el modo configurado:
 *  - Modo A (recomendado, con Workspace): GOOGLE_SERVICE_ACCOUNT_KEY presente
 *    → cuenta de servicio contra una Unidad compartida. No caduca nunca.
 *  - Modo B: OAuth con el refresh token del fotógrafo.
 */
export async function getDrive(): Promise<drive_v3.Drive> {
  // Modo A: cuenta de servicio + Unidad compartida.
  if (env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    if (cachedDrive && cachedKey === "sa") return cachedDrive;
    if (!env.GOOGLE_DRIVE_SHARED_DRIVE_ID) {
      throw new Error(
        "GOOGLE_SERVICE_ACCOUNT_KEY requiere GOOGLE_DRIVE_SHARED_DRIVE_ID (una cuenta de servicio no tiene cuota propia; debe escribir en una Unidad compartida)."
      );
    }
    let credentials: Record<string, unknown>;
    try {
      credentials = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY);
    } catch {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY no es un JSON válido");
    }
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/drive"],
    });
    cachedDrive = google.drive({ version: "v3", auth });
    cachedKey = "sa";
    return cachedDrive;
  }

  // Modo B: OAuth. El refresh token puede venir del panel (BD) o del entorno.
  const token = await getGoogleRefreshToken();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !token) {
    throw new Error(
      "Google Drive no está conectado. Conéctalo desde el panel (/admin) o configura GOOGLE_SERVICE_ACCOUNT_KEY."
    );
  }
  if (cachedDrive && cachedKey === token) return cachedDrive;

  const oauth2 = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET
  );
  oauth2.setCredentials({ refresh_token: token });

  cachedDrive = google.drive({ version: "v3", auth: oauth2 });
  cachedKey = token;
  return cachedDrive;
}

/** Opciones comunes cuando se usa una Unidad compartida. */
function sharedDriveParams() {
  const id = env.GOOGLE_DRIVE_SHARED_DRIVE_ID;
  if (!id) return {};
  return {
    supportsAllDrives: true,
    driveId: id,
    includeItemsFromAllDrives: true,
    corpora: "drive" as const,
  };
}

function supportsAllDrives() {
  return env.GOOGLE_DRIVE_SHARED_DRIVE_ID ? { supportsAllDrives: true } : {};
}

/**
 * Busca (o crea) una subcarpeta por nombre dentro de un padre.
 * Idempotente: si ya existe una carpeta con ese nombre, la reutiliza.
 */
export async function ensureSubfolder(
  parentId: string,
  name: string
): Promise<string> {
  if (isDriveMock()) return `mock-folder-${name.replace(/\W+/g, "-")}`;
  const drive = await getDrive();
  const safeName = name.replace(/'/g, "\\'");

  const list = await drive.files.list({
    q: `name = '${safeName}' and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`,
    fields: "files(id, name)",
    pageSize: 1,
    ...sharedDriveParams(),
  });

  const existing = list.data.files?.[0]?.id;
  if (existing) return existing;

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
    ...supportsAllDrives(),
  });

  if (!created.data.id) throw new Error("No se pudo crear la subcarpeta en Drive");
  return created.data.id;
}

/**
 * Crea una carpeta raíz PROPIA de la app (sin padre → "Mi unidad" del
 * fotógrafo, propiedad de la app). Necesario con scope drive.file, que solo
 * permite acceder a archivos/carpetas creados por la propia app.
 */
export async function createRootFolder(name: string): Promise<string> {
  if (isDriveMock()) return `mock-root-${name.replace(/\W+/g, "-")}`;
  const drive = await getDrive();
  const created = await drive.files.create({
    requestBody: { name, mimeType: "application/vnd.google-apps.folder" },
    fields: "id",
    ...supportsAllDrives(),
  });
  if (!created.data.id) throw new Error("No se pudo crear la carpeta raíz en Drive");
  return created.data.id;
}

/**
 * Garantiza la estructura del evento:
 *   <carpeta raíz de la app>/01_Fotos_invitados[/<invitado>]
 * Si no hay carpeta raíz propia, la crea (nombrada por la pareja).
 * Devuelve los IDs para persistirlos en el evento.
 */
export async function ensureGuestFolder(
  eventRootFolderId: string | null,
  guestsFolderId: string | null,
  guestName?: string | null,
  coupleName?: string | null
): Promise<{ rootFolderId: string; guestsFolderId: string; targetFolderId: string }> {
  const root =
    eventRootFolderId ||
    (await createRootFolder(`Fotos boda - ${(coupleName || "evento").slice(0, 60)}`));

  const guests =
    guestsFolderId ?? (await ensureSubfolder(root, "01_Fotos_invitados"));

  let target = guests;
  if (guestName && guestName.trim()) {
    const folderName = guestName.trim().slice(0, 60);
    target = await ensureSubfolder(guests, folderName);
  }
  return { rootFolderId: root, guestsFolderId: guests, targetFolderId: target };
}

/**
 * Sube un archivo a Drive desde un stream de Node (subida resumible).
 * Devuelve el fileId. La carpeta destino NO se hace pública.
 */
export async function uploadStreamToDrive(params: {
  parentFolderId: string;
  name: string;
  mimeType: string;
  body: Readable;
}): Promise<{ fileId: string }> {
  if (isDriveMock()) {
    // Consumimos el stream para respetar el flujo real (tamaño/hash).
    await new Promise<void>((resolve, reject) => {
      params.body.on("data", () => {});
      params.body.on("end", () => resolve());
      params.body.on("error", reject);
    });
    return { fileId: `mock-file-${Date.now()}-${Math.random().toString(36).slice(2)}` };
  }
  const drive = await getDrive();
  const res = await drive.files.create(
    {
      requestBody: {
        name: params.name,
        parents: [params.parentFolderId],
      },
      media: {
        mimeType: params.mimeType,
        body: params.body,
      },
      fields: "id",
      ...supportsAllDrives(),
    },
    {
      // Reintentos controlados a nivel de transporte para errores 5xx/429.
      retry: true,
      retryConfig: {
        retry: 4,
        retryDelay: 500,
        statusCodesToRetry: [
          [429, 429],
          [500, 599],
        ],
      },
    }
  );

  if (!res.data.id) throw new Error("Drive no devolvió el ID del archivo");
  return { fileId: res.data.id };
}

/**
 * Elimina una carpeta de Drive y todo su contenido (borrado real, no papelera
 * si es Unidad compartida). Se usa para el "vaciado" manual del evento tras
 * descargar las fotos. Acción deliberada del administrador.
 */
export async function deleteFolder(folderId: string): Promise<void> {
  if (isDriveMock()) return;
  const drive = await getDrive();
  await drive.files.delete({
    fileId: folderId,
    ...supportsAllDrives(),
  });
}

/** Comprueba que la carpeta raíz del evento existe y es accesible. */
export async function verifyFolderAccessible(folderId: string): Promise<boolean> {
  if (isDriveMock()) return true;
  try {
    const drive = await getDrive();
    const res = await drive.files.get({
      fileId: folderId,
      fields: "id, mimeType, trashed",
      ...supportsAllDrives(),
    });
    return (
      res.data.mimeType === "application/vnd.google-apps.folder" &&
      !res.data.trashed
    );
  } catch {
    return false;
  }
}
