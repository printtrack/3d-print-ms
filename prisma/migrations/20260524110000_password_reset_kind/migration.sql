-- Add kind column to PasswordResetToken to prevent cross-account
-- token reuse (Admin token cannot reset Customer password and vice versa).
--
-- Existing tokens are 1-hour TTL and have already been cleared before
-- this migration runs (see roadmap/security.md Phase 1.1).

ALTER TABLE `PasswordResetToken`
  ADD COLUMN `kind` ENUM('USER', 'CUSTOMER') NOT NULL;

CREATE INDEX `PasswordResetToken_email_kind_idx`
  ON `PasswordResetToken`(`email`, `kind`);
