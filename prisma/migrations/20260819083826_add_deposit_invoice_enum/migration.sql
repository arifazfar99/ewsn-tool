-- AlterEnum
-- Split into its own migration file: Postgres doesn't allow a newly-added
-- enum value to be referenced by other statements in the same
-- transaction/batch it was added in.
ALTER TYPE "DocType" ADD VALUE 'DEPOSIT_INVOICE';
