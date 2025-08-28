# VinBooking Email Service - Implementazione Completa

## 🏗️ Panoramica Architetturale

Il **Email Service** è un microservizio specializzato per l'invio di email automatiche nel sistema VinBooking. Gestisce tutte le comunicazioni email tra la piattaforma, i clienti e i produttori di vino.

### 🎯 Funzionalità Principali

- **Email di Conferma Prenotazione** con QR code embedded
- **Notifiche ai Produttori** per nuove prenotazioni  
- **Conferme di Pagamento** per i clienti
- **Template HTML Responsivi** con branding VinBooking
- **Generazione QR Code** multipla (PNG, SVG, Buffer)
- **Validazione Input** con Joi schemas
- **Supporto SMTP** configurabile (Gmail, Outlook, custom)
- **Fallback Development** per testing senza SMTP

## 📁 Struttura del Progetto

```
services/email-service/
├── package.json                              # Dependencies e scripts
├── server.js                                 # Server Express principale
├── Dockerfile & Containerfile                # Container configs
├── .env.example                              # Template configurazione
├── src/
│   ├── controllers/
│   │   └── emailController.js                # Logic email sending
│   ├── routes/
│   │   └── emailRoutes.js                    # API endpoints
│   ├── middleware/
│   │   └── errorHandler.js                  # Error management
│   ├── utils/
│   │   ├── qrGenerator.js                   # QR code utilities
│   │   └── validation.js                    # Input validation
│   └── templates/
│       ├── booking-confirmation.hbs         # Template conferma prenotazione
│       ├── booking-notification.hbs         # Template notifica produttore
│       └── payment-confirmation.hbs         # Template conferma pagamento
```

## 🔧 Configurazione

### Environment Variables (.env)

```env
PORT=3006
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@vinbooking.com
FROM_NAME=VinBooking Platform
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
NODE_ENV=development
QR_CODE_SIZE=200
EMAIL_TIMEOUT=30000
```

### Gmail Configuration

Per Gmail, utilizzare **App Password** (non la password normale):

1. Abilitare 2FA su Gmail
2. Generare App Password in Security Settings
3. Utilizzare la App Password nell'env `SMTP_PASS`

### Dependencies

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5", 
    "helmet": "^7.0.0",
    "dotenv": "^16.3.1",
    "nodemailer": "^6.9.7",
    "handlebars": "^4.7.8",
    "qrcode": "^1.5.3",
    "joi": "^17.11.0",
    "moment": "^2.29.4"
  }
}
```

## 🚀 API Endpoints

### 1. Email Conferma Prenotazione
```bash
POST /api/email/booking-confirmation
Content-Type: application/json

{
  "to": "cliente@email.com",
  "booking": {
    "id": "booking-uuid",
    "package_name": "Degustazione Premium",
    "producer_name": "Cantina Rossi", 
    "booking_date": "2025-09-15",
    "booking_time": "15:00",
    "participants": 2,
    "total_price": 80.00,
    "qr_code": "VINBOOKING-12345"
  },
  "customer": {
    "name": "Mario",
    "surname": "Rossi",
    "email": "mario.rossi@email.com",
    "phone": "123456789"
  }
}
```

### 2. Notifica Nuova Prenotazione 
```bash
POST /api/email/booking-notification
Content-Type: application/json

{
  "to": "produttore@cantina.it",
  "booking": {
    "id": "booking-uuid",
    "package_name": "Degustazione Premium",
    "booking_date": "2025-09-15", 
    "booking_time": "15:00",
    "participants": 2,
    "total_price": 80.00
  },
  "customer": {
    "name": "Mario",
    "surname": "Rossi",
    "email": "mario.rossi@email.com",
    "phone": "123456789"
  }
}
```

### 3. Conferma Pagamento
```bash
POST /api/email/payment-confirmation
Content-Type: application/json

{
  "to": "cliente@email.com",
  "booking": {
    "id": "booking-uuid", 
    "package_name": "Degustazione Premium",
    "booking_date": "2025-09-15",
    "booking_time": "15:00", 
    "total_price": 80.00
  },
  "customer": {
    "name": "Mario",
    "surname": "Rossi"
  }
}
```

### 4. Email Personalizzata
```bash
POST /api/email/send-custom
Content-Type: application/json

{
  "to": "destinatario@email.com",
  "subject": "Oggetto email",
  "htmlContent": "<h1>Contenuto HTML</h1>",
  "attachments": []
}
```

### 5. Test Configurazione
```bash
GET /api/email/test-configuration?sendTest=true
```

## 💻 Codice Implementazione

### Server Principal (server.js)

```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const emailRoutes = require('./src/routes/emailRoutes');
const { errorHandler } = require('./src/middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3006;

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/email', emailRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'UP', 
        service: 'email-service', 
        timestamp: new Date(),
        smtp: {
            configured: !!process.env.SMTP_HOST,
            host: process.env.SMTP_HOST
        }
    });
});

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
    console.log(`Email Service running on port ${PORT}`);
    console.log(`SMTP configured: ${process.env.SMTP_HOST ? 'Yes' : 'No'}`);
});

module.exports = app;
```

### Email Controller (emailController.js)

Il controller principale gestisce:

#### Inizializzazione SMTP Transporter
```javascript
createTransporter() {
    if (!process.env.SMTP_HOST) {
        console.warn('SMTP not configured - emails will be logged only');
        return null;
    }

    return nodemailer.createTransporter({
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
```

#### Caricamento Template Dinamico
```javascript
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
```

#### Invio Email con QR Code
```javascript
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
```

### QR Code Generator (qrGenerator.js)

```javascript
const QRCode = require('qrcode');

const generateQRCodeImage = async (data, options = {}) => {
    try {
        const qrOptions = {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            quality: 0.92,
            margin: 1,
            width: parseInt(process.env.QR_CODE_SIZE) || 200,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            },
            ...options
        };

        const qrCodeDataURL = await QRCode.toDataURL(data, qrOptions);
        return qrCodeDataURL;
    } catch (error) {
        console.error('QR Code generation error:', error);
        throw new Error('Errore nella generazione del QR Code');
    }
};

const generateQRCodeBuffer = async (data, options = {}) => {
    try {
        const qrOptions = {
            errorCorrectionLevel: 'M',
            width: parseInt(process.env.QR_CODE_SIZE) || 200,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            },
            ...options
        };

        const buffer = await QRCode.toBuffer(data, qrOptions);
        return buffer;
    } catch (error) {
        console.error('QR Code buffer generation error:', error);
        throw new Error('Errore nella generazione del buffer QR Code');
    }
};

module.exports = { 
    generateQRCodeImage,
    generateQRCodeBuffer,
    generateQRCodeSVG
};
```

### Input Validation (validation.js)

```javascript
const Joi = require('joi');

const validateBookingConfirmation = (data) => {
    const schema = Joi.object({
        to: Joi.string().email().required(),
        booking: Joi.object({
            id: Joi.string().required(),
            package_name: Joi.string().required(),
            producer_name: Joi.string().required(),
            booking_date: Joi.date().required(),
            booking_time: Joi.string().required(),
            participants: Joi.number().integer().min(1).required(),
            total_price: Joi.number().positive().required(),
            qr_code: Joi.string().required()
        }).required(),
        customer: Joi.object({
            name: Joi.string().required(),
            surname: Joi.string().required(),
            email: Joi.string().email().required(),
            phone: Joi.string().optional()
        }).required()
    });
    return schema.validate(data);
};

// ... altri schemi di validazione
```

## 🎨 Template HTML

### Template Conferma Prenotazione

Il template `booking-confirmation.hbs` include:

- **Header con branding VinBooking** 
- **Dettagli prenotazione** in formato tabellare
- **QR Code embedded** come attachment
- **Informazioni importanti** per il cliente
- **Design responsive** per mobile/desktop
- **Styling CSS inline** per compatibilità email

Caratteristiche visual:
- Colori corporate (#722F37 per VinBooking)
- Gradients e ombre per modernità
- Icone emoji per leggibilità  
- Layout a card responsive
- Typography ottimizzata per lettura

### Template Notifica Produttore  

Il template `booking-notification.hbs` include:

- **Alert box** per notifica immediata
- **Dati cliente completi** 
- **Dettagli prenotazione**
- **Call-to-action** per dashboard
- **Prossimi passi** suggeriti
- **Colori verdi** (#28a745) per notifiche positive

### Template Conferma Pagamento

Il template `payment-confirmation.hbs` include:

- **Status box pagamento** con importo prominente
- **Dettagli transazione**
- **Conferma prenotazione** 
- **Note sicurezza** per rassicurazione
- **Next steps** per il cliente
- **Colori blu-teal** (#17a2b8) per pagamenti

## 🔧 Advanced Features

### Fallback Templates

Il sistema include template di fallback hardcoded per garantire funzionamento anche se i file .hbs non sono disponibili:

```javascript
getFallbackTemplate(templateName) {
    const fallbackTemplates = {
        'booking-confirmation': handlebars.compile(`
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #722F37;">Conferma Prenotazione VinBooking</h2>
                <p>Gentile {{customerName}},</p>
                <p>La sua prenotazione è stata confermata:</p>
                <!-- ... contenuto semplificato ... -->
            </div>
        `),
        // ... altri template
    };
    return fallbackTemplates[templateName] || handlebars.compile('<p>Email template not available</p>');
}
```

### Error Handling Specifico

```javascript
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
```

### Health Check Avanzato

```javascript
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
                    html: `<div>Test email successful at ${new Date().toISOString()}</div>`
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
```

## 🚀 Deployment & Usage

### Avvio con Docker

```bash
# Build image
docker build -t vinbooking-email-service .

# Run container
docker run -d \
  --name email-service \
  -p 3006:3006 \
  -e SMTP_HOST=smtp.gmail.com \
  -e SMTP_USER=your-email@gmail.com \
  -e SMTP_PASS=your-app-password \
  vinbooking-email-service
```

### Avvio con Node.js

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Editare .env con le proprie configurazioni

# Start development
npm run dev

# Start production
npm start
```

### Testing

```bash
# Test health check
curl http://localhost:3006/health

# Test SMTP configuration
curl http://localhost:3006/api/email/test-configuration?sendTest=true

# Test booking confirmation email
curl -X POST http://localhost:3006/api/email/booking-confirmation \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "booking": {
      "id": "test-123",
      "package_name": "Degustazione Test",
      "producer_name": "Cantina Test",
      "booking_date": "2025-09-15",
      "booking_time": "15:00",
      "participants": 2,
      "total_price": 50.00,
      "qr_code": "TEST-QR-123"
    },
    "customer": {
      "name": "Mario",
      "surname": "Test",
      "email": "mario@test.com"
    }
  }'
```

## 🔒 Sicurezza & Best Practices

### Configurazioni Sicure

1. **App Password Gmail**: Mai usare password normale
2. **Environment Variables**: Secrets mai in repository
3. **Rate Limiting**: Implementato a livello API Gateway
4. **Input Validation**: Ogni endpoint validato con Joi
5. **Error Handling**: Non esporre dettagli interni in production

### Performance

1. **Template Caching**: Template compilati all'avvio
2. **Connection Pooling**: Transporter SMTP riutilizzato
3. **Async Operations**: Tutte le operazioni I/O asincrone
4. **QR Code Caching**: Possibilità di cache per QR ricorrenti

### Monitoring

1. **Health Check**: Endpoint dedicato con verifica SMTP
2. **Logging**: Structured logging per debugging
3. **Error Tracking**: Categorizzazione errori specifici
4. **Metrics**: Ready per integrazione con Prometheus

## 📈 Estensioni Future

### Funzionalità Aggiuntive

1. **Template Editor**: Dashboard per editare template via UI
2. **Email Analytics**: Tracking aperture/click
3. **Bulk Sending**: Invio massivo per newsletter
4. **Multi-language**: Template in più lingue
5. **Calendar Integration**: ICS attachment per prenotazioni
6. **PDF Attachments**: Voucher/ricevute PDF
7. **SMS Integration**: Notifiche SMS oltre email

### Integrazione

Il servizio si integra perfettamente con gli altri microservizi VinBooking:

- **Booking Service**: Trigger email dopo prenotazione
- **Payment Service**: Trigger email dopo pagamento
- **Producer Service**: Notifiche personalizzate per produttore
- **API Gateway**: Routing e rate limiting centralizzato

---

**VinBooking Email Service** è un componente mission-critical per l'esperienza utente, garantendo comunicazioni tempestive, professionali e affidabili in tutto il processo di prenotazione delle degustazioni.