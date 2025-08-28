const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../utils/database');
const { validateLogin, validateRegister } = require('../utils/validation');

class AuthController {
    async login(req, res) {
        try {
            const { error } = validateLogin(req.body);
            if (error) {
                return res.status(400).json({ error: error.details[0].message });
            }

            const { email, password } = req.body;

            // Find producer
            const result = await db.query(
                'SELECT id, name, email, password_hash, is_active FROM producers WHERE email = $1',
                [email]
            );

            if (result.rows.length === 0) {
                return res.status(401).json({ error: 'Credenziali non valide' });
            }

            const producer = result.rows[0];

            if (!producer.is_active) {
                return res.status(401).json({ error: 'Account disattivato' });
            }

            // Verify password
            const isValidPassword = await bcrypt.compare(password, producer.password_hash);
            if (!isValidPassword) {
                return res.status(401).json({ error: 'Credenziali non valide' });
            }

            // Generate JWT token
            const token = jwt.sign(
                { 
                    id: producer.id, 
                    email: producer.email,
                    type: 'producer' 
                },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
            );

            // Save session
            await db.query(
                'INSERT INTO user_sessions (producer_id, token, expires_at) VALUES ($1, $2, $3)',
                [producer.id, token, new Date(Date.now() + 24 * 60 * 60 * 1000)] // 24 hours
            );

            res.json({
                token,
                producer: {
                    id: producer.id,
                    name: producer.name,
                    email: producer.email
                }
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    }

    async register(req, res) {
        try {
            const { error } = validateRegister(req.body);
            if (error) {
                return res.status(400).json({ error: error.details[0].message });
            }

            const { name, email, password, address, phone, description } = req.body;

            // Check if producer already exists
            const existingProducer = await db.query(
                'SELECT id FROM producers WHERE email = $1',
                [email]
            );

            if (existingProducer.rows.length > 0) {
                return res.status(409).json({ error: 'Email già registrata' });
            }

            // Hash password
            const saltRounds = 12;
            const password_hash = await bcrypt.hash(password, saltRounds);

            // Insert new producer
            const result = await db.query(
                `INSERT INTO producers (name, email, password_hash, address, phone, description) 
                 VALUES ($1, $2, $3, $4, $5, $6) 
                 RETURNING id, name, email`,
                [name, email, password_hash, address, phone, description]
            );

            const producer = result.rows[0];

            // Generate JWT token
            const token = jwt.sign(
                { 
                    id: producer.id, 
                    email: producer.email,
                    type: 'producer' 
                },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
            );

            res.status(201).json({
                message: 'Registrazione completata con successo',
                token,
                producer: {
                    id: producer.id,
                    name: producer.name,
                    email: producer.email
                }
            });
        } catch (error) {
            console.error('Registration error:', error);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    }

    async logout(req, res) {
        try {
            const token = req.headers.authorization?.replace('Bearer ', '');

            if (token) {
                await db.query('DELETE FROM user_sessions WHERE token = $1', [token]);
            }

            res.json({ message: 'Logout completato con successo' });
        } catch (error) {
            console.error('Logout error:', error);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    }

    async verifyToken(req, res) {
        try {
            const token = req.headers.authorization?.replace('Bearer ', '');

            if (!token) {
                return res.status(401).json({ error: 'Token mancante' });
            }

            // Verify JWT
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

            res.json({
                valid: true,
                producer: producerResult.rows[0]
            });
        } catch (error) {
            console.error('Token verification error:', error);
            res.status(401).json({ error: 'Token non valido' });
        }
    }
}

module.exports = new AuthController();
