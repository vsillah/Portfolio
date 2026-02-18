-- Sync orders id sequence so nextval() never returns an id that already exists.
-- Fixes: duplicate key value violates unique constraint "orders_pkey" when
-- orders_id_seq was behind max(orders.id) (e.g. after restore or manual inserts).
SELECT setval(
  pg_get_serial_sequence('orders', 'id'),
  COALESCE((SELECT MAX(id) FROM orders), 1)
);
