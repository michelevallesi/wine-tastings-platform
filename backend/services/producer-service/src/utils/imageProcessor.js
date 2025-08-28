const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

/**
 * Process and save uploaded profile image
 */
const processAndSaveImage = async (file, producerId) => {
    try {
        const uploadDir = process.env.UPLOAD_DIR || 'uploads';
        const quality = parseInt(process.env.IMAGE_QUALITY) || 80;

        // Ensure upload directory exists
        await ensureDirectoryExists(uploadDir);

        // Generate unique filename
        const fileExtension = getFileExtension(file.mimetype);
        const timestamp = Date.now();
        const hash = crypto.createHash('md5').update(file.buffer).digest('hex').substring(0, 8);
        const fileName = `producer-${producerId}-${timestamp}-${hash}.${fileExtension}`;
        const filePath = path.join(uploadDir, fileName);
        const fullPath = path.resolve(filePath);

        // Process image with Sharp
        let sharpInstance = sharp(file.buffer);
        
        // Get image metadata
        const metadata = await sharpInstance.metadata();
        
        // Resize if too large (max 800x800, maintain aspect ratio)
        const maxSize = 800;
        if (metadata.width > maxSize || metadata.height > maxSize) {
            sharpInstance = sharpInstance.resize(maxSize, maxSize, {
                fit: 'inside',
                withoutEnlargement: true
            });
        }

        // Convert to JPEG and optimize
        const processedBuffer = await sharpInstance
            .jpeg({ 
                quality: quality,
                progressive: true,
                mozjpeg: true
            })
            .toBuffer();

        // Save to disk
        await fs.writeFile(fullPath, processedBuffer);

        // Return relative path for database storage
        return filePath.replace(/\\\\/g, '/');

    } catch (error) {
        console.error('Error processing image:', error);
        throw new Error('Errore durante l elaborazione dellimmagine');
    }
};

/**
 * Delete existing profile image
 */
const deleteProfileImage = async (imagePath) => {
    try {
        if (!imagePath) return;

        const fullPath = path.resolve(imagePath);
        
        // Check if file exists
        try {
            await fs.access(fullPath);
            await fs.unlink(fullPath);
            console.log(`Profile image deleted: ${imagePath}`);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('Error deleting profile image:', error);
            }
            // File doesn't exist, ignore
        }
    } catch (error) {
        console.error('Error in deleteProfileImage:', error);
        // Don't throw error for image deletion failures
    }
};

/**
 * Generate image thumbnails for different sizes
 */
const generateThumbnails = async (file, producerId) => {
    try {
        const uploadDir = process.env.UPLOAD_DIR || 'uploads';
        const quality = parseInt(process.env.IMAGE_QUALITY) || 80;
        const thumbnailSizes = [
            { suffix: 'thumb', width: 150, height: 150 },
            { suffix: 'medium', width: 400, height: 400 },
            { suffix: 'large', width: 800, height: 800 }
        ];

        await ensureDirectoryExists(uploadDir);

        const timestamp = Date.now();
        const hash = crypto.createHash('md5').update(file.buffer).digest('hex').substring(0, 8);
        const baseName = `producer-${producerId}-${timestamp}-${hash}`;
        
        const thumbnails = {};

        for (const size of thumbnailSizes) {
            const fileName = `${baseName}-${size.suffix}.jpg`;
            const filePath = path.join(uploadDir, fileName);
            const fullPath = path.resolve(filePath);

            const processedBuffer = await sharp(file.buffer)
                .resize(size.width, size.height, {
                    fit: 'cover',
                    position: 'center'
                })
                .jpeg({ 
                    quality: quality,
                    progressive: true,
                    mozjpeg: true
                })
                .toBuffer();

            await fs.writeFile(fullPath, processedBuffer);
            thumbnails[size.suffix] = filePath.replace(/\\\\/g, '/');
        }

        return thumbnails;

    } catch (error) {
        console.error('Error generating thumbnails:', error);
        throw new Error('Errore durante la generazione delle anteprime');
    }
};

/**
 * Validate image content and format
 */
const validateImageContent = async (fileBuffer) => {
    try {
        const metadata = await sharp(fileBuffer).metadata();
        
        const validation = {
            valid: true,
            errors: [],
            metadata: {
                format: metadata.format,
                width: metadata.width,
                height: metadata.height,
                size: fileBuffer.length,
                hasAlpha: metadata.hasAlpha,
                channels: metadata.channels
            }
        };

        // Check minimum dimensions
        const minWidth = 100;
        const minHeight = 100;
        if (metadata.width < minWidth || metadata.height < minHeight) {
            validation.valid = false;
            validation.errors.push(`Dimensioni minime richieste: ${minWidth}x${minHeight}px`);
        }

        // Check maximum dimensions
        const maxWidth = 5000;
        const maxHeight = 5000;
        if (metadata.width > maxWidth || metadata.height > maxHeight) {
            validation.valid = false;
            validation.errors.push(`Dimensioni massime consentite: ${maxWidth}x${maxHeight}px`);
        }

        // Check aspect ratio (should be reasonably square-ish for profile images)
        const aspectRatio = metadata.width / metadata.height;
        if (aspectRatio < 0.5 || aspectRatio > 2.0) {
            validation.errors.push("Proporzioni immagine troppo estreme. Usa un'immagine più quadrata");
            // Note: This is a warning, not a blocking error
        }

        // Check for supported format
        const supportedFormats = ['jpeg', 'png', 'webp'];
        if (!supportedFormats.includes(metadata.format)) {
            validation.valid = false;
            validation.errors.push(`Formato non supportato: ${metadata.format}`);
        }

        return validation;

    } catch (error) {
        return {
            valid: false,
            errors: ["File non è un'immagine valida o è corrotto"],
            metadata: null
        };
    }
};

/**
 * Get file extension from mime type
 */
const getFileExtension = (mimeType) => {
    const extensions = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp'
    };
    return extensions[mimeType] || 'jpg';
};

/**
 * Ensure directory exists, create if not
 */
const ensureDirectoryExists = async (dirPath) => {
    try {
        await fs.access(dirPath);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.mkdir(dirPath, { recursive: true });
            console.log(`Created upload directory: ${dirPath}`);
        } else {
            throw error;
        }
    }
};

/**
 * Get image info from file path
 */
const getImageInfo = async (imagePath) => {
    try {
        if (!imagePath) return null;

        const fullPath = path.resolve(imagePath);
        const stats = await fs.stat(fullPath);
        const buffer = await fs.readFile(fullPath);
        const metadata = await sharp(buffer).metadata();

        return {
            path: imagePath,
            size: stats.size,
            modified: stats.mtime,
            format: metadata.format,
            width: metadata.width,
            height: metadata.height,
            channels: metadata.channels,
            hasAlpha: metadata.hasAlpha
        };

    } catch (error) {
        console.error('Error getting image info:', error);
        return null;
    }
};

/**
 * Clean up old unused images
 */
const cleanupOldImages = async (producerId, keepCurrent = null) => {
    try {
        const uploadDir = process.env.UPLOAD_DIR || 'uploads';
        const files = await fs.readdir(uploadDir);
        
        // Find all images for this producer
        const producerImages = files.filter(file => 
            file.startsWith(`producer-${producerId}-`) && 
            (file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.png') || file.endsWith('.webp'))
        );

        // Remove old images (keep current one)
        for (const file of producerImages) {
            const filePath = path.join(uploadDir, file);
            if (keepCurrent && filePath.replace(/\\\\/g, '/') === keepCurrent) {
                continue; // Skip current image
            }

            try {
                await fs.unlink(path.resolve(filePath));
                console.log(`Cleaned up old image: ${file}`);
            } catch (error) {
                console.error(`Error deleting old image ${file}:`, error);
            }
        }

    } catch (error) {
        console.error('Error in cleanup process:', error);
        // Don't throw error for cleanup failures
    }
};

/**
 * Generate image placeholder/default image
 */
const generatePlaceholderImage = async (producerId, producerName) => {
    try {
        const uploadDir = process.env.UPLOAD_DIR || 'uploads';
        await ensureDirectoryExists(uploadDir);

        const fileName = `producer-${producerId}-placeholder.jpg`;
        const filePath = path.join(uploadDir, fileName);
        const fullPath = path.resolve(filePath);

        // Create a simple colored placeholder with initials
        const initials = producerName
            .split(' ')
            .slice(0, 2)
            .map(word => word.charAt(0).toUpperCase())
            .join('');

        const size = 400;
        const backgroundColor = getColorFromString(producerName);

        // Create SVG placeholder
        const svg = `
            <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
                <rect width="100%" height="100%" fill="${backgroundColor}"/>
                <text x="50%" y="50%" text-anchor="middle" dy="0.3em" 
                      font-family="Arial, sans-serif" font-size="120" font-weight="bold" fill="white">
                    ${initials}
                </text>
            </svg>
        `;

        const buffer = await sharp(Buffer.from(svg))
            .jpeg({ quality: 90 })
            .toBuffer();

        await fs.writeFile(fullPath, buffer);

        return filePath.replace(/\\\\/g, '/');

    } catch (error) {
        console.error('Error generating placeholder image:', error);
        return null;
    }
};

/**
 * Generate color from string (for placeholders)
 */
const getColorFromString = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const colors = [
        '#722F37', '#8B3A42', '#A0522D', '#B8860B', '#CD853F',
        '#D2691E', '#DAA520', '#DC143C', '#FF6347', '#FF7F50'
    ];
    
    return colors[Math.abs(hash) % colors.length];
};

module.exports = {
    processAndSaveImage,
    deleteProfileImage,
    generateThumbnails,
    validateImageContent,
    getImageInfo,
    cleanupOldImages,
    generatePlaceholderImage,
    ensureDirectoryExists
};