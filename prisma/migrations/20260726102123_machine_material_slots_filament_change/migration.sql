-- AlterTable
ALTER TABLE `Machine` ADD COLUMN `materialSlots` INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE `PrintJob` ADD COLUMN `filamentChangeConfirmedAt` DATETIME(3) NULL,
    ADD COLUMN `filamentChangeConfirmedBy` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `MachineFilamentSlot` (
    `id` VARCHAR(191) NOT NULL,
    `machineId` VARCHAR(191) NOT NULL,
    `slot` INTEGER NOT NULL,
    `filamentId` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MachineFilamentSlot_filamentId_idx`(`filamentId`),
    UNIQUE INDEX `MachineFilamentSlot_machineId_slot_key`(`machineId`, `slot`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PrintJobPlannedFilament` (
    `printJobId` VARCHAR(191) NOT NULL,
    `filamentId` VARCHAR(191) NOT NULL,

    INDEX `PrintJobPlannedFilament_filamentId_idx`(`filamentId`),
    PRIMARY KEY (`printJobId`, `filamentId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MachineFilamentSlot` ADD CONSTRAINT `MachineFilamentSlot_machineId_fkey` FOREIGN KEY (`machineId`) REFERENCES `Machine`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MachineFilamentSlot` ADD CONSTRAINT `MachineFilamentSlot_filamentId_fkey` FOREIGN KEY (`filamentId`) REFERENCES `Filament`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PrintJobPlannedFilament` ADD CONSTRAINT `PrintJobPlannedFilament_printJobId_fkey` FOREIGN KEY (`printJobId`) REFERENCES `PrintJob`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PrintJobPlannedFilament` ADD CONSTRAINT `PrintJobPlannedFilament_filamentId_fkey` FOREIGN KEY (`filamentId`) REFERENCES `Filament`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
