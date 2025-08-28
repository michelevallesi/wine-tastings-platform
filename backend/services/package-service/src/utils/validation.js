const Joi = require('joi');

const validateCreatePackage = (data) => {
    const schema = Joi.object({
        name: Joi.string().min(3).max(200).required(),
        description: Joi.string().min(10).max(5000).required(),
        price: Joi.number()
            .positive()
            .precision(2)
            .min(parseFloat(process.env.MIN_PRICE) || 5.00)
            .max(parseFloat(process.env.MAX_PRICE) || 1000.00)
            .required(),
        max_participants: Joi.number()
            .integer()
            .min(parseInt(process.env.MIN_PARTICIPANTS) || 1)
            .max(parseInt(process.env.MAX_PARTICIPANTS) || 50)
            .required(),
        duration: Joi.number()
            .integer()
            .min(parseInt(process.env.MIN_DURATION_MINUTES) || 30)
            .max(parseInt(process.env.MAX_DURATION_MINUTES) || 480)
            .required(),
        wines: Joi.array().items(
            Joi.object({
                name: Joi.string().max(200).required(),
                type: Joi.string().valid('red', 'white', 'rosé', 'sparkling', 'dessert', 'fortified').required(),
                vintage: Joi.number().integer().min(1900).max(new Date().getFullYear()).optional(),
                alcohol_content: Joi.number().min(0).max(20).optional(),
                grape_varieties: Joi.array().items(Joi.string().max(100)).optional(),
                tasting_notes: Joi.string().max(1000).optional(),
                serving_temperature: Joi.string().max(50).optional()
            })
        ).min(1).required(),
        includes: Joi.array().items(Joi.string().max(200)).min(1).required(),
        excludes: Joi.array().items(Joi.string().max(200)).optional(),
        location_details: Joi.object({
            address: Joi.string().max(500).optional(),
            meeting_point: Joi.string().max(500).optional(),
            parking_available: Joi.boolean().optional(),
            accessibility_notes: Joi.string().max(1000).optional(),
            coordinates: Joi.object({
                latitude: Joi.number().min(-90).max(90).optional(),
                longitude: Joi.number().min(-180).max(180).optional()
            }).optional()
        }).optional(),
        available_days: Joi.array().items(
            Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
        ).min(1).required(),
        available_times: Joi.array().items(
            Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
        ).min(1).required(),
        languages: Joi.array().items(
            Joi.string().valid('it', 'en', 'de', 'fr', 'es', 'pt')
        ).min(1).required(),
        difficulty_level: Joi.string()
            .valid('beginner', 'intermediate', 'advanced', 'expert')
            .required(),
        age_restriction: Joi.number().integer().min(0).max(21).optional(),
        special_requirements: Joi.string().max(1000).optional().allow(''),
        cancellation_policy: Joi.string().max(2000).optional().allow(''),
        is_active: Joi.boolean().optional(),
        metadata: Joi.object().optional()
    });

    return schema.validate(data, { abortEarly: false });
};

const validateUpdatePackage = (data) => {
    const schema = Joi.object({
        name: Joi.string().min(3).max(200).optional(),
        description: Joi.string().min(10).max(5000).optional(),
        price: Joi.number()
            .positive()
            .precision(2)
            .min(parseFloat(process.env.MIN_PRICE) || 5.00)
            .max(parseFloat(process.env.MAX_PRICE) || 1000.00)
            .optional(),
        max_participants: Joi.number()
            .integer()
            .min(parseInt(process.env.MIN_PARTICIPANTS) || 1)
            .max(parseInt(process.env.MAX_PARTICIPANTS) || 50)
            .optional(),
        duration: Joi.number()
            .integer()
            .min(parseInt(process.env.MIN_DURATION_MINUTES) || 30)
            .max(parseInt(process.env.MAX_DURATION_MINUTES) || 480)
            .optional(),
        wines: Joi.array().items(
            Joi.object({
                name: Joi.string().max(200).required(),
                type: Joi.string().valid('red', 'white', 'rosé', 'sparkling', 'dessert', 'fortified').required(),
                vintage: Joi.number().integer().min(1900).max(new Date().getFullYear()).optional(),
                alcohol_content: Joi.number().min(0).max(20).optional(),
                grape_varieties: Joi.array().items(Joi.string().max(100)).optional(),
                tasting_notes: Joi.string().max(1000).optional(),
                serving_temperature: Joi.string().max(50).optional()
            })
        ).min(1).optional(),
        includes: Joi.array().items(Joi.string().max(200)).min(1).optional(),
        excludes: Joi.array().items(Joi.string().max(200)).optional(),
        location_details: Joi.object({
            address: Joi.string().max(500).optional(),
            meeting_point: Joi.string().max(500).optional(),
            parking_available: Joi.boolean().optional(),
            accessibility_notes: Joi.string().max(1000).optional(),
            coordinates: Joi.object({
                latitude: Joi.number().min(-90).max(90).optional(),
                longitude: Joi.number().min(-180).max(180).optional()
            }).optional()
        }).optional(),
        available_days: Joi.array().items(
            Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
        ).min(1).optional(),
        available_times: Joi.array().items(
            Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
        ).min(1).optional(),
        languages: Joi.array().items(
            Joi.string().valid('it', 'en', 'de', 'fr', 'es', 'pt')
        ).min(1).optional(),
        difficulty_level: Joi.string()
            .valid('beginner', 'intermediate', 'advanced', 'expert')
            .optional(),
        age_restriction: Joi.number().integer().min(0).max(21).optional(),
        special_requirements: Joi.string().max(1000).optional().allow(''),
        cancellation_policy: Joi.string().max(2000).optional().allow(''),
        is_active: Joi.boolean().optional(),
        metadata: Joi.object().optional()
    });

    return schema.validate(data, { abortEarly: false });
};

const validatePackageFilters = (data) => {
    const schema = Joi.object({
        page: Joi.number().integer().min(1).optional(),
        limit: Joi.number().integer().min(1).max(100).optional(),
        is_active: Joi.string().valid('true', 'false').optional(),
        price_min: Joi.number().positive().optional(),
        price_max: Joi.number().positive().optional(),
        max_participants_min: Joi.number().integer().min(1).optional(),
        difficulty_level: Joi.string()
            .valid('beginner', 'intermediate', 'advanced', 'expert')
            .optional(),
        languages: Joi.string().optional(),
        search: Joi.string().max(255).optional(),
        sort_by: Joi.string()
            .valid('created_at', 'updated_at', 'name', 'price', 'max_participants')
            .optional(),
        sort_order: Joi.string()
            .valid('ASC', 'DESC', 'asc', 'desc')
            .optional()
    });

    return schema.validate(data);
};

const validatePublicFilters = (data) => {
    const schema = Joi.object({
        page: Joi.number().integer().min(1).optional(),
        limit: Joi.number().integer().min(1).max(50).optional(), // Lower limit for public API
        search: Joi.string().max(255).optional(),
        location: Joi.string().max(255).optional(),
        price_min: Joi.number().positive().optional(),
        price_max: Joi.number().positive().optional(),
        max_participants_min: Joi.number().integer().min(1).optional(),
        difficulty_level: Joi.string()
            .valid('beginner', 'intermediate', 'advanced', 'expert')
            .optional(),
        languages: Joi.string().optional(),
        wine_type: Joi.string()
            .valid('red', 'white', 'rosé', 'sparkling', 'dessert', 'fortified')
            .optional(),
        duration_min: Joi.number().integer().min(1).optional(),
        duration_max: Joi.number().integer().max(480).optional(),
        rating_min: Joi.number().min(0).max(5).optional(),
        available_date: Joi.date().min('now').optional(),
        producer_id: Joi.string().uuid().optional(),
        sort_by: Joi.string()
            .valid('created_at', 'name', 'price', 'max_participants', 'booking_count', 'avg_rating')
            .optional(),
        sort_order: Joi.string()
            .valid('ASC', 'DESC', 'asc', 'desc')
            .optional()
    });

    return schema.validate(data);
};

const validateWineData = (wines) => {
    if (!Array.isArray(wines) || wines.length === 0) {
        return { valid: false, errors: ['Almeno un vino è richiesto'] };
    }

    const errors = [];
    const wineTypes = ['red', 'white', 'rosé', 'sparkling', 'dessert', 'fortified'];

    wines.forEach((wine, index) => {
        if (!wine.name || wine.name.length < 2) {
            errors.push(`Nome vino richiesto per il vino #${index + 1}`);
        }

        if (!wine.type || !wineTypes.includes(wine.type)) {
            errors.push(`Tipo di vino non valido per il vino #${index + 1}. Tipi consentiti: ${wineTypes.join(', ')}`);
        }

        if (wine.vintage && (wine.vintage < 1900 || wine.vintage > new Date().getFullYear())) {
            errors.push(`Annata non valida per il vino #${index + 1}`);
        }

        if (wine.alcohol_content && (wine.alcohol_content < 0 || wine.alcohol_content > 20)) {
            errors.push(`Contenuto alcolico non valido per il vino #${index + 1} (0-20%)`);
        }
    });

    return {
        valid: errors.length === 0,
        errors
    };
};

const validateTimeSlots = (availableTimes) => {
    if (!Array.isArray(availableTimes) || availableTimes.length === 0) {
        return { valid: false, errors: ['Almeno un orario disponibile è richiesto'] };
    }

    const errors = [];
    const timePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

    availableTimes.forEach((time, index) => {
        if (!timePattern.test(time)) {
            errors.push(`Formato orario non valido: ${time}. Usa formato HH:MM`);
            return;
        }

        const [hours, minutes] = time.split(':').map(Number);
        
        // Check reasonable business hours (8 AM to 10 PM)
        if (hours < 8 || hours > 22) {
            errors.push(`Orario ${time} non è negli orari di apertura standard (8:00-22:00)`);
        }

        // Check for 15-minute intervals
        if (minutes % 15 !== 0) {
            errors.push(`Orario ${time} deve essere in intervalli di 15 minuti (es. 14:00, 14:15, 14:30, 14:45)`);
        }
    });

    // Check for duplicates
    const uniqueTimes = [...new Set(availableTimes)];
    if (uniqueTimes.length !== availableTimes.length) {
        errors.push('Orari duplicati non consentiti');
    }

    // Sort times and check for reasonable gaps
    const sortedTimes = [...uniqueTimes].sort();
    for (let i = 1; i < sortedTimes.length; i++) {
        const prevTime = sortedTimes[i - 1];
        const currTime = sortedTimes[i];
        
        const prevMinutes = parseTimeToMinutes(prevTime);
        const currMinutes = parseTimeToMinutes(currTime);
        
        if (currMinutes - prevMinutes < 30) {
            errors.push(`Gap troppo piccolo tra ${prevTime} e ${currTime}. Minimo 30 minuti tra gli slot`);
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
};

const parseTimeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
};

const validateAvailableDays = (availableDays) => {
    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    if (!Array.isArray(availableDays) || availableDays.length === 0) {
        return { valid: false, errors: ['Almeno un giorno disponibile è richiesto'] };
    }

    const errors = [];

    availableDays.forEach(day => {
        if (!validDays.includes(day)) {
            errors.push(`Giorno non valido: ${day}. Giorni consentiti: ${validDays.join(', ')}`);
        }
    });

    // Check for duplicates
    const uniqueDays = [...new Set(availableDays)];
    if (uniqueDays.length !== availableDays.length) {
        errors.push('Giorni duplicati non consentiti');
    }

    return {
        valid: errors.length === 0,
        errors
    };
};

const validateBusinessRules = (packageData) => {
    const errors = [];

    // Price validation with currency considerations
    if (packageData.price) {
        const minPrice = parseFloat(process.env.MIN_PRICE) || 5.00;
        const maxPrice = parseFloat(process.env.MAX_PRICE) || 1000.00;
        
        if (packageData.price < minPrice) {
            errors.push(`Prezzo minimo consentito: €${minPrice.toFixed(2)}`);
        }
        
        if (packageData.price > maxPrice) {
            errors.push(`Prezzo massimo consentito: €${maxPrice.toFixed(2)}`);
        }

        // Check reasonable pricing per participant
        if (packageData.max_participants && packageData.price) {
            const pricePerPerson = packageData.price / packageData.max_participants;
            if (pricePerPerson < 10) {
                errors.push('Prezzo per persona troppo basso (minimo €10 per persona)');
            }
            if (pricePerPerson > 200) {
                errors.push('Prezzo per persona molto alto (massimo €200 per persona)');
            }
        }
    }

    // Duration validation with activity type considerations
    if (packageData.duration) {
        if (packageData.wines && packageData.wines.length > 0) {
            const wineCount = packageData.wines.length;
            const minDuration = wineCount * 15; // 15 minutes per wine minimum
            
            if (packageData.duration < minDuration) {
                errors.push(`Durata troppo breve per ${wineCount} vini. Minimo ${minDuration} minuti`);
            }
        }
    }

    // Participant limits based on difficulty
    if (packageData.max_participants && packageData.difficulty_level) {
        const difficultyLimits = {
            'beginner': 20,
            'intermediate': 15,
            'advanced': 12,
            'expert': 8
        };
        
        const maxForDifficulty = difficultyLimits[packageData.difficulty_level];
        if (packageData.max_participants > maxForDifficulty) {
            errors.push(`Troppi partecipanti per livello ${packageData.difficulty_level}. Massimo ${maxForDifficulty}`);
        }
    }

    // Language validation for Italian wine experiences
    if (packageData.languages && !packageData.languages.includes('it')) {
        errors.push('Italiano deve essere incluso tra le lingue disponibili');
    }

    return {
        valid: errors.length === 0,
        errors
    };
};

module.exports = {
    validateCreatePackage,
    validateUpdatePackage,
    validatePackageFilters,
    validatePublicFilters,
    validateWineData,
    validateTimeSlots,
    validateAvailableDays,
    validateBusinessRules,
    parseTimeToMinutes
};