const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const QRCode = require('qrcode');
const db = require('../utils/database');
const { 
    validateCreateBooking, 
    validateUpdateBookingStatus,
    validateAvailabilityCheck,
    validateBookingFilters
} = require('../utils/validation');
const { generateQRCode } = require('../utils/qrGenerator');
const { sendEmailNotifications } = require('../utils/emailService');
const { checkAvailability } = require('../utils/availabilityChecker');

class BookingController {
    async createBooking(req, res) {
        const client = await db.connect();
        
        try {
            await client.query('BEGIN');
            
            const { error } = validateCreateBooking(req.body);
            if (error) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: error.details[0].message });
            }

            const {
                package_id,
                customer,
                booking_date,
                booking_time,
                participants,
                notes
            } = req.body;

            // Get package details and verify it exists
            const packageResult = await client.query(
                `SELECT p.*, pr.name as producer_name, pr.email as producer_email 
                 FROM packages p 
                 JOIN producers pr ON p.producer_id = pr.id 
                 WHERE p.id = $1 AND p.is_active = true`,
                [package_id]
            );

            if (packageResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Pacchetto non trovato o non disponibile' });
            }

            const packageData = packageResult.rows[0];

            // Validate booking date and time
            const bookingDateTime = moment(`${booking_date} ${booking_time}`);
            const now = moment();
            
            if (bookingDateTime.isBefore(now)) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Non è possibile prenotare per una data passata' });
            }

            if (bookingDateTime.isAfter(moment().add(parseInt(process.env.ADVANCE_BOOKING_DAYS) || 365, 'days'))) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    error: `Prenotazioni possibili fino a ${process.env.ADVANCE_BOOKING_DAYS || 365} giorni in anticipo` 
                });
            }

            // Check availability
            const isAvailable = await checkAvailability(
                client, 
                package_id, 
                booking_date, 
                booking_time, 
                participants
            );

            if (!isAvailable.available) {
                await client.query('ROLLBACK');
                return res.status(409).json({ 
                    error: 'Slot non disponibile',
                    details: isAvailable.reason
                });
            }

            // Validate participants count
            if (participants > packageData.max_participants) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    error: `Numero massimo di partecipanti: ${packageData.max_participants}` 
                });
            }

            if (participants > parseInt(process.env.MAX_PARTICIPANTS) || 50) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    error: `Numero massimo di partecipanti superato: ${process.env.MAX_PARTICIPANTS || 50}` 
                });
            }

            // Create or get customer
            let customerId;
            const existingCustomer = await client.query(
                'SELECT id FROM customers WHERE email = $1 OR phone = $2',
                [customer.email, customer.phone]
            );

            if (existingCustomer.rows.length > 0) {
                customerId = existingCustomer.rows[0].id;
                // Update customer info if provided
                await client.query(
                    'UPDATE customers SET name = $1, surname = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
                    [customer.name, customer.surname, customerId]
                );
            } else {
                const customerResult = await client.query(
                    'INSERT INTO customers (name, surname, email, phone) VALUES ($1, $2, $3, $4) RETURNING id',
                    [customer.name, customer.surname, customer.email, customer.phone]
                );
                customerId = customerResult.rows[0].id;
            }

            // Calculate total price
            const totalPrice = parseFloat(packageData.price) * participants;

            // Generate unique QR code
            const qrCode = await generateQRCode();

            // Create booking
            const bookingResult = await client.query(
                `INSERT INTO bookings (
                    id, package_id, producer_id, customer_id, booking_date, booking_time,
                    participants, total_price, qr_code, notes, status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
                RETURNING *`,
                [
                    uuidv4(),
                    package_id,
                    packageData.producer_id,
                    customerId,
                    booking_date,
                    booking_time,
                    participants,
                    totalPrice,
                    qrCode,
                    notes || null,
                    'pending'
                ]
            );

            const booking = bookingResult.rows[0];

            await client.query('COMMIT');

            // Prepare booking data for response and notifications
            const bookingData = {
                ...booking,
                package_name: packageData.name,
                producer_name: packageData.producer_name,
                customer: {
                    name: customer.name,
                    surname: customer.surname,
                    email: customer.email,
                    phone: customer.phone
                }
            };

            // Send email notifications asynchronously
            sendEmailNotifications({
                type: 'booking_created',
                booking: bookingData,
                customer: customer,
                producer_email: packageData.producer_email
            }).catch(err => console.error('Email notification error:', err));

            res.status(201).json({
                message: 'Prenotazione creata con successo',
                booking: {
                    id: booking.id,
                    package_id: booking.package_id,
                    package_name: packageData.name,
                    producer_name: packageData.producer_name,
                    booking_date: booking.booking_date,
                    booking_time: booking.booking_time,
                    participants: booking.participants,
                    total_price: booking.total_price,
                    qr_code: booking.qr_code,
                    status: booking.status,
                    created_at: booking.created_at
                },
                customer: {
                    name: customer.name,
                    surname: customer.surname,
                    email: customer.email,
                    phone: customer.phone
                }
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Create booking error:', error);
            res.status(500).json({ error: 'Errore interno del server' });
        } finally {
            client.release();
        }
    }

    async getBookings(req, res) {
        try {
            const { error } = validateBookingFilters(req.query);
            if (error) {
                return res.status(400).json({ error: error.details[0].message });
            }

            const { 
                page = 1, 
                limit = 20, 
                status, 
                date_from, 
                date_to,
                package_id,
                customer_email,
                sort_by = 'booking_date',
                sort_order = 'ASC'
            } = req.query;

            const offset = (parseInt(page) - 1) * parseInt(limit);

            // Build dynamic WHERE clause
            let whereClause = 'WHERE b.producer_id = $1';
            let params = [req.producer.id];
            let paramCount = 1;

            if (status) {
                paramCount++;
                whereClause += ` AND b.status = $${paramCount}`;
                params.push(status);
            }

            if (date_from) {
                paramCount++;
                whereClause += ` AND b.booking_date >= $${paramCount}`;
                params.push(date_from);
            }

            if (date_to) {
                paramCount++;
                whereClause += ` AND b.booking_date <= $${paramCount}`;
                params.push(date_to);
            }

            if (package_id) {
                paramCount++;
                whereClause += ` AND b.package_id = $${paramCount}`;
                params.push(package_id);
            }

            if (customer_email) {
                paramCount++;
                whereClause += ` AND c.email ILIKE $${paramCount}`;
                params.push(`%${customer_email}%`);
            }

            // Validate sort parameters
            const allowedSortColumns = ['booking_date', 'booking_time', 'created_at', 'total_price', 'status'];
            const allowedSortOrders = ['ASC', 'DESC'];
            
            const sortColumn = allowedSortColumns.includes(sort_by) ? sort_by : 'booking_date';
            const sortOrderVal = allowedSortOrders.includes(sort_order.toUpperCase()) ? sort_order.toUpperCase() : 'ASC';

            const query = `
                SELECT 
                    b.*,
                    p.name as package_name,
                    p.description as package_description,
                    p.price as package_unit_price,
                    c.name as customer_name,
                    c.surname as customer_surname,
                    c.email as customer_email,
                    c.phone as customer_phone
                FROM bookings b
                JOIN packages p ON b.package_id = p.id
                JOIN customers c ON b.customer_id = c.id
                ${whereClause}
                ORDER BY b.${sortColumn} ${sortOrderVal}
                LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
            `;

            params.push(parseInt(limit), offset);

            const result = await db.query(query, params);

            // Get total count for pagination
            const countQuery = `
                SELECT COUNT(*) as total
                FROM bookings b
                JOIN customers c ON b.customer_id = c.id
                ${whereClause}
            `;
            const countResult = await db.query(countQuery, params.slice(0, -2));
            const total = parseInt(countResult.rows[0].total);

            res.json({
                bookings: result.rows.map(row => ({
                    id: row.id,
                    package: {
                        id: row.package_id,
                        name: row.package_name,
                        description: row.package_description,
                        unit_price: parseFloat(row.package_unit_price)
                    },
                    customer: {
                        name: row.customer_name,
                        surname: row.customer_surname,
                        email: row.customer_email,
                        phone: row.customer_phone
                    },
                    booking_date: row.booking_date,
                    booking_time: row.booking_time,
                    participants: row.participants,
                    total_price: parseFloat(row.total_price),
                    status: row.status,
                    qr_code: row.qr_code,
                    notes: row.notes,
                    created_at: row.created_at,
                    updated_at: row.updated_at
                })),
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            });

        } catch (error) {
            console.error('Get bookings error:', error);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    }

    async getBookingById(req, res) {
        try {
            const { id } = req.params;

            const result = await db.query(
                `SELECT 
                    b.*,
                    p.name as package_name,
                    p.description as package_description,
                    p.price as package_unit_price,
                    p.wines,
                    p.duration,
                    pr.name as producer_name,
                    pr.address as producer_address,
                    pr.phone as producer_phone,
                    c.name as customer_name,
                    c.surname as customer_surname,
                    c.email as customer_email,
                    c.phone as customer_phone
                FROM bookings b
                JOIN packages p ON b.package_id = p.id
                JOIN producers pr ON b.producer_id = pr.id
                JOIN customers c ON b.customer_id = c.id
                WHERE b.id = $1 AND b.producer_id = $2`,
                [id, req.producer.id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Prenotazione non trovata' });
            }

            const row = result.rows[0];
            
            res.json({
                id: row.id,
                package: {
                    id: row.package_id,
                    name: row.package_name,
                    description: row.package_description,
                    unit_price: parseFloat(row.package_unit_price),
                    wines: row.wines,
                    duration: row.duration
                },
                producer: {
                    name: row.producer_name,
                    address: row.producer_address,
                    phone: row.producer_phone
                },
                customer: {
                    name: row.customer_name,
                    surname: row.customer_surname,
                    email: row.customer_email,
                    phone: row.customer_phone
                },
                booking_date: row.booking_date,
                booking_time: row.booking_time,
                participants: row.participants,
                total_price: parseFloat(row.total_price),
                status: row.status,
                qr_code: row.qr_code,
                notes: row.notes,
                payment_id: row.payment_id,
                created_at: row.created_at,
                updated_at: row.updated_at
            });

        } catch (error) {
            console.error('Get booking by ID error:', error);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    }

    async updateBookingStatus(req, res) {
        try {
            const { error } = validateUpdateBookingStatus(req.body);
            if (error) {
                return res.status(400).json({ error: error.details[0].message });
            }

            const { id } = req.params;
            const { status, notes } = req.body;

            // Get current booking
            const currentResult = await db.query(
                `SELECT b.*, p.name as package_name, c.name as customer_name, 
                        c.surname as customer_surname, c.email as customer_email
                 FROM bookings b 
                 JOIN packages p ON b.package_id = p.id
                 JOIN customers c ON b.customer_id = c.id
                 WHERE b.id = $1 AND b.producer_id = $2`,
                [id, req.producer.id]
            );

            if (currentResult.rows.length === 0) {
                return res.status(404).json({ error: 'Prenotazione non trovata' });
            }

            const currentBooking = currentResult.rows[0];

            // Validate status transition
            const validTransitions = {
                'pending': ['confirmed', 'cancelled'],
                'confirmed': ['completed', 'cancelled'],
                'cancelled': [], // Cannot change from cancelled
                'completed': [] // Cannot change from completed
            };

            if (!validTransitions[currentBooking.status].includes(status)) {
                return res.status(400).json({ 
                    error: `Impossibile cambiare stato da ${currentBooking.status} a ${status}` 
                });
            }

            // Update booking status
            const updateResult = await db.query(
                `UPDATE bookings 
                 SET status = $1, notes = COALESCE($2, notes), updated_at = CURRENT_TIMESTAMP
                 WHERE id = $3 AND producer_id = $4
                 RETURNING *`,
                [status, notes, id, req.producer.id]
            );

            const updatedBooking = updateResult.rows[0];

            // Send notification email for status changes
            if (status === 'confirmed') {
                sendEmailNotifications({
                    type: 'booking_confirmed',
                    booking: {
                        ...updatedBooking,
                        package_name: currentBooking.package_name
                    },
                    customer: {
                        name: currentBooking.customer_name,
                        surname: currentBooking.customer_surname,
                        email: currentBooking.customer_email
                    }
                }).catch(err => console.error('Confirmation email error:', err));
            }

            res.json({
                message: `Stato prenotazione aggiornato a: ${status}`,
                booking: {
                    id: updatedBooking.id,
                    status: updatedBooking.status,
                    notes: updatedBooking.notes,
                    updated_at: updatedBooking.updated_at
                }
            });

        } catch (error) {
            console.error('Update booking status error:', error);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    }

    async checkAvailability(req, res) {
        try {
            const { error } = validateAvailabilityCheck(req.query);
            if (error) {
                return res.status(400).json({ error: error.details[0].message });
            }

            const { package_id, date, time, participants } = req.query;

            // Verify package exists and belongs to requesting producer (if authenticated)
            let packageQuery = 'SELECT * FROM packages WHERE id = $1 AND is_active = true';
            let packageParams = [package_id];

            if (req.producer) {
                packageQuery += ' AND producer_id = $2';
                packageParams.push(req.producer.id);
            }

            const packageResult = await db.query(packageQuery, packageParams);

            if (packageResult.rows.length === 0) {
                return res.status(404).json({ error: 'Pacchetto non trovato' });
            }

            const packageData = packageResult.rows[0];

            // Check availability
            const availability = await checkAvailability(
                db, 
                package_id, 
                date, 
                time, 
                parseInt(participants)
            );

            res.json({
                package_id,
                date,
                time,
                participants: parseInt(participants),
                available: availability.available,
                reason: availability.reason,
                max_participants: packageData.max_participants,
                current_bookings: availability.current_bookings || 0,
                available_slots: availability.available ? packageData.max_participants - (availability.current_bookings || 0) : 0
            });

        } catch (error) {
            console.error('Check availability error:', error);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    }

    async verifyQRCode(req, res) {
        try {
            const { qr_code } = req.params;

            const result = await db.query(
                `SELECT 
                    b.*,
                    p.name as package_name,
                    p.description as package_description,
                    p.duration,
                    pr.name as producer_name,
                    pr.address as producer_address,
                    c.name as customer_name,
                    c.surname as customer_surname,
                    c.email as customer_email,
                    c.phone as customer_phone
                FROM bookings b
                JOIN packages p ON b.package_id = p.id
                JOIN producers pr ON b.producer_id = pr.id
                JOIN customers c ON b.customer_id = c.id
                WHERE b.qr_code = $1`,
                [qr_code]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ 
                    error: 'QR Code non valido',
                    valid: false 
                });
            }

            const booking = result.rows[0];
            const bookingDate = moment(booking.booking_date);
            const today = moment();

            // Check if booking is valid for today
            const isToday = bookingDate.isSame(today, 'day');
            const isValidStatus = ['confirmed', 'completed'].includes(booking.status);

            res.json({
                valid: isToday && isValidStatus,
                booking: {
                    id: booking.id,
                    package: {
                        name: booking.package_name,
                        description: booking.package_description,
                        duration: booking.duration
                    },
                    producer: {
                        name: booking.producer_name,
                        address: booking.producer_address
                    },
                    customer: {
                        name: booking.customer_name,
                        surname: booking.customer_surname,
                        email: booking.customer_email,
                        phone: booking.customer_phone
                    },
                    booking_date: booking.booking_date,
                    booking_time: booking.booking_time,
                    participants: booking.participants,
                    status: booking.status
                },
                checks: {
                    is_today: isToday,
                    valid_status: isValidStatus,
                    status: booking.status,
                    booking_date: booking.booking_date
                }
            });

        } catch (error) {
            console.error('Verify QR code error:', error);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    }

    async getDashboardStats(req, res) {
        try {
            const producerId = req.producer.id;
            const { period = '30' } = req.query; // days

            const periodDays = parseInt(period);
            const startDate = moment().subtract(periodDays, 'days').format('YYYY-MM-DD');

            // Get booking stats
            const statsQuery = `
                SELECT 
                    COUNT(*) as total_bookings,
                    COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_bookings,
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_bookings,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_bookings,
                    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_bookings,
                    COALESCE(SUM(CASE WHEN status IN ('confirmed', 'completed') THEN total_price ELSE 0 END), 0) as total_revenue,
                    COALESCE(AVG(CASE WHEN status IN ('confirmed', 'completed') THEN total_price END), 0) as avg_booking_value,
                    COALESCE(SUM(CASE WHEN status IN ('confirmed', 'completed') THEN participants ELSE 0 END), 0) as total_participants
                FROM bookings 
                WHERE producer_id = $1 AND created_at >= $2
            `;

            const statsResult = await db.query(statsQuery, [producerId, startDate]);
            const stats = statsResult.rows[0];

            // Get upcoming bookings
            const upcomingQuery = `
                SELECT 
                    b.id,
                    b.booking_date,
                    b.booking_time,
                    b.participants,
                    b.status,
                    p.name as package_name,
                    c.name || ' ' || c.surname as customer_name,
                    c.email as customer_email
                FROM bookings b
                JOIN packages p ON b.package_id = p.id
                JOIN customers c ON b.customer_id = c.id
                WHERE b.producer_id = $1 
                  AND b.booking_date >= CURRENT_DATE 
                  AND b.status IN ('confirmed', 'pending')
                ORDER BY b.booking_date ASC, b.booking_time ASC
                LIMIT 10
            `;

            const upcomingResult = await db.query(upcomingQuery, [producerId]);

            // Get popular packages
            const popularPackagesQuery = `
                SELECT 
                    p.id,
                    p.name,
                    COUNT(b.id) as booking_count,
                    COALESCE(SUM(b.total_price), 0) as total_revenue,
                    COALESCE(AVG(b.participants), 0) as avg_participants
                FROM packages p
                LEFT JOIN bookings b ON p.id = b.package_id AND b.created_at >= $2 AND b.status IN ('confirmed', 'completed')
                WHERE p.producer_id = $1 AND p.is_active = true
                GROUP BY p.id, p.name
                ORDER BY booking_count DESC, total_revenue DESC
                LIMIT 5
            `;

            const popularPackagesResult = await db.query(popularPackagesQuery, [producerId, startDate]);

            // Get booking trends (daily data for charts)
            const trendsQuery = `
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as bookings,
                    COALESCE(SUM(total_price), 0) as revenue,
                    COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed
                FROM bookings 
                WHERE producer_id = $1 AND created_at >= $2
                GROUP BY DATE(created_at)
                ORDER BY date ASC
            `;

            const trendsResult = await db.query(trendsQuery, [producerId, startDate]);

            res.json({
                period_days: periodDays,
                summary: {
                    total_bookings: parseInt(stats.total_bookings),
                    confirmed_bookings: parseInt(stats.confirmed_bookings),
                    pending_bookings: parseInt(stats.pending_bookings),
                    completed_bookings: parseInt(stats.completed_bookings),
                    cancelled_bookings: parseInt(stats.cancelled_bookings),
                    total_revenue: parseFloat(stats.total_revenue),
                    avg_booking_value: parseFloat(stats.avg_booking_value),
                    total_participants: parseInt(stats.total_participants),
                    conversion_rate: stats.total_bookings > 0 ? 
                        ((parseInt(stats.confirmed_bookings) + parseInt(stats.completed_bookings)) / parseInt(stats.total_bookings) * 100).toFixed(1) : 0
                },
                upcoming_bookings: upcomingResult.rows,
                popular_packages: popularPackagesResult.rows.map(row => ({
                    id: row.id,
                    name: row.name,
                    booking_count: parseInt(row.booking_count),
                    total_revenue: parseFloat(row.total_revenue),
                    avg_participants: parseFloat(row.avg_participants).toFixed(1)
                })),
                trends: trendsResult.rows.map(row => ({
                    date: row.date,
                    bookings: parseInt(row.bookings),
                    revenue: parseFloat(row.revenue),
                    confirmed: parseInt(row.confirmed)
                }))
            });

        } catch (error) {
            console.error('Get dashboard stats error:', error);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    }

    async cancelBooking(req, res) {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            // Get current booking
            const currentResult = await db.query(
                `SELECT b.*, p.name as package_name, c.email as customer_email,
                        c.name as customer_name, c.surname as customer_surname
                 FROM bookings b 
                 JOIN packages p ON b.package_id = p.id
                 JOIN customers c ON b.customer_id = c.id
                 WHERE b.id = $1 AND b.producer_id = $2`,
                [id, req.producer.id]
            );

            if (currentResult.rows.length === 0) {
                return res.status(404).json({ error: 'Prenotazione non trovata' });
            }

            const booking = currentResult.rows[0];

            if (booking.status === 'cancelled') {
                return res.status(400).json({ error: 'Prenotazione già cancellata' });
            }

            if (booking.status === 'completed') {
                return res.status(400).json({ error: 'Non è possibile cancellare una prenotazione completata' });
            }

            // Cancel booking
            const cancelResult = await db.query(
                `UPDATE bookings 
                 SET status = 'cancelled', 
                     notes = COALESCE(notes || ' | ', '') || 'Cancellata: ' || $2,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1 
                 RETURNING *`,
                [id, reason || 'Nessuna ragione specificata']
            );

            // Send cancellation notification
            sendEmailNotifications({
                type: 'booking_cancelled',
                booking: {
                    ...cancelResult.rows[0],
                    package_name: booking.package_name
                },
                customer: {
                    name: booking.customer_name,
                    surname: booking.customer_surname,
                    email: booking.customer_email
                },
                reason
            }).catch(err => console.error('Cancellation email error:', err));

            res.json({
                message: 'Prenotazione cancellata con successo',
                booking: {
                    id: cancelResult.rows[0].id,
                    status: cancelResult.rows[0].status,
                    notes: cancelResult.rows[0].notes,
                    updated_at: cancelResult.rows[0].updated_at
                }
            });

        } catch (error) {
            console.error('Cancel booking error:', error);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    }
}

module.exports = new BookingController();