-- CreateTable
CREATE TABLE "Flag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "variations" JSONB NOT NULL,
    "fallthrough" JSONB NOT NULL,
    "offVariationKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Flag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rule" (
    "id" TEXT NOT NULL,
    "flagId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "description" TEXT,
    "conditions" JSONB NOT NULL,
    "serve" JSONB NOT NULL,

    CONSTRAINT "Rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exposure" (
    "id" TEXT NOT NULL,
    "flagId" TEXT NOT NULL,
    "unitKey" TEXT NOT NULL,
    "variationKey" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "ruleOrder" INTEGER,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Exposure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Flag_key_key" ON "Flag"("key");

-- CreateIndex
CREATE INDEX "Flag_key_idx" ON "Flag"("key");

-- CreateIndex
CREATE INDEX "Rule_flagId_order_idx" ON "Rule"("flagId", "order");

-- CreateIndex
CREATE INDEX "Exposure_flagId_ts_idx" ON "Exposure"("flagId", "ts");

-- AddForeignKey
ALTER TABLE "Rule" ADD CONSTRAINT "Rule_flagId_fkey" FOREIGN KEY ("flagId") REFERENCES "Flag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exposure" ADD CONSTRAINT "Exposure_flagId_fkey" FOREIGN KEY ("flagId") REFERENCES "Flag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
