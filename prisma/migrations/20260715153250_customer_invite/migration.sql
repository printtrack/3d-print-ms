-- CreateTable
CREATE TABLE `CustomerInvite` (
    `token` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `usedById` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CustomerInvite_email_idx`(`email`),
    INDEX `CustomerInvite_createdById_idx`(`createdById`),
    PRIMARY KEY (`token`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CustomerInvite` ADD CONSTRAINT `CustomerInvite_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

