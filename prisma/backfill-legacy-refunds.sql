-- Populate the Refund ledger before deploying refund accounting changes.
-- The unique razorpayRefundId plus ON CONFLICT makes this safe to rerun.
INSERT INTO "Refund" (
  "id",
  "razorpayRefundId",
  "orderId",
  "amount",
  "status",
  "source",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  'legacy-' || o."id",
  o."id",
  o."refundAmount",
  'processed',
  'LEGACY',
  now(),
  now()
FROM "Order" o
WHERE o."refundAmount" > 0
  AND NOT EXISTS (
    SELECT 1 FROM "Refund" r WHERE r."orderId" = o."id"
  )
ON CONFLICT DO NOTHING;
