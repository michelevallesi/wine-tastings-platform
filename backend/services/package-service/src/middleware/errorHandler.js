const errorHandler = (error, req, res, next) => {
    console.error('Package Service Error:', {
        message: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        body: req.body,
        timestamp: new Date().toISOString()
    });

    if (error.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Dati pacchetto non validi',
            details: error.message
        });
    }

    // Multer/image upload errors
    if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
            error: 'File troppo grande. Dimensione massima: 10MB per immagine'
        });
    }

    if (error.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
            error: `Troppi file. Massimo ${process.env.MAX_IMAGES_PER_PACKAGE || 10} immagini per pacchetto`
        });
    }

    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
            error: 'Campo file non previsto'
        });
    }

    if (error.message && error.message.includes('Formato immagine non supportato')) {
        return res.status(400).json({
            error: 'Formato immagine non supportato. Usa JPEG, PNG o WebP'
        });
    }

    // Database errors
    if (error.code === '23505') { // PostgreSQL unique violation
        if (error.detail && error.detail.includes('slug')) {
            return res.status(409).json({
                error: 'Nome pacchetto già esistente. Scegli un nome diverso'
            });
        }
        return res.status(409).json({
            error: 'Conflitto nei dati - risorsa già esistente'
        });
    }

    if (error.code === '23503') { // PostgreSQL foreign key violation
        return res.status(400).json({
            error: 'Riferimento non valido - produttore non trovato'
        });
    }

    if (error.code === '23502') { // PostgreSQL not null violation
        return res.status(400).json({
            error: 'Campi obbligatori mancanti'
        });
    }

    if (error.code === '22001') { // PostgreSQL string too long
        return res.status(400).json({
            error: 'Uno o più campi superano la lunghezza massima consentita'
        });
    }

    if (error.code === '22003') { // PostgreSQL numeric value out of range
        return res.status(400).json({
            error: 'Valore numerico non valido (prezzo, partecipanti, durata)'
        });
    }

    // Image processing errors
    if (error.message && error.message.includes('Sharp')) {
        return res.status(400).json({
            error: "Errore nel processamento dell'immagine. Verifica che sia un file immagine valido"
        });
    }

    // Network/connection errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        return res.status(503).json({
            error: 'Servizi esterni temporaneamente non disponibili',
            details: 'Riprovare tra qualche minuto'
        });
    }

    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
        return res.status(504).json({
            error: 'Timeout nella connessione',
            details: 'La richiesta ha impiegato troppo tempo'
        });
    }

    // Business logic errors
    if (error.message && error.message.includes('booking')) {
        return res.status(409).json({
            error: 'Operazione non consentita a causa di prenotazioni attive',
            details: error.message
        });
    }

    res.status(500).json({
        error: 'Errore interno del servizio pacchetti',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
    });
};

module.exports = { errorHandler };