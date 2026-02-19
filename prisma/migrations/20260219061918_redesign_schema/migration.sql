/*
  Warnings:

  - You are about to alter the column `amount` on the `transactions` table. The data in that column could be lost. The data in that column will be cast from `Decimal(18,2)` to `Decimal(18,6)`.
  - You are about to drop the column `password` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `currency` on the `wallets` table. All the data in the column will be lost.
  - You are about to alter the column `balance` on the `wallets` table. The data in that column could be lost. The data in that column will be cast from `Decimal(18,2)` to `Decimal(18,6)`.
  - A unique constraint covering the columns `[userId,assetTypeId]` on the table `wallets` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `assetTypeId` to the `wallets` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "wallets_userId_key";

-- AlterTable
ALTER TABLE "transactions" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(18,6);

-- AlterTable
ALTER TABLE "users" DROP COLUMN "password";

-- AlterTable
ALTER TABLE "wallets" DROP COLUMN "currency",
ADD COLUMN     "assetTypeId" TEXT NOT NULL,
ALTER COLUMN "balance" SET DATA TYPE DECIMAL(18,6);

-- CreateTable
CREATE TABLE "asset_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "asset_types_name_key" ON "asset_types"("name");

-- CreateIndex
CREATE INDEX "wallets_userId_idx" ON "wallets"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_userId_assetTypeId_key" ON "wallets"("userId", "assetTypeId");

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_assetTypeId_fkey" FOREIGN KEY ("assetTypeId") REFERENCES "asset_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
