-- CreateTable
CREATE TABLE `OrderPartAssignee` (
    `orderPartId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`orderPartId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MilestoneTaskAssignee` (
    `taskId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`taskId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PrintJobAssignee` (
    `printJobId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`printJobId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `OrderPartAssignee` ADD CONSTRAINT `OrderPartAssignee_orderPartId_fkey` FOREIGN KEY (`orderPartId`) REFERENCES `OrderPart`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderPartAssignee` ADD CONSTRAINT `OrderPartAssignee_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MilestoneTaskAssignee` ADD CONSTRAINT `MilestoneTaskAssignee_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `MilestoneTask`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MilestoneTaskAssignee` ADD CONSTRAINT `MilestoneTaskAssignee_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PrintJobAssignee` ADD CONSTRAINT `PrintJobAssignee_printJobId_fkey` FOREIGN KEY (`printJobId`) REFERENCES `PrintJob`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PrintJobAssignee` ADD CONSTRAINT `PrintJobAssignee_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing MilestoneTask.assigneeId data before dropping the column
INSERT INTO `MilestoneTaskAssignee` (`taskId`, `userId`)
SELECT `id`, `assigneeId` FROM `MilestoneTask` WHERE `assigneeId` IS NOT NULL;

-- DropForeignKey
ALTER TABLE `MilestoneTask` DROP FOREIGN KEY `MilestoneTask_assigneeId_fkey`;

-- AlterTable
ALTER TABLE `MilestoneTask` DROP COLUMN `assigneeId`;
