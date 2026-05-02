-- AlterTable PartPhase: add isReview and isPrinted flags
ALTER TABLE `PartPhase` ADD COLUMN `isReview` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `PartPhase` ADD COLUMN `isPrinted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable VerificationRequest: add orderPartId for per-part scope
ALTER TABLE `VerificationRequest` ADD COLUMN `orderPartId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `VerificationRequest` ADD CONSTRAINT `VerificationRequest_orderPartId_fkey`
  FOREIGN KEY (`orderPartId`) REFERENCES `OrderPart`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
