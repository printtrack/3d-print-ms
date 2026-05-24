-- CreateTable: Invoice
CREATE TABLE `Invoice` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `quoteId` VARCHAR(191) NULL,
    `number` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `issuedAt` DATETIME(3) NULL,
    `dueAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `reverseOfId` VARCHAR(191) NULL,
    `totalCents` INTEGER NOT NULL DEFAULT 0,
    `taxCents` INTEGER NOT NULL DEFAULT 0,
    `kleinunternehmer` BOOLEAN NOT NULL DEFAULT false,
    `notes` TEXT NULL,
    `pdfPath` VARCHAR(191) NULL,
    `snapshotJson` JSON NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Invoice_number_key`(`number`),
    UNIQUE INDEX `Invoice_reverseOfId_key`(`reverseOfId`),
    INDEX `Invoice_orderId_idx`(`orderId`),
    INDEX `Invoice_status_idx`(`status`),
    INDEX `Invoice_quoteId_idx`(`quoteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: InvoiceItem
CREATE TABLE `InvoiceItem` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `description` TEXT NOT NULL,
    `quantity` DECIMAL(10, 3) NOT NULL DEFAULT 1,
    `unitPriceCents` INTEGER NOT NULL DEFAULT 0,
    `taxRatePercent` DECIMAL(5, 2) NOT NULL DEFAULT 19,
    `category` ENUM('FILAMENT', 'HARDWARE', 'POST_PROCESSING', 'DESIGN', 'SHIPPING', 'DISCOUNT', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `orderPartId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `InvoiceItem_invoiceId_idx`(`invoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: InvoiceNumberCounter
CREATE TABLE `InvoiceNumberCounter` (
    `id` VARCHAR(191) NOT NULL,
    `prefix` VARCHAR(191) NOT NULL,
    `nextValue` INTEGER NOT NULL DEFAULT 1,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `InvoiceNumberCounter_prefix_key`(`prefix`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: Payment
CREATE TABLE `Payment` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `amountCents` INTEGER NOT NULL,
    `paidAt` DATETIME(3) NOT NULL,
    `method` ENUM('SEPA', 'CASH', 'PAYPAL', 'CREDIT', 'CARD', 'OTHER') NOT NULL,
    `reference` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `recordedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Payment_invoiceId_idx`(`invoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: PaymentReminder
CREATE TABLE `PaymentReminder` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `stage` INTEGER NOT NULL,
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `feeCents` INTEGER NULL DEFAULT 0,

    INDEX `PaymentReminder_invoiceId_idx`(`invoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_quoteId_fkey` FOREIGN KEY (`quoteId`) REFERENCES `Quote`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_reverseOfId_fkey` FOREIGN KEY (`reverseOfId`) REFERENCES `Invoice`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `InvoiceItem` ADD CONSTRAINT `InvoiceItem_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PaymentReminder` ADD CONSTRAINT `PaymentReminder_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
