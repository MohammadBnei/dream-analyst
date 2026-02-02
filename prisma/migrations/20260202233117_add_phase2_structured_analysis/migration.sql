-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('META_ANALYSIS', 'WEEKLY_SUMMARY', 'MILESTONE', 'PATTERN_ALERT');

-- AlterTable
ALTER TABLE "dreams" ADD COLUMN     "analysis_version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "structured_analysis" JSONB;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "dream_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "insight_reports" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "report_type" "ReportType" NOT NULL DEFAULT 'META_ANALYSIS',
    "trigger_event" TEXT NOT NULL,
    "dream_ids" TEXT[],
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "insights" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insight_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "insight_reports_user_id_created_at_idx" ON "insight_reports"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "insight_reports_user_id_is_read_idx" ON "insight_reports"("user_id", "is_read");

-- AddForeignKey
ALTER TABLE "insight_reports" ADD CONSTRAINT "insight_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
