import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { sniffAndRebuild } from "@/lib/stream";

function webStreamFrom(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) controller.enqueue(chunks[i++]);
      else controller.close();
    },
  });
}

async function drain(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const parts: Buffer[] = [];
  for await (const c of stream) parts.push(Buffer.from(c as Buffer));
  return Buffer.concat(parts);
}

describe("sniffAndRebuild", () => {
  it("reconstruye el contenido íntegro (cabecera + resto)", async () => {
    const jpegHead = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
    const rest = new Uint8Array([9, 9, 9, 9, 9]);
    const original = Buffer.concat([Buffer.from(jpegHead), Buffer.from(rest)]);

    const { head, stream, done } = await sniffAndRebuild(
      webStreamFrom([jpegHead, rest]),
      { maxBytes: 1000, headLen: 4 }
    );

    expect(Array.from(head.slice(0, 3))).toEqual([0xff, 0xd8, 0xff]);

    const rebuilt = await drain(stream);
    expect(rebuilt.equals(original)).toBe(true);

    const { size, sha256 } = await done;
    expect(size).toBe(original.length);
    expect(sha256).toBe(createHash("sha256").update(original).digest("hex"));
  });

  it("aborta cuando se supera el tamaño máximo", async () => {
    const big = new Uint8Array(100).fill(7);
    const { stream, done } = await sniffAndRebuild(webStreamFrom([big]), {
      maxBytes: 10,
      headLen: 4,
    });

    await expect(drain(stream)).rejects.toThrow();
    await expect(done).rejects.toThrow(/MAX_SIZE_EXCEEDED/);
  });
});
