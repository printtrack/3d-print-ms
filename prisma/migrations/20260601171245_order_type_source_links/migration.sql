-- AlterTable
ALTER TABLE `Order` ADD COLUMN `orderType` ENUM('PRINT_ONLY', 'DESIGN') NOT NULL DEFAULT 'PRINT_ONLY';

-- CreateTable
CREATE TABLE `OrderSourceLink` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `url` TEXT NOT NULL,
    `label` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OrderSourceLink_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `OrderSourceLink` ADD CONSTRAINT `OrderSourceLink_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

