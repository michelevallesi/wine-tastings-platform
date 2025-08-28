const errorHandler = (error, req, res, next) => {
    console.error('Booking Service Error:', {
        message: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        body: req.body,
        timestamp: new Date().toISOString()
    });

    if (error.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Dati di prenotazione non validi',
            details: error.message
        });
    }

    if (error.code === '23505') { // PostgreSQL unique violation
        if (error.detail && error.detail.includes('qr_code')) {
            return res.status(409).json({
                error: 'Errore nella generazione del codice QR, riprovare'
            });
        }
        return res.status(409).json({
            error: 'Conflitto nei dati - risorsa già esistente'
        });
    }

    if (error.code === '23503') { // PostgreSQL foreign key violation
        return res.status(400).json({
            error: 'Riferimento non valido - verificare i dati inseriti'
        });
    }

    if (error.code === '23502') { // PostgreSQL not null violation
        return res.status(400).json({
            error: 'Campi obbligatori mancanti'
        });
    }

    if (error.code === '22007' || error.code === '22008') { // PostgreSQL date/time errors
        return res.status(400).json({
            error: 'Formato data o ora non valido'
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
        error: 'Errore interno del servizio prenotazioni',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
    });
};

module.exports = { errorHandler };