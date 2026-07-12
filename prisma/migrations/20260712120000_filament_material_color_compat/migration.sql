-- AlterTable: add separate material/color requirement columns
ALTER TABLE `OrderPart`
    ADD COLUMN `material` VARCHAR(191) NULL,
    ADD COLUMN `materialAny` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `color` VARCHAR(191) NULL,
    ADD COLUMN `colorHex` VARCHAR(191) NULL,
    ADD COLUMN `colorAny` BOOLEAN NOT NULL DEFAULT false;

-- Backfill the new requirement columns from the previously linked concrete spool
UPDATE `OrderPart` op
    JOIN `Filament` f ON f.id = op.filamentId
    SET op.material = f.material,
        op.color = f.color,
        op.colorHex = f.colorHex;

-- DropForeignKey + DropColumn: the concrete spool link is replaced by the requirement
ALTER TABLE `OrderPart` DROP FOREIGN KEY `OrderPart_filamentId_fkey`;
ALTER TABLE `OrderPart` DROP COLUMN `filamentId`;

-- CreateTable: Filament <-> Machine compatibility (empty = compatible with all)
CREATE TABLE `_FilamentMachineCompat` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_FilamentMachineCompat_AB_unique`(`A`, `B`),
    INDEX `_FilamentMachineCompat_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `_FilamentMachineCompat` ADD CONSTRAINT `_FilamentMachineCompat_A_fkey` FOREIGN KEY (`A`) REFERENCES `Filament`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_FilamentMachineCompat` ADD CONSTRAINT `_FilamentMachineCompat_B_fkey` FOREIGN KEY (`B`) REFERENCES `Machine`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
