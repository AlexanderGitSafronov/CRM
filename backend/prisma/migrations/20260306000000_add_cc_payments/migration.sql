-- CreateTable
CREATE TABLE "cc_payments" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cc_payments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "cc_payments" ADD CONSTRAINT "cc_payments_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
