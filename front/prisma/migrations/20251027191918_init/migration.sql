/*
  Warnings:

  - Made the column `user_id` on table `dreams` required. This step will fail if there are existing NULL values in that column.
  - Made the column `email` on table `user` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."dreams" DROP CONSTRAINT "dreams_user_id_fkey";

-- AlterTable
ALTER TABLE "dreams" ALTER COLUMN "user_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "user" ALTER COLUMN "email" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "dreams" ADD CONSTRAINT "dreams_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
