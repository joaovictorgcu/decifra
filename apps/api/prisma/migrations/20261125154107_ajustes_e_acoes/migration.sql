-- AlterTable
ALTER TABLE "Message" ADD COLUMN "acoes" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "empresa" TEXT NOT NULL DEFAULT '',
    "texto" TEXT NOT NULL,
    "fonte" TEXT NOT NULL,
    "iaDescricao" TEXT,
    "ajustada" BOOLEAN NOT NULL DEFAULT false,
    "companyJobId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Job_companyJobId_fkey" FOREIGN KEY ("companyJobId") REFERENCES "CompanyJob" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Job" ("companyJobId", "createdAt", "empresa", "fonte", "iaDescricao", "id", "texto", "titulo", "userId") SELECT "companyJobId", "createdAt", "empresa", "fonte", "iaDescricao", "id", "texto", "titulo", "userId" FROM "Job";
DROP TABLE "Job";
ALTER TABLE "new_Job" RENAME TO "Job";
CREATE INDEX "Job_userId_createdAt_idx" ON "Job"("userId", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
