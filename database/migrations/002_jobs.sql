CREATE TABLE "ExternalRefund" (
 id text PRIMARY KEY, "transactionId" text NOT NULL UNIQUE REFERENCES "Transaction"(id),
 "holdId" text NOT NULL UNIQUE REFERENCES "Hold"(id), "actorId" text NOT NULL REFERENCES "User"(id),
 reason text NOT NULL, status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','COMPLETED','FAILED')),
 "providerId" text, "compensationId" text REFERENCES "Transaction"(id), attempts integer NOT NULL DEFAULT 0,
 "createdAt" timestamptz NOT NULL DEFAULT now());
CREATE INDEX ON "Notification"("deliveryStatus", "createdAt");
CREATE INDEX ON "ExternalRefund"(status);
