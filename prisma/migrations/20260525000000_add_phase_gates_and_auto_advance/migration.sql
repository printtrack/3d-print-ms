-- Add per-phase configurable enterGate (block-on-entry conditions)
-- and autoAdvance (auto-transition-when-met conditions) to OrderPhase
-- and PartPhase. Both are nullable JSON arrays of typed condition objects;
-- evaluator lives in lib/phase-conditions.ts.

ALTER TABLE `OrderPhase`
  ADD COLUMN `enterGate` JSON NULL,
  ADD COLUMN `autoAdvance` JSON NULL;

ALTER TABLE `PartPhase`
  ADD COLUMN `enterGate` JSON NULL,
  ADD COLUMN `autoAdvance` JSON NULL;
