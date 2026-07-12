-- AlterTable
ALTER TABLE `OrderPart` ADD COLUMN `variantGroupId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `OrderPart_variantGroupId_idx` ON `OrderPart`(`variantGroupId`);

