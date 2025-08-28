const Joi = require('joi');

const validateProducerUpdate = (data) => {
    const schema = Joi.object({
        name: Joi.string().min(2).max(255).required(),
        address: Joi.string().max(1000).optional().allow(''),
        phone: Joi.string().max(50).optional().allow(''),
        description: Joi.string().max(5000).optional().allow(''),
        website: Joi.string().uri().max(255).optional().allow(''),
        established_year: Joi.number()
            .integer()
            .min(1800)
            .max(new Date().getFullYear())
            .optional()
            .allow(null),
        wine_regions: Joi.alternatives().try(
            Joi.array().items(Joi.string().max(100)),
            Joi.string().max(1000)
        ).optional().allow('', null),
        certifications: Joi.alternatives().try(
            Joi.array().items(Joi.string().max(100)),
            Joi.string().max(1000)
        ).optional().allow('', null),
        opening_hours: Joi.alternatives().try(
            Joi.object({
                monday: Joi.object({
                    open: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
                    close: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
                    closed: Joi.boolean()
                }).optional(),
                tuesday: Joi.object({
                    open: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
                    close: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
                    closed: Joi.boolean()
                }).optional(),
                wednesday: Joi.object({
                    open: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
                    close: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
                    closed: Joi.boolean()
                }).optional(),
                thursday: Joi.object({
                    open: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
                    close: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
                    closed: Joi.boolean()
                }).optional(),
                friday: Joi.object({
                    open: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
                    close: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
                    closed: Joi.boolean()
                }).optional(),
                saturday: Joi.object({
                    open: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
                    close: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
                    closed: Joi.boolean()
                }).optional(),
                sunday: Joi.object({
                    open: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
                    close: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
                    closed: Joi.boolean()
                }).optional()
            }),
            Joi.string().max(2000)
        ).optional().allow('', null)
    });

    return schema.validate(data, { abortEarly: false });
};

const validateProducerFilters = (data) => {
    const schema = Joi.object({
        page: Joi.number().integer().min(1).optional(),
        limit: Joi.number().integer().min(1).max(100).optional(),
        search: Joi.string().max(255).optional().allow(''),
        region: Joi.string().max(100).optional().allow(''),
        has_packages: Joi.string().valid('true', 'false').optional(),
        sort_by: Joi.string()
            .valid('name', 'created_at', 'established_year')
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

const validateImageFile = (file) => {
    const errors = [];

    // Check file size
    const maxSize = parseInt(process.env.MAX_PROFILE_IMAGE_SIZE) || 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
        errors.push(`File troppo grande. Dimensione massima: ${Math.round(maxSize / 1024 / 1024)}MB`);
    }

    // Check mime type
    const allowedMimeTypes = process.env.SUPPORTED_IMAGE_FORMATS?.split(',').map(format => `image/${format}`) || 
                            ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    
    if (!allowedMimeTypes.includes(file.mimetype)) {
        errors.push(`Formato non supportato. Formati consentiti: ${allowedMimeTypes.map(type => type.replace('image/', '')).join(', ')}`);
    }

    // Check filename
    if (file.originalname && !/^[a-zA-Z0-9._-]+$/.test(file.originalname)) {
        errors.push('Nome file non valido. Usa solo lettere, numeri, punti, trattini e underscore');
    }

    return {
        valid: errors.length === 0,
        errors
    };
};

const validateBusinessHours = (openingHours) => {
    if (!openingHours || typeof openingHours !== 'object') {
        return { valid: true }; // Optional field
    }

    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const errors = [];

    for (const day of days) {
        if (openingHours[day]) {
            const dayHours = openingHours[day];
            
            if (dayHours.closed) {
                continue; // Skip validation for closed days
            }

            if (!dayHours.open || !dayHours.close) {
                errors.push(`Orari mancanti per ${day}`);
                continue;
            }

            // Validate time format
            const timePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
            if (!timePattern.test(dayHours.open) || !timePattern.test(dayHours.close)) {
                errors.push(`Formato orario non valido per ${day}. Usa HH:MM`);
                continue;
            }

            // Check that opening time is before closing time
            const [openHour, openMin] = dayHours.open.split(':').map(Number);
            const [closeHour, closeMin] = dayHours.close.split(':').map(Number);
            const openTime = openHour * 60 + openMin;
            const closeTime = closeHour * 60 + closeMin;

            if (openTime >= closeTime) {
                errors.push(`Orario di apertura deve essere precedente a quello di chiusura per ${day}`);
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
};

const validateWineRegions = (regions) => {
    if (!regions) return { valid: true };

    let regionArray = [];
    
    if (Array.isArray(regions)) {
        regionArray = regions;
    } else if (typeof regions === 'string') {
        regionArray = regions.split(',').map(r => r.trim()).filter(r => r.length > 0);
    }

    const errors = [];
    const maxRegions = 10;
    const maxRegionLength = 100;

    if (regionArray.length > maxRegions) {
        errors.push(`Massimo ${maxRegions} regioni vinicole consentite`);
    }

    for (const region of regionArray) {
        if (typeof region !== 'string' || region.length > maxRegionLength) {
            errors.push(`Regione non valida: ${region}. Massimo ${maxRegionLength} caratteri`);
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        processedRegions: regionArray
    };
};

const validateCertifications = (certifications) => {
    if (!certifications) return { valid: true };

    let certArray = [];
    
    if (Array.isArray(certifications)) {
        certArray = certifications;
    } else if (typeof certifications === 'string') {
        certArray = certifications.split(',').map(c => c.trim()).filter(c => c.length > 0);
    }

    const errors = [];
    const maxCertifications = 15;
    const maxCertLength = 100;

    if (certArray.length > maxCertifications) {
        errors.push(`Massimo ${maxCertifications} certificazioni consentite`);
    }

    for (const cert of certArray) {
        if (typeof cert !== 'string' || cert.length > maxCertLength) {
            errors.push(`Certificazione non valida: ${cert}. Massimo ${maxCertLength} caratteri`);
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        processedCertifications: certArray
    };
};

const sanitizeProducerData = (data) => {
    const sanitized = { ...data };

    // Trim string fields
    if (sanitized.name) sanitized.name = sanitized.name.trim();
    if (sanitized.address) sanitized.address = sanitized.address.trim();
    if (sanitized.phone) sanitized.phone = sanitized.phone.trim();
    if (sanitized.description) sanitized.description = sanitized.description.trim();
    if (sanitized.website) {
        sanitized.website = sanitized.website.trim();
        // Add protocol if missing
        if (sanitized.website && !sanitized.website.match(/^https?:\/\//)) {
            sanitized.website = 'https://' + sanitized.website;
        }
    }

    // Process arrays
    const wineRegionsValidation = validateWineRegions(sanitized.wine_regions);
    if (wineRegionsValidation.valid) {
        sanitized.wine_regions = wineRegionsValidation.processedRegions;
    }

    const certificationsValidation = validateCertifications(sanitized.certifications);
    if (certificationsValidation.valid) {
        sanitized.certifications = certificationsValidation.processedCertifications;
    }

    return sanitized;
};

// Custom validation for specific business rules
const validateProducerBusinessRules = (data) => {
    const errors = [];

    // Check established year is reasonable
    if (data.established_year) {
        const currentYear = new Date().getFullYear();
        if (data.established_year < 1800) {
            errors.push('Anno di fondazione troppo antico');
        }
        if (data.established_year > currentYear) {
            errors.push('Anno di fondazione non può essere futuro');
        }
    }

    // Validate wine regions are Italian regions (if specified)
    if (data.wine_regions && Array.isArray(data.wine_regions)) {
        const italianRegions = [
            'Abruzzo', 'Basilicata', 'Calabria', 'Campania', 'Emilia-Romagna',
            'Friuli-Venezia Giulia', 'Lazio', 'Liguria', 'Lombardia', 'Marche',
            'Molise', 'Piemonte', 'Puglia', 'Sardegna', 'Sicilia', 'Toscana',
            'Trentino-Alto Adige', 'Umbria', 'Valle Aosta', 'Veneto'
        ];
        
        for (const region of data.wine_regions) {
            if (!italianRegions.includes(region)) {
                console.warn(`Wine region '${region}' might not be a recognized Italian region`);
                // Note: this is a warning, not an error, to allow flexibility
            }
        }
    }

    // Validate business hours make sense
    if (data.opening_hours) {
        const businessHoursValidation = validateBusinessHours(data.opening_hours);
        if (!businessHoursValidation.valid) {
            errors.push(...businessHoursValidation.errors);
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
};

module.exports = {
    validateProducerUpdate,
    validateProducerFilters,
    validateDashboardPeriod,
    validateImageFile,
    validateBusinessHours,
    validateWineRegions,
    validateCertifications,
    sanitizeProducerData,
    validateProducerBusinessRules
};