-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'UPLOADING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "publicToken" TEXT NOT NULL,
    "coupleName" TEXT NOT NULL,
    "weddingDate" TIMESTAMP(3) NOT NULL,
    "driveFolderId" TEXT NOT NULL,
    "driveGuestsFolderId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "closesAt" TIMESTAMP(3),
    "coverImageUrl" TEXT,
    "logoUrl" TEXT,
    "accentColor" TEXT NOT NULL DEFAULT '#8C7B6B',
    "welcomeMessage" TEXT NOT NULL DEFAULT 'Comparte con nosotros las fotos que has hecho hoy',
    "thankYouMessage" TEXT NOT NULL DEFAULT '¡Gracias por compartir tus recuerdos!',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Upload" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "driveFileId" TEXT,
    "sha256" TEXT,
    "guestName" TEXT,
    "ipHash" TEXT,
    "status" "UploadStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitEntry" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RateLimitEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Event_publicToken_key" ON "Event"("publicToken");

-- CreateIndex
CREATE INDEX "Event_slug_idx" ON "Event"("slug");

-- CreateIndex
CREATE INDEX "Upload_eventId_status_idx" ON "Upload"("eventId", "status");

-- CreateIndex
CREATE INDEX "Upload_eventId_createdAt_idx" ON "Upload"("eventId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Upload_eventId_idempotencyKey_key" ON "Upload"("eventId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");

-- CreateIndex
CREATE INDEX "RateLimitEntry_windowStart_idx" ON "RateLimitEntry"("windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimitEntry_key_windowStart_key" ON "RateLimitEntry"("key", "windowStart");

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
