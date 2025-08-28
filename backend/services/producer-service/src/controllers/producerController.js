const moment = require('moment');
const axios = require('axios');
const db = require('../utils/database');
const { 
    validateProducerUpdate,
    validateProducerFilters,
    validateDashboardPeriod
} = require('../utils/validation');
const { processAndSaveImage } = require('../utils/imageProcessor');
const { getProducerAnalytics } = require('../utils/analyticsEngine');

class ProducerController {
    async getProfile(req, res) {
        try {
            const result = await db.query(
                `SELECT id, name, email, address, phone, description, tenant_key, 
                        profile_image, website, established_year, wine_regions,
                        certifications, opening_hours, is_active,
                        created_at, updated_at 
                 FROM producers WHERE id = $1 AND is_active = true`,
                [req.producer.id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Profilo non trovato' });
            }

            const producer = result.rows[0];

            // Get additional statistics
            const statsResult = await db.query(
                `SELECT 
                    COUNT(p.id) as total_packages,
                    COUNT(CASE WHEN p.is_active = true THEN 1 END) as active_packages,
                    COUNT(b.id) as total_bookings,
                    COUNT(CASE WHEN b.status = 'confirmed' THEN 1 END) as confirmed_bookings,
                    COALESCE(SUM(CASE WHEN b.status IN ('confirmed', 'completed') THEN b.total_price ELSE 0 END), 0) as total_revenue,
                    COALESCE(AVG(CASE WHEN b.status IN ('confirmed', 'completed') THEN b.total_price END), 0) as avg_booking_value
                 FROM producers pr
                 LEFT JOIN packages p ON pr.id = p.producer_id
                 LEFT JOIN bookings b ON pr.id = b.producer_id AND b.created_at >= CURRENT_DATE - INTERVAL '30 days'
                 WHERE pr.id = $1
                 GROUP BY pr.id`,
                [req.producer.id]
            );

            const stats = statsResult.rows[0] || {};

            res.json({
                id: producer.id,
                name: producer.name,
                email: producer.email,
                address: producer.address,
                phone: producer.phone,
                description: producer.description,
                tenant_key: producer.tenant_key,
                profile_image: producer.profile_image,
                website: producer.website,
                established_year: producer.established_year,
                wine_regions: producer.wine_regions,
                certifications: producer.certifications,
                opening_hours: producer.opening_hours,
                created_at: producer.created_at,
                updated_at: producer.updated_at,
                statistics: {
                    total_packages: parseInt(stats.total_packages) || 0,
                    active_packages: parseInt(stats.active_packages) || 0,
                    total_bookings_30d: parseInt(stats.total_bookings) || 0,
                    confirmed_bookings_30d: parseInt(stats.confirmed_bookings) || 0,
                    total_revenue_30d: parseFloat(stats.total_revenue) || 0,
                    avg_booking_value_30d: parseFloat(stats.avg_booking_value) || 0
                }
            });
        } catch (error) {
            console.error('Get profile error:', error);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    }

    async updateProfile(req, res) {
        const client = await db.connect();

        try {
            await client.query('BEGIN');

            const { error } = validateProducerUpdate(req.body);
            if (error) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: error.details[0].message });
            }

            const { 
                name, 
                address, 
                phone, 
                description, 
                website,
                established_year,
                wine_regions,
                certifications,
                opening_hours
            } = req.body;

            // Process wine regions and certifications as JSON arrays
            const processedWineRegions = Array.isArray(wine_regions) ? wine_regions : 
                                       (wine_regions ? wine_regions.split(',').map(r => r.trim()) : null);
            
            const processedCertifications = Array.isArray(certifications) ? certifications : 
                                          (certifications ? certifications.split(',').map(c => c.trim()) : null);

            // Process opening hours as JSON object
            let processedOpeningHours = opening_hours;
            if (typeof opening_hours === 'string') {
                try {
                    processedOpeningHours = JSON.parse(opening_hours);
                } catch (e) {
                    processedOpeningHours = null;
                }
            }

            const result = await client.query(
                `UPDATE producers 
                 SET name = $1, address = $2, phone = $3, description = $4, 
                     website = $5, established_year = $6, wine_regions = $7,
                     certifications = $8, opening_hours = $9, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $10 AND is_active = true
                 RETURNING id, name, email, address, phone, description, website,
                          established_year, wine_regions, certifications, opening_hours, updated_at`,
                [
                    name, address, phone, description, website, established_year,
                    JSON.stringify(processedWineRegions), JSON.stringify(processedCertifications),
                    JSON.stringify(processedOpeningHours), req.producer.id
                ]
            );

            if (result.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Produttore non trovato' });
            }

            await client.query('COMMIT');

            res.json({
                message: 'Profilo aggiornato con successo',
                producer: result.rows[0]
            });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Update profile error:', error);
            res.status(500).json({ error: 'Errore interno del server' });
        } finally {
            client.release();
        }
    }

    async uploadProfileImage(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'Nessuna immagine fornita' });
            }

            // Process and save image
            const imagePath = await processAndSaveImage(req.file, req.producer.id);

            // Update database with image path
            const result = await db.query(
                'UPDATE producers SET profile_image = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING profile_image',
                [imagePath, req.producer.id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Produttore non trovato' });
            }

            res.json({
                message: 'Immagine profilo aggiornata con successo',
                profile_image: result.rows[0].profile_image
            });
        } catch (error) {
            console.error('Upload profile image error:', error);
            res.status(500).json({ error: 'Errore durante il caricamento dell immagine' });
        }
    }

    async getDashboardStats(req, res) {
        try {
            const { error } = validateDashboardPeriod(req.query);
            if (error) {
                return res.status(400).json({ error: error.details[0].message });
            }

            const { period = '30' } = req.query;
            const periodDays = parseInt(period);
            const startDate = moment().subtract(periodDays, 'days').format('YYYY-MM-DD');

            // Get comprehensive analytics
            const analytics = await getProducerAnalytics(req.producer.id, periodDays);

            res.json({
                producer_id: req.producer.id,
                period_days: periodDays,
                start_date: startDate,
                end_date: moment().format('YYYY-MM-DD'),
                generated_at: new Date(),
                ...analytics
            });

        } catch (error) {
            console.error('Get dashboard stats error:', error);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    }

    async getBusinessInsights(req, res) {
        try {
            const producerId = req.producer.id;
            const { period = '90' } = req.query;
            const periodDays = parseInt(period);
            const startDate = moment().subtract(periodDays, 'days').format('YYYY-MM-DD');

            // Revenue analysis
            const revenueAnalysis = await db.query(
                `SELECT 
                    DATE_TRUNC('week', b.booking_date) as week,
                    COUNT(*) as bookings,
                    SUM(b.total_price) as revenue,
                    AVG(b.total_price) as avg_value,
                    AVG(b.participants) as avg_participants
                 FROM bookings b
                 WHERE b.producer_id = $1 
                   AND b.status IN ('confirmed', 'completed')
                   AND b.created_at >= $2
                 GROUP BY DATE_TRUNC('week', b.booking_date)
                 ORDER BY week DESC
                 LIMIT 12`,
                [producerId, startDate]
            );

            // Customer analysis
            const customerAnalysis = await db.query(
                `SELECT 
                    COUNT(DISTINCT c.id) as unique_customers,
                    COUNT(b.id) as total_bookings,
                    ROUND(COUNT(b.id)::numeric / COUNT(DISTINCT c.id), 2) as avg_bookings_per_customer,
                    COUNT(CASE WHEN customer_bookings.booking_count > 1 THEN 1 END) as returning_customers
                 FROM bookings b
                 JOIN customers c ON b.customer_id = c.id
                 JOIN (
                     SELECT customer_id, COUNT(*) as booking_count
                     FROM bookings 
                     WHERE producer_id = $1 AND status IN ('confirmed', 'completed')
                     GROUP BY customer_id
                 ) customer_bookings ON c.id = customer_bookings.customer_id
                 WHERE b.producer_id = $1 
                   AND b.status IN ('confirmed', 'completed')
                   AND b.created_at >= $2`,
                [producerId, startDate]
            );

            // Peak time analysis
            const peakTimeAnalysis = await db.query(
                `SELECT 
                    EXTRACT(HOUR FROM booking_time::time) as hour,
                    COUNT(*) as booking_count,
                    AVG(participants) as avg_participants,
                    SUM(total_price) as total_revenue
                 FROM bookings
                 WHERE producer_id = $1 
                   AND status IN ('confirmed', 'completed')
                   AND created_at >= $2
                 GROUP BY EXTRACT(HOUR FROM booking_time::time)
                 ORDER BY booking_count DESC`,
                [producerId, startDate]
            );

            // Package performance
            const packagePerformance = await db.query(
                `SELECT 
                    p.id,
                    p.name,
                    p.price,
                    COUNT(b.id) as booking_count,
                    SUM(b.total_price) as total_revenue,
                    AVG(b.participants) as avg_participants,
                    COUNT(CASE WHEN b.status = 'cancelled' THEN 1 END) as cancellation_count,
                    ROUND(
                        (COUNT(CASE WHEN b.status IN ('confirmed', 'completed') THEN 1 END)::numeric / 
                         NULLIF(COUNT(b.id), 0)) * 100, 1
                    ) as success_rate
                 FROM packages p
                 LEFT JOIN bookings b ON p.id = b.package_id AND b.created_at >= $2
                 WHERE p.producer_id = $1 AND p.is_active = true
                 GROUP BY p.id, p.name, p.price
                 ORDER BY total_revenue DESC NULLS LAST`,
                [producerId, startDate]
            );

            res.json({
                period_days: periodDays,
                revenue_trends: revenueAnalysis.rows.map(row => ({
                    week: row.week,
                    bookings: parseInt(row.bookings),
                    revenue: parseFloat(row.revenue),
                    avg_value: parseFloat(row.avg_value),
                    avg_participants: parseFloat(row.avg_participants)
                })),
                customer_insights: {
                    unique_customers: parseInt(customerAnalysis.rows[0]?.unique_customers) || 0,
                    total_bookings: parseInt(customerAnalysis.rows[0]?.total_bookings) || 0,
                    avg_bookings_per_customer: parseFloat(customerAnalysis.rows[0]?.avg_bookings_per_customer) || 0,
                    returning_customers: parseInt(customerAnalysis.rows[0]?.returning_customers) || 0,
                    retention_rate: customerAnalysis.rows[0] ? 
                        ((parseInt(customerAnalysis.rows[0].returning_customers) / parseInt(customerAnalysis.rows[0].unique_customers)) * 100).toFixed(1) : 0
                },
                peak_times: peakTimeAnalysis.rows.map(row => ({
                    hour: parseInt(row.hour),
                    booking_count: parseInt(row.booking_count),
                    avg_participants: parseFloat(row.avg_participants),
                    total_revenue: parseFloat(row.total_revenue)
                })),
                package_performance: packagePerformance.rows.map(row => ({
                    id: row.id,
                    name: row.name,
                    price: parseFloat(row.price),
                    booking_count: parseInt(row.booking_count) || 0,
                    total_revenue: parseFloat(row.total_revenue) || 0,
                    avg_participants: parseFloat(row.avg_participants) || 0,
                    cancellation_count: parseInt(row.cancellation_count) || 0,
                    success_rate: parseFloat(row.success_rate) || 0
                }))
            });

        } catch (error) {
            console.error('Get business insights error:', error);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    }

    async getAllProducers(req, res) {
        try {
            const { error } = validateProducerFilters(req.query);
            if (error) {
                return res.status(400).json({ error: error.details[0].message });
            }

            const { 
                page = 1, 
                limit = 20, 
                search,
                region,
                has_packages = true,
                sort_by = 'name',
                sort_order = 'ASC'
            } = req.query;

            const offset = (parseInt(page) - 1) * parseInt(limit);

            // Build dynamic WHERE clause
            let whereClause = 'WHERE p.is_active = true';
            let params = [];
            let paramCount = 0;

            if (search) {
                paramCount++;
                whereClause += ` AND (p.name ILIKE $${paramCount} OR p.description ILIKE $${paramCount})`;
                params.push(`%${search}%`);
            }

            if (region) {
                paramCount++;
                whereClause += ` AND p.wine_regions::text ILIKE $${paramCount}`;
                params.push(`%${region}%`);
            }

            if (has_packages === 'true') {
                whereClause += ` AND EXISTS (SELECT 1 FROM packages pkg WHERE pkg.producer_id = p.id AND pkg.is_active = true)`;
            }

            // Validate sort parameters
            const allowedSortColumns = ['name', 'created_at', 'established_year'];
            const allowedSortOrders = ['ASC', 'DESC'];
            
            const sortColumn = allowedSortColumns.includes(sort_by) ? sort_by : 'name';
            const sortOrderVal = allowedSortOrders.includes(sort_order.toUpperCase()) ? sort_order.toUpperCase() : 'ASC';

            const query = `
                SELECT 
                    p.id,
                    p.name,
                    p.description,
                    p.address,
                    p.phone,
                    p.profile_image,
                    p.website,
                    p.established_year,
                    p.wine_regions,
                    p.certifications,
                    p.tenant_key,
                    COUNT(pkg.id) as package_count,
                    COUNT(CASE WHEN pkg.is_active = true THEN 1 END) as active_package_count,
                    AVG(pkg.price) as avg_package_price
                FROM producers p
                LEFT JOIN packages pkg ON p.id = pkg.producer_id
                ${whereClause}
                GROUP BY p.id, p.name, p.description, p.address, p.phone, p.profile_image,
                         p.website, p.established_year, p.wine_regions, p.certifications, p.tenant_key
                ORDER BY p.${sortColumn} ${sortOrderVal}
                LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
            `;

            params.push(parseInt(limit), offset);

            const result = await db.query(query, params);

            // Get total count for pagination
            const countQuery = `
                SELECT COUNT(*) as total
                FROM producers p
                ${whereClause}
            `;
            const countResult = await db.query(countQuery, params.slice(0, -2));
            const total = parseInt(countResult.rows[0].total);

            res.json({
                producers: result.rows.map(row => ({
                    id: row.id,
                    name: row.name,
                    description: row.description,
                    address: row.address,
                    phone: row.phone,
                    profile_image: row.profile_image,
                    website: row.website,
                    established_year: row.established_year,
                    wine_regions: row.wine_regions,
                    certifications: row.certifications,
                    tenant_key: row.tenant_key,
                    package_count: parseInt(row.package_count),
                    active_package_count: parseInt(row.active_package_count),
                    avg_package_price: parseFloat(row.avg_package_price) || 0
                })),
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            });

        } catch (error) {
            console.error('Get all producers error:', error);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    }

    async getProducerById(req, res) {
        try {
            const { id } = req.params;

            const result = await db.query(
                `SELECT 
                    p.id, p.name, p.description, p.address, p.phone, 
                    p.profile_image, p.website, p.established_year,
                    p.wine_regions, p.certifications, p.opening_hours,
                    p.tenant_key, p.created_at,
                    COUNT(pkg.id) as total_packages,
                    COUNT(CASE WHEN pkg.is_active = true THEN 1 END) as active_packages,
                    AVG(pkg.price) as avg_package_price,
                    MIN(pkg.price) as min_package_price,
                    MAX(pkg.price) as max_package_price
                 FROM producers p
                 LEFT JOIN packages pkg ON p.id = pkg.producer_id
                 WHERE p.id = $1 AND p.is_active = true
                 GROUP BY p.id, p.name, p.description, p.address, p.phone, 
                          p.profile_image, p.website, p.established_year,
                          p.wine_regions, p.certifications, p.opening_hours,
                          p.tenant_key, p.created_at`,
                [id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Produttore non trovato' });
            }

            const producer = result.rows[0];

            // Get some recent packages
            const packagesResult = await db.query(
                `SELECT id, name, description, price, max_participants, duration, is_active
                 FROM packages 
                 WHERE producer_id = $1 AND is_active = true
                 ORDER BY created_at DESC
                 LIMIT 5`,
                [id]
            );

            res.json({
                id: producer.id,
                name: producer.name,
                description: producer.description,
                address: producer.address,
                phone: producer.phone,
                profile_image: producer.profile_image,
                website: producer.website,
                established_year: producer.established_year,
                wine_regions: producer.wine_regions,
                certifications: producer.certifications,
                opening_hours: producer.opening_hours,
                tenant_key: producer.tenant_key,
                created_at: producer.created_at,
                statistics: {
                    total_packages: parseInt(producer.total_packages),
                    active_packages: parseInt(producer.active_packages),
                    avg_package_price: parseFloat(producer.avg_package_price) || 0,
                    min_package_price: parseFloat(producer.min_package_price) || 0,
                    max_package_price: parseFloat(producer.max_package_price) || 0
                },
                sample_packages: packagesResult.rows
            });

        } catch (error) {
            console.error('Get producer by ID error:', error);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    }

    async updateTenantKey(req, res) {
        try {
            // Generate new tenant key
            const crypto = require('crypto');
            const newTenantKey = crypto.randomBytes(32).toString('hex');

            const result = await db.query(
                'UPDATE producers SET tenant_key = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND is_active = true RETURNING tenant_key',
                [newTenantKey, req.producer.id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Produttore non trovato' });
            }

            res.json({
                message: 'Chiave tenant aggiornata con successo',
                tenant_key: result.rows[0].tenant_key,
                warning: 'La vecchia chiave non è più valida. Aggiorna le integrazioni API.'
            });

        } catch (error) {
            console.error('Update tenant key error:', error);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    }

    async getApiUsageStats(req, res) {
        try {
            // This would typically track API usage via the tenant_key
            // For now, return basic information
            const result = await db.query(
                'SELECT tenant_key, created_at, updated_at FROM producers WHERE id = $1',
                [req.producer.id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Produttore non trovato' });
            }

            // In a real implementation, you'd track API calls in a separate table
            res.json({
                tenant_key: result.rows[0].tenant_key,
                key_created_at: result.rows[0].created_at,
                key_updated_at: result.rows[0].updated_at,
                api_usage: {
                    calls_today: 0,
                    calls_this_month: 0,
                    rate_limit: 1000, // calls per day
                    remaining_today: 1000
                },
                endpoints: [
                    {
                        endpoint: '/api/bookings/availability/check',
                        method: 'GET',
                        description: 'Verifica disponibilità pacchetti'
                    },
                    {
                        endpoint: '/api/bookings/create',
                        method: 'POST',
                        description: 'Crea nuova prenotazione'
                    }
                ]
            });

        } catch (error) {
            console.error('Get API usage stats error:', error);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    }
}

module.exports = new ProducerController();