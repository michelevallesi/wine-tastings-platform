const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const slugify = require('slugify');
const db = require('../utils/database');
const { 
    validateCreatePackage, 
    validateUpdatePackage,
    validatePackageFilters
} = require('../utils/validation');
const { processPackageImages } = require('../utils/imageProcessor');
const { generatePackageSlug } = require('../utils/slugGenerator');

class PackageController {
    async createPackage(req, res) {
        const client = await db.connect();
        
        try {
            await client.query('BEGIN');
            
            const { error } = validateCreatePackage(req.body);
            if (error) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: error.details[0].message });
            }

            const {
                name,
                description,
                price,
                max_participants,
                duration,
                wines,
                includes,
                excludes,
                location_details,
                available_days,
                available_times,
                languages,
                difficulty_level,
                age_restriction,
                special_requirements,
                cancellation_policy,
                is_active = true,
                metadata = {}
            } = req.body;

            const producerId = req.producer.id;
            const packageId = uuidv4();

            // Generate unique slug
            const slug = await generatePackageSlug(name, producerId);

            // Process images if provided
            let processedImages = [];
            if (req.files && req.files.length > 0) {
                try {
                    processedImages = await processPackageImages(req.files, packageId);
                } catch (imageError) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ 
                        error: 'Errore nel processamento delle immagini: ' + imageError.message 
                    });
                }
            }

            // Insert package
            const packageResult = await client.query(
                `INSERT INTO packages (
                    id, producer_id, name, slug, description, price, max_participants,
                    duration, wines, includes, excludes, location_details,
                    available_days, available_times, languages, difficulty_level,
                    age_restriction, special_requirements, cancellation_policy,
                    images, is_active, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
                RETURNING *`,
                [
                    packageId, producerId, name, slug, description, price, max_participants,
                    duration, JSON.stringify(wines), JSON.stringify(includes), 
                    JSON.stringify(excludes), JSON.stringify(location_details),
                    JSON.stringify(available_days), JSON.stringify(available_times),
                    JSON.stringify(languages), difficulty_level, age_restriction,
                    special_requirements, cancellation_policy, JSON.stringify(processedImages),
                    is_active, JSON.stringify(metadata)
                ]
            );

            const package_data = packageResult.rows[0];

            await client.query('COMMIT');

            res.status(201).json({
                message: 'Pacchetto creato con successo',
                package: {
                    id: package_data.id,
                    producer_id: package_data.producer_id,
                    name: package_data.name,
                    slug: package_data.slug,
                    description: package_data.description,
                    price: parseFloat(package_data.price),
                    max_participants: package_data.max_participants,
                    duration: package_data.duration,
                    wines: package_data.wines,
                    includes: package_data.includes,
                    excludes: package_data.excludes,
                    location_details: package_data.location_details,
                    available_days: package_data.available_days,
                    available_times: package_data.available_times,
                    languages: package_data.languages,
                    difficulty_level: package_data.difficulty_level,
                    age_restriction: package_data.age_restriction,
                    special_requirements: package_data.special_requirements,
                    cancellation_policy: package_data.cancellation_policy,
                    images: package_data.images,
                    is_active: package_data.is_active,
                    created_at: package_data.created_at,
                    updated_at: package_data.updated_at
                }
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Create package error:', error);
            res.status(500).json({ error: 'Errore interno del server' });
        } finally {
            client.release();
        }
    }

    async getPackages(req, res) {
        try {
            const { error } = validatePackageFilters(req.query);
            if (error) {
                return res.status(400).json({ error: error.details[0].message });
            }

            const { 
                page = 1, 
                limit = 20, 
                is_active,
                price_min,
                price_max,
                max_participants_min,
                difficulty_level,
                languages,
                search,
                sort_by = 'created_at',
                sort_order = 'DESC'
            } = req.query;

            const offset = (parseInt(page) - 1) * parseInt(limit);

            // Build dynamic WHERE clause for producer's packages
            let whereClause = 'WHERE p.producer_id = $1';
            let params = [req.producer.id];
            let paramCount = 1;

            if (is_active !== undefined) {
                paramCount++;
                whereClause += ` AND p.is_active = $${paramCount}`;
                params.push(is_active === 'true');
            }

            if (price_min) {
                paramCount++;
                whereClause += ` AND p.price >= $${paramCount}`;
                params.push(parseFloat(price_min));
            }

            if (price_max) {
                paramCount++;
                whereClause += ` AND p.price <= $${paramCount}`;
                params.push(parseFloat(price_max));
            }

            if (max_participants_min) {
                paramCount++;
                whereClause += ` AND p.max_participants >= $${paramCount}`;
                params.push(parseInt(max_participants_min));
            }

            if (difficulty_level) {
                paramCount++;
                whereClause += ` AND p.difficulty_level = $${paramCount}`;
                params.push(difficulty_level);
            }

            if (languages) {
                paramCount++;
                whereClause += ` AND p.languages::text ILIKE $${paramCount}`;
                params.push(`%${languages}%`);
            }

            if (search) {
                paramCount++;
                whereClause += ` AND (p.name ILIKE $${paramCount} OR p.description ILIKE $${paramCount})`;
                params.push(`%${search}%`);
            }

            // Validate sort parameters
            const allowedSortColumns = ['created_at', 'updated_at', 'name', 'price', 'max_participants'];
            const allowedSortOrders = ['ASC', 'DESC'];
            
            const sortColumn = allowedSortColumns.includes(sort_by) ? sort_by : 'created_at';
            const sortOrderVal = allowedSortOrders.includes(sort_order.toUpperCase()) ? sort_order.toUpperCase() : 'DESC';

            const query = `
                SELECT 
                    p.*,
                    pr.name as producer_name,
                    COUNT(b.id) as booking_count,
                    COALESCE(AVG(CASE WHEN b.status IN ('completed') THEN 5.0 END), 0) as avg_rating
                FROM packages p
                JOIN producers pr ON p.producer_id = pr.id
                LEFT JOIN bookings b ON p.id = b.package_id
                ${whereClause}
                GROUP BY p.id, pr.name
                ORDER BY p.${sortColumn} ${sortOrderVal}
                LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
            `;

            params.push(parseInt(limit), offset);

            const result = await db.query(query, params);

            // Get total count for pagination
            const countQuery = `
                SELECT COUNT(*) as total
                FROM packages p
                ${whereClause}
            `;
            const countResult = await db.query(countQuery, params.slice(0, -2));
            const total = parseInt(countResult.rows[0].total);

            res.json({
                packages: result.rows.map(row => ({
                    id: row.id,
                    producer_id: row.producer_id,
                    producer_name: row.producer_name,
                    name: row.name,
                    slug: row.slug,
                    description: row.description,
                    price: parseFloat(row.price),
                    max_participants: row.max_participants,
                    duration: row.duration,
                    wines: row.wines,
                    includes: row.includes,
                    excludes: row.excludes,
                    location_details: row.location_details,
                    available_days: row.available_days,
                    available_times: row.available_times,
                    languages: row.languages,
                    difficulty_level: row.difficulty_level,
                    age_restriction: row.age_restriction,
                    special_requirements: row.special_requirements,
                    cancellation_policy: row.cancellation_policy,
                    images: row.images,
                    is_active: row.is_active,
                    booking_count: parseInt(row.booking_count) || 0,
                    avg_rating: parseFloat(row.avg_rating) || 0,
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
            console.error('Get packages error:', error);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    }

    async getPackageById(req, res) {
        try {
            const { id } = req.params;

            const result = await db.query(
                `SELECT 
                    p.*,
                    pr.name as producer_name,
                    pr.address as producer_address,
                    pr.phone as producer_phone,
                    pr.email as producer_email,
                    pr.website as producer_website,
                    COUNT(b.id) as booking_count,
                    COUNT(CASE WHEN b.status = 'completed' THEN 1 END) as completed_bookings,
                    COALESCE(AVG(CASE WHEN b.status IN ('completed') THEN 5.0 END), 0) as avg_rating
                 FROM packages p
                 JOIN producers pr ON p.producer_id = pr.id
                 LEFT JOIN bookings b ON p.id = b.package_id
                 WHERE p.id = $1 AND p.producer_id = $2
                 GROUP BY p.id, pr.name, pr.address, pr.phone, pr.email, pr.website`,
                [id, req.producer.id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Pacchetto non trovato' });
            }

            const row = result.rows[0];

            res.json({
                id: row.id,
                producer_id: row.producer_id,
                producer: {
                    name: row.producer_name,
                    address: row.producer_address,
                    phone: row.producer_phone,
                    email: row.producer_email,
                    website: row.producer_website
                },
                name: row.name,
                slug: row.slug,
                description: row.description,
                price: parseFloat(row.price),
                max_participants: row.max_participants,
                duration: row.duration,
                wines: row.wines,
                includes: row.includes,
                excludes: row.excludes,
                location_details: row.location_details,
                available_days: row.available_days,
                available_times: row.available_times,
                languages: row.languages,
                difficulty_level: row.difficulty_level,
                age_restriction: row.age_restriction,
                special_requirements: row.special_requirements,
                cancellation_policy: row.cancellation_policy,
                images: row.images,
                is_active: row.is_active,
                statistics: {
                    booking_count: parseInt(row.booking_count) || 0,
                    completed_bookings: parseInt(row.completed_bookings) || 0,
                    avg_rating: parseFloat(row.avg_rating) || 0
                },
                created_at: row.created_at,
                updated_at: row.updated_at
            });

        } catch (error) {
            console.error('Get package by ID error:', error);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    }

    async updatePackage(req, res) {
        const client = await db.connect();
        
        try {
            await client.query('BEGIN');
            
            const { error } = validateUpdatePackage(req.body);
            if (error) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: error.details[0].message });
            }

            const { id } = req.params;
            const updateData = req.body;

            // Check if package exists and belongs to producer
            const existingResult = await client.query(
                'SELECT * FROM packages WHERE id = $1 AND producer_id = $2',
                [id, req.producer.id]
            );

            if (existingResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Pacchetto non trovato' });
            }

            const existingPackage = existingResult.rows[0];

            // Process new images if provided
            let updatedImages = existingPackage.images;
            if (req.files && req.files.length > 0) {
                try {
                    const newImages = await processPackageImages(req.files, id);
                    updatedImages = [...(existingPackage.images || []), ...newImages];
                } catch (imageError) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ 
                        error: 'Errore nel processamento delle immagini: ' + imageError.message 
                    });
                }
            }

            // Build update query dynamically
            const updateFields = [];
            const updateValues = [];
            let paramCount = 0;

            // Fields that can be updated
            const updatableFields = [
                'name', 'description', 'price', 'max_participants', 'duration',
                'wines', 'includes', 'excludes', 'location_details', 'available_days',
                'available_times', 'languages', 'difficulty_level', 'age_restriction',
                'special_requirements', 'cancellation_policy', 'is_active', 'metadata'
            ];

            updatableFields.forEach(field => {
                if (updateData.hasOwnProperty(field)) {
                    paramCount++;
                    updateFields.push(`${field} = $${paramCount}`);
                    
                    if (['wines', 'includes', 'excludes', 'location_details', 'available_days', 'available_times', 'languages', 'metadata'].includes(field)) {
                        updateValues.push(JSON.stringify(updateData[field]));
                    } else {
                        updateValues.push(updateData[field]);
                    }
                }
            });

            // Always update images and updated_at
            paramCount++;
            updateFields.push(`images = $${paramCount}`);
            updateValues.push(JSON.stringify(updatedImages));

            paramCount++;
            updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

            // Add WHERE clause parameters
            paramCount++;
            updateValues.push(id);
            paramCount++;
            updateValues.push(req.producer.id);

            const updateQuery = `
                UPDATE packages 
                SET ${updateFields.join(', ')}
                WHERE id = $${paramCount - 1} AND producer_id = $${paramCount}
                RETURNING *
            `;

            const updateResult = await client.query(updateQuery, updateValues);
            const updatedPackage = updateResult.rows[0];

            await client.query('COMMIT');

            res.json({
                message: 'Pacchetto aggiornato con successo',
                package: {
                    id: updatedPackage.id,
                    producer_id: updatedPackage.producer_id,
                    name: updatedPackage.name,
                    slug: updatedPackage.slug,
                    description: updatedPackage.description,
                    price: parseFloat(updatedPackage.price),
                    max_participants: updatedPackage.max_participants,
                    duration: updatedPackage.duration,
                    wines: updatedPackage.wines,
                    includes: updatedPackage.includes,
                    excludes: updatedPackage.excludes,
                    location_details: updatedPackage.location_details,
                    available_days: updatedPackage.available_days,
                    available_times: updatedPackage.available_times,
                    languages: updatedPackage.languages,
                    difficulty_level: updatedPackage.difficulty_level,
                    age_restriction: updatedPackage.age_restriction,
                    special_requirements: updatedPackage.special_requirements,
                    cancellation_policy: updatedPackage.cancellation_policy,
                    images: updatedPackage.images,
                    is_active: updatedPackage.is_active,
                    updated_at: updatedPackage.updated_at
                }
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Update package error:', error);
            res.status(500).json({ error: 'Errore interno del server' });
        } finally {
            client.release();
        }
    }

    async deletePackage(req, res) {
        const client = await db.connect();
        
        try {
            await client.query('BEGIN');
            
            const { id } = req.params;

            // Check if package has active bookings
            const bookingResult = await client.query(
                'SELECT COUNT(*) as count FROM bookings WHERE package_id = $1 AND status IN ($2, $3, $4)',
                [id, 'pending', 'confirmed', 'processing']
            );

            const activeBookings = parseInt(bookingResult.rows[0].count);

            if (activeBookings > 0) {
                await client.query('ROLLBACK');
                return res.status(409).json({ 
                    error: `Impossibile eliminare il pacchetto. Ci sono ${activeBookings} prenotazioni attive.`,
                    details: 'Disattiva il pacchetto o aspetta il completamento delle prenotazioni.'
                });
            }

            // Soft delete (set is_active to false)
            const result = await client.query(
                'UPDATE packages SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND producer_id = $2 RETURNING id, name',
                [id, req.producer.id]
            );

            if (result.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Pacchetto non trovato' });
            }

            await client.query('COMMIT');

            res.json({
                message: 'Pacchetto disattivato con successo',
                package: {
                    id: result.rows[0].id,
                    name: result.rows[0].name,
                    is_active: false
                }
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Delete package error:', error);
            res.status(500).json({ error: 'Errore interno del server' });
        } finally {
            client.release();
        }
    }

    async getPackageAnalytics(req, res) {
        try {
            const { period = '30' } = req.query;
            const periodDays = parseInt(period);
            const startDate = moment().subtract(periodDays, 'days').format('YYYY-MM-DD');

            const analyticsQuery = `
                SELECT 
                    p.id,
                    p.name,
                    p.price,
                    p.max_participants,
                    COUNT(b.id) as total_bookings,
                    COUNT(CASE WHEN b.status = 'confirmed' THEN 1 END) as confirmed_bookings,
                    COUNT(CASE WHEN b.status = 'completed' THEN 1 END) as completed_bookings,
                    COUNT(CASE WHEN b.status = 'cancelled' THEN 1 END) as cancelled_bookings,
                    COALESCE(SUM(CASE WHEN b.status IN ('confirmed', 'completed') THEN b.total_price ELSE 0 END), 0) as total_revenue,
                    COALESCE(SUM(CASE WHEN b.status IN ('confirmed', 'completed') THEN b.participants ELSE 0 END), 0) as total_participants,
                    COALESCE(AVG(CASE WHEN b.status IN ('confirmed', 'completed') THEN b.participants END), 0) as avg_participants_per_booking,
                    ROUND(
                        (COUNT(CASE WHEN b.status IN ('confirmed', 'completed') THEN 1 END)::numeric / 
                         NULLIF(COUNT(b.id), 0)) * 100, 1
                    ) as success_rate
                FROM packages p
                LEFT JOIN bookings b ON p.id = b.package_id AND b.created_at >= $2
                WHERE p.producer_id = $1 AND p.is_active = true
                GROUP BY p.id, p.name, p.price, p.max_participants
                ORDER BY total_revenue DESC, total_bookings DESC
            `;

            const result = await db.query(analyticsQuery, [req.producer.id, startDate]);

            // Calculate overall summary
            const summaryQuery = `
                SELECT 
                    COUNT(DISTINCT p.id) as total_packages,
                    COUNT(DISTINCT b.id) as total_bookings,
                    COALESCE(SUM(CASE WHEN b.status IN ('confirmed', 'completed') THEN b.total_price ELSE 0 END), 0) as total_revenue,
                    COALESCE(AVG(p.price), 0) as avg_package_price,
                    COUNT(CASE WHEN p.is_active = true THEN 1 END) as active_packages
                FROM packages p
                LEFT JOIN bookings b ON p.id = b.package_id AND b.created_at >= $2
                WHERE p.producer_id = $1
            `;

            const summaryResult = await db.query(summaryQuery, [req.producer.id, startDate]);
            const summary = summaryResult.rows[0];

            res.json({
                period_days: periodDays,
                start_date: startDate,
                summary: {
                    total_packages: parseInt(summary.total_packages) || 0,
                    active_packages: parseInt(summary.active_packages) || 0,
                    total_bookings: parseInt(summary.total_bookings) || 0,
                    total_revenue: parseFloat(summary.total_revenue) || 0,
                    avg_package_price: parseFloat(summary.avg_package_price) || 0
                },
                packages: result.rows.map(row => ({
                    id: row.id,
                    name: row.name,
                    price: parseFloat(row.price),
                    max_participants: row.max_participants,
                    total_bookings: parseInt(row.total_bookings) || 0,
                    confirmed_bookings: parseInt(row.confirmed_bookings) || 0,
                    completed_bookings: parseInt(row.completed_bookings) || 0,
                    cancelled_bookings: parseInt(row.cancelled_bookings) || 0,
                    total_revenue: parseFloat(row.total_revenue) || 0,
                    total_participants: parseInt(row.total_participants) || 0,
                    avg_participants_per_booking: parseFloat(row.avg_participants_per_booking) || 0,
                    success_rate: parseFloat(row.success_rate) || 0
                }))
            });

        } catch (error) {
            console.error('Get package analytics error:', error);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    }

    async duplicatePackage(req, res) {
        const client = await db.connect();
        
        try {
            await client.query('BEGIN');
            
            const { id } = req.params;
            const { name: newName } = req.body;

            // Get original package
            const originalResult = await client.query(
                'SELECT * FROM packages WHERE id = $1 AND producer_id = $2',
                [id, req.producer.id]
            );

            if (originalResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Pacchetto originale non trovato' });
            }

            const original = originalResult.rows[0];
            const packageId = uuidv4();

            // Generate new slug
            const slug = await generatePackageSlug(newName || `${original.name} - Copia`, req.producer.id);

            // Create duplicate
            const duplicateResult = await client.query(
                `INSERT INTO packages (
                    id, producer_id, name, slug, description, price, max_participants,
                    duration, wines, includes, excludes, location_details,
                    available_days, available_times, languages, difficulty_level,
                    age_restriction, special_requirements, cancellation_policy,
                    images, is_active, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
                RETURNING *`,
                [
                    packageId, original.producer_id, newName || `${original.name} - Copia`, 
                    slug, original.description, original.price, original.max_participants,
                    original.duration, original.wines, original.includes, original.excludes,
                    original.location_details, original.available_days, original.available_times,
                    original.languages, original.difficulty_level, original.age_restriction,
                    original.special_requirements, original.cancellation_policy,
                    original.images, false, // Set as inactive by default
                    original.metadata
                ]
            );

            const duplicatedPackage = duplicateResult.rows[0];

            await client.query('COMMIT');

            res.status(201).json({
                message: 'Pacchetto duplicato con successo',
                original_package_id: id,
                duplicated_package: {
                    id: duplicatedPackage.id,
                    name: duplicatedPackage.name,
                    slug: duplicatedPackage.slug,
                    is_active: duplicatedPackage.is_active,
                    created_at: duplicatedPackage.created_at
                }
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Duplicate package error:', error);
            res.status(500).json({ error: 'Errore interno del server' });
        } finally {
            client.release();
        }
    }
}

module.exports = new PackageController();