/*
  Warnings:

  - The primary key for the `product` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `product` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `product_variant` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `product_variant` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `productId` on the `product_variant` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "product_variant" DROP CONSTRAINT "product_variant_productId_fkey";

-- AlterTable
ALTER TABLE "product" DROP CONSTRAINT "product_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
ADD CONSTRAINT "product_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "product_variant" DROP CONSTRAINT "product_variant_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
DROP COLUMN "productId",
ADD COLUMN     "productId" UUID NOT NULL,
ADD CONSTRAINT "product_variant_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE INDEX "product_variant_productId_idx" ON "product_variant"("productId");

-- AddForeignKey
ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
