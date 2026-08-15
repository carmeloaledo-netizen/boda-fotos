import { z } from "zod";
import { ALLOWED_EXTENSIONS } from "./mime";

/** Esquemas Zod compartidos entre frontend y backend. */

export const guestNameSchema = z
  .string()
  .trim()
  .max(60, "El nombre es demasiado largo")
  .optional()
  .or(z.literal(""));

/** Metadatos que el cliente declara al iniciar una subida. */
export const uploadInitSchema = z.object({
  slug: z.string().min(1).max(120),
  token: z.string().min(20).max(200),
  guestName: guestNameSchema,
  files: z
    .array(
      z.object({
        idempotencyKey: z.string().uuid(),
        originalName: z.string().min(1).max(255),
        sizeBytes: z.number().int().positive(),
        declaredMime: z.string().min(1).max(100),
      })
    )
    .min(1)
    .max(100),
  consent: z.literal(true, {
    errorMap: () => ({ message: "Debes aceptar la casilla de autorización" }),
  }),
});

export type UploadInitInput = z.infer<typeof uploadInitSchema>;

/** Validación del nombre de archivo por extensión declarada. */
export const filenameExtensionSchema = z.string().refine((name) => {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
}, "Extensión de archivo no permitida");

/** Creación/edición de eventos desde el panel de administración. */
export const eventCreateSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "El identificador solo puede tener minúsculas, números y guiones"
    ),
  coupleName: z.string().trim().min(1).max(120),
  weddingDate: z.coerce.date(),
  // Opcional: con scope drive.file la app crea ella misma la carpeta del
  // evento en el Drive del fotógrafo. Si se deja vacío, se crea al primer subida.
  driveFolderId: z.string().trim().max(200).optional().default(""),
  closesAt: z.coerce.date().optional().nullable(),
  isActive: z.boolean().default(true),
  coverImageUrl: z.string().url().max(500).optional().nullable().or(z.literal("")),
  logoUrl: z.string().url().max(500).optional().nullable().or(z.literal("")),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color hex inválido")
    .default("#8C7B6B"),
  welcomeMessage: z.string().max(300).optional(),
  thankYouMessage: z.string().max(300).optional(),
});

export type EventCreateInput = z.infer<typeof eventCreateSchema>;

export const eventUpdateSchema = eventCreateSchema.partial().extend({
  // slug no se puede cambiar tras creación para no romper QR ya impresos.
  slug: z.undefined().optional(),
});

export const adminLoginSchema = z.object({
  username: z.string().min(1).max(120),
  password: z.string().min(1).max(200),
});
