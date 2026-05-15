-- AlterTable
ALTER TABLE `OrderPart` ADD COLUMN `orientQx` DOUBLE NOT NULL DEFAULT 0,
                        ADD COLUMN `orientQy` DOUBLE NOT NULL DEFAULT 0,
                        ADD COLUMN `orientQz` DOUBLE NOT NULL DEFAULT 0,
                        ADD COLUMN `orientQw` DOUBLE NOT NULL DEFAULT 1;
