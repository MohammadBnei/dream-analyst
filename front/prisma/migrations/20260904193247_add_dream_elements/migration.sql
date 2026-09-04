-- CreateTable
CREATE TABLE "vocabulary_entry" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vocabulary_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dream_element" (
    "id" TEXT NOT NULL,
    "dream_id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "raw_label" TEXT NOT NULL,
    "valence" DOUBLE PRECISION,
    "intensity" DOUBLE PRECISION,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dream_element_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vocabulary_entry_user_id_kind_label_key" ON "vocabulary_entry"("user_id", "kind", "label");

-- CreateIndex
CREATE INDEX "dream_element_entry_id_idx" ON "dream_element"("entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "dream_element_dream_id_entry_id_key" ON "dream_element"("dream_id", "entry_id");

-- AddForeignKey
ALTER TABLE "vocabulary_entry" ADD CONSTRAINT "vocabulary_entry_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dream_element" ADD CONSTRAINT "dream_element_dream_id_fkey" FOREIGN KEY ("dream_id") REFERENCES "dreams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dream_element" ADD CONSTRAINT "dream_element_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "vocabulary_entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
