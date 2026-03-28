-- CreateTable
CREATE TABLE "product_image" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "productId" UUID NOT NULL,
    "mediaId" TEXT NOT NULL,
    "altText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variant_image" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "variantId" UUID NOT NULL,
    "mediaId" TEXT NOT NULL,
    "altText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "variant_image_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_image_productId_idx" ON "product_image"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "product_image_mediaId_key" ON "product_image"("mediaId");

-- CreateIndex
CREATE INDEX "variant_image_variantId_idx" ON "variant_image"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "variant_image_mediaId_key" ON "variant_image"("mediaId");

-- AddForeignKey
ALTER TABLE "product_image" ADD CONSTRAINT "product_image_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_image" ADD CONSTRAINT "product_image_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_image" ADD CONSTRAINT "variant_image_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_image" ADD CONSTRAINT "variant_image_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
