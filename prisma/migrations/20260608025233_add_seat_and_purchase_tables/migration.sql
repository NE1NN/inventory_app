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

-- CreateTable
CREATE TABLE "Purchase" (
    "id" SERIAL NOT NULL,
    "customerId" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "reason" TEXT,
    "mode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);
