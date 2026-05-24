-- Add nullable, unique Quote.number column
ALTER TABLE `Quote` ADD COLUMN `number` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `Quote_number_key` ON `Quote`(`number`);
