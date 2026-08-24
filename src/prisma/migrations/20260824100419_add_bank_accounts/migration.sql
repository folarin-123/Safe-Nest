-- CreateEnum
CREATE TYPE "BankAccountStatus" AS ENUM ('ACTIVE', 'RECONNECT_REQUIRED', 'UNLINKED');

-- CreateEnum
CREATE TYPE "BankTxStatus" AS ENUM ('PENDING', 'ALLOCATED', 'IGNORED');

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" VARCHAR(20) NOT NULL DEFAULT 'MONO',
    "provider_account_id" VARCHAR(255) NOT NULL,
    "account_name" VARCHAR(255),
    "account_number" VARCHAR(20),
    "bank_name" VARCHAR(255),
    "currency" VARCHAR(10) DEFAULT 'NGN',
    "status" "BankAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_synced_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_transactions" (
    "id" UUID NOT NULL,
    "bank_account_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider_transaction_id" VARCHAR(255) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "narration" TEXT,
    "transaction_type" VARCHAR(10) NOT NULL,
    "transaction_date" TIMESTAMPTZ(6) NOT NULL,
    "status" "BankTxStatus" NOT NULL DEFAULT 'PENDING',
    "allocated_goal_id" UUID,
    "allocated_contribution_id" UUID,
    "raw_payload" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_provider_account_id_key" ON "bank_accounts"("provider_account_id");

-- CreateIndex
CREATE INDEX "bank_accounts_user_id_idx" ON "bank_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "bank_transactions_provider_transaction_id_key" ON "bank_transactions"("provider_transaction_id");

-- CreateIndex
CREATE INDEX "bank_transactions_user_id_status_idx" ON "bank_transactions"("user_id", "status");

-- CreateIndex
CREATE INDEX "bank_transactions_bank_account_id_idx" ON "bank_transactions"("bank_account_id");

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
