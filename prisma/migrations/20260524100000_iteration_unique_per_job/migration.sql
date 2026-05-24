-- Allow re-verifying the same OrderPart in a different PrintJob.
-- The old constraint (orderPartId, pieceIndex) blocked reprints after misprints.
-- New constraint includes printJobId so each job verifies its own pieces.
--
-- The FK on orderPartId currently uses the old unique key as its index, so we
-- must drop the FK first, swap the unique, then recreate the FK.

ALTER TABLE `OrderPartIteration` DROP FOREIGN KEY `OrderPartIteration_orderPartId_fkey`;
DROP INDEX `OrderPartIteration_orderPartId_pieceIndex_key` ON `OrderPartIteration`;
CREATE UNIQUE INDEX `OrderPartIteration_orderPartId_pieceIndex_printJobId_key`
  ON `OrderPartIteration`(`orderPartId`, `pieceIndex`, `printJobId`);
CREATE INDEX `OrderPartIteration_orderPartId_idx` ON `OrderPartIteration`(`orderPartId`);
ALTER TABLE `OrderPartIteration`
  ADD CONSTRAINT `OrderPartIteration_orderPartId_fkey`
  FOREIGN KEY (`orderPartId`) REFERENCES `OrderPart`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
