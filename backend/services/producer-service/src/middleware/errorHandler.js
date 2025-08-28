const errorHandler = (error, req, res, next) => {
    console.error('Producer Service Error:', {
        message: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        body: req.body,
        timestamp: new Date().toISOString()
    });

    if (error.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Dati produttore non validi',
            details: error.message
        });
    }

    if (error.code === '23505') { // PostgreSQL unique violation
        if (error.detail && error.detail.includes('email')) {
            return res.status(409).json({
                error: 'Email già registrata da un altro produttore'
            });
        }
        if (error.detail && error.detail.includes('tenant_key')) {
            return res.status(409).json({
                error: 'Errore nella generazione della chiave tenant, riprovare'
            });
        }
        return res.status(409).json({
            error: 'Conflitto nei dati - risorsa già esistente'
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

    // Multer/image upload errors
    if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
            error: 'File troppo grande. Dimensione massima: 5MB'
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

    res.status(500).json({
        error: 'Errore interno del servizio produttori',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
    });
};

module.exports = { errorHandler };