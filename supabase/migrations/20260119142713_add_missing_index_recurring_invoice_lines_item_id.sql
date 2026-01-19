/*
  # Add missing index for foreign key

  1. Changes
    - Add index on `recurring_invoice_lines.item_id` to optimize foreign key lookups

  2. Notes
    - The "unused indexes" warning is expected for a new application with limited traffic
    - These indexes will be used as the application scales and should NOT be removed
*/

CREATE INDEX IF NOT EXISTS idx_recurring_invoice_lines_item_id 
  ON recurring_invoice_lines(item_id);