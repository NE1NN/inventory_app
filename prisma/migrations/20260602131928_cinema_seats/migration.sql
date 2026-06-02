/*
  Warnings:

  - You are about to drop the `Item` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "Item";

-- CreateTable
CREATE TABLE "Seat" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "label" TEXT NOT NULL DEFAULT 'E5',
    "row" TEXT NOT NULL DEFAULT 'E',
    "col" INTEGER NOT NULL DEFAULT 5,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "bookedBy" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'safe',

    CONSTRAINT "Seat_pkey" PRIMARY KEY ("id")
);
