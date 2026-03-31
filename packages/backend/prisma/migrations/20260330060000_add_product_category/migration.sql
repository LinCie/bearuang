-- CreateTable
CREATE TABLE "product_category" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "organizationId" TEXT NOT NULL,
    "parentId" UUID,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "product_category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_category_organizationId_slug_key" ON "product_category"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "product_category_organizationId_idx" ON "product_category"("organizationId");

-- CreateIndex
CREATE INDEX "product_category_parentId_idx" ON "product_category"("parentId");

-- AddForeignKey
ALTER TABLE "product_category" ADD CONSTRAINT "product_category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "product_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "product" ADD COLUMN "categoryId" UUID;

-- CreateIndex
CREATE INDEX "product_categoryId_idx" ON "product"("categoryId");

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "product_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
