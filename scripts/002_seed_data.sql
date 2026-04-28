-- Seed data for Oeste Gafas

-- Insert default categories
INSERT INTO categories (name) VALUES 
  ('Gafas de Sol'),
  ('Gafas de Ver'),
  ('Lentes de Contacto'),
  ('Accesorios'),
  ('Estuches')
ON CONFLICT (name) DO NOTHING;

-- Insert default payment methods
INSERT INTO payment_methods (name, discount_pct) VALUES 
  ('Efectivo', 10.00),
  ('Transferencia', 5.00),
  ('Tarjeta de Crédito', 0.00),
  ('Tarjeta de Débito', 0.00),
  ('MercadoPago', 0.00)
ON CONFLICT (name) DO NOTHING;

-- Insert sample products
INSERT INTO products (name, variant, price, stock, category_id, is_active)
SELECT 
  'Ray-Ban Aviator',
  'Dorado/Verde',
  45000.00,
  15,
  c.id,
  true
FROM categories c WHERE c.name = 'Gafas de Sol'
ON CONFLICT DO NOTHING;

INSERT INTO products (name, variant, price, stock, category_id, is_active)
SELECT 
  'Ray-Ban Wayfarer',
  'Negro/Gris',
  42000.00,
  20,
  c.id,
  true
FROM categories c WHERE c.name = 'Gafas de Sol'
ON CONFLICT DO NOTHING;

INSERT INTO products (name, variant, price, stock, category_id, is_active)
SELECT 
  'Oakley Holbrook',
  'Negro Mate',
  55000.00,
  10,
  c.id,
  true
FROM categories c WHERE c.name = 'Gafas de Sol'
ON CONFLICT DO NOTHING;

INSERT INTO products (name, variant, price, stock, category_id, is_active)
SELECT 
  'Estuche Premium',
  'Negro',
  5000.00,
  50,
  c.id,
  true
FROM categories c WHERE c.name = 'Estuches'
ON CONFLICT DO NOTHING;

INSERT INTO products (name, variant, price, stock, category_id, is_active)
SELECT 
  'Kit de Limpieza',
  NULL,
  2500.00,
  100,
  c.id,
  true
FROM categories c WHERE c.name = 'Accesorios'
ON CONFLICT DO NOTHING;
