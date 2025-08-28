const moment = require('moment');

/**
 * Check availability for a specific time slot
 */
const checkAvailability = async (dbClient, package_id, booking_date, booking_time, requested_participants) => {
    try {
        // Get package details
        const packageResult = await dbClient.query(
            'SELECT max_participants, available_days, available_times FROM packages WHERE id = $1 AND is_active = true',
            [package_id]
        );

        if (packageResult.rows.length === 0) {
            return {
                available: false,
                reason: 'Pacchetto non trovato o non attivo'
            };
        }

        const packageData = packageResult.rows[0];

        // Check if the day is available
        const dayAvailability = checkDayAvailability(booking_date, packageData.available_days);
        if (!dayAvailability.available) {
            return dayAvailability;
        }

        // Check if the time is available
        const timeAvailability = checkTimeAvailability(booking_time, packageData.available_times);
        if (!timeAvailability.available) {
            return timeAvailability;
        }

        // Check existing bookings for this time slot
        const existingBookingsResult = await dbClient.query(
            `SELECT SUM(participants) as total_participants
             FROM bookings 
             WHERE package_id = $1 
               AND booking_date = $2 
               AND booking_time = $3 
               AND status IN ('pending', 'confirmed')`,
            [package_id, booking_date, booking_time]
        );

        const currentParticipants = parseInt(existingBookingsResult.rows[0].total_participants) || 0;
        const availableSlots = packageData.max_participants - currentParticipants;

        if (requested_participants > availableSlots) {
            return {
                available: false,
                reason: `Posti insufficienti. Disponibili: ${availableSlots}, richiesti: ${requested_participants}`,
                current_bookings: currentParticipants,
                available_slots: availableSlots
            };
        }

        return {
            available: true,
            current_bookings: currentParticipants,
            available_slots: availableSlots,
            reason: 'Slot disponibile'
        };

    } catch (error) {
        console.error('Error checking availability:', error);
        return {
            available: false,
            reason: 'Errore nel controllo disponibilità'
        };
    }
};

/**
 * Check if a specific day is available for booking
 */
const checkDayAvailability = (booking_date, available_days) => {
    try {
        const bookingMoment = moment(booking_date);
        const dayOfWeek = bookingMoment.day(); // 0 = Sunday, 1 = Monday, etc.
        
        // If no available_days specified, assume all days are available
        if (!available_days || available_days.length === 0) {
            return { available: true, reason: 'Tutti i giorni disponibili' };
        }

        // Check if the day of the week is in the available days array
        if (available_days.includes(dayOfWeek)) {
            return { available: true, reason: 'Giorno disponibile' };
        }

        const dayNames = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
        const availableDayNames = available_days.map(day => dayNames[day]).join(', ');

        return {
            available: false,
            reason: `Giorno non disponibile. Giorni disponibili: ${availableDayNames}`
        };

    } catch (error) {
        console.error('Error checking day availability:', error);
        return {
            available: false,
            reason: 'Errore nel controllo disponibilità giornaliera'
        };
    }
};

/**
 * Check if a specific time is available for booking
 */
const checkTimeAvailability = (booking_time, available_times) => {
    try {
        // If no available_times specified, assume all business hours are available
        if (!available_times || available_times.length === 0) {
            // Default business hours check (8:00 - 20:00)
            const [hours, minutes] = booking_time.split(':').map(Number);
            if (hours < 8 || hours >= 20) {
                return {
                    available: false,
                    reason: 'Orario fuori dagli orari di servizio (8:00 - 20:00)'
                };
            }
            return { available: true, reason: 'Orario negli orari di servizio' };
        }

        // Check if the time is in the available times array
        if (available_times.includes(booking_time)) {
            return { available: true, reason: 'Orario disponibile' };
        }

        return {
            available: false,
            reason: `Orario non disponibile. Orari disponibili: ${available_times.join(', ')}`
        };

    } catch (error) {
        console.error('Error checking time availability:', error);
        return {
            available: false,
            reason: 'Errore nel controllo disponibilità oraria'
        };
    }
};

/**
 * Get all available slots for a specific date and package
 */
const getAvailableSlots = async (dbClient, package_id, booking_date) => {
    try {
        // Get package details
        const packageResult = await dbClient.query(
            'SELECT max_participants, available_times FROM packages WHERE id = $1 AND is_active = true',
            [package_id]
        );

        if (packageResult.rows.length === 0) {
            return {
                available_slots: [],
                error: 'Pacchetto non trovato'
            };
        }

        const packageData = packageResult.rows[0];
        const availableTimes = packageData.available_times || [];

        // Get existing bookings for the date
        const bookingsResult = await dbClient.query(
            `SELECT booking_time, SUM(participants) as total_participants
             FROM bookings 
             WHERE package_id = $1 
               AND booking_date = $2 
               AND status IN ('pending', 'confirmed')
             GROUP BY booking_time`,
            [package_id, booking_date]
        );

        const existingBookings = {};
        bookingsResult.rows.forEach(row => {
            existingBookings[row.booking_time] = parseInt(row.total_participants);
        });

        // Calculate available slots for each time
        const availableSlots = [];
        
        for (const time of availableTimes) {
            const bookedParticipants = existingBookings[time] || 0;
            const availableParticipants = packageData.max_participants - bookedParticipants;
            
            if (availableParticipants > 0) {
                availableSlots.push({
                    time: time,
                    available_participants: availableParticipants,
                    booked_participants: bookedParticipants,
                    max_participants: packageData.max_participants
                });
            }
        }

        return {
            available_slots: availableSlots.sort((a, b) => a.time.localeCompare(b.time)),
            date: booking_date,
            package_id: package_id
        };

    } catch (error) {
        console.error('Error getting available slots:', error);
        return {
            available_slots: [],
            error: 'Errore nel recupero degli slot disponibili'
        };
    }
};

/**
 * Get availability calendar for a month
 */
const getMonthAvailability = async (dbClient, package_id, year, month) => {
    try {
        // Get package details
        const packageResult = await dbClient.query(
            'SELECT max_participants, available_days, available_times FROM packages WHERE id = $1 AND is_active = true',
            [package_id]
        );

        if (packageResult.rows.length === 0) {
            return {
                calendar: {},
                error: 'Pacchetto non trovato'
            };
        }

        const packageData = packageResult.rows[0];
        const availableDays = packageData.available_days || [1, 2, 3, 4, 5, 6]; // Default to all days except Sunday
        const availableTimes = packageData.available_times || [];

        // Get month boundaries
        const startDate = moment(`${year}-${month.toString().padStart(2, '0')}-01`);
        const endDate = startDate.clone().endOf('month');

        // Get all bookings for the month
        const bookingsResult = await dbClient.query(
            `SELECT booking_date, booking_time, SUM(participants) as total_participants
             FROM bookings 
             WHERE package_id = $1 
               AND booking_date >= $2 
               AND booking_date <= $3 
               AND status IN ('pending', 'confirmed')
             GROUP BY booking_date, booking_time`,
            [package_id, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]
        );

        // Process bookings by date and time
        const bookingsByDate = {};
        bookingsResult.rows.forEach(row => {
            const dateKey = row.booking_date.toISOString().split('T')[0];
            if (!bookingsByDate[dateKey]) {
                bookingsByDate[dateKey] = {};
            }
            bookingsByDate[dateKey][row.booking_time] = parseInt(row.total_participants);
        });

        // Build calendar
        const calendar = {};
        const currentDate = startDate.clone();

        while (currentDate.isSameOrBefore(endDate)) {
            const dateKey = currentDate.format('YYYY-MM-DD');
            const dayOfWeek = currentDate.day();

            // Check if day is available
            if (availableDays.includes(dayOfWeek) && currentDate.isAfter(moment(), 'day')) {
                const dayBookings = bookingsByDate[dateKey] || {};
                const availableSlots = [];

                // Check each available time
                for (const time of availableTimes) {
                    const bookedParticipants = dayBookings[time] || 0;
                    const availableParticipants = packageData.max_participants - bookedParticipants;
                    
                    availableSlots.push({
                        time: time,
                        available_participants: availableParticipants,
                        is_available: availableParticipants > 0
                    });
                }

                calendar[dateKey] = {
                    available: availableSlots.some(slot => slot.is_available),
                    slots: availableSlots,
                    day_of_week: dayOfWeek
                };
            } else {
                calendar[dateKey] = {
                    available: false,
                    reason: currentDate.isSameOrBefore(moment(), 'day') ? 'Data passata' : 'Giorno non disponibile',
                    slots: [],
                    day_of_week: dayOfWeek
                };
            }

            currentDate.add(1, 'day');
        }

        return {
            calendar: calendar,
            month: month,
            year: year,
            package_id: package_id
        };

    } catch (error) {
        console.error('Error getting month availability:', error);
        return {
            calendar: {},
            error: 'Errore nel recupero del calendario disponibilità'
        };
    }
};

/**
 * Check if a booking can be moved to a new time slot
 */
const checkRescheduleAvailability = async (dbClient, booking_id, new_date, new_time) => {
    try {
        // Get current booking details
        const currentBookingResult = await dbClient.query(
            'SELECT package_id, participants FROM bookings WHERE id = $1',
            [booking_id]
        );

        if (currentBookingResult.rows.length === 0) {
            return {
                available: false,
                reason: 'Prenotazione non trovata'
            };
        }

        const currentBooking = currentBookingResult.rows[0];

        // Check availability for the new slot (excluding current booking)
        const availability = await checkAvailability(
            dbClient,
            currentBooking.package_id,
            new_date,
            new_time,
            currentBooking.participants
        );

        return availability;

    } catch (error) {
        console.error('Error checking reschedule availability:', error);
        return {
            available: false,
            reason: 'Errore nel controllo disponibilità riprogrammazione'
        };
    }
};

/**
 * Get booking statistics for a package
 */
const getBookingStatistics = async (dbClient, package_id, period_days = 30) => {
    try {
        const startDate = moment().subtract(period_days, 'days').format('YYYY-MM-DD');

        const statsResult = await dbClient.query(
            `SELECT 
                COUNT(*) as total_bookings,
                AVG(participants) as avg_participants,
                SUM(participants) as total_participants,
                COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_bookings,
                COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_bookings
             FROM bookings 
             WHERE package_id = $1 AND created_at >= $2`,
            [package_id, startDate]
        );

        const stats = statsResult.rows[0];

        // Get peak time analysis
        const peakTimesResult = await dbClient.query(
            `SELECT booking_time, COUNT(*) as booking_count
             FROM bookings 
             WHERE package_id = $1 AND created_at >= $2 AND status IN ('confirmed', 'completed')
             GROUP BY booking_time 
             ORDER BY booking_count DESC 
             LIMIT 5`,
            [package_id, startDate]
        );

        // Get peak day analysis
        const peakDaysResult = await dbClient.query(
            `SELECT EXTRACT(DOW FROM booking_date) as day_of_week, COUNT(*) as booking_count
             FROM bookings 
             WHERE package_id = $1 AND created_at >= $2 AND status IN ('confirmed', 'completed')
             GROUP BY EXTRACT(DOW FROM booking_date) 
             ORDER BY booking_count DESC`,
            [package_id, startDate]
        );

        return {
            period_days: period_days,
            total_bookings: parseInt(stats.total_bookings),
            avg_participants: parseFloat(stats.avg_participants).toFixed(1),
            total_participants: parseInt(stats.total_participants),
            confirmed_bookings: parseInt(stats.confirmed_bookings),
            cancelled_bookings: parseInt(stats.cancelled_bookings),
            confirmation_rate: stats.total_bookings > 0 ? 
                (parseInt(stats.confirmed_bookings) / parseInt(stats.total_bookings) * 100).toFixed(1) : 0,
            peak_times: peakTimesResult.rows,
            peak_days: peakDaysResult.rows
        };

    } catch (error) {
        console.error('Error getting booking statistics:', error);
        return {
            error: 'Errore nel recupero delle statistiche prenotazioni'
        };
    }
};

module.exports = {
    checkAvailability,
    checkDayAvailability,
    checkTimeAvailability,
    getAvailableSlots,
    getMonthAvailability,
    checkRescheduleAvailability,
    getBookingStatistics
};