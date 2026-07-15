-- AlterTable
ALTER TABLE `User` ADD COLUMN `restrictedToAssigned` BOOLEAN NULL,
    ADD COLUMN `teamRoleId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `TeamRole` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `color` VARCHAR(191) NOT NULL DEFAULT '#6366f1',
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `restricted` BOOLEAN NOT NULL DEFAULT false,
    `position` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TeamRole_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TeamRolePermission` (
    `roleId` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,

    INDEX `TeamRolePermission_key_idx`(`key`),
    PRIMARY KEY (`roleId`, `key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `User_teamRoleId_idx` ON `User`(`teamRoleId`);

-- AddForeignKey
ALTER TABLE `TeamRolePermission` ADD CONSTRAINT `TeamRolePermission_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `TeamRole`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_teamRoleId_fkey` FOREIGN KEY (`teamRoleId`) REFERENCES `TeamRole`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `MilestoneTaskAssignee` RENAME INDEX `MilestoneTaskAssignee_userId_fkey` TO `MilestoneTaskAssignee_userId_idx`;

-- RenameIndex
ALTER TABLE `OrderAssignee` RENAME INDEX `OrderAssignee_userId_fkey` TO `OrderAssignee_userId_idx`;

-- RenameIndex
ALTER TABLE `OrderPartAssignee` RENAME INDEX `OrderPartAssignee_userId_fkey` TO `OrderPartAssignee_userId_idx`;

-- RenameIndex
ALTER TABLE `PrintJobAssignee` RENAME INDEX `PrintJobAssignee_userId_fkey` TO `PrintJobAssignee_userId_idx`;

-- RenameIndex
ALTER TABLE `ProjectAssignee` RENAME INDEX `ProjectAssignee_userId_fkey` TO `ProjectAssignee_userId_idx`;


-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill: give every existing member the rights they already had.
--
-- The seeded system role mirrors, key by key, what a TEAM_MEMBER could do before
-- roles existed (see DEFAULT_ROLE_PERMISSIONS in lib/permissions.ts). Keys that
-- were ADMIN-only before (orders.delete, knowledge.delete, inventory.*) are
-- deliberately absent. Result: nobody's access changes on migration day.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO `TeamRole` (`id`, `name`, `description`, `color`, `isSystem`, `isDefault`, `restricted`, `position`, `createdAt`, `updatedAt`)
VALUES ('teamrole_system_member', 'Team-Mitglied', 'Standardrolle für alle Teammitglieder.', '#6366f1', true, true, false, 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

INSERT INTO `TeamRolePermission` (`roleId`, `key`) VALUES
  ('teamrole_system_member', 'orders.create'),
  ('teamrole_system_member', 'orders.edit'),
  ('teamrole_system_member', 'orders.assign'),
  ('teamrole_system_member', 'orders.archive'),
  ('teamrole_system_member', 'billing.quotes.manage'),
  ('teamrole_system_member', 'billing.invoices.manage'),
  ('teamrole_system_member', 'billing.payments.record'),
  ('teamrole_system_member', 'jobs.manage'),
  ('teamrole_system_member', 'jobs.verify'),
  ('teamrole_system_member', 'jobs.delete'),
  ('teamrole_system_member', 'projects.create'),
  ('teamrole_system_member', 'projects.edit'),
  ('teamrole_system_member', 'projects.delete'),
  ('teamrole_system_member', 'knowledge.create'),
  ('teamrole_system_member', 'knowledge.edit');

UPDATE `User` SET `teamRoleId` = 'teamrole_system_member' WHERE `role` = 'TEAM_MEMBER';
