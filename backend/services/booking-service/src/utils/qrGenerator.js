const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const db = require('./database');

/**
 * Generate unique QR code for bookings
 * Format: VINBOOKING-XXXXXXXX (where X is alphanumeric)
 */
const generateQRCode = async () => {
    const prefix = process.env.QR_CODE_PREFIX || 'VINBOOKING';
    const length = parseInt(process.env.QR_CODE_LENGTH) || 8;
    
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
        const randomString = generateRandomString(length);
        const qrCode = `${prefix}-${randomString}`;
        
        // Check if QR code already exists
        try {
            const existingResult = await db.query(
                'SELECT id FROM bookings WHERE qr_code = $1',
                [qrCode]
            );
            
            if (existingResult.rows.length === 0) {
                return qrCode;
            }
        } catch (error) {
            console.error('Error checking QR code uniqueness:', error);
            throw new Error('Errore nella generazione del codice QR');
        }
        
        attempts++;
    }
    
    throw new Error('Impossibile generare un codice QR univoco');
};

/**
 * Generate random alphanumeric string
 */
const generateRandomString = (length) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    return result;
};

/**
 * Generate QR code image as data URL
 */
const generateQRCodeImage = async (qrCodeText, options = {}) => {
    try {
        const qrOptions = {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            quality: 0.92,
            margin: 2,
            width: 300,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            },
            ...options
        };
        
        const dataUrl = await QRCode.toDataURL(qrCodeText, qrOptions);
        return dataUrl;
    } catch (error) {
        console.error('Error generating QR code image:', error);
        throw new Error('Errore nella generazione dell immagine QR');
    }
};

/**
 * Generate QR code as buffer for file attachments
 */
const generateQRCodeBuffer = async (qrCodeText, options = {}) => {
    try {
        const qrOptions = {
            errorCorrectionLevel: 'M',
            width: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            },
            ...options
        };
        
        const buffer = await QRCode.toBuffer(qrCodeText, qrOptions);
        return buffer;
    } catch (error) {
        console.error('Error generating QR code buffer:', error);
        throw new Error('Errore nella generazione del buffer QR');
    }
};

/**
 * Generate QR code as SVG
 */
const generateQRCodeSVG = async (qrCodeText, options = {}) => {
    try {
        const qrOptions = {
            type: 'svg',
            width: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            },
            ...options
        };
        
        const svg = await QRCode.toString(qrCodeText, qrOptions);
        return svg;
    } catch (error) {
        console.error('Error generating QR code SVG:', error);
        throw new Error('Errore nella generazione del QR SVG');
    }
};

/**
 * Validate QR code format
 */
const validateQRCode = (qrCode) => {
    const prefix = process.env.QR_CODE_PREFIX || 'VINBOOKING';
    const expectedLength = prefix.length + 1 + parseInt(process.env.QR_CODE_LENGTH || 8);
    
    if (!qrCode || typeof qrCode !== 'string') {
        return { valid: false, reason: 'QR code non valido' };
    }
    
    if (!qrCode.startsWith(prefix + '-')) {
        return { valid: false, reason: 'Formato QR code non valido' };
    }
    
    if (qrCode.length !== expectedLength) {
        return { valid: false, reason: 'Lunghezza QR code non valida' };
    }
    
    // Check if contains only allowed characters
    const allowedPattern = new RegExp(`^${prefix}-[A-Z0-9]+$`);
    if (!allowedPattern.test(qrCode)) {
        return { valid: false, reason: 'Caratteri non validi nel QR code' };
    }
    
    return { valid: true };
};

/**
 * Generate QR code with embedded booking info (for advanced use)
 */
const generateBookingQRCode = async (bookingData) => {
    try {
        // Create a simple QR code
        const qrCode = await generateQRCode();
        
        // For advanced implementations, could embed JSON data
        // const qrData = {
        //     code: qrCode,
        //     booking_id: bookingData.id,
        //     date: bookingData.booking_date,
        //     time: bookingData.booking_time,
        //     participants: bookingData.participants,
        //     timestamp: Date.now()
        // };
        
        return qrCode;
    } catch (error) {
        console.error('Error generating booking QR code:', error);
        throw new Error('Errore nella generazione del QR code prenotazione');
    }
};

/**
 * Bulk generate multiple QR codes (for pre-generation)
 */
const bulkGenerateQRCodes = async (count = 100) => {
    const codes = [];
    const batchSize = 10;
    
    try {
        for (let i = 0; i < count; i += batchSize) {
            const batch = [];
            const remaining = Math.min(batchSize, count - i);
            
            for (let j = 0; j < remaining; j++) {
                batch.push(generateQRCode());
            }
            
            const batchResults = await Promise.all(batch);
            codes.push(...batchResults);
            
            // Small delay to avoid overwhelming the system
            if (i + batchSize < count) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        return codes;
    } catch (error) {
        console.error('Error in bulk QR code generation:', error);
        throw new Error('Errore nella generazione in lotto dei QR code');
    }
};

/**
 * Get QR code usage statistics
 */
const getQRCodeStats = async () => {
    try {
        const result = await db.query(`
            SELECT 
                COUNT(*) as total_codes,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_codes,
                COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_codes,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_codes,
                COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_codes
            FROM bookings 
            WHERE qr_code IS NOT NULL
        `);
        
        return result.rows[0];
    } catch (error) {
        console.error('Error getting QR code stats:', error);
        throw new Error('Errore nel recupero delle statistiche QR');
    }
};

module.exports = {
    generateQRCode,
    generateRandomString,
    generateQRCodeImage,
    generateQRCodeBuffer,
    generateQRCodeSVG,
    validateQRCode,
    generateBookingQRCode,
    bulkGenerateQRCodes,
    getQRCodeStats
};