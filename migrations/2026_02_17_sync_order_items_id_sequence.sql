-- Sync order_items id sequence so nextval() never returns an id that already exists.
-- Fixes: duplicate key value violates unique constraint "order_items_pkey" when
-- order_items_id_seq was behind max(order_items.id).
SELECT setval(
  pg_get_serial_sequence('order_items', 'id'),
  COALESCE((SELECT MAX(id) FROM order_items), 1)
);
