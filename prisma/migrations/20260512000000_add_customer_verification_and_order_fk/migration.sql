-- Add emailVerifiedAt to Customer
ALTER TABLE `Customer` ADD COLUMN `emailVerifiedAt` DATETIME(3) NULL;

-- Add customerId FK to Order
ALTER TABLE `Order` ADD COLUMN `customerId` VARCHAR(191) NULL;

-- Create CustomerEmailVerificationToken table
CREATE TABLE `CustomerEmailVerificationToken` (
  `token` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `expires` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`token`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Backfill: mark existing customers as verified (they predate the feature)
UPDATE `Customer` SET `emailVerifiedAt` = `createdAt` WHERE `emailVerifiedAt` IS NULL;

-- Backfill: link existing orders to customers via email match (case-insensitive)
UPDATE `Order` o
JOIN `Customer` c ON LOWER(o.customerEmail) = LOWER(c.email)
SET o.customerId = c.id
WHERE o.customerId IS NULL;

-- Add FK: Order.customerId -> Customer.id (SetNull on delete)
ALTER TABLE `Order` ADD CONSTRAINT `Order_customerId_fkey`
  FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Add FK: CustomerEmailVerificationToken.customerId -> Customer.id (Cascade on delete)
ALTER TABLE `CustomerEmailVerificationToken` ADD CONSTRAINT `CustomerEmailVerificationToken_customerId_fkey`
  FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Add indexes
CREATE INDEX `Order_customerId_idx` ON `Order`(`customerId`);
CREATE INDEX `CustomerEmailVerificationToken_customerId_idx` ON `CustomerEmailVerificationToken`(`customerId`);
