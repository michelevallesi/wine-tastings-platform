const axios = require('axios');

const authenticateProducer = async (req, res, next) => {
    try {
        const token = req.headers.authorization;

        if (!token) {
            return res.status(401).json({ error: 'Token di autorizzazione mancante' });
        }

        // Verify token with auth service
        const response = await axios.get(`${process.env.AUTH_SERVICE_URL}/api/auth/verify`, {
            headers: { Authorization: token },
            timeout: 10000
        });

        if (!response.data.valid) {
            return res.status(401).json({ error: 'Token non valido' });
        }

        req.producer = response.data.producer;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            return res.status(503).json({ 
                error: 'Servizio di autenticazione temporaneamente non disponibile' 
            });
        }

        if (error.response && error.response.status === 401) {
            return res.status(401).json({ error: 'Token scaduto o non valido' });
        }

        res.status(500).json({ error: 'Errore di autenticazione' });
    }
};

module.exports = { authenticateProducer };