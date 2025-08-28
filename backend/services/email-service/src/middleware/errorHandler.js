const errorHandler = (error, req, res, next) => {
    console.error('Email Service Error:', error);

    if (error.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Dati email non validi',
            details: error.message
        });
    }

    if (error.code === 'EAUTH' || error.code === 'ECONNECTION') {
        return res.status(503).json({
            error: 'Errore di connessione al server email',
            details: 'Verificare configurazione SMTP'
        });
    }

    if (error.code === 'EMESSAGE') {
        return res.status(400).json({
            error: 'Errore nel formato del messaggio email',
            details: error.message
        });
    }

    res.status(500).json({
        error: 'Errore interno del servizio email',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
};

module.exports = { errorHandler };