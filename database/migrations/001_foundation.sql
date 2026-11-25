CREATE TABLE IF NOT EXISTS "SchemaMigration" (name text PRIMARY KEY, "appliedAt" timestamptz NOT NULL DEFAULT now());
CREATE TABLE "User" (
 id text PRIMARY KEY, email text NOT NULL UNIQUE, name text NOT NULL, "passwordHash" text NOT NULL,
 role text NOT NULL DEFAULT 'CUSTOMER' CHECK(role IN ('CUSTOMER','SUPPORT','OPERATIONS','FINANCE','ADMIN')),
 "mfaEnabled" boolean NOT NULL DEFAULT false, disabled boolean NOT NULL DEFAULT false, phone text,
 "createdAt" timestamptz NOT NULL DEFAULT now());
CREATE TABLE "Session" (id text PRIMARY KEY, "userId" text NOT NULL REFERENCES "User"(id), "tokenHash" text UNIQUE NOT NULL,
 "familyId" text NOT NULL, "expiresAt" timestamptz NOT NULL, "revokedAt" timestamptz, "createdAt" timestamptz NOT NULL DEFAULT now());
CREATE INDEX ON "Session"("userId");
CREATE TABLE "Challenge" (id text PRIMARY KEY, "userId" text NOT NULL REFERENCES "User"(id), "codeHash" text NOT NULL,
 attempts integer NOT NULL DEFAULT 0, "expiresAt" timestamptz NOT NULL, used boolean NOT NULL DEFAULT false);
CREATE TABLE "Wallet" (id text PRIMARY KEY, "userId" text REFERENCES "User"(id), name text NOT NULL, currency text NOT NULL DEFAULT 'INR' CHECK(currency='INR'),
 type text NOT NULL DEFAULT 'CUSTOMER' CHECK(type IN ('CUSTOMER','TREASURY')), status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','FROZEN')),
 "createdAt" timestamptz NOT NULL DEFAULT now(), CHECK ((type='CUSTOMER' AND "userId" IS NOT NULL) OR (type='TREASURY' AND "userId" IS NULL)));
CREATE INDEX ON "Wallet"("userId");
CREATE UNIQUE INDEX one_treasury ON "Wallet"(type) WHERE type='TREASURY';
CREATE TABLE "Account" (id text PRIMARY KEY, "userId" text NOT NULL REFERENCES "User"(id), label text NOT NULL, reference text NOT NULL UNIQUE, "createdAt" timestamptz NOT NULL DEFAULT now());
CREATE TABLE "Beneficiary" (id text PRIMARY KEY, "userId" text NOT NULL REFERENCES "User"(id), "walletId" text NOT NULL REFERENCES "Wallet"(id), name text NOT NULL,
 "createdAt" timestamptz NOT NULL DEFAULT now(), UNIQUE("userId","walletId"));
CREATE TABLE "Transaction" (id text PRIMARY KEY, "userId" text REFERENCES "User"(id), "fromWalletId" text NOT NULL REFERENCES "Wallet"(id), "toWalletId" text NOT NULL REFERENCES "Wallet"(id),
 amount numeric(20,2) NOT NULL CHECK(amount>0 AND amount<=10000000), currency text NOT NULL DEFAULT 'INR' CHECK(currency='INR'),
 kind text NOT NULL CHECK(kind IN ('TRANSFER','FUNDING','REFUND','REVERSAL')), status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','POSTED','FAILED')),
 description text NOT NULL, "originalId" text UNIQUE REFERENCES "Transaction"(id), "createdAt" timestamptz NOT NULL DEFAULT now(), CHECK("fromWalletId"<>"toWalletId"));
CREATE INDEX ON "Transaction"("userId","createdAt");
CREATE INDEX ON "Transaction"("fromWalletId","createdAt");
CREATE INDEX ON "Transaction"("toWalletId","createdAt");
CREATE TABLE "LedgerEntry" (id text PRIMARY KEY, "transactionId" text NOT NULL REFERENCES "Transaction"(id), "walletId" text NOT NULL REFERENCES "Wallet"(id),
 direction text NOT NULL CHECK(direction IN ('DEBIT','CREDIT')), amount numeric(20,2) NOT NULL CHECK(amount>0), "createdAt" timestamptz NOT NULL DEFAULT now());
CREATE INDEX ON "LedgerEntry"("walletId","createdAt");
CREATE INDEX ON "LedgerEntry"("transactionId");
CREATE TABLE "Hold" (id text PRIMARY KEY, "walletId" text NOT NULL REFERENCES "Wallet"(id), amount numeric(20,2) NOT NULL CHECK(amount>0), status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','RELEASED')),
 reason text NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now());
CREATE INDEX ON "Hold"("walletId",status);
CREATE TABLE "Idempotency" (id text PRIMARY KEY, "payloadHash" text NOT NULL, "transactionId" text NOT NULL UNIQUE REFERENCES "Transaction"(id), "createdAt" timestamptz NOT NULL DEFAULT now());
CREATE TABLE "PaymentIntent" (id text PRIMARY KEY, "userId" text NOT NULL REFERENCES "User"(id), "walletId" text NOT NULL REFERENCES "Wallet"(id), amount numeric(20,2) NOT NULL CHECK(amount>0 AND amount<=10000000),
 currency text NOT NULL DEFAULT 'INR' CHECK(currency='INR'), provider text NOT NULL CHECK(provider IN ('local','stripe')), "providerId" text NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','SUCCEEDED','FAILED')), "transactionId" text UNIQUE REFERENCES "Transaction"(id), "createdAt" timestamptz NOT NULL DEFAULT now());
CREATE TABLE "ProviderEvent" (id text PRIMARY KEY, "intentId" text NOT NULL REFERENCES "PaymentIntent"(id), type text NOT NULL, amount numeric(20,2) NOT NULL CHECK(amount>=0), status text NOT NULL,
 "createdAt" timestamptz NOT NULL DEFAULT now());
CREATE INDEX ON "ProviderEvent"("intentId");
CREATE TABLE "Settlement" (id text PRIMARY KEY, "intentId" text NOT NULL UNIQUE REFERENCES "PaymentIntent"(id), "providerEventId" text NOT NULL UNIQUE REFERENCES "ProviderEvent"(id),
 amount numeric(20,2) NOT NULL CHECK(amount>=0), status text NOT NULL CHECK(status IN ('MATCHED','FAILED')), "createdAt" timestamptz NOT NULL DEFAULT now());
CREATE TABLE "Refund" (id text PRIMARY KEY, "transactionId" text NOT NULL UNIQUE REFERENCES "Transaction"(id), "compensationId" text NOT NULL UNIQUE REFERENCES "Transaction"(id), kind text NOT NULL, reason text NOT NULL,
 "providerId" text, "createdAt" timestamptz NOT NULL DEFAULT now());
CREATE TABLE "Dispute" (id text PRIMARY KEY, "userId" text NOT NULL REFERENCES "User"(id), "transactionId" text NOT NULL REFERENCES "Transaction"(id), reason text NOT NULL,
 status text NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','INVESTIGATING','RESOLVED','REJECTED')), "assignedTo" text REFERENCES "User"(id), resolution text, history jsonb NOT NULL,
 "createdAt" timestamptz NOT NULL DEFAULT now());
CREATE TABLE "RiskAlert" (id text PRIMARY KEY, "userId" text NOT NULL REFERENCES "User"(id), score integer NOT NULL CHECK(score BETWEEN 0 AND 100), level text NOT NULL,
 reasons jsonb NOT NULL, status text NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','RESOLVED')), resolution text, "createdAt" timestamptz NOT NULL DEFAULT now());
CREATE TABLE "Reconciliation" (id text PRIMARY KEY, "intentId" text NOT NULL UNIQUE REFERENCES "PaymentIntent"(id), status text NOT NULL, details text NOT NULL,
 "resolvedBy" text REFERENCES "User"(id), resolution text, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now());
CREATE TABLE "Notification" (id text PRIMARY KEY, "userId" text NOT NULL REFERENCES "User"(id), title text NOT NULL, message text NOT NULL, read boolean NOT NULL DEFAULT false,
 "deliveryStatus" text NOT NULL DEFAULT 'PENDING', attempts integer NOT NULL DEFAULT 0, "createdAt" timestamptz NOT NULL DEFAULT now());
CREATE INDEX ON "Notification"("userId","createdAt");
CREATE TABLE "Audit" (id text PRIMARY KEY, "actorId" text REFERENCES "User"(id), action text NOT NULL, "resourceId" text, "requestId" text NOT NULL, metadata jsonb NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now());
CREATE INDEX ON "Audit"("createdAt");
CREATE TABLE "Setting" (key text PRIMARY KEY, value text NOT NULL, "updatedAt" timestamptz NOT NULL DEFAULT now());

-- The financial journal is append-only. Posted transaction headers are immutable too.
CREATE FUNCTION reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Immutable historical record' USING ERRCODE='23514'; END $$;
CREATE TRIGGER immutable_ledger BEFORE UPDATE OR DELETE ON "LedgerEntry" FOR EACH ROW EXECUTE FUNCTION reject_mutation();
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON "Audit" FOR EACH ROW EXECUTE FUNCTION reject_mutation();
CREATE FUNCTION protect_transaction() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' OR OLD.status <> 'PENDING' THEN RAISE EXCEPTION 'Immutable finalized transaction' USING ERRCODE='23514'; END IF;
 IF NEW.id<>OLD.id OR NEW.amount<>OLD.amount OR NEW."fromWalletId"<>OLD."fromWalletId" OR NEW."toWalletId"<>OLD."toWalletId" OR NEW.kind<>OLD.kind OR NEW.currency<>OLD.currency OR NEW."userId" IS DISTINCT FROM OLD."userId" OR NEW."originalId" IS DISTINCT FROM OLD."originalId" OR NEW."createdAt"<>OLD."createdAt" OR NEW.description<>OLD.description THEN
 RAISE EXCEPTION 'Only pending state transitions are allowed' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_transaction BEFORE UPDATE OR DELETE ON "Transaction" FOR EACH ROW EXECUTE FUNCTION protect_transaction();
CREATE FUNCTION validate_entry() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE t "Transaction";
BEGIN
 SELECT * INTO t FROM "Transaction" WHERE id=NEW."transactionId" FOR UPDATE;
 IF t.status<>'PENDING' OR NEW.amount<>t.amount OR
 (NEW.direction='DEBIT' AND NEW."walletId"<>t."fromWalletId") OR (NEW.direction='CREDIT' AND NEW."walletId"<>t."toWalletId") THEN
 RAISE EXCEPTION 'Invalid journal entry for transaction' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM "Wallet" WHERE id=NEW."walletId" AND currency=t.currency) THEN RAISE EXCEPTION 'Currency mismatch'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_entry BEFORE INSERT ON "LedgerEntry" FOR EACH ROW EXECUTE FUNCTION validate_entry();

CREATE FUNCTION validate_journal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE tid text; t "Transaction"; n integer; net numeric;
BEGIN
 IF TG_TABLE_NAME='Transaction' THEN tid=NEW.id; ELSE tid=NEW."transactionId"; END IF;
 SELECT * INTO t FROM "Transaction" WHERE id=tid;
 SELECT count(*),COALESCE(sum(CASE WHEN direction='CREDIT' THEN amount ELSE -amount END),0) INTO n,net FROM "LedgerEntry" WHERE "transactionId"=tid;
 IF (t.status='POSTED' AND (n<>2 OR net<>0)) OR (t.status<>'POSTED' AND n<>0) THEN
 RAISE EXCEPTION 'Journal must contain exactly two balanced entries for a posted transaction' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER balanced_transaction AFTER INSERT OR UPDATE ON "Transaction" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_journal();
CREATE CONSTRAINT TRIGGER balanced_entries AFTER INSERT ON "LedgerEntry" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_journal();

CREATE FUNCTION protect_available_balance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE wid text; b numeric; h numeric;
BEGIN
 wid=NEW."walletId";
 -- Serialize all writers, including SQL that bypasses the API.
 PERFORM id FROM "Wallet" WHERE id=wid FOR UPDATE;
 IF EXISTS(SELECT 1 FROM "Wallet" WHERE id=wid AND type='CUSTOMER') THEN
 SELECT COALESCE(sum(CASE WHEN direction='CREDIT' THEN amount ELSE -amount END),0) INTO b FROM "LedgerEntry" WHERE "walletId"=wid;
 SELECT COALESCE(sum(amount),0) INTO h FROM "Hold" WHERE "walletId"=wid AND status='ACTIVE';
 IF b-h<0 THEN RAISE EXCEPTION 'Insufficient available balance' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER nonnegative_journal AFTER INSERT ON "LedgerEntry" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION protect_available_balance();
CREATE CONSTRAINT TRIGGER nonnegative_holds AFTER INSERT OR UPDATE ON "Hold" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION protect_available_balance();
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
