const validateImageUpload = (req, res, next) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nessuna immagine fornita' });
    }

    // Check file size
    const maxSize = parseInt(process.env.MAX_PROFILE_IMAGE_SIZE) || 5 * 1024 * 1024; // 5MB
    if (req.file.size > maxSize) {
        return res.status(400).json({ 
            error: `Immagine troppo grande. Dimensione massima: ${Math.round(maxSize / 1024 / 1024)}MB` 
        });
    }

    // Check mime type
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ 
            error: 'Formato immagine non supportato. Usa JPEG, PNG o WebP' 
        });
    }

    // Check if it's actually an image by looking at the buffer header
    const imageSignatures = {
        'jpeg': [0xFF, 0xD8, 0xFF],
        'png': [0x89, 0x50, 0x4E, 0x47],
        'webp': [0x52, 0x49, 0x46, 0x46] // RIFF header for WebP
    };

    const buffer = req.file.buffer;
    let isValidImage = false;

    for (const [format, signature] of Object.entries(imageSignatures)) {
        if (signature.every((byte, index) => buffer[index] === byte)) {
            isValidImage = true;
            break;
        }
    }

    if (!isValidImage) {
        return res.status(400).json({ 
            error: 'File non valido. Assicurati di caricare unmmagine reale' 
        });
    }

    next();
};

module.exports = { validateImageUpload };