-- AlterTable
ALTER TABLE `Machine` ADD COLUMN `connectionConfigEnc` TEXT NULL,
    ADD COLUMN `connectionType` ENUM('NONE', 'MOCK', 'PRUSA_CONNECT', 'ULTIMAKER_CLOUD') NOT NULL DEFAULT 'NONE',
    ADD COLUMN `lastSeenAt` DATETIME(3) NULL,
    ADD COLUMN `lastSeenState` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `PrintDispatch` (
    `id` VARCHAR(191) NOT NULL,
    `printJobId` VARCHAR(191) NOT NULL,
    `machineId` VARCHAR(191) NOT NULL,
    `printJobFileId` VARCHAR(191) NOT NULL,
    `status` ENUM('QUEUED', 'UPLOADING', 'UPLOADED', 'HELD', 'STARTED', 'PRINTING', 'DONE', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'QUEUED',
    `autoStart` BOOLEAN NOT NULL DEFAULT true,
    `providerRef` VARCHAR(191) NULL,
    `holdReason` VARCHAR(191) NULL,
    `error` TEXT NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `startedAt` DATETIME(3) NULL,
    `finishedAt` DATETIME(3) NULL,

    INDEX `PrintDispatch_printJobId_idx`(`printJobId`),
    INDEX `PrintDispatch_machineId_idx`(`machineId`),
    INDEX `PrintDispatch_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PrintDispatch` ADD CONSTRAINT `PrintDispatch_printJobId_fkey` FOREIGN KEY (`printJobId`) REFERENCES `PrintJob`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PrintDispatch` ADD CONSTRAINT `PrintDispatch_machineId_fkey` FOREIGN KEY (`machineId`) REFERENCES `Machine`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PrintDispatch` ADD CONSTRAINT `PrintDispatch_printJobFileId_fkey` FOREIGN KEY (`printJobFileId`) REFERENCES `PrintJobFile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

