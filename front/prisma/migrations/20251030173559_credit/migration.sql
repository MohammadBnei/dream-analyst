-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('BASIC', 'VIP', 'ADMIN');

-- CreateEnum
CREATE TYPE "CreditActionType" AS ENUM ('DREAM_ANALYSIS', 'CHAT_MESSAGE', 'DAILY_GRANT', 'ADMIN_GRANT', 'ADMIN_DEDUCT');

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "credits" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'BASIC';

-- CreateTable
CREATE TABLE "credit_transaction" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "actionType" "CreditActionType" NOT NULL,
    "related_dream_id" TEXT,
    "related_chat_message_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "credit_transaction_related_chat_message_id_key" ON "credit_transaction"("related_chat_message_id");

-- AddForeignKey
ALTER TABLE "credit_transaction" ADD CONSTRAINT "credit_transaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transaction" ADD CONSTRAINT "credit_transaction_related_dream_id_fkey" FOREIGN KEY ("related_dream_id") REFERENCES "dreams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transaction" ADD CONSTRAINT "credit_transaction_related_chat_message_id_fkey" FOREIGN KEY ("related_chat_message_id") REFERENCES "dream_chat"("id") ON DELETE SET NULL ON UPDATE CASCADE;
