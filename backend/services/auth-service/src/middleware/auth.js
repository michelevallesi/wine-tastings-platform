const jwt = require('jsonwebtoken');
const db = require('../utils/database');

const authenticateProducer = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ error: 'Token di autorizzazione mancante' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check if session exists and is valid
        const sessionResult = await db.query(
            'SELECT producer_id FROM user_sessions WHERE token = $1 AND expires_at > NOW()',
            [token]
        );

        if (sessionResult.rows.length === 0) {
            return res.status(401).json({ error: 'Sessione scaduta' });
        }

        // Get producer info
        const producerResult = await db.query(
            'SELECT id, name, email, is_active FROM producers WHERE id = $1',
            [decoded.id]
        );

        if (producerResult.rows.length === 0 || !producerResult.rows[0].is_active) {
            return res.status(401).json({ error: 'Account non valido' });
        }

        req.producer = producerResult.rows[0];
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(401).json({ error: 'Token non valido' });
    }
};

module.exports = { authenticateProducer };
