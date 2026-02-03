/*
  Warnings:

  - The `status` column on the `dreams` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "DreamStatus" AS ENUM ('PENDING_ANALYSIS', 'COMPLETED', 'ANALYSIS_FAILED');

-- AlterTable
ALTER TABLE "dreams" DROP COLUMN "status",
ADD COLUMN     "status" "DreamStatus" NOT NULL DEFAULT 'PENDING_ANALYSIS';
