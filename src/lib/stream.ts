import { Readable } from "node:stream";
import { createHash } from "node:crypto";

/**
 * Utilidades de streaming para la subida sin bufferizar el archivo completo.
 *
 * Leemos solo los primeros bytes (cabecera) para poder validar el MIME real
 * ANTES de reenviar a Drive, y reconstruimos un stream que vuelve a emitir
 * esa cabecera seguida del resto. Por el camino:
 *   - contamos el tamaño total y abortamos si supera el límite;
 *   - calculamos el SHA-256 del contenido.
 */

export interface RebuiltStream {
  head: Uint8Array;
  /** Stream de Node listo para pasar a Drive (cabecera + resto). */
  stream: Readable;
  /** Promesa que resuelve con {size, sha256} al terminar de leer. */
  done: Promise<{ size: number; sha256: string }>;
}

export async function sniffAndRebuild(
  webStream: ReadableStream<Uint8Array>,
  opts: { headLen?: number; maxBytes: number }
): Promise<RebuiltStream> {
  const headLen = opts.headLen ?? 32;
  const reader = webStream.getReader();

  const headChunks: Uint8Array[] = [];
  let headBytes = 0;

  // Acumula hasta tener headLen bytes (o EOF).
  let leftover: Uint8Array | null = null;
  let ended = false;

  while (headBytes < headLen) {
    const { value, done } = await reader.read();
    if (done) {
      ended = true;
      break;
    }
    if (value && value.length) {
      headChunks.push(value);
      headBytes += value.length;
    }
  }

  const head = concat(headChunks).slice(0, Math.max(headLen, 0));
  const headFull = concat(headChunks); // puede exceder headLen: se reemite completo

  const hash = createHash("sha256");
  let size = 0;

  let resolveDone!: (v: { size: number; sha256: string }) => void;
  let rejectDone!: (e: unknown) => void;
  const done = new Promise<{ size: number; sha256: string }>((res, rej) => {
    resolveDone = res;
    rejectDone = rej;
  });

  const maxBytes = opts.maxBytes;

  async function* generator() {
    try {
      // 1) Reemite lo ya leído para la cabecera.
      if (headFull.length) {
        size += headFull.length;
        hash.update(headFull);
        if (size > maxBytes) throw new Error("MAX_SIZE_EXCEEDED");
        yield Buffer.from(headFull);
      }
      // 2) Resto del stream.
      if (!ended) {
        while (true) {
          const { value, done: d } = await reader.read();
          if (d) break;
          if (value && value.length) {
            size += value.length;
            hash.update(value);
            if (size > maxBytes) throw new Error("MAX_SIZE_EXCEEDED");
            yield Buffer.from(value);
          }
        }
      }
      resolveDone({ size, sha256: hash.digest("hex") });
    } catch (err) {
      rejectDone(err);
      throw err;
    }
  }

  const stream = Readable.from(generator());
  return { head, stream, done };
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}
