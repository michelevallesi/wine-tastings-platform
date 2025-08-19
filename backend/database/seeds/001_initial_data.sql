-- Wine Tastings Platform - Initial Data

-- Insert demo tenants
INSERT INTO tenants (id, name, slug, description, location, email, phone, website) VALUES
('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'Cantina Rossi', 'cantina-rossi', 'Tradizione familiare dal 1890 nel cuore della Toscana', 'Chianti, Toscana', 'info@cantinarossi.it', '+39 055 1234567', 'https://cantinarossi.it'),
('f47ac10b-58cc-4372-a567-0e02b2c3d480', 'Villa Bianchi', 'villa-bianchi', 'Vini di eccellenza nelle colline del Piemonte', 'Barolo, Piemonte', 'degustazioni@villabianchi.it', '+39 0173 987654', 'https://villabianchi.it');

-- Insert admin users (password: admin123)
INSERT INTO users (id, tenant_id, email, password_hash, name, role) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'admin@cantinarossi.it', crypt('admin123', gen_salt('bf')), 'Mario Rossi', 'producer'),
('550e8400-e29b-41d4-a716-446655440001', 'f47ac10b-58cc-4372-a567-0e02b2c3d480', 'admin@villabianchi.it', crypt('admin123', gen_salt('bf')), 'Giuseppe Bianchi', 'producer');

-- Insert sample tastings
INSERT INTO tastings (id, tenant_id, name, slug, description, wines, price, max_participants, duration_hours, available_days, time_slots, image_url) VALUES
('a1b2c3d4-e5f6-7890-1234-567890123456', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'Esperienza Chianti Classico', 'chianti-experience', 'Degustazione guidata dei nostri migliori Chianti Classico con abbinamenti di formaggi locali', '["Chianti Classico DOCG 2020", "Chianti Classico Riserva 2018", "Chianti Classico Gran Selezione 2016"]', 45.00, 12, 2.0, '["martedì", "mercoledì", "giovedì", "venerdì", "sabato"]', '["10:00", "15:00", "17:30"]', 'https://via.placeholder.com/400x300/8B0000/FFFFFF?text=Chianti+Experience'),

('b2c3d4e5-f6g7-8901-2345-678901234567', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'Vino e Cibo: Abbinamenti Perfetti', 'wine-food-pairing', 'Degustazione con menu a 4 portate abbinato ai nostri vini più pregiati', '["Brunello di Montalcino 2017", "Rosso di Montalcino 2019", "Super Tuscan Blend 2018"]', 75.00, 8, 3.0, '["venerdì", "sabato", "domenica"]', '["12:00", "19:30"]', 'https://via.placeholder.com/400x300/8B0000/FFFFFF?text=Wine+%26+Food'),

('c3d4e5f6-g7h8-9012-3456-789012345678', 'f47ac10b-58cc-4372-a567-0e02b2c3d480', 'Tour delle Botti di Barolo', 'barolo-tour', 'Visita guidata della cantina con degustazione di Barolo e Barbaresco d'annata', '["Barolo DOCG 2018", "Barbaresco DOCG 2019", "Nebbiolo d'Alba 2020"]', 60.00, 10, 2.5, '["lunedì", "mercoledì", "giovedì", "sabato", "domenica"]', '["11:00", "14:30", "16:00"]', 'https://via.placeholder.com/400x300/8B0000/FFFFFF?text=Barolo+Tour');

-- Insert sample bookings
INSERT INTO bookings (id, tenant_id, tasting_id, customer_name, customer_email, customer_phone, booking_date, booking_time, participants, total_price, status, payment_status, qr_code) VALUES
('d4e5f6g7-h8i9-0123-4567-890123456789', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'a1b2c3d4-e5f6-7890-1234-567890123456', 'Marco Verdi', 'marco.verdi@email.com', '+39 333 1234567', '2025-08-25', '15:00', 2, 90.00, 'confirmed', 'paid', 'QR-ROSSI-001-20250825'),
('e5f6g7h8-i9j0-1234-5678-901234567890', 'f47ac10b-58cc-4372-a567-0e02b2c3d480', 'c3d4e5f6-g7h8-9012-3456-789012345678', 'Anna Lombardi', 'anna.lombardi@email.com', '+39 347 9876543', '2025-08-26', '14:30', 4, 240.00, 'confirmed', 'paid', 'QR-BIANCHI-002-20250826');

-- Success message
SELECT 'Database initialized with sample data!' as message;
