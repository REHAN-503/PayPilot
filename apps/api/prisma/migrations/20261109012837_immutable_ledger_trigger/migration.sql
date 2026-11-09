-- Enforce append-only immutable ledger on "transaction" table

CREATE OR REPLACE FUNCTION enforce_transaction_ledger_immutable()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Transaction ledger records are immutable and append-only. Modification or deletion is strictly prohibited (transaction_id: %)', OLD.id;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_transaction_immutable ON "transaction";

CREATE TRIGGER trg_transaction_immutable
BEFORE UPDATE OR DELETE ON "transaction"
FOR EACH ROW
EXECUTE FUNCTION enforce_transaction_ledger_immutable();
