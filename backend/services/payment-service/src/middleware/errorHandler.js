const errorHandler = (error, req, res, next) => {
    console.error('Payment Service Error:', {
        message: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        body: req.body,
        timestamp: new Date().toISOString()
    });

    if (error.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Dati di pagamento non validi',
            details: error.message
        });
    }

    // Stripe-specific errors
    if (error.type === 'StripeCardError') {
        return res.status(402).json({
            error: 'Carta di credito rifiutata',
            details: error.message,
            code: error.code
        });
    }

    if (error.type === 'StripeInvalidRequestError') {
        return res.status(400).json({
            error: 'Richiesta di pagamento non valida',
            details: error.message
        });
    }

    if (error.type === 'StripeAPIError') {
        return res.status(503).json({
            error: 'Servizio di pagamento temporaneamente non disponibile',
            details: 'Riprova tra qualche minuto'
        });
    }

    if (error.type === 'StripeConnectionError') {
        return res.status(503).json({
            error: 'Errore di connessione al servizio di pagamento'
        });
    }

    if (error.type === 'StripeAuthenticationError') {
        return res.status(500).json({
            error: 'Errore di configurazione del servizio di pagamento'
        });
    }

    // PayPal-specific errors
    if (error.httpStatusCode) {
        return res.status(error.httpStatusCode >= 500 ? 503 : 400).json({
            error: error.httpStatusCode >= 500 ? 
                'Servizio PayPal temporaneamente non disponibile' : 
                'Errore PayPal',
            details: error.message
        });
    }

    // Database errors
    if (error.code === '23505') { // PostgreSQL unique violation
        return res.status(409).json({
            error: 'Pagamento già esistente per questa prenotazione'
        });
    }

    if (error.code === '23503') { // PostgreSQL foreign key violation
        return res.status(400).json({
            error: 'Riferimento non valido - prenotazione non trovata'
        });
    }

    if (error.code === '23502') { // PostgreSQL not null violation
        return res.status(400).json({
            error: 'Campi obbligatori mancanti nel pagamento'
        });
    }

    if (error.code === '22003') { // PostgreSQL numeric value out of range
        return res.status(400).json({
            error: 'Importo pagamento non valido'
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
            error: 'Timeout nella connessione ai servizi di pagamento',
            details: 'La richiesta ha impiegato troppo tempo'
        });
    }

    // Rate limiting errors
    if (error.status === 429) {
        return res.status(429).json({
            error: 'Troppi tentativi di pagamento',
            details: 'Riprova tra qualche minuto'
        });
    }

    // Generic payment processing errors
    if (error.message && error.message.includes('payment')) {
        return res.status(402).json({
            error: 'Errore nel processamento del pagamento',
            details: 'Verifica i dati di pagamento e riprova'
        });
    }

    res.status(500).json({
        error: 'Errore interno del servizio pagamenti',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
    });
};

module.exports = { errorHandler };