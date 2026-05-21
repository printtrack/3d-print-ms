-- DropForeignKey
ALTER TABLE `FilamentCredit` DROP FOREIGN KEY `FilamentCredit_customerId_fkey`;

-- AlterTable: Customer — replace grams balance with cents balance
ALTER TABLE `Customer`
    DROP COLUMN `creditBalance`,
    ADD COLUMN `creditBalanceCents` INTEGER NOT NULL DEFAULT 0;

-- AlterTable: Filament — add optional price per kg
ALTER TABLE `Filament` ADD COLUMN `pricePerKg` DECIMAL(10, 2) NULL;

-- AlterTable: OrderPart — add aggregate cache fields for verification
ALTER TABLE `OrderPart`
    ADD COLUMN `chargedCentsTotal` INTEGER NULL,
    ADD COLUMN `gramsActualTotal` INTEGER NULL;

-- AlterTable: PartPhase — isMisprint flag
ALTER TABLE `PartPhase` ADD COLUMN `isMisprint` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: PrintJob — shortCode unique identifier
ALTER TABLE `PrintJob`
    ADD COLUMN `shortCode` VARCHAR(191) NULL,
    MODIFY `status` ENUM('PLANNED', 'SLICED', 'IN_PROGRESS', 'AWAITING_VERIFICATION', 'DONE', 'CANCELLED') NOT NULL DEFAULT 'PLANNED';

-- DropTable: FilamentCredit replaced by CustomerCredit
DROP TABLE `FilamentCredit`;

-- CreateTable: OrderPartIteration — per-piece verification data
CREATE TABLE `OrderPartIteration` (
    `id` VARCHAR(191) NOT NULL,
    `orderPartId` VARCHAR(191) NOT NULL,
    `pieceIndex` INTEGER NOT NULL,
    `result` VARCHAR(191) NOT NULL,
    `gramsActual` INTEGER NOT NULL,
    `chargedCents` INTEGER NULL,
    `chargeReason` VARCHAR(191) NULL,
    `printJobId` VARCHAR(191) NULL,
    `verifiedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `verifiedBy` VARCHAR(191) NULL,

    UNIQUE INDEX `OrderPartIteration_orderPartId_pieceIndex_key`(`orderPartId`, `pieceIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: OrderFileNote
CREATE TABLE `OrderFileNote` (
    `id` VARCHAR(191) NOT NULL,
    `orderFileId` VARCHAR(191) NOT NULL,
    `posX` DOUBLE NOT NULL,
    `posY` DOUBLE NOT NULL,
    `posZ` DOUBLE NOT NULL,
    `normalX` DOUBLE NOT NULL,
    `normalY` DOUBLE NOT NULL,
    `normalZ` DOUBLE NOT NULL,
    `body` TEXT NOT NULL,
    `isCustomerVisible` BOOLEAN NOT NULL DEFAULT true,
    `resolvedAt` DATETIME(3) NULL,
    `authorId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OrderFileNote_orderFileId_idx`(`orderFileId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: CustomerCredit replaces FilamentCredit, amount now in cents
CREATE TABLE `CustomerCredit` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `amountCents` INTEGER NOT NULL,
    `reason` TEXT NOT NULL,
    `orderId` VARCHAR(191) NULL,
    `performedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CustomerCredit_customerId_idx`(`customerId`),
    INDEX `CustomerCredit_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex: PrintJob shortCode unique
CREATE UNIQUE INDEX `PrintJob_shortCode_key` ON `PrintJob`(`shortCode`);

-- AddForeignKey
ALTER TABLE `OrderPartIteration` ADD CONSTRAINT `OrderPartIteration_orderPartId_fkey` FOREIGN KEY (`orderPartId`) REFERENCES `OrderPart`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderFileNote` ADD CONSTRAINT `OrderFileNote_orderFileId_fkey` FOREIGN KEY (`orderFileId`) REFERENCES `OrderFile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderFileNote` ADD CONSTRAINT `OrderFileNote_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerCredit` ADD CONSTRAINT `CustomerCredit_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
