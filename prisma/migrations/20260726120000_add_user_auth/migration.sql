-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "score_points" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AlterTable
ALTER TABLE "Scan" ADD COLUMN "customer_id" TEXT;

-- CreateIndex
CREATE INDEX "Scan_customer_id_idx" ON "Scan"("customer_id");

-- AddForeignKey
ALTER TABLE "Scan" ADD CONSTRAINT "Scan_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
