-- AlterTable
ALTER TABLE "dreams" ADD COLUMN     "promptType" TEXT DEFAULT 'jungian';

-- CreateTable
CREATE TABLE "dream_chat" (
    "id" TEXT NOT NULL,
    "dream_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "promptType" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dream_chat_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "dream_chat" ADD CONSTRAINT "dream_chat_dream_id_fkey" FOREIGN KEY ("dream_id") REFERENCES "dreams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dream_chat" ADD CONSTRAINT "dream_chat_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
