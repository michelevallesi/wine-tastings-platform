const validateImageUpload = (req, res, next) => {
    // If no files, continue (images are optional for updates)
    if (!req.files || req.files.length === 0) {
        return next();
    }

    const maxSize = parseInt(process.env.MAX_IMAGE_SIZE) || 10 * 1024 * 1024; // 10MB
    const maxFiles = parseInt(process.env.MAX_IMAGES_PER_PACKAGE) || 10;
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    // Check number of files
    if (req.files.length > maxFiles) {
        return res.status(400).json({ 
            error: `Troppi file. Massimo ${maxFiles} immagini per pacchetto` 
        });
    }

    // Validate each file
    for (const file of req.files) {
        // Check file size
        if (file.size > maxSize) {
            return res.status(400).json({ 
                error: `Immagine troppo grande: ${file.originalname}. Dimensione massima: ${Math.round(maxSize / 1024 / 1024)}MB` 
            });
        }

        // Check mime type
        if (!allowedMimeTypes.includes(file.mimetype)) {
            return res.status(400).json({ 
                error: `Formato non supportato per ${file.originalname}. Usa JPEG, PNG o WebP` 
            });
        }

        // Check if it's actually an image by looking at the buffer header
        const imageSignatures = {
            'jpeg': [0xFF, 0xD8, 0xFF],
            'png': [0x89, 0x50, 0x4E, 0x47],
            'webp': [0x52, 0x49, 0x46, 0x46] // RIFF header for WebP
        };

        let isValidImage = false;
        for (const [format, signature] of Object.entries(imageSignatures)) {
            if (signature.every((byte, index) => file.buffer[index] === byte)) {
                isValidImage = true;
                break;
            }
        }

        if (!isValidImage) {
            return res.status(400).json({ 
                error: `File non valido: ${file.originalname}. Assicurati di caricare un'immagine reale` 
            });
        }

        // Check filename
        if (file.originalname && !/^[a-zA-Z0-9._-]+$/.test(file.originalname)) {
            return res.status(400).json({
                error: `Nome file non valido: ${file.originalname}. Usa solo lettere, numeri, punti, trattini e underscore`
            });
        }
    }

    next();
};

module.exports = { validateImageUpload };