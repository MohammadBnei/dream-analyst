-- AlterTable
ALTER TABLE "dreams" ADD COLUMN     "context" TEXT,
ADD COLUMN     "emotions" TEXT,
ADD COLUMN     "state" TEXT DEFAULT 'CREATED',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "dream_state_change_event" (
    "id" TEXT NOT NULL,
    "dream_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "event_type" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "old_raw_text" TEXT,
    "new_raw_text" TEXT,
    "old_interpretation" TEXT,
    "new_interpretation" TEXT,
    "old_title" TEXT,
    "new_title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dream_state_change_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dream_state_change_event_dream_id_version_idx" ON "dream_state_change_event"("dream_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "dream_state_change_event_dream_id_version_key" ON "dream_state_change_event"("dream_id", "version");

-- AddForeignKey
ALTER TABLE "dream_state_change_event" ADD CONSTRAINT "dream_state_change_event_dream_id_fkey" FOREIGN KEY ("dream_id") REFERENCES "dreams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
