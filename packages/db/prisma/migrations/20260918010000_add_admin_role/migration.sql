-- CreateEnum
CREATE TYPE "AdminUserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'USER');

-- AlterTable
ALTER TABLE "admin_users" ADD COLUMN "role" "AdminUserRole" NOT NULL DEFAULT 'USER';
