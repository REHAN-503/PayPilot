ALTER TABLE "user_policy"
  ADD COLUMN "agentPaused" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "maxDiscountSeekPercent" DECIMAL(5,2);

ALTER TABLE "agent_activity"
  ADD COLUMN "prevHash" TEXT,
  ADD COLUMN "eventHash" TEXT;

CREATE OR REPLACE FUNCTION paypilot_agent_activity_chain()
RETURNS TRIGGER AS $$
DECLARE
  previous_hash TEXT;
  canonical JSONB;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(COALESCE(NEW."planId", NEW."userId")));
  SELECT "eventHash" INTO previous_hash
  FROM "agent_activity"
  WHERE "planId" IS NOT DISTINCT FROM NEW."planId"
  ORDER BY "createdAt" DESC, "id" DESC
  LIMIT 1;

  canonical := jsonb_build_object(
    'actor', NEW."actor",
    'createdAt', to_char(NEW."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'description', NEW."description",
    'id', NEW."id",
    'metadata', NEW."metadata",
    'paymentId', NEW."paymentId",
    'planId', NEW."planId",
    'title', NEW."title",
    'type', NEW."type",
    'userId', NEW."userId"
  );
  NEW."prevHash" := previous_hash;
  NEW."eventHash" := encode(digest(COALESCE(previous_hash, '') || canonical::text, 'sha256'), 'hex');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agent_activity_chain_insert ON "agent_activity";
CREATE TRIGGER agent_activity_chain_insert
BEFORE INSERT ON "agent_activity"
FOR EACH ROW EXECUTE FUNCTION paypilot_agent_activity_chain();

DO $$
DECLARE
  row_data RECORD;
  previous_hash TEXT;
  canonical JSONB;
BEGIN
  FOR row_data IN
    SELECT * FROM "agent_activity" ORDER BY "planId", "createdAt", "id"
  LOOP
    SELECT prior."eventHash" INTO previous_hash
    FROM "agent_activity" prior
    WHERE prior."planId" IS NOT DISTINCT FROM row_data."planId"
      AND (prior."createdAt", prior."id") < (row_data."createdAt", row_data."id")
    ORDER BY prior."createdAt" DESC, prior."id" DESC
    LIMIT 1;
    canonical := jsonb_build_object(
      'actor', row_data."actor",
      'createdAt', to_char(row_data."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'description', row_data."description",
      'id', row_data."id",
      'metadata', row_data."metadata",
      'paymentId', row_data."paymentId",
      'planId', row_data."planId",
      'title', row_data."title",
      'type', row_data."type",
      'userId', row_data."userId"
    );
    UPDATE "agent_activity"
    SET "prevHash" = previous_hash,
        "eventHash" = encode(digest(COALESCE(previous_hash, '') || canonical::text, 'sha256'), 'hex')
    WHERE "id" = row_data."id";
  END LOOP;
END;
$$;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
