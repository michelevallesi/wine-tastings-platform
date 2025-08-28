-- Seed script for customers
INSERT INTO customers (id, name, email, phone, date_of_birth, preferences) VALUES

('11111111-2222-3333-4444-555555555555',
 'Mario Rossi',
 'mario.rossi@email.it',
 '+39 333 1234567',
 '1985-03-15',
 '{"wine_preferences": ["red", "full-bodied"], "dietary_restrictions": [], "language": "it", "experience_level": "intermediate"}'),

('22222222-3333-4444-5555-666666666666',
 'Laura Bianchi',
 'laura.bianchi@gmail.com',
 '+39 347 2345678',
 '1990-07-22',
 '{"wine_preferences": ["white", "sparkling"], "dietary_restrictions": ["vegetarian"], "language": "it", "experience_level": "beginner"}'),

('33333333-4444-5555-6666-777777777777',
 'Giuseppe Verdi',
 'g.verdi@outlook.it',
 '+39 320 3456789',
 '1978-12-03',
 '{"wine_preferences": ["red", "aged"], "dietary_restrictions": [], "language": "it", "experience_level": "expert"}'),

('44444444-5555-6666-7777-888888888888',
 'Anna Ferrari',
 'anna.ferrari@libero.it',
 '+39 339 4567890',
 '1982-09-18',
 '{"wine_preferences": ["rosé", "light"], "dietary_restrictions": ["gluten-free"], "language": "it", "experience_level": "beginner"}'),

('55555555-6666-7777-8888-999999999999',
 'Francesco Costa',
 'francesco.costa@yahoo.it',
 '+39 349 5678901',
 '1975-11-28',
 '{"wine_preferences": ["red", "white"], "dietary_restrictions": [], "language": "it", "experience_level": "advanced"}'),

('66666666-7777-8888-9999-aaaaaaaaaaaa',
 'Elena Martini',
 'elena.martini@email.com',
 '+39 338 6789012',
 '1988-04-12',
 '{"wine_preferences": ["sparkling", "dessert"], "dietary_restrictions": ["vegan"], "language": "it", "experience_level": "intermediate"}'),

('77777777-8888-9999-aaaa-bbbbbbbbbbbb',
 'Roberto Conti',
 'roberto.conti@fastmail.com',
 '+39 348 7890123',
 '1992-06-05',
 '{"wine_preferences": ["natural", "organic"], "dietary_restrictions": [], "language": "it", "experience_level": "advanced"}'),

('88888888-9999-aaaa-bbbb-cccccccccccc',
 'Chiara Romano',
 'chiara.romano@protonmail.com',
 '+39 345 8901234',
 '1987-08-30',
 '{"wine_preferences": ["white", "mineral"], "dietary_restrictions": ["lactose-free"], "language": "it", "experience_level": "intermediate"}');