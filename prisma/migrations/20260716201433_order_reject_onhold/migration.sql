-- AlterTable
ALTER TABLE `Order` ADD COLUMN `rejectedAt` DATETIME(3) NULL,
    ADD COLUMN `rejectionReason` TEXT NULL;

-- AlterTable
ALTER TABLE `OrderPhase` ADD COLUMN `isOnHold` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `isRejected` BOOLEAN NOT NULL DEFAULT false;

