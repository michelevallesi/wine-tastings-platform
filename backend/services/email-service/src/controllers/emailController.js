const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const moment = require('moment');
const { generateQRCodeImage } = require('../utils/qrGenerator');
const { validateBookingConfirmation, validateBookingNotification, validatePaymentConfirmation } = require('../utils/validation');

class EmailController {
    constructor() {
        this.transporter = this.createTransporter();
        this.templates = {};
        this.loadTemplates();
    }

    createTransporter() {
        if (!process.env.SMTP_HOST) {
            console.warn('SMTP not configured - emails will be logged only');
            return null;
        }

        return nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            },
            timeout: parseInt(process.env.EMAIL_TIMEOUT) || 30000
        });
    }

    async loadTemplates() {
        try {
            const templatesDir = path.join(__dirname, '../templates');
            const templateFiles = ['booking-confirmation.hbs', 'booking-notification.hbs', 'payment-confirmation.hbs'];

            for (const file of templateFiles) {
                try {
                    const templatePath = path.join(templatesDir, file);
                    const templateSource = await fs.readFile(templatePath, 'utf8');
                    const templateName = file.replace('.hbs', '');
                    this.templates[templateName] = handlebars.compile(templateSource);
                } catch (error) {
                    console.warn(`Template ${file} not found, using fallback`);
                    this.templates[file.replace('.hbs', '')] = this.getFallbackTemplate(file.replace('.hbs', ''));
                }
            }
        } catch (error) {
            console.error('Error loading templates:', error);
        }
    }

    getFallbackTemplate(templateName) {
        const fallbackTemplates = {
            'booking-confirmation': handlebars.compile(`
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #722F37;">Conferma Prenotazione VinBooking</h2>
                    <p>Gentile {{customerName}},</p>
                    <p>La sua prenotazione è stata confermata:</p>
                    <ul>
                        <li><strong>ID:</strong> {{bookingId}}</li>
                        <li><strong>Pacchetto:</strong> {{packageName}}</li>
                        <li><strong>Produttore:</strong> {{producerName}}</li>
                        <li><strong>Data:</strong> {{bookingDate}}</li>
                        <li><strong>Orario:</strong> {{bookingTime}}</li>
                        <li><strong>Partecipanti:</strong> {{participants}}</li>
                        <li><strong>Totale:</strong> €{{totalPrice}}</li>
                    </ul>
                    <p><strong>Codice QR:</strong> {{qrCode}}</p>
                    <p>Grazie per aver scelto VinBooking!</p>
                </div>
            `),
            'booking-notification': handlebars.compile(`
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #722F37;">Nuova Prenotazione - VinBooking</h2>
                    <p>È stata ricevuta una nuova prenotazione:</p>
                    <ul>
                        <li><strong>ID:</strong> {{bookingId}}</li>
                        <li><strong>Pacchetto:</strong> {{packageName}}</li>
                        <li><strong>Cliente:</strong> {{customerName}}</li>
                        <li><strong>Email:</strong> {{customerEmail}}</li>
                        <li><strong>Telefono:</strong> {{customerPhone}}</li>
                        <li><strong>Data:</strong> {{bookingDate}}</li>
                        <li><strong>Orario:</strong> {{bookingTime}}</li>
                        <li><strong>Partecipanti:</strong> {{participants}}</li>
                        <li><strong>Totale:</strong> €{{totalPrice}}</li>
                    </ul>
                    <p>Accedi al dashboard per gestire la prenotazione.</p>
                </div>
            `),
            'payment-confirmation': handlebars.compile(`
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #722F37;">Pagamento Confermato - VinBooking</h2>
                    <p>Gentile {{customerName}},</p>
                    <p>Il pagamento per la sua prenotazione è stato confermato:</p>
                    <ul>
                        <li><strong>ID Prenotazione:</strong> {{bookingId}}</li>
                        <li><strong>Pacchetto:</strong> {{packageName}}</li>
                        <li><strong>Importo:</strong> €{{totalPrice}}</li>
                        <li><strong>Data:</strong> {{bookingDate}}</li>
                        <li><strong>Orario:</strong> {{bookingTime}}</li>
                    </ul>
                    <p>La sua prenotazione è ora confermata. Grazie!</p>
                </div>
            `)
        };
        return fallbackTemplates[templateName] || handlebars.compile('<p>Email template not available</p>');
    }

    async sendBookingConfirmation(req, res) {
        try {
            const { error } = validateBookingConfirmation(req.body);
            if (error) {
                return res.status(400).json({ error: error.details[0].message });
            }

            const { to, booking, customer } = req.body;

            // Generate QR code image
            let qrCodeImage = null;
            try {
                qrCodeImage = await generateQRCodeImage(booking.qr_code);
            } catch (qrError) {
                console.warn('QR Code generation failed:', qrError.message);
            }

            // Prepare template data
            const templateData = {
                customerName: `${customer.name} ${customer.surname}`,
                bookingId: booking.id,
                packageName: booking.package_name,
                producerName: booking.producer_name,
                bookingDate: moment(booking.booking_date).format('DD/MM/YYYY'),
                bookingTime: booking.booking_time,
                participants: booking.participants,
                totalPrice: parseFloat(booking.total_price).toFixed(2),
                qrCode: booking.qr_code,
                currentYear: moment().format('YYYY')
            };

            // Compile template
            const template = this.templates['booking-confirmation'];
            const html = template(templateData);

            // Prepare mail options
            const mailOptions = {
                from: `"${process.env.FROM_NAME || 'VinBooking'}" <${process.env.FROM_EMAIL}>`,
                to: to,
                subject: `Conferma Prenotazione - ${booking.package_name}`,
                html: html,
                attachments: []
            };

            // Add QR code attachment if generated
            if (qrCodeImage) {
                mailOptions.attachments.push({
                    filename: 'qr-code.png',
                    content: qrCodeImage.split(',')[1],
                    encoding: 'base64',
                    cid: 'qrcode'
                });
            }

            // Send email or log if SMTP not configured
            if (this.transporter) {
                await this.transporter.sendMail(mailOptions);
                console.log(`Booking confirmation email sent to ${to}`);
            } else {
                console.log('EMAIL SIMULATION - Booking confirmation:', {
                    to,
                    subject: mailOptions.subject,
                    bookingId: booking.id,
                    qrCode: booking.qr_code
                });
            }

            res.json({ 
                message: 'Email di conferma prenotazione inviata con successo',
                bookingId: booking.id,
                sentTo: to
            });
        } catch (error) {
            console.error('Send booking confirmation error:', error);
            res.status(500).json({ error: 'Errore nell\'invio dell\'email di conferma' });
        }
    }

    async sendBookingNotification(req, res) {
        try {
            const { error } = validateBookingNotification(req.body);
            if (error) {
                return res.status(400).json({ error: error.details[0].message });
            }

            const { to, booking, customer } = req.body;

            // Prepare template data
            const templateData = {
                bookingId: booking.id,
                packageName: booking.package_name,
                customerName: `${customer.name} ${customer.surname}`,
                customerEmail: customer.email,
                customerPhone: customer.phone || 'Non fornito',
                bookingDate: moment(booking.booking_date).format('DD/MM/YYYY'),
                bookingTime: booking.booking_time,
                participants: booking.participants,
                totalPrice: parseFloat(booking.total_price).toFixed(2),
                currentYear: moment().format('YYYY')
            };

            // Compile template
            const template = this.templates['booking-notification'];
            const html = template(templateData);

            const mailOptions = {
                from: `"${process.env.FROM_NAME || 'VinBooking'}" <${process.env.FROM_EMAIL}>`,
                to: to,
                subject: `Nuova Prenotazione - ${booking.package_name}`,
                html: html
            };

            // Send email or log
            if (this.transporter) {
                await this.transporter.sendMail(mailOptions);
                console.log(`Booking notification email sent to ${to}`);
            } else {
                console.log('EMAIL SIMULATION - Booking notification:', {
                    to,
                    subject: mailOptions.subject,
                    bookingId: booking.id,
                    customer: customer.email
                });
            }

            res.json({ 
                message: 'Email di notifica prenotazione inviata con successo',
                bookingId: booking.id,
                sentTo: to
            });
        } catch (error) {
            console.error('Send booking notification error:', error);
            res.status(500).json({ error: 'Errore nell\'invio dell\'email di notifica' });
        }
    }

    async sendPaymentConfirmation(req, res) {
        try {
            const { error } = validatePaymentConfirmation(req.body);
            if (error) {
                return res.status(400).json({ error: error.details[0].message });
            }

            const { to, booking, customer } = req.body;

            // Prepare template data
            const templateData = {
                customerName: `${customer.name} ${customer.surname}`,
                bookingId: booking.id,
                packageName: booking.package_name,
                totalPrice: parseFloat(booking.total_price).toFixed(2),
                bookingDate: moment(booking.booking_date).format('DD/MM/YYYY'),
                bookingTime: booking.booking_time,
                currentYear: moment().format('YYYY')
            };

            // Compile template
            const template = this.templates['payment-confirmation'];
            const html = template(templateData);

            const mailOptions = {
                from: `"${process.env.FROM_NAME || 'VinBooking'}" <${process.env.FROM_EMAIL}>`,
                to: to,
                subject: `Pagamento Confermato - ${booking.package_name}`,
                html: html
            };

            // Send email or log
            if (this.transporter) {
                await this.transporter.sendMail(mailOptions);
                console.log(`Payment confirmation email sent to ${to}`);
            } else {
                console.log('EMAIL SIMULATION - Payment confirmation:', {
                    to,
                    subject: mailOptions.subject,
                    bookingId: booking.id,
                    amount: booking.total_price
                });
            }

            res.json({ 
                message: 'Email di conferma pagamento inviata con successo',
                bookingId: booking.id,
                sentTo: to
            });
        } catch (error) {
            console.error('Send payment confirmation error:', error);
            res.status(500).json({ error: 'Errore nell\'invio dell\'email di conferma pagamento' });
        }
    }

    async sendCustomEmail(req, res) {
        try {
            const { to, subject, htmlContent, attachments = [] } = req.body;

            if (!to || !subject || !htmlContent) {
                return res.status(400).json({ 
                    error: 'Parametri mancanti: to, subject, htmlContent sono richiesti' 
                });
            }

            const mailOptions = {
                from: `"${process.env.FROM_NAME || 'VinBooking'}" <${process.env.FROM_EMAIL}>`,
                to,
                subject,
                html: htmlContent,
                attachments: attachments
            };

            if (this.transporter) {
                await this.transporter.sendMail(mailOptions);
                console.log(`Custom email sent to ${to}`);
            } else {
                console.log('EMAIL SIMULATION - Custom email:', {
                    to,
                    subject,
                    hasAttachments: attachments.length > 0
                });
            }

            res.json({ 
                message: 'Email personalizzata inviata con successo',
                sentTo: to
            });
        } catch (error) {
            console.error('Send custom email error:', error);
            res.status(500).json({ error: 'Errore nell\'invio dell\'email personalizzata' });
        }
    }

    async testEmailConfiguration(req, res) {
        try {
            if (!this.transporter) {
                return res.status(400).json({ 
                    error: 'SMTP non configurato',
                    configured: false
                });
            }

            // Test SMTP connection
            await this.transporter.verify();

            // Send test email if requested
            const { sendTest } = req.query;
            if (sendTest === 'true') {
                const testEmail = process.env.SMTP_USER;
                if (testEmail) {
                    await this.transporter.sendMail({
                        from: `"${process.env.FROM_NAME || 'VinBooking'}" <${process.env.FROM_EMAIL}>`,
                        to: testEmail,
                        subject: 'Test Email - VinBooking Email Service',
                        html: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                <h2 style="color: #722F37;">Test Email Successful!</h2>
                                <p>Il servizio email VinBooking è configurato correttamente.</p>
                                <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
                                <p><strong>Service:</strong> Email Service</p>
                            </div>
                        `
                    });
                }
            }

            res.json({
                message: 'Configurazione email testata con successo',
                configured: true,
                smtp: {
                    host: process.env.SMTP_HOST,
                    port: process.env.SMTP_PORT,
                    secure: process.env.SMTP_SECURE,
                    user: process.env.SMTP_USER
                },
                testEmailSent: sendTest === 'true'
            });
        } catch (error) {
            console.error('Email configuration test error:', error);
            res.status(500).json({ 
                error: 'Errore nella configurazione email',
                details: error.message,
                configured: false
            });
        }
    }
}

module.exports = new EmailController();