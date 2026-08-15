import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();

function publicToken(): string {
  // 32 bytes -> 43 chars base64url, criptográficamente seguro.
  return randomBytes(32).toString("base64url");
}

async function main() {
  const slug = "laura-pablo-2026";

  const token = publicToken();
  const event = await prisma.event.upsert({
    where: { slug },
    update: {},
    create: {
      slug,
      publicToken: token,
      coupleName: "Laura & Pablo",
      weddingDate: new Date("2026-09-12T18:00:00.000Z"),
      // En una instalación real, sustituye por el ID real de la carpeta de Drive.
      driveFolderId: "DEMO_DRIVE_FOLDER_ID",
      isActive: true,
      closesAt: new Date("2026-09-19T23:59:59.000Z"),
      accentColor: "#8C7B6B",
      welcomeMessage: "Comparte con nosotros las fotos que has hecho hoy",
      thankYouMessage: "¡Gracias por compartir vuestros recuerdos con nosotros!",
    },
  });

  // Un par de subidas de ejemplo para poblar el panel.
  await prisma.upload.createMany({
    data: [
      {
        eventId: event.id,
        idempotencyKey: "demo-1",
        originalName: "IMG_0421.jpg",
        storedName: "20260912_184530_ana_demo-uuid-1_IMG_0421.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 3_812_004,
        driveFileId: "demo-drive-file-1",
        guestName: "Ana",
        status: "COMPLETED",
      },
      {
        eventId: event.id,
        idempotencyKey: "demo-2",
        originalName: "foto ramo.png",
        storedName: "20260912_190210_sin-nombre_demo-uuid-2_foto-ramo.png",
        mimeType: "image/png",
        sizeBytes: 7_240_115,
        driveFileId: "demo-drive-file-2",
        status: "COMPLETED",
      },
    ],
    skipDuplicates: true,
  });

  console.log("Seed completado.");
  console.log(`Evento demo: ${event.coupleName}`);
  console.log(`URL pública: /e/${event.slug}?t=${token}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
