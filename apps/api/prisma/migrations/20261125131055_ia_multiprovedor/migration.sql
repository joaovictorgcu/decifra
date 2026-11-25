-- AlterTable
ALTER TABLE "InterviewStory" ADD COLUMN "iaDescricao" TEXT;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN "iaDescricao" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AiInteraction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "tarefa" TEXT NOT NULL,
    "nivel" TEXT NOT NULL DEFAULT '',
    "tentativa" INTEGER NOT NULL DEFAULT 1,
    "provedor" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "latenciaMs" INTEGER NOT NULL,
    "tokensEntrada" INTEGER NOT NULL DEFAULT 0,
    "tokensSaida" INTEGER NOT NULL DEFAULT 0,
    "erro" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiInteraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AiInteraction" ("createdAt", "erro", "id", "latenciaMs", "modelo", "provedor", "status", "tarefa", "tokensEntrada", "tokensSaida", "userId") SELECT "createdAt", "erro", "id", "latenciaMs", "modelo", "provedor", "status", "tarefa", "tokensEntrada", "tokensSaida", "userId" FROM "AiInteraction";
DROP TABLE "AiInteraction";
ALTER TABLE "new_AiInteraction" RENAME TO "AiInteraction";
CREATE INDEX "AiInteraction_tarefa_createdAt_idx" ON "AiInteraction"("tarefa", "createdAt");
CREATE INDEX "AiInteraction_userId_createdAt_idx" ON "AiInteraction"("userId", "createdAt");
CREATE TABLE "new_Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "papel" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "iaDescricao" TEXT,
    "interrompida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Message" ("conteudo", "conversationId", "createdAt", "id", "papel") SELECT "conteudo", "conversationId", "createdAt", "id", "papel" FROM "Message";
DROP TABLE "Message";
ALTER TABLE "new_Message" RENAME TO "Message";
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
