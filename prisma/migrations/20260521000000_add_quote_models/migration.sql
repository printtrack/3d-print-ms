-- CreateTable: Quote (versioned per Order)
CREATE TABLE `Quote` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `status` ENUM('DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED', 'SUPERSEDED') NOT NULL DEFAULT 'DRAFT',
    `totalCents` INTEGER NOT NULL DEFAULT 0,
    `taxCents` INTEGER NOT NULL DEFAULT 0,
    `validUntil` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NULL,
    `approvedAt` DATETIME(3) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `rejectionReason` TEXT NULL,
    `notes` TEXT NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Quote_orderId_version_key`(`orderId`, `version`),
    INDEX `Quote_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: QuoteItem
CREATE TABLE `QuoteItem` (
    `id` VARCHAR(191) NOT NULL,
    `quoteId` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `description` TEXT NOT NULL,
    `quantity` DECIMAL(10, 3) NOT NULL DEFAULT 1,
    `unitPriceCents` INTEGER NOT NULL DEFAULT 0,
    `taxRatePercent` DECIMAL(5, 2) NOT NULL DEFAULT 19,
    `category` ENUM('FILAMENT', 'HARDWARE', 'POST_PROCESSING', 'DESIGN', 'SHIPPING', 'DISCOUNT', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `source` ENUM('ESTIMATE', 'FIXED', 'ACTUAL') NOT NULL DEFAULT 'FIXED',
    `orderPartId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `QuoteItem_quoteId_idx`(`quoteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable: VerificationRequest — optional link to Quote
ALTER TABLE `VerificationRequest` ADD COLUMN `quoteId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `VerificationRequest_quoteId_idx` ON `VerificationRequest`(`quoteId`);

-- AddForeignKey
ALTER TABLE `Quote` ADD CONSTRAINT `Quote_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuoteItem` ADD CONSTRAINT `QuoteItem_quoteId_fkey` FOREIGN KEY (`quoteId`) REFERENCES `Quote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VerificationRequest` ADD CONSTRAINT `VerificationRequest_quoteId_fkey` FOREIGN KEY (`quoteId`) REFERENCES `Quote`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
