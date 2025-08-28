const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

/**
 * Process package images with multiple sizes
 */
const processPackageImages = async (files, packageId) => {
    try {
        const uploadDir = process.env.UPLOAD_DIR || 'uploads';
        const quality = parseInt(process.env.IMAGE_QUALITY) || 85;

        // Ensure upload directory exists
        await ensureDirectoryExists(uploadDir);
        await ensureDirectoryExists(path.join(uploadDir, 'packages'));
        await ensureDirectoryExists(path.join(uploadDir, 'packages', packageId));

        const processedImages = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const imageId = uuidv4();
            const timestamp = Date.now();
            const hash = crypto.createHash('md5').update(file.buffer).digest('hex').substring(0, 8);
            
            // Create different sizes
            const sizes = {
                thumbnail: { width: 300, height: 200 },
                medium: { width: 600, height: 400 },
                large: { width: 1200, height: 800 },
                original: null // Keep original size but optimize
            };

            const imageVariants = {};

            for (const [sizeName, dimensions] of Object.entries(sizes)) {
                let sharpInstance = sharp(file.buffer);
                
                // Get original metadata
                const metadata = await sharpInstance.metadata();
                
                // Resize if dimensions specified and larger than original
                if (dimensions) {
                    if (metadata.width > dimensions.width || metadata.height > dimensions.height) {
                        sharpInstance = sharpInstance.resize(dimensions.width, dimensions.height, {
                            fit: 'cover',
                            position: 'center'
                        });
                    }
                }

                // Process and optimize
                const processedBuffer = await sharpInstance
                    .jpeg({ 
                        quality: quality,
                        progressive: true,
                        mozjpeg: true
                    })
                    .toBuffer();

                // Generate filename
                const fileName = `${imageId}-${sizeName}-${timestamp}-${hash}.jpg`;
                const filePath = path.join(uploadDir, 'packages', packageId, fileName);
                const fullPath = path.resolve(filePath);

                // Save to disk
                await fs.writeFile(fullPath, processedBuffer);

                // Store relative path
                imageVariants[sizeName] = path.join('packages', packageId, fileName).replace(/\\\\/g, '/');
            }

            processedImages.push({
                id: imageId,
                original_name: file.originalname,
                variants: imageVariants,
                alt_text: `${file.originalname} - Image ${i + 1}`,
                order: i,
                metadata: {
                    size: file.size,
                    mime_type: file.mimetype,
                    uploaded_at: new Date().toISOString()
                }
            });
        }

        return processedImages;

    } catch (error) {
        console.error('Error processing package images:', error);
        throw new Error('Errore durante l\'elaborazione delle immagini del pacchetto');
    }
};

/**
 * Validate image content and format
 */
const validatePackageImage = async (fileBuffer) => {
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
                channels: metadata.channels,
                density: metadata.density
            }
        };

        // Check minimum dimensions for package images
        const minWidth = 400;
        const minHeight = 300;
        if (metadata.width < minWidth || metadata.height < minHeight) {
            validation.valid = false;
            validation.errors.push(`Dimensioni minime richieste: ${minWidth}x${minHeight}px`);
        }

        // Check maximum dimensions
        const maxWidth = 4000;
        const maxHeight = 3000;
        if (metadata.width > maxWidth || metadata.height > maxHeight) {
            validation.valid = false;
            validation.errors.push(`Dimensioni massime consentite: ${maxWidth}x${maxHeight}px`);
        }

        // Check aspect ratio (should be reasonable for package display)
        const aspectRatio = metadata.width / metadata.height;
        if (aspectRatio < 0.75 || aspectRatio > 2.0) {
            validation.errors.push('Proporzioni immagine non ideali per la visualizzazione. Rapporto consigliato: 4:3 o 16:9');
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
 * Delete package images
 */
const deletePackageImages = async (packageId, imageIds = null) => {
    try {
        const uploadDir = process.env.UPLOAD_DIR || 'uploads';
        const packageDir = path.join(uploadDir, 'packages', packageId);
        
        if (imageIds && Array.isArray(imageIds)) {
            // Delete specific images
            for (const imageId of imageIds) {
                try {
                    const files = await fs.readdir(packageDir);
                    const imageFiles = files.filter(file => file.startsWith(`${imageId}-`));
                    
                    for (const file of imageFiles) {
                        await fs.unlink(path.join(packageDir, file));
                        console.log(`Deleted package image: ${file}`);
                    }
                } catch (error) {
                    console.error(`Error deleting image ${imageId}:`, error);
                }
            }
        } else {
            // Delete entire package directory
            try {
                await fs.rmdir(packageDir, { recursive: true });
                console.log(`Deleted package images directory: ${packageId}`);
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    console.error(`Error deleting package directory ${packageId}:`, error);
                }
            }
        }

    } catch (error) {
        console.error('Error in deletePackageImages:', error);
        // Don't throw error for image deletion failures
    }
};

/**
 * Generate optimized gallery images
 */
const generateImageGallery = async (images) => {
    try {
        const gallery = [];

        for (const image of images) {
            // Validate that all required variants exist
            const requiredVariants = ['thumbnail', 'medium', 'large'];
            const hasAllVariants = requiredVariants.every(variant => 
                image.variants && image.variants[variant]
            );

            if (!hasAllVariants) {
                console.warn(`Image ${image.id} missing required variants`);
                continue;
            }

            gallery.push({
                id: image.id,
                alt_text: image.alt_text || 'Package image',
                order: image.order || 0,
                thumbnail: image.variants.thumbnail,
                medium: image.variants.medium,
                large: image.variants.large,
                metadata: image.metadata || {}
            });
        }

        // Sort by order
        gallery.sort((a, b) => a.order - b.order);

        return gallery;

    } catch (error) {
        console.error('Error generating image gallery:', error);
        return [];
    }
};

/**
 * Create image placeholder for packages without images
 */
const generatePackagePlaceholder = async (packageId, packageName) => {
    try {
        const uploadDir = process.env.UPLOAD_DIR || 'uploads';
        await ensureDirectoryExists(uploadDir);
        await ensureDirectoryExists(path.join(uploadDir, 'packages'));
        await ensureDirectoryExists(path.join(uploadDir, 'packages', packageId));

        const fileName = `placeholder-${packageId}.jpg`;
        const filePath = path.join(uploadDir, 'packages', packageId, fileName);
        const fullPath = path.resolve(filePath);

        // Create a wine-themed placeholder
        const initials = packageName
            .split(' ')
            .slice(0, 2)
            .map(word => word.charAt(0).toUpperCase())
            .join('');

        const size = 600;
        const backgroundColor = getWineColor(packageName);

        // Create SVG placeholder with wine theme
        const svg = `
            <svg width="${size}" height="400" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="wineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color:${backgroundColor};stop-opacity:1" />
                        <stop offset="100%" style="stop-color:${darkenColor(backgroundColor)};stop-opacity:1" />
                    </linearGradient>
                </defs>
                <rect width="100%" height="100%" fill="url(#wineGradient)"/>
                <circle cx="150" cy="150" r="80" fill="rgba(255,255,255,0.1)"/>
                <circle cx="450" cy="300" r="60" fill="rgba(255,255,255,0.05)"/>
                <text x="50%" y="45%" text-anchor="middle" dy="0.3em" 
                      font-family="Arial, sans-serif" font-size="80" font-weight="bold" fill="white" opacity="0.9">
                    ${initials}
                </text>
                <text x="50%" y="65%" text-anchor="middle" dy="0.3em" 
                      font-family="Arial, sans-serif" font-size="24" font-weight="normal" fill="white" opacity="0.7">
                    Wine Tasting Experience
                </text>
            </svg>
        `;

        const buffer = await sharp(Buffer.from(svg))
            .jpeg({ quality: 90 })
            .toBuffer();

        await fs.writeFile(fullPath, buffer);

        return path.join('packages', packageId, fileName).replace(/\\\\/g, '/');

    } catch (error) {
        console.error('Error generating package placeholder:', error);
        return null;
    }
};

/**
 * Get wine-themed colors
 */
const getWineColor = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const wineColors = [
        '#722F37', // Deep red
        '#8B0000', // Dark red  
        '#A0522D', // Sienna
        '#8B4513', // Saddle brown
        '#CD853F', // Peru
        '#D2691E', // Chocolate
        '#B22222', // Fire brick
        '#A52A2A', // Brown
        '#800080', // Purple
        '#483D8B'  // Dark slate blue
    ];
    
    return wineColors[Math.abs(hash) % wineColors.length];
};

/**
 * Darken color for gradient
 */
const darkenColor = (hex) => {
    // Simple darkening by reducing RGB values
    const r = Math.max(0, parseInt(hex.substr(1, 2), 16) - 40);
    const g = Math.max(0, parseInt(hex.substr(3, 2), 16) - 40);
    const b = Math.max(0, parseInt(hex.substr(5, 2), 16) - 40);
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

/**
 * Ensure directory exists
 */
const ensureDirectoryExists = async (dirPath) => {
    try {
        await fs.access(dirPath);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.mkdir(dirPath, { recursive: true });
            console.log(`Created directory: ${dirPath}`);
        } else {
            throw error;
        }
    }
};

/**
 * Get image information
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
 * Cleanup old unused images
 */
const cleanupPackageImages = async (packageId, keepImages = []) => {
    try {
        const uploadDir = process.env.UPLOAD_DIR || 'uploads';
        const packageDir = path.join(uploadDir, 'packages', packageId);
        
        try {
            const files = await fs.readdir(packageDir);
            
            for (const file of files) {
                // Skip if this image should be kept
                const shouldKeep = keepImages.some(keepImage => 
                    file.includes(keepImage.id)
                );
                
                if (!shouldKeep && !file.includes('placeholder')) {
                    await fs.unlink(path.join(packageDir, file));
                    console.log(`Cleaned up old image: ${file}`);
                }
            }
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error(`Error cleaning up images for package ${packageId}:`, error);
            }
        }

    } catch (error) {
        console.error('Error in cleanup process:', error);
    }
};

module.exports = {
    processPackageImages,
    validatePackageImage,
    deletePackageImages,
    generateImageGallery,
    generatePackagePlaceholder,
    getImageInfo,
    cleanupPackageImages,
    ensureDirectoryExists
};