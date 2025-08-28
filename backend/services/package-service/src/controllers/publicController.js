const moment = require('moment');
const db = require('../utils/database');
const { validatePublicFilters } = require('../utils/validation');

class PublicController {
    async searchPackages(req, res) {
        try {
            const { error } = validatePublicFilters(req.query);
            if (error) {
                return res.status(400).json({ error: error.details[0].message });
            }

            const { 
                page = 1, 
                limit = 20, 
                search,
                location,
                price_min,
                price_max,
                max_participants_min,
                difficulty_level,
                languages,
                wine_type,
                duration_min,
                duration_max,
                rating_min,
                available_date,
                producer_id,
                sort_by = 'created_at',
                sort_order = 'DESC'
            } = req.query;

            const offset = (parseInt(page) - 1) * parseInt(limit);

            // Build dynamic WHERE clause
            let whereClause = 'WHERE p.is_active = true AND pr.is_active = true';
            let params = [];
            let paramCount = 0;

            if (search) {
                paramCount++;
                whereClause += ` AND (p.name ILIKE $${paramCount} OR p.description ILIKE $${paramCount} OR pr.name ILIKE $${paramCount})`;
                params.push(`%${search}%`);
            }

            if (location) {
                paramCount++;
                whereClause += ` AND (pr.address ILIKE $${paramCount} OR p.location_details::text ILIKE $${paramCount})`;
                params.push(`%${location}%`);
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

            if (wine_type) {
                paramCount++;
                whereClause += ` AND p.wines::text ILIKE $${paramCount}`;
                params.push(`%${wine_type}%`);
            }

            if (duration_min) {
                paramCount++;
                whereClause += ` AND p.duration >= $${paramCount}`;
                params.push(parseInt(duration_min));
            }

            if (duration_max) {
                paramCount++;
                whereClause += ` AND p.duration <= $${paramCount}`;
                params.push(parseInt(duration_max));
            }

            if (producer_id) {
                paramCount++;
                whereClause += ` AND p.producer_id = $${paramCount}`;
                params.push(producer_id);
            }

            // Validate sort parameters
            const allowedSortColumns = ['created_at', 'name', 'price', 'max_participants', 'booking_count', 'avg_rating'];
            const allowedSortOrders = ['ASC', 'DESC'];
            
            const sortColumn = allowedSortColumns.includes(sort_by) ? sort_by : 'created_at';
            const sortOrderVal = allowedSortOrders.includes(sort_order.toUpperCase()) ? sort_order.toUpperCase() : 'DESC';

            const query = `
                SELECT 
                    p.id,
                    p.name,
                    p.slug,
                    p.description,
                    p.price,
                    p.max_participants,
                    p.duration,
                    p.wines,
                    p.includes,
                    p.location_details,
                    p.available_days,
                    p.available_times,
                    p.languages,
                    p.difficulty_level,
                    p.age_restriction,
                    p.images,
                    p.created_at,
                    pr.id as producer_id,
                    pr.name as producer_name,
                    pr.address as producer_address,
                    pr.profile_image as producer_image,
                    COUNT(b.id) as booking_count,
                    COUNT(CASE WHEN b.status = 'completed' THEN 1 END) as completed_bookings,
                    COALESCE(AVG(CASE WHEN b.status = 'completed' THEN 5.0 END), 0) as avg_rating,
                    CASE WHEN COUNT(b.id) > 10 THEN true ELSE false END as is_popular
                FROM packages p
                JOIN producers pr ON p.producer_id = pr.id
                LEFT JOIN bookings b ON p.id = b.package_id
                ${whereClause}
                GROUP BY p.id, pr.id, pr.name, pr.address, pr.profile_image
                ${sortColumn === 'booking_count' ? 'ORDER BY booking_count' : 
                  sortColumn === 'avg_rating' ? 'ORDER BY avg_rating' : 
                  `ORDER BY p.${sortColumn}`} ${sortOrderVal}
                LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
            `;

            params.push(parseInt(limit), offset);

            const result = await db.query(query, params);

            // Get total count for pagination
            const countQuery = `
                SELECT COUNT(*) as total
                FROM packages p
                JOIN producers pr ON p.producer_id = pr.id
                ${whereClause}
            `;
            const countResult = await db.query(countQuery, params.slice(0, -2));
            const total = parseInt(countResult.rows[0].total);

            res.json({
                packages: result.rows.map(row => ({
                    id: row.id,
                    name: row.name,
                    slug: row.slug,
                    description: row.description,
                    price: parseFloat(row.price),
                    max_participants: row.max_participants,
                    duration: row.duration,
                    wines: row.wines,
                    includes: row.includes,
                    location_details: row.location_details,
                    available_days: row.available_days,
                    available_times: row.available_times,
                    languages: row.languages,
                    difficulty_level: row.difficulty_level,
                    age_restriction: row.age_restriction,
                    images: row.images,
                    created_at: row.created_at,
                    producer: {
                        id: row.producer_id,
                        name: row.producer_name,
                        address: row.producer_address,
                        profile_image: row.producer_image
                    },
                    statistics: {
                        booking_count: parseInt(row.booking_count) || 0,
                        completed_bookings: parseInt(row.completed_bookings) || 0,
                        avg_rating: parseFloat(row.avg_rating) || 0,
                        is_popular: row.is_popular
                    }
                })),
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                },
                filters_applied: {
                    search: search || null,
                    location: location || null,
                    price_range: price_min || price_max ? { min: price_min, max: price_max } : null,
                    difficulty_level: difficulty_level || null,
                    languages: languages || null
                }
            });

        } catch (error) {
            console.error('Search packages error:', error);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    }

    async getFeaturedPackages(req, res) {
        try {
            const { limit = 10 } = req.query;

            const query = `
                SELECT 
                    p.id,
                    p.name,
                    p.slug,
                    p.description,
                    p.price,
                    p.max_participants,
                    p.duration,
                    p.images,
                    p.created_at,
                    pr.id as producer_id,
                    pr.name as producer_name,
                    pr.address as producer_address,
                    pr.profile_image as producer_image,
                    COUNT(b.id) as booking_count,
                    COALESCE(AVG(CASE WHEN b.status = 'completed' THEN 5.0 END), 0) as avg_rating,
                    CASE 
                        WHEN COUNT(b.id) > 20 THEN 'high'
                        WHEN COUNT(b.id) > 10 THEN 'medium'
                        ELSE 'low'
                    END as popularity_level
                FROM packages p
                JOIN producers pr ON p.producer_id = pr.id
                LEFT JOIN bookings b ON p.id = b.package_id AND b.created_at >= CURRENT_DATE - INTERVAL '60 days'
                WHERE p.is_active = true AND pr.is_active = true
                GROUP BY p.id, pr.id, pr.name, pr.address, pr.profile_image
                HAVING COUNT(b.id) > 5 OR p.created_at >= CURRENT_DATE - INTERVAL '30 days'
                ORDER BY 
                    COUNT(b.id) DESC,
                    AVG(CASE WHEN b.status = 'completed' THEN 5.0 END) DESC NULLS LAST,
                    p.created_at DESC
                LIMIT $1
            `;

            const result = await db.query(query, [parseInt(limit)]);

            res.json({
                featured_packages: result.rows.map(row => ({
                    id: row.id,
                    name: row.name,
                    slug: row.slug,
                    description: row.description,
                    price: parseFloat(row.price),
                    max_participants: row.max_participants,
                    duration: row.duration,
                    images: row.images,
                    created_at: row.created_at,
                    producer: {
                        id: row.producer_id,
                        name: row.producer_name,
                        address: row.producer_address,
                        profile_image: row.producer_image
                    },
                    statistics: {
                        booking_count: parseInt(row.booking_count) || 0,
                        avg_rating: parseFloat(row.avg_rating) || 0,
                        popularity_level: row.popularity_level
                    }
                })),
                total_found: result.rows.length
            });

        } catch (error) {
            console.error('Get featured packages error:', error);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    }

    async getPackageCategories(req, res) {
        try {
            const query = `
                SELECT 
                    p.difficulty_level,
                    COUNT(*) as package_count,
                    AVG(p.price) as avg_price,
                    MIN(p.price) as min_price,
                    MAX(p.price) as max_price
                FROM packages p
                JOIN producers pr ON p.producer_id = pr.id
                WHERE p.is_active = true AND pr.is_active = true
                GROUP BY p.difficulty_level
                ORDER BY package_count DESC
            `;

            const difficultyResult = await db.query(query);

            // Get wine types
            const wineTypesQuery = `
                SELECT DISTINCT 
                    wine_info->>'type' as wine_type,
                    COUNT(*) as package_count
                FROM packages p
                JOIN producers pr ON p.producer_id = pr.id,
                jsonb_array_elements(p.wines) as wine_info
                WHERE p.is_active = true AND pr.is_active = true
                  AND wine_info->>'type' IS NOT NULL
                GROUP BY wine_info->>'type'
                ORDER BY package_count DESC
                LIMIT 10
            `;

            const wineTypesResult = await db.query(wineTypesQuery);

            // Get locations
            const locationsQuery = `
                SELECT 
                    SPLIT_PART(pr.address, ',', -1) as region,
                    COUNT(*) as package_count
                FROM packages p
                JOIN producers pr ON p.producer_id = pr.id
                WHERE p.is_active = true AND pr.is_active = true
                  AND pr.address IS NOT NULL
                GROUP BY SPLIT_PART(pr.address, ',', -1)
                ORDER BY package_count DESC
                LIMIT 10
            `;

            const locationsResult = await db.query(locationsQuery);

            // Get languages
            const languagesQuery = `
                SELECT 
                    language,
                    COUNT(*) as package_count
                FROM packages p
                JOIN producers pr ON p.producer_id = pr.id,
                jsonb_array_elements_text(p.languages) as language
                WHERE p.is_active = true AND pr.is_active = true
                GROUP BY language
                ORDER BY package_count DESC
                LIMIT 10
            `;

            const languagesResult = await db.query(languagesQuery);

            res.json({
                categories: {
                    difficulty_levels: difficultyResult.rows.map(row => ({
                        level: row.difficulty_level,
                        package_count: parseInt(row.package_count),
                        avg_price: parseFloat(row.avg_price),
                        price_range: {
                            min: parseFloat(row.min_price),
                            max: parseFloat(row.max_price)
                        }
                    })),
                    wine_types: wineTypesResult.rows.map(row => ({
                        type: row.wine_type,
                        package_count: parseInt(row.package_count)
                    })),
                    regions: locationsResult.rows.map(row => ({
                        region: row.region?.trim(),
                        package_count: parseInt(row.package_count)
                    })).filter(item => item.region),
                    languages: languagesResult.rows.map(row => ({
                        language: row.language,
                        package_count: parseInt(row.package_count)
                    }))
                }
            });

        } catch (error) {
            console.error('Get package categories error:', error);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    }

    async getPackageDetails(req, res) {
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
                    pr.profile_image as producer_image,
                    pr.description as producer_description,
                    pr.wine_regions as producer_wine_regions,
                    pr.certifications as producer_certifications,
                    pr.opening_hours as producer_opening_hours,
                    COUNT(b.id) as booking_count,
                    COUNT(CASE WHEN b.status = 'completed' THEN 1 END) as completed_bookings,
                    COUNT(CASE WHEN b.status = 'cancelled' THEN 1 END) as cancelled_bookings,
                    COALESCE(AVG(CASE WHEN b.status = 'completed' THEN 5.0 END), 0) as avg_rating,
                    MAX(b.booking_date) as last_booking_date
                 FROM packages p
                 JOIN producers pr ON p.producer_id = pr.id
                 LEFT JOIN bookings b ON p.id = b.package_id
                 WHERE p.id = $1 AND p.is_active = true AND pr.is_active = true
                 GROUP BY p.id, pr.id`,
                [id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Pacchetto non trovato' });
            }

            const row = result.rows[0];

            // Get similar packages
            const similarQuery = `
                SELECT 
                    p.id, p.name, p.slug, p.price, p.images, p.difficulty_level,
                    pr.name as producer_name
                FROM packages p
                JOIN producers pr ON p.producer_id = pr.id
                WHERE p.id != $1 
                  AND p.is_active = true 
                  AND pr.is_active = true
                  AND (p.difficulty_level = $2 OR p.producer_id = $3)
                ORDER BY 
                  CASE WHEN p.producer_id = $3 THEN 0 ELSE 1 END,
                  CASE WHEN p.difficulty_level = $2 THEN 0 ELSE 1 END,
                  RANDOM()
                LIMIT 6
            `;

            const similarResult = await db.query(similarQuery, [id, row.difficulty_level, row.producer_id]);

            res.json({
                id: row.id,
                producer_id: row.producer_id,
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
                created_at: row.created_at,
                updated_at: row.updated_at,
                producer: {
                    id: row.producer_id,
                    name: row.producer_name,
                    address: row.producer_address,
                    phone: row.producer_phone,
                    email: row.producer_email,
                    website: row.producer_website,
                    profile_image: row.producer_image,
                    description: row.producer_description,
                    wine_regions: row.producer_wine_regions,
                    certifications: row.producer_certifications,
                    opening_hours: row.producer_opening_hours
                },
                statistics: {
                    booking_count: parseInt(row.booking_count) || 0,
                    completed_bookings: parseInt(row.completed_bookings) || 0,
                    cancelled_bookings: parseInt(row.cancelled_bookings) || 0,
                    avg_rating: parseFloat(row.avg_rating) || 0,
                    last_booking_date: row.last_booking_date,
                    success_rate: row.booking_count > 0 ? 
                        ((parseInt(row.completed_bookings) / parseInt(row.booking_count)) * 100).toFixed(1) : 0
                },
                similar_packages: similarResult.rows.map(similar => ({
                    id: similar.id,
                    name: similar.name,
                    slug: similar.slug,
                    price: parseFloat(similar.price),
                    images: similar.images,
                    difficulty_level: similar.difficulty_level,
                    producer_name: similar.producer_name
                }))
            });

        } catch (error) {
            console.error('Get package details error:', error);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    }

    async getPackagesByProducer(req, res) {
        try {
            const { producer_id } = req.params;
            const { page = 1, limit = 10 } = req.query;
            const offset = (parseInt(page) - 1) * parseInt(limit);

            const result = await db.query(
                `SELECT 
                    p.id, p.name, p.slug, p.description, p.price, p.max_participants,
                    p.duration, p.images, p.difficulty_level, p.languages, p.created_at,
                    COUNT(b.id) as booking_count,
                    COALESCE(AVG(CASE WHEN b.status = 'completed' THEN 5.0 END), 0) as avg_rating
                 FROM packages p
                 LEFT JOIN bookings b ON p.id = b.package_id
                 WHERE p.producer_id = $1 AND p.is_active = true
                 GROUP BY p.id
                 ORDER BY p.created_at DESC
                 LIMIT $2 OFFSET $3`,
                [producer_id, parseInt(limit), offset]
            );

            // Get producer info
            const producerResult = await db.query(
                'SELECT id, name, address, profile_image, description FROM producers WHERE id = $1 AND is_active = true',
                [producer_id]
            );

            if (producerResult.rows.length === 0) {
                return res.status(404).json({ error: 'Produttore non trovato' });
            }

            // Get total count
            const countResult = await db.query(
                'SELECT COUNT(*) as total FROM packages WHERE producer_id = $1 AND is_active = true',
                [producer_id]
            );
            const total = parseInt(countResult.rows[0].total);

            res.json({
                producer: producerResult.rows[0],
                packages: result.rows.map(row => ({
                    id: row.id,
                    name: row.name,
                    slug: row.slug,
                    description: row.description,
                    price: parseFloat(row.price),
                    max_participants: row.max_participants,
                    duration: row.duration,
                    images: row.images,
                    difficulty_level: row.difficulty_level,
                    languages: row.languages,
                    created_at: row.created_at,
                    statistics: {
                        booking_count: parseInt(row.booking_count) || 0,
                        avg_rating: parseFloat(row.avg_rating) || 0
                    }
                })),
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            });

        } catch (error) {
            console.error('Get packages by producer error:', error);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    }

    async getPackageBySlug(req, res) {
        try {
            const { slug } = req.params;

            const result = await db.query(
                `SELECT 
                    p.*,
                    pr.name as producer_name,
                    pr.address as producer_address,
                    pr.profile_image as producer_image
                 FROM packages p
                 JOIN producers pr ON p.producer_id = pr.id
                 WHERE p.slug = $1 AND p.is_active = true AND pr.is_active = true`,
                [slug]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Pacchetto non trovato' });
            }

            const row = result.rows[0];

            res.json({
                id: row.id,
                producer_id: row.producer_id,
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
                images: row.images,
                created_at: row.created_at,
                producer: {
                    id: row.producer_id,
                    name: row.producer_name,
                    address: row.producer_address,
                    profile_image: row.producer_image
                }
            });

        } catch (error) {
            console.error('Get package by slug error:', error);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    }
}

module.exports = new PublicController();