-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "charCount" INTEGER NOT NULL,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "charStart" INTEGER NOT NULL,
    "charEnd" INTEGER NOT NULL,
    "embedding" JSONB NOT NULL,
    "embedderKind" TEXT NOT NULL,
    "dimension" INTEGER NOT NULL,
    "tokenCount" INTEGER NOT NULL,

    CONSTRAINT "Chunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Query" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "refused" BOOLEAN NOT NULL DEFAULT false,
    "cacheHit" BOOLEAN NOT NULL DEFAULT false,
    "topScore" DOUBLE PRECISION,
    "topK" INTEGER NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "embedderKind" TEXT NOT NULL,
    "generatorKind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Query_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Retrieval" (
    "id" TEXT NOT NULL,
    "queryId" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "rank" INTEGER NOT NULL,
    "cited" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Retrieval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Document_contentHash_idx" ON "Document"("contentHash");

-- CreateIndex
CREATE INDEX "Chunk_documentId_idx" ON "Chunk"("documentId");

-- CreateIndex
CREATE INDEX "Query_createdAt_idx" ON "Query"("createdAt");

-- CreateIndex
CREATE INDEX "Retrieval_queryId_idx" ON "Retrieval"("queryId");

-- AddForeignKey
ALTER TABLE "Chunk" ADD CONSTRAINT "Chunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Retrieval" ADD CONSTRAINT "Retrieval_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "Query"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Retrieval" ADD CONSTRAINT "Retrieval_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "Chunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
