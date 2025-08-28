const Joi = require('joi');
const moment = require('moment');

const validateCreateBooking = (data) => {
    const schema = Joi.object({
        package_id: Joi.string().uuid().required(),
        customer: Joi.object({
            name: Joi.string().min(2).max(100).required(),
            surname: Joi.string().min(2).max(100).required(),
            email: Joi.string().email().required(),
            phone: Joi.string().min(8).max(20).optional().allow('')
        }).required(),
        booking_date: Joi.date()
            .min(moment().format('YYYY-MM-DD'))
            .max(moment().add(parseInt(process.env.ADVANCE_BOOKING_DAYS) || 365, 'days').format('YYYY-MM-DD'))
            .required(),
        booking_time: Joi.string()
            .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
            .required(),
        participants: Joi.number()
            .integer()
            .min(1)
            .max(parseInt(process.env.MAX_PARTICIPANTS) || 50)
            .required(),
        notes: Joi.string().max(1000).optional().allow('')
    });

    return schema.validate(data, { abortEarly: false });
};

const validateUpdateBookingStatus = (data) => {
    const schema = Joi.object({
        status: Joi.string()
            .valid('pending', 'confirmed', 'cancelled', 'completed')
            .required(),
        notes: Joi.string().max(1000).optional().allow('')
    });

    return schema.validate(data);
};

const validateAvailabilityCheck = (data) => {
    const schema = Joi.object({
        package_id: Joi.string().uuid().required(),
        date: Joi.date()
            .min(moment().format('YYYY-MM-DD'))
            .max(moment().add(parseInt(process.env.ADVANCE_BOOKING_DAYS) || 365, 'days').format('YYYY-MM-DD'))
            .required(),
        time: Joi.string()
            .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
            .required(),
        participants: Joi.number()
            .integer()
            .min(1)
            .max(parseInt(process.env.MAX_PARTICIPANTS) || 50)
            .required()
    });

    return schema.validate(data);
};

const validateBookingFilters = (data) => {
    const schema = Joi.object({
        page: Joi.number().integer().min(1).optional(),
        limit: Joi.number().integer().min(1).max(100).optional(),
        status: Joi.string()
            .valid('pending', 'confirmed', 'cancelled', 'completed')
            .optional(),
        date_from: Joi.date().optional(),
        date_to: Joi.date().min(Joi.ref('date_from')).optional(),
        package_id: Joi.string().uuid().optional(),
        customer_email: Joi.string().email().optional(),
        sort_by: Joi.string()
            .valid('booking_date', 'booking_time', 'created_at', 'total_price', 'status')
            .optional(),
        sort_order: Joi.string()
            .valid('ASC', 'DESC', 'asc', 'desc')
            .optional()
    });

    return schema.validate(data);
};

const validateDashboardPeriod = (data) => {
    const schema = Joi.object({
        period: Joi.number()
            .integer()
            .min(1)
            .max(730) // Max 2 years
            .optional()
    });

    return schema.validate(data);
};

const validateBookingUpdate = (data) => {
    const schema = Joi.object({
        booking_date: Joi.date()
            .min(moment().format('YYYY-MM-DD'))
            .max(moment().add(parseInt(process.env.ADVANCE_BOOKING_DAYS) || 365, 'days').format('YYYY-MM-DD'))
            .optional(),
        booking_time: Joi.string()
            .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
            .optional(),
        participants: Joi.number()
            .integer()
            .min(1)
            .max(parseInt(process.env.MAX_PARTICIPANTS) || 50)
            .optional(),
        notes: Joi.string().max(1000).optional().allow('')
    });

    return schema.validate(data, { abortEarly: false });
};

const validateCancellation = (data) => {
    const schema = Joi.object({
        reason: Joi.string().max(500).required()
    });

    return schema.validate(data);
};

// Custom validation helpers
const isValidTimeSlot = (time) => {
    const [hours, minutes] = time.split(':').map(Number);
    
    // Check if it's within reasonable hours (8 AM to 8 PM)
    if (hours < 8 || hours > 20) {
        return false;
    }
    
    // Check if it's on quarter-hour intervals
    if (![0, 15, 30, 45].includes(minutes)) {
        return false;
    }
    
    return true;
};

const isValidBookingDate = (date) => {
    const bookingDate = moment(date);
    const now = moment();
    const maxAdvance = moment().add(parseInt(process.env.ADVANCE_BOOKING_DAYS) || 365, 'days');
    
    // Must be future date
    if (bookingDate.isSameOrBefore(now, 'day')) {
        return { valid: false, reason: 'La data deve essere futura' };
    }
    
    // Must be within advance booking limit
    if (bookingDate.isAfter(maxAdvance)) {
        return { valid: false, reason: `Prenotazioni possibili fino a ${process.env.ADVANCE_BOOKING_DAYS || 365} giorni in anticipo` };
    }
    
    // Should not be on a weekend for business bookings (optional rule)
    const dayOfWeek = bookingDate.day();
    if (process.env.NO_WEEKEND_BOOKINGS === 'true' && (dayOfWeek === 0 || dayOfWeek === 6)) {
        return { valid: false, reason: 'Prenotazioni non disponibili nel weekend' };
    }
    
    return { valid: true };
};

const validateBusinessRules = (bookingData) => {
    const errors = [];
    
    // Check booking date
    const dateValidation = isValidBookingDate(bookingData.booking_date);
    if (!dateValidation.valid) {
        errors.push(dateValidation.reason);
    }
    
    // Check time slot
    if (!isValidTimeSlot(bookingData.booking_time)) {
        errors.push('Orario non valido. Utilizzare intervalli di 15 minuti tra le 8:00 e le 20:00');
    }
    
    // Check minimum advance notice (e.g., 24 hours)
    const bookingDateTime = moment(`${bookingData.booking_date} ${bookingData.booking_time}`);
    const minAdvanceHours = parseInt(process.env.MIN_ADVANCE_HOURS) || 24;
    
    if (bookingDateTime.isBefore(moment().add(minAdvanceHours, 'hours'))) {
        errors.push(`Prenotazioni devono essere effettuate con almeno ${minAdvanceHours} ore di anticipo`);
    }
    
    // Check participants count against system limits
    const maxSystemParticipants = parseInt(process.env.MAX_PARTICIPANTS) || 50;
    if (bookingData.participants > maxSystemParticipants) {
        errors.push(`Numero massimo di partecipanti: ${maxSystemParticipants}`);
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
};

// Sanitization functions
const sanitizeBookingData = (data) => {
    return {
        ...data,
        customer: {
            name: data.customer.name.trim(),
            surname: data.customer.surname.trim(),
            email: data.customer.email.toLowerCase().trim(),
            phone: data.customer.phone ? data.customer.phone.replace(/\\D/g, '') : null
        },
        notes: data.notes ? data.notes.trim() : null
    };
};

const sanitizeFilters = (filters) => {
    const sanitized = {};
    
    if (filters.page) sanitized.page = parseInt(filters.page);
    if (filters.limit) sanitized.limit = Math.min(parseInt(filters.limit), 100);
    if (filters.status) sanitized.status = filters.status.toLowerCase();
    if (filters.date_from) sanitized.date_from = moment(filters.date_from).format('YYYY-MM-DD');
    if (filters.date_to) sanitized.date_to = moment(filters.date_to).format('YYYY-MM-DD');
    if (filters.package_id) sanitized.package_id = filters.package_id;
    if (filters.customer_email) sanitized.customer_email = filters.customer_email.toLowerCase().trim();
    if (filters.sort_by) sanitized.sort_by = filters.sort_by;
    if (filters.sort_order) sanitized.sort_order = filters.sort_order.toUpperCase();
    
    return sanitized;
};

module.exports = {
    validateCreateBooking,
    validateUpdateBookingStatus,
    validateAvailabilityCheck,
    validateBookingFilters,
    validateDashboardPeriod,
    validateBookingUpdate,
    validateCancellation,
    isValidTimeSlot,
    isValidBookingDate,
    validateBusinessRules,
    sanitizeBookingData,
    sanitizeFilters
};