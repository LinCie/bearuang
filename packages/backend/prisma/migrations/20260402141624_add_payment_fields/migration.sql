-- AlterTable
ALTER TABLE "purchase_order" ADD COLUMN     "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "paymentMethod" TEXT;

-- AlterTable
ALTER TABLE "sales_order" ADD COLUMN     "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0;
