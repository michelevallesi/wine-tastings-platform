const moment = require('moment');
const db = require('./database');

/**
 * Get comprehensive producer analytics
 */
const getProducerAnalytics = async (producerId, periodDays = 30) => {
    try {
        const startDate = moment().subtract(periodDays, 'days').format('YYYY-MM-DD');
        const endDate = moment().format('YYYY-MM-DD');

        // Parallel execution of analytics queries for better performance
        const [
            summaryStats,
            bookingTrends,
            revenueAnalysis,
            popularPackages,
            upcomingBookings,
            customerAnalytics,
            performanceMetrics
        ] = await Promise.all([
            getSummaryStatistics(producerId, startDate),
            getBookingTrends(producerId, startDate, periodDays),
            getRevenueAnalysis(producerId, startDate),
            getPopularPackages(producerId, startDate),
            getUpcomingBookings(producerId),
            getCustomerAnalytics(producerId, startDate),
            getPerformanceMetrics(producerId, startDate)
        ]);

        return {
            summary: summaryStats,
            trends: {
                booking_trends: bookingTrends,
                revenue_analysis: revenueAnalysis
            },
            packages: {
                popular_packages: popularPackages
            },
            upcoming: {
                bookings: upcomingBookings
            },
            customers: customerAnalytics,
            performance: performanceMetrics,
            generated_at: new Date(),
            period: {
                days: periodDays,
                start_date: startDate,
                end_date: endDate
            }
        };

    } catch (error) {
        console.error('Error getting producer analytics:', error);
        throw new Error('Errore nel recupero delle analytics');
    }
};

/**
 * Get summary statistics
 */
const getSummaryStatistics = async (producerId, startDate) => {
    try {
        const result = await db.query(`
            SELECT 
                COUNT(DISTINCT p.id) as total_packages,
                COUNT(DISTINCT CASE WHEN p.is_active = true THEN p.id END) as active_packages,
                COUNT(DISTINCT b.id) as total_bookings,
                COUNT(DISTINCT CASE WHEN b.status = 'pending' THEN b.id END) as pending_bookings,
                COUNT(DISTINCT CASE WHEN b.status = 'confirmed' THEN b.id END) as confirmed_bookings,
                COUNT(DISTINCT CASE WHEN b.status = 'completed' THEN b.id END) as completed_bookings,
                COUNT(DISTINCT CASE WHEN b.status = 'cancelled' THEN b.id END) as cancelled_bookings,
                COALESCE(SUM(CASE WHEN b.status IN ('confirmed', 'completed') THEN b.total_price ELSE 0 END), 0) as total_revenue,
                COALESCE(AVG(CASE WHEN b.status IN ('confirmed', 'completed') THEN b.total_price END), 0) as avg_booking_value,
                COALESCE(SUM(CASE WHEN b.status IN ('confirmed', 'completed') THEN b.participants ELSE 0 END), 0) as total_participants,
                COUNT(DISTINCT c.id) as unique_customers
            FROM producers pr
            LEFT JOIN packages p ON pr.id = p.producer_id
            LEFT JOIN bookings b ON pr.id = b.producer_id AND b.created_at >= $2
            LEFT JOIN customers c ON b.customer_id = c.id AND b.created_at >= $2
            WHERE pr.id = $1
            GROUP BY pr.id
        `, [producerId, startDate]);

        const stats = result.rows[0] || {};

        // Calculate conversion rate
        const totalBookings = parseInt(stats.total_bookings) || 0;
        const confirmedCompleted = parseInt(stats.confirmed_bookings) + parseInt(stats.completed_bookings);
        const conversionRate = totalBookings > 0 ? 
            ((confirmedCompleted / totalBookings) * 100).toFixed(1) : 0;

        return {
            total_packages: parseInt(stats.total_packages) || 0,
            active_packages: parseInt(stats.active_packages) || 0,
            total_bookings: totalBookings,
            pending_bookings: parseInt(stats.pending_bookings) || 0,
            confirmed_bookings: parseInt(stats.confirmed_bookings) || 0,
            completed_bookings: parseInt(stats.completed_bookings) || 0,
            cancelled_bookings: parseInt(stats.cancelled_bookings) || 0,
            total_revenue: parseFloat(stats.total_revenue) || 0,
            avg_booking_value: parseFloat(stats.avg_booking_value) || 0,
            total_participants: parseInt(stats.total_participants) || 0,
            unique_customers: parseInt(stats.unique_customers) || 0,
            conversion_rate: parseFloat(conversionRate)
        };

    } catch (error) {
        console.error('Error getting summary statistics:', error);
        throw error;
    }
};

/**
 * Get booking trends over time
 */
const getBookingTrends = async (producerId, startDate, periodDays) => {
    try {
        // Determine grouping based on period
        let dateGroup, dateFormat;
        if (periodDays <= 7) {
            dateGroup = 'DATE(created_at)';
            dateFormat = 'daily';
        } else if (periodDays <= 31) {
            dateGroup = 'DATE(created_at)';
            dateFormat = 'daily';
        } else if (periodDays <= 90) {
            dateGroup = "DATE_TRUNC('week', created_at)";
            dateFormat = 'weekly';
        } else {
            dateGroup = "DATE_TRUNC('month', created_at)";
            dateFormat = 'monthly';
        }

        const result = await db.query(`
            SELECT 
                ${dateGroup} as period,
                COUNT(*) as total_bookings,
                COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_bookings,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_bookings,
                COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_bookings,
                COALESCE(SUM(CASE WHEN status IN ('confirmed', 'completed') THEN total_price ELSE 0 END), 0) as revenue,
                COALESCE(SUM(CASE WHEN status IN ('confirmed', 'completed') THEN participants ELSE 0 END), 0) as participants
            FROM bookings
            WHERE producer_id = $1 AND created_at >= $2
            GROUP BY ${dateGroup}
            ORDER BY period ASC
        `, [producerId, startDate]);

        return {
            format: dateFormat,
            data: result.rows.map(row => ({
                period: row.period,
                total_bookings: parseInt(row.total_bookings),
                confirmed_bookings: parseInt(row.confirmed_bookings),
                completed_bookings: parseInt(row.completed_bookings),
                cancelled_bookings: parseInt(row.cancelled_bookings),
                revenue: parseFloat(row.revenue),
                participants: parseInt(row.participants)
            }))
        };

    } catch (error) {
        console.error('Error getting booking trends:', error);
        throw error;
    }
};

/**
 * Get revenue analysis with growth metrics
 */
const getRevenueAnalysis = async (producerId, startDate) => {
    try {
        const result = await db.query(`
            WITH current_period AS (
                SELECT 
                    COALESCE(SUM(total_price), 0) as current_revenue,
                    COUNT(*) as current_bookings,
                    COALESCE(AVG(total_price), 0) as current_avg_value
                FROM bookings
                WHERE producer_id = $1 
                  AND status IN ('confirmed', 'completed')
                  AND created_at >= $2
            ),
            previous_period AS (
                SELECT 
                    COALESCE(SUM(total_price), 0) as previous_revenue,
                    COUNT(*) as previous_bookings,
                    COALESCE(AVG(total_price), 0) as previous_avg_value
                FROM bookings
                WHERE producer_id = $1 
                  AND status IN ('confirmed', 'completed')
                  AND created_at >= $2::date - ($2::date - $3::date) 
                  AND created_at < $2
            )
            SELECT 
                cp.current_revenue,
                cp.current_bookings,
                cp.current_avg_value,
                pp.previous_revenue,
                pp.previous_bookings,
                pp.previous_avg_value,
                CASE 
                    WHEN pp.previous_revenue > 0 
                    THEN ((cp.current_revenue - pp.previous_revenue) / pp.previous_revenue * 100)
                    ELSE 0 
                END as revenue_growth_percent,
                CASE 
                    WHEN pp.previous_bookings > 0 
                    THEN ((cp.current_bookings - pp.previous_bookings)::numeric / pp.previous_bookings * 100)
                    ELSE 0 
                END as booking_growth_percent
            FROM current_period cp, previous_period pp
        `, [producerId, startDate, moment().subtract(60, 'days').format('YYYY-MM-DD')]);

        const data = result.rows[0] || {};

        return {
            current_revenue: parseFloat(data.current_revenue) || 0,
            current_bookings: parseInt(data.current_bookings) || 0,
            current_avg_value: parseFloat(data.current_avg_value) || 0,
            previous_revenue: parseFloat(data.previous_revenue) || 0,
            previous_bookings: parseInt(data.previous_bookings) || 0,
            previous_avg_value: parseFloat(data.previous_avg_value) || 0,
            revenue_growth_percent: parseFloat(data.revenue_growth_percent) || 0,
            booking_growth_percent: parseFloat(data.booking_growth_percent) || 0
        };

    } catch (error) {
        console.error('Error getting revenue analysis:', error);
        throw error;
    }
};

/**
 * Get popular packages with performance metrics
 */
const getPopularPackages = async (producerId, startDate) => {
    try {
        const result = await db.query(`
            SELECT 
                p.id,
                p.name,
                p.price,
                p.max_participants,
                COUNT(b.id) as booking_count,
                COUNT(CASE WHEN b.status = 'confirmed' THEN 1 END) as confirmed_count,
                COUNT(CASE WHEN b.status = 'completed' THEN 1 END) as completed_count,
                COUNT(CASE WHEN b.status = 'cancelled' THEN 1 END) as cancelled_count,
                COALESCE(SUM(CASE WHEN b.status IN ('confirmed', 'completed') THEN b.total_price ELSE 0 END), 0) as total_revenue,
                COALESCE(AVG(CASE WHEN b.status IN ('confirmed', 'completed') THEN b.participants END), 0) as avg_participants,
                ROUND(
                    (COUNT(CASE WHEN b.status IN ('confirmed', 'completed') THEN 1 END)::numeric / 
                     NULLIF(COUNT(b.id), 0)) * 100, 1
                ) as success_rate
            FROM packages p
            LEFT JOIN bookings b ON p.id = b.package_id AND b.created_at >= $2
            WHERE p.producer_id = $1 AND p.is_active = true
            GROUP BY p.id, p.name, p.price, p.max_participants
            ORDER BY booking_count DESC, total_revenue DESC
            LIMIT 10
        `, [producerId, startDate]);

        return result.rows.map(row => ({
            id: row.id,
            name: row.name,
            price: parseFloat(row.price),
            max_participants: parseInt(row.max_participants),
            booking_count: parseInt(row.booking_count) || 0,
            confirmed_count: parseInt(row.confirmed_count) || 0,
            completed_count: parseInt(row.completed_count) || 0,
            cancelled_count: parseInt(row.cancelled_count) || 0,
            total_revenue: parseFloat(row.total_revenue) || 0,
            avg_participants: parseFloat(row.avg_participants) || 0,
            success_rate: parseFloat(row.success_rate) || 0
        }));

    } catch (error) {
        console.error('Error getting popular packages:', error);
        throw error;
    }
};

/**
 * Get upcoming bookings
 */
const getUpcomingBookings = async (producerId) => {
    try {
        const result = await db.query(`
            SELECT 
                b.id,
                b.booking_date,
                b.booking_time,
                b.participants,
                b.total_price,
                b.status,
                b.notes,
                p.name as package_name,
                p.duration,
                c.name || ' ' || c.surname as customer_name,
                c.email as customer_email,
                c.phone as customer_phone
            FROM bookings b
            JOIN packages p ON b.package_id = p.id
            JOIN customers c ON b.customer_id = c.id
            WHERE b.producer_id = $1 
              AND b.booking_date >= CURRENT_DATE 
              AND b.status IN ('confirmed', 'pending')
            ORDER BY b.booking_date ASC, b.booking_time ASC
            LIMIT 15
        `, [producerId]);

        return result.rows.map(row => ({
            id: row.id,
            booking_date: row.booking_date,
            booking_time: row.booking_time,
            participants: parseInt(row.participants),
            total_price: parseFloat(row.total_price),
            status: row.status,
            notes: row.notes,
            package_name: row.package_name,
            package_duration: row.duration,
            customer_name: row.customer_name,
            customer_email: row.customer_email,
            customer_phone: row.customer_phone
        }));

    } catch (error) {
        console.error('Error getting upcoming bookings:', error);
        throw error;
    }
};

/**
 * Get customer analytics
 */
const getCustomerAnalytics = async (producerId, startDate) => {
    try {
        const result = await db.query(`
            WITH customer_stats AS (
                SELECT 
                    c.id,
                    c.name || ' ' || c.surname as customer_name,
                    c.email,
                    COUNT(b.id) as booking_count,
                    SUM(b.total_price) as total_spent,
                    MIN(b.created_at) as first_booking,
                    MAX(b.created_at) as last_booking,
                    COUNT(CASE WHEN b.status = 'completed' THEN 1 END) as completed_bookings
                FROM customers c
                JOIN bookings b ON c.id = b.customer_id
                WHERE b.producer_id = $1 AND b.created_at >= $2
                GROUP BY c.id, c.name, c.surname, c.email
            )
            SELECT 
                COUNT(*) as total_customers,
                COUNT(CASE WHEN booking_count > 1 THEN 1 END) as returning_customers,
                COALESCE(AVG(booking_count), 0) as avg_bookings_per_customer,
                COALESCE(AVG(total_spent), 0) as avg_customer_value,
                COALESCE(MAX(total_spent), 0) as top_customer_value
            FROM customer_stats
        `, [producerId, startDate]);

        const stats = result.rows[0] || {};

        // Get top customers
        const topCustomersResult = await db.query(`
            SELECT 
                c.name || ' ' || c.surname as customer_name,
                c.email,
                COUNT(b.id) as booking_count,
                SUM(b.total_price) as total_spent,
                MAX(b.created_at) as last_booking
            FROM customers c
            JOIN bookings b ON c.id = b.customer_id
            WHERE b.producer_id = $1 
              AND b.created_at >= $2
              AND b.status IN ('confirmed', 'completed')
            GROUP BY c.id, c.name, c.surname, c.email
            ORDER BY total_spent DESC
            LIMIT 10
        `, [producerId, startDate]);

        const totalCustomers = parseInt(stats.total_customers) || 0;
        const returningCustomers = parseInt(stats.returning_customers) || 0;
        const retentionRate = totalCustomers > 0 ? 
            ((returningCustomers / totalCustomers) * 100).toFixed(1) : 0;

        return {
            total_customers: totalCustomers,
            returning_customers: returningCustomers,
            retention_rate: parseFloat(retentionRate),
            avg_bookings_per_customer: parseFloat(stats.avg_bookings_per_customer) || 0,
            avg_customer_value: parseFloat(stats.avg_customer_value) || 0,
            top_customer_value: parseFloat(stats.top_customer_value) || 0,
            top_customers: topCustomersResult.rows.map(row => ({
                customer_name: row.customer_name,
                email: row.email,
                booking_count: parseInt(row.booking_count),
                total_spent: parseFloat(row.total_spent),
                last_booking: row.last_booking
            }))
        };

    } catch (error) {
        console.error('Error getting customer analytics:', error);
        throw error;
    }
};

/**
 * Get performance metrics and insights
 */
const getPerformanceMetrics = async (producerId, startDate) => {
    try {
        // Peak times analysis
        const peakTimesResult = await db.query(`
            SELECT 
                EXTRACT(HOUR FROM booking_time::time) as hour,
                COUNT(*) as booking_count,
                AVG(participants) as avg_participants,
                SUM(total_price) as total_revenue
            FROM bookings
            WHERE producer_id = $1 
              AND status IN ('confirmed', 'completed')
              AND created_at >= $2
            GROUP BY EXTRACT(HOUR FROM booking_time::time)
            ORDER BY booking_count DESC
            LIMIT 5
        `, [producerId, startDate]);

        // Peak days analysis
        const peakDaysResult = await db.query(`
            SELECT 
                EXTRACT(DOW FROM booking_date) as day_of_week,
                COUNT(*) as booking_count,
                AVG(participants) as avg_participants,
                SUM(total_price) as total_revenue
            FROM bookings
            WHERE producer_id = $1 
              AND status IN ('confirmed', 'completed')
              AND created_at >= $2
            GROUP BY EXTRACT(DOW FROM booking_date)
            ORDER BY booking_count DESC
        `, [producerId, startDate]);

        // Cancellation analysis
        const cancellationResult = await db.query(`
            SELECT 
                COUNT(*) as total_bookings,
                COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_bookings,
                ROUND(
                    (COUNT(CASE WHEN status = 'cancelled' THEN 1 END)::numeric / 
                     NULLIF(COUNT(*), 0)) * 100, 1
                ) as cancellation_rate
            FROM bookings
            WHERE producer_id = $1 AND created_at >= $2
        `, [producerId, startDate]);

        const dayNames = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

        return {
            peak_times: peakTimesResult.rows.map(row => ({
                hour: parseInt(row.hour),
                booking_count: parseInt(row.booking_count),
                avg_participants: parseFloat(row.avg_participants),
                total_revenue: parseFloat(row.total_revenue)
            })),
            peak_days: peakDaysResult.rows.map(row => ({
                day_of_week: parseInt(row.day_of_week),
                day_name: dayNames[parseInt(row.day_of_week)],
                booking_count: parseInt(row.booking_count),
                avg_participants: parseFloat(row.avg_participants),
                total_revenue: parseFloat(row.total_revenue)
            })),
            cancellation_metrics: {
                total_bookings: parseInt(cancellationResult.rows[0]?.total_bookings) || 0,
                cancelled_bookings: parseInt(cancellationResult.rows[0]?.cancelled_bookings) || 0,
                cancellation_rate: parseFloat(cancellationResult.rows[0]?.cancellation_rate) || 0
            }
        };

    } catch (error) {
        console.error('Error getting performance metrics:', error);
        throw error;
    }
};

/**
 * Get real-time metrics for dashboard
 */
const getRealTimeMetrics = async (producerId) => {
    try {
        const today = moment().format('YYYY-MM-DD');
        const thisMonth = moment().format('YYYY-MM-01');

        const result = await db.query(`
            SELECT 
                COUNT(CASE WHEN DATE(created_at) = $2 THEN 1 END) as bookings_today,
                COUNT(CASE WHEN created_at >= $3 THEN 1 END) as bookings_this_month,
                COUNT(CASE WHEN booking_date = $2 AND status IN ('confirmed', 'pending') THEN 1 END) as bookings_for_today,
                COUNT(CASE WHEN booking_date > $2 AND booking_date <= $2::date + interval '7 days' AND status IN ('confirmed', 'pending') THEN 1 END) as bookings_next_week
            FROM bookings
            WHERE producer_id = $1
        `, [producerId, today, thisMonth]);

        const metrics = result.rows[0] || {};

        return {
            bookings_today: parseInt(metrics.bookings_today) || 0,
            bookings_this_month: parseInt(metrics.bookings_this_month) || 0,
            scheduled_for_today: parseInt(metrics.bookings_for_today) || 0,
            upcoming_week: parseInt(metrics.bookings_next_week) || 0,
            timestamp: new Date()
        };

    } catch (error) {
        console.error('Error getting real-time metrics:', error);
        throw error;
    }
};

module.exports = {
    getProducerAnalytics,
    getSummaryStatistics,
    getBookingTrends,
    getRevenueAnalysis,
    getPopularPackages,
    getUpcomingBookings,
    getCustomerAnalytics,
    getPerformanceMetrics,
    getRealTimeMetrics
};