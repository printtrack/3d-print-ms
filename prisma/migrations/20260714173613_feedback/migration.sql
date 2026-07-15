-- CreateTable
CREATE TABLE `Feedback` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('BUG', 'IMPROVEMENT') NOT NULL DEFAULT 'BUG',
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `screenshotPath` VARCHAR(191) NULL,
    `pageUrl` VARCHAR(191) NULL,
    `userAgent` TEXT NULL,
    `status` ENUM('NEW', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED') NOT NULL DEFAULT 'NEW',
    `githubIssueUrl` VARCHAR(191) NULL,
    `githubIssueNumber` INTEGER NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Feedback_status_idx`(`status`),
    INDEX `Feedback_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Feedback` ADD CONSTRAINT `Feedback_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

