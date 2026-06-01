-- Mark order phases that should archive orders upon entry.
-- When an order is moved (manually or via auto-advance) into a phase with
-- isArchive=true, the application sets archivedAt on the order.
-- Moving out clears archivedAt.

ALTER TABLE `OrderPhase`
  ADD COLUMN `isArchive` BOOLEAN NOT NULL DEFAULT FALSE;
