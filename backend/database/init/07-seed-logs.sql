-- Seed script for transaction and email logs
INSERT INTO payment_transaction_logs (id, payment_id, action, provider, amount, currency, status, metadata, ip_address) VALUES

-- Transaction logs for completed payments
('log11111-1111-1111-1111-111111111111',
 'pay11111-1111-1111-1111-111111111111',
 'payment_created',
 'stripe',
 179.00,
 'EUR',
 'pending',
 '{"booking_id": "book1111-1111-1111-1111-111111111111", "stripe_payment_intent_id": "pi_3NxYZ1234567890abcdef"}',
 '192.168.1.100'),

('log11111-1111-1111-1111-222222222222',
 'pay11111-1111-1111-1111-111111111111',
 'payment_completed',
 'stripe',
 179.00,
 'EUR',
 'completed',
 '{"stripe_payment_intent_id": "pi_3NxYZ1234567890abcdef", "payment_method": "card_1234"}',
 '192.168.1.100'),

('log22222-2222-2222-2222-111111111111',
 'pay22222-2222-2222-2222-222222222222',
 'payment_created',
 'paypal',
 580.00,
 'EUR',
 'pending',
 '{"booking_id": "book2222-2222-2222-2222-222222222222", "paypal_payment_id": "PAYID-MXY7Z8A1B2C3D4E5F6G7"}',
 '10.0.1.50'),

('log22222-2222-2222-2222-222222222222',
 'pay22222-2222-2222-2222-222222222222',
 'payment_completed',
 'paypal',
 580.00,
 'EUR',
 'completed',
 '{"paypal_payment_id": "PAYID-MXY7Z8A1B2C3D4E5F6G7", "payer_id": "PAYER123456789"}',
 '10.0.1.50');

-- Email logs for booking confirmations
INSERT INTO email_logs (id, to_email, from_email, subject, template_name, status, sent_at, booking_id, payment_id) VALUES

('email111-1111-1111-1111-111111111111',
 'mario.rossi@email.it',
 'noreply@vinbooking.com',
 'Conferma Prenotazione - Degustazione Premium Barolo',
 'booking_confirmation',
 'sent',
 '2025-08-20 14:35:00+02',
 'book1111-1111-1111-1111-111111111111',
 'pay11111-1111-1111-1111-111111111111'),

('email222-2222-2222-2222-222222222222',
 'laura.bianchi@gmail.com',
 'noreply@vinbooking.com',
 'Conferma Prenotazione - Tour delle Langhe con Degustazione',
 'booking_confirmation',
 'sent',
 '2025-08-18 16:50:00+02',
 'book2222-2222-2222-2222-222222222222',
 'pay22222-2222-2222-2222-222222222222'),

('email333-3333-3333-3333-333333333333',
 'g.verdi@outlook.it',
 'noreply@vinbooking.com',
 'Conferma Prenotazione - Chianti Classico Experience',
 'booking_confirmation',
 'sent',
 '2025-08-16 09:20:00+02',
 'book3333-3333-3333-3333-333333333333',
 'pay33333-3333-3333-3333-333333333333'),

-- Payment reminder emails
('email444-4444-4444-4444-444444444444',
 'anna.ferrari@libero.it',
 'noreply@vinbooking.com',
 'Promemoria Degustazione - Vini dei Colli Euganei e Natura',
 'booking_reminder',
 'sent',
 '2025-08-21 10:00:00+02',
 'book4444-4444-4444-4444-444444444444',
 NULL),

-- Producer notification emails
('email555-5555-5555-5555-555555555555',
 'info@cantinarossi.it',
 'noreply@vinbooking.com',
 'Nuova Prenotazione - Degustazione Premium Barolo - 15 Set 2025',
 'producer_new_booking',
 'sent',
 '2025-08-20 14:32:00+02',
 'book1111-1111-1111-1111-111111111111',
 'pay11111-1111-1111-1111-111111111111');