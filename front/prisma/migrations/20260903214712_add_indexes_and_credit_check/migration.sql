-- CreateIndex
CREATE INDEX "credit_transaction_user_id_created_at_idx" ON "credit_transaction"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "credit_transaction_related_dream_id_idx" ON "credit_transaction"("related_dream_id");

-- CreateIndex
CREATE INDEX "dream_chat_dream_id_created_at_idx" ON "dream_chat"("dream_id", "created_at");

-- CreateIndex
CREATE INDEX "dreams_user_id_dream_date_idx" ON "dreams"("user_id", "dream_date" DESC);

-- CreateIndex
CREATE INDEX "dreams_user_id_created_at_idx" ON "dreams"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "dreams_user_id_status_idx" ON "dreams"("user_id", "status");

-- Database-level backstop for the credit balance.
--
-- deductCredits now decrements conditionally inside a transaction, but
-- application logic can regress and this constraint cannot. Verified safe before
-- adding: production had 0 users with a negative balance at the time of writing.
--
-- Prisma does not model CHECK constraints, so this is raw and will be preserved
-- by `migrate deploy` but is invisible to `prisma db push`.
ALTER TABLE "user" ADD CONSTRAINT "user_credits_non_negative" CHECK (credits >= 0);
