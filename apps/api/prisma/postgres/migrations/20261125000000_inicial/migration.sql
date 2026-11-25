-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "papel" TEXT NOT NULL,
    "plano" TEXT NOT NULL DEFAULT 'gratis',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateProfile" (
    "userId" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "situacao" TEXT NOT NULL,
    "tempo" TEXT NOT NULL,
    "candidatou" TEXT NOT NULL,
    "atrapalha" TEXT NOT NULL,
    "etapa" TEXT NOT NULL,
    "publico" BOOLEAN NOT NULL DEFAULT false,
    "slug" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "concluido" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT NOT NULL DEFAULT '',
    "competencias" TEXT NOT NULL DEFAULT '[]',
    "problema" TEXT NOT NULL DEFAULT '',
    "fez" TEXT NOT NULL DEFAULT '',
    "ferramentas" TEXT NOT NULL DEFAULT '',
    "resultado" TEXT NOT NULL DEFAULT '',
    "origem" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "empresa" TEXT NOT NULL DEFAULT '',
    "texto" TEXT NOT NULL,
    "fonte" TEXT NOT NULL,
    "iaDescricao" TEXT,
    "ajustada" BOOLEAN NOT NULL DEFAULT false,
    "companyJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRequirement" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "requisito" TEXT NOT NULL,
    "curto" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "kind" TEXT,
    "obrig" BOOLEAN NOT NULL,
    "evId" TEXT,
    "aceita" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "JobRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT,
    "titulo" TEXT NOT NULL,
    "prazo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'a fazer',
    "tipo" TEXT NOT NULL,
    "comp" TEXT NOT NULL DEFAULT '',
    "evId" TEXT,
    "virou" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "etapa" TEXT NOT NULL DEFAULT 'Candidatei',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewStory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pergunta" TEXT NOT NULL,
    "evidenceId" TEXT,
    "evidencia" TEXT NOT NULL,
    "situacao" TEXT NOT NULL,
    "tarefa" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "resultado" TEXT NOT NULL,
    "fonte" TEXT NOT NULL,
    "iaDescricao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewStory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "papel" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "iaDescricao" TEXT,
    "interrompida" BOOLEAN NOT NULL DEFAULT false,
    "acoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyJob" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "selo" BOOLEAN NOT NULL DEFAULT false,
    "publicada" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyJobRequirement" (
    "id" TEXT NOT NULL,
    "companyJobId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "requisito" TEXT NOT NULL,
    "curto" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "kind" TEXT,
    "obrig" BOOLEAN NOT NULL,
    "aceita" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "CompanyJobRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "vaga" TEXT NOT NULL DEFAULT '',
    "competencia" TEXT NOT NULL DEFAULT '',
    "descricao" TEXT NOT NULL,
    "prazo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "triagem" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiInteraction" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateProfile_slug_key" ON "CandidateProfile"("slug");

-- CreateIndex
CREATE INDEX "Evidence_userId_idx" ON "Evidence"("userId");

-- CreateIndex
CREATE INDEX "Job_userId_createdAt_idx" ON "Job"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "JobRequirement_jobId_idx" ON "JobRequirement"("jobId");

-- CreateIndex
CREATE INDEX "Task_userId_idx" ON "Task"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_jobId_key" ON "Application"("jobId");

-- CreateIndex
CREATE INDEX "Application_userId_idx" ON "Application"("userId");

-- CreateIndex
CREATE INDEX "InterviewStory_userId_idx" ON "InterviewStory"("userId");

-- CreateIndex
CREATE INDEX "UsageEvent_userId_tipo_createdAt_idx" ON "UsageEvent"("userId", "tipo", "createdAt");

-- CreateIndex
CREATE INDEX "Conversation_userId_updatedAt_idx" ON "Conversation"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "CompanyJob_companyId_idx" ON "CompanyJob"("companyId");

-- CreateIndex
CREATE INDEX "CompanyJob_publicada_createdAt_idx" ON "CompanyJob"("publicada", "createdAt");

-- CreateIndex
CREATE INDEX "CompanyJobRequirement_companyJobId_idx" ON "CompanyJobRequirement"("companyJobId");

-- CreateIndex
CREATE INDEX "Challenge_companyId_idx" ON "Challenge"("companyId");

-- CreateIndex
CREATE INDEX "Challenge_prazo_idx" ON "Challenge"("prazo");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_challengeId_candidateId_key" ON "Submission"("challengeId", "candidateId");

-- CreateIndex
CREATE INDEX "AiInteraction_tarefa_createdAt_idx" ON "AiInteraction"("tarefa", "createdAt");

-- CreateIndex
CREATE INDEX "AiInteraction_userId_createdAt_idx" ON "AiInteraction"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_companyJobId_fkey" FOREIGN KEY ("companyJobId") REFERENCES "CompanyJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobRequirement" ADD CONSTRAINT "JobRequirement_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewStory" ADD CONSTRAINT "InterviewStory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyJob" ADD CONSTRAINT "CompanyJob_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyJobRequirement" ADD CONSTRAINT "CompanyJobRequirement_companyJobId_fkey" FOREIGN KEY ("companyJobId") REFERENCES "CompanyJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiInteraction" ADD CONSTRAINT "AiInteraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
