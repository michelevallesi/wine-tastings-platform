const crypto = require('crypto');

const algorithm = 'aes-256-gcm';
const keyLength = 32; // 256 bits

/**
 * Get encryption key from environment variable
 */
const getEncryptionKey = () => {
    const key = process.env.ENCRYPTION_KEY;
    
    if (!key) {
        throw new Error('ENCRYPTION_KEY environment variable is required');
    }
    
    if (key.length !== keyLength) {
        throw new Error(`ENCRYPTION_KEY must be ${keyLength} characters long`);
    }
    
    return Buffer.from(key, 'utf8');
};

/**
 * Encrypt sensitive data
 */
const encryptSensitiveData = (plaintext) => {
    try {
        if (!plaintext || typeof plaintext !== 'string') {
            throw new Error('Plaintext must be a non-empty string');
        }

        const key = getEncryptionKey();
        const iv = crypto.randomBytes(16); // 128 bits for GCM
        
        const cipher = crypto.createCipher(algorithm, key, iv);
        
        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();
        
        // Combine IV, auth tag, and encrypted data
        const result = {
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex'),
            encrypted: encrypted
        };
        
        return JSON.stringify(result);
        
    } catch (error) {
        console.error('Encryption error:', error);
        throw new Error('Failed to encrypt sensitive data');
    }
};

/**
 * Decrypt sensitive data
 */
const decryptSensitiveData = (encryptedData) => {
    try {
        if (!encryptedData || typeof encryptedData !== 'string') {
            throw new Error('Encrypted data must be a non-empty string');
        }

        const key = getEncryptionKey();
        const data = JSON.parse(encryptedData);
        
        if (!data.iv || !data.authTag || !data.encrypted) {
            throw new Error('Invalid encrypted data format');
        }
        
        const iv = Buffer.from(data.iv, 'hex');
        const authTag = Buffer.from(data.authTag, 'hex');
        
        const decipher = crypto.createDecipher(algorithm, key, iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
        
    } catch (error) {
        console.error('Decryption error:', error);
        throw new Error('Failed to decrypt sensitive data');
    }
};

/**
 * Generate secure hash for data integrity
 */
const generateHash = (data, salt = null) => {
    try {
        const saltToUse = salt || crypto.randomBytes(32);
        const hash = crypto.pbkdf2Sync(data, saltToUse, 100000, 64, 'sha512');
        
        return {
            hash: hash.toString('hex'),
            salt: saltToUse.toString('hex')
        };
        
    } catch (error) {
        console.error('Hash generation error:', error);
        throw new Error('Failed to generate hash');
    }
};

/**
 * Verify data against hash
 */
const verifyHash = (data, hash, salt) => {
    try {
        const saltBuffer = Buffer.from(salt, 'hex');
        const hashBuffer = crypto.pbkdf2Sync(data, saltBuffer, 100000, 64, 'sha512');
        const hashToVerify = hashBuffer.toString('hex');
        
        return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(hashToVerify, 'hex'));
        
    } catch (error) {
        console.error('Hash verification error:', error);
        return false;
    }
};

/**
 * Generate secure random token
 */
const generateSecureToken = (length = 32) => {
    try {
        return crypto.randomBytes(length).toString('hex');
    } catch (error) {
        console.error('Token generation error:', error);
        throw new Error('Failed to generate secure token');
    }
};

/**
 * Mask sensitive data for logging
 */
const maskSensitiveData = (data, fieldsToMask = []) => {
    try {
        if (!data || typeof data !== 'object') {
            return data;
        }

        const defaultFieldsToMask = [
            'card_number', 'cardNumber', 'card_cvv', 'cvv', 'cvc',
            'social_security', 'ssn', 'tax_id', 'iban', 'account_number',
            'password', 'secret', 'token', 'key', 'auth'
        ];
        
        const allFieldsToMask = [...defaultFieldsToMask, ...fieldsToMask];
        const masked = { ...data };
        
        const maskValue = (value, fieldName) => {
            if (typeof value === 'string') {
                if (fieldName.toLowerCase().includes('email')) {
                    // Mask email keeping first char and domain
                    const parts = value.split('@');
                    if (parts.length === 2) {
                        return `${parts[0].charAt(0)}***@${parts[1]}`;
                    }
                }
                
                if (fieldName.toLowerCase().includes('phone')) {
                    // Mask phone keeping last 4 digits
                    return value.length > 4 ? 
                        '*'.repeat(value.length - 4) + value.slice(-4) : 
                        '*'.repeat(value.length);
                }
                
                if (fieldName.toLowerCase().includes('card') || 
                    fieldName.toLowerCase().includes('number')) {
                    // Mask card/account numbers keeping last 4 digits
                    return value.length > 4 ? 
                        '*'.repeat(value.length - 4) + value.slice(-4) : 
                        '*'.repeat(value.length);
                }
                
                // Default masking
                return value.length > 2 ? 
                    value.charAt(0) + '*'.repeat(value.length - 2) + value.slice(-1) :
                    '*'.repeat(value.length);
            }
            
            return '[MASKED]';
        };
        
        const maskObject = (obj, depth = 0) => {
            if (depth > 5) return obj; // Prevent infinite recursion
            
            const result = {};
            
            for (const [key, value] of Object.entries(obj)) {
                const shouldMask = allFieldsToMask.some(field => 
                    key.toLowerCase().includes(field.toLowerCase())
                );
                
                if (shouldMask) {
                    result[key] = maskValue(value, key);
                } else if (value && typeof value === 'object' && !Array.isArray(value)) {
                    result[key] = maskObject(value, depth + 1);
                } else if (Array.isArray(value)) {
                    result[key] = value.map(item => 
                        item && typeof item === 'object' ? 
                        maskObject(item, depth + 1) : item
                    );
                } else {
                    result[key] = value;
                }
            }
            
            return result;
        };
        
        return maskObject(masked);
        
    } catch (error) {
        console.error('Data masking error:', error);
        return '[MASKING_ERROR]';
    }
};

/**
 * Generate encryption key (for setup)
 */
const generateEncryptionKey = () => {
    try {
        return crypto.randomBytes(keyLength).toString('hex').substring(0, keyLength);
    } catch (error) {
        console.error('Key generation error:', error);
        throw new Error('Failed to generate encryption key');
    }
};

/**
 * Validate encryption key format
 */
const validateEncryptionKey = (key) => {
    if (!key) {
        return { valid: false, reason: 'Encryption key is required' };
    }
    
    if (typeof key !== 'string') {
        return { valid: false, reason: 'Encryption key must be a string' };
    }
    
    if (key.length !== keyLength) {
        return { valid: false, reason: `Encryption key must be exactly ${keyLength} characters long` };
    }
    
    // Check if key contains only valid characters
    const validKeyPattern = /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]+$/;
    if (!validKeyPattern.test(key)) {
        return { valid: false, reason: 'Encryption key contains invalid characters' };
    }
    
    return { valid: true };
};

/**
 * Create secure fingerprint of data
 */
const createDataFingerprint = (data) => {
    try {
        const hash = crypto.createHash('sha256');
        hash.update(JSON.stringify(data));
        return hash.digest('hex');
    } catch (error) {
        console.error('Fingerprint creation error:', error);
        throw new Error('Failed to create data fingerprint');
    }
};

module.exports = {
    encryptSensitiveData,
    decryptSensitiveData,
    generateHash,
    verifyHash,
    generateSecureToken,
    maskSensitiveData,
    generateEncryptionKey,
    validateEncryptionKey,
    createDataFingerprint
};
