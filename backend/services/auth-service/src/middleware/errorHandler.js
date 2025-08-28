const errorHandler = (error, req, res, next) => {
    console.error('Error:', error);

    if (error.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Dati non validi',
            details: error.message
        });
    }

    if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
            error: 'Token non valido'
        });
    }

    if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
            error: 'Token scaduto'
        });
    }

    res.status(500).json({
        error: 'Errore interno del server'
    });
};

module.exports = { errorHandler };
