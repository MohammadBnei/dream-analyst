-- CreateEnum
CREATE TYPE "Sentiment" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE', 'AMBIVALENT');

-- AlterTable
ALTER TABLE "dreams" ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "metadata_schema" JSONB;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "active_metadata_config_id" TEXT,
ADD COLUMN     "custom_metadata_schema" JSONB;

-- CreateTable
CREATE TABLE "metadata_configs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "schema" JSONB NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_global" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metadata_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "symbols" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "occurrence_count" INTEGER NOT NULL DEFAULT 0,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "symbols_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dream_symbol_occurrences" (
    "id" TEXT NOT NULL,
    "dream_id" TEXT NOT NULL,
    "symbol_id" TEXT NOT NULL,
    "sentiment" "Sentiment" NOT NULL DEFAULT 'NEUTRAL',
    "context_note" VARCHAR(500),
    "prominence" INTEGER NOT NULL DEFAULT 2,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dream_symbol_occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "metadata_configs_name_key" ON "metadata_configs"("name");

-- CreateIndex
CREATE UNIQUE INDEX "symbols_name_key" ON "symbols"("name");

-- CreateIndex
CREATE INDEX "symbols_name_idx" ON "symbols"("name");

-- CreateIndex
CREATE INDEX "symbols_category_idx" ON "symbols"("category");

-- CreateIndex
CREATE INDEX "symbols_occurrence_count_idx" ON "symbols"("occurrence_count");

-- CreateIndex
CREATE INDEX "dream_symbol_occurrences_dream_id_idx" ON "dream_symbol_occurrences"("dream_id");

-- CreateIndex
CREATE INDEX "dream_symbol_occurrences_symbol_id_idx" ON "dream_symbol_occurrences"("symbol_id");

-- CreateIndex
CREATE INDEX "dream_symbol_occurrences_sentiment_idx" ON "dream_symbol_occurrences"("sentiment");

-- CreateIndex
CREATE UNIQUE INDEX "dream_symbol_occurrences_dream_id_symbol_id_key" ON "dream_symbol_occurrences"("dream_id", "symbol_id");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_active_metadata_config_id_fkey" FOREIGN KEY ("active_metadata_config_id") REFERENCES "metadata_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dream_symbol_occurrences" ADD CONSTRAINT "dream_symbol_occurrences_dream_id_fkey" FOREIGN KEY ("dream_id") REFERENCES "dreams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dream_symbol_occurrences" ADD CONSTRAINT "dream_symbol_occurrences_symbol_id_fkey" FOREIGN KEY ("symbol_id") REFERENCES "symbols"("id") ON DELETE CASCADE ON UPDATE CASCADE;
