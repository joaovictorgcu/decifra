-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "alvo" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "util" BOOLEAN NOT NULL,
    "comentario" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Feedback_alvo_createdAt_idx" ON "Feedback"("alvo", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Feedback_userId_alvo_refId_key" ON "Feedback"("userId", "alvo", "refId");

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
