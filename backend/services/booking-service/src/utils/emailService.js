const axios = require('axios');

/**
 * Send email notifications through the email service
 */
const sendEmailNotifications = async (notificationData) => {
    const emailServiceUrl = process.env.EMAIL_SERVICE_URL;
    
    if (!emailServiceUrl) {
        console.warn('EMAIL_SERVICE_URL not configured - skipping email notifications');
        return;
    }
    
    try {
        const { type, booking, customer, producer_email, reason } = notificationData;
        
        switch (type) {
            case 'booking_created':
                await sendBookingCreatedNotifications(booking, customer, producer_email);
                break;
                
            case 'booking_confirmed':
                await sendBookingConfirmation(booking, customer);
                break;
                
            case 'booking_cancelled':
                await sendBookingCancellation(booking, customer, reason);
                break;
                
            case 'payment_confirmed':
                await sendPaymentConfirmation(booking, customer);
                break;
                
            default:
                console.warn(`Unknown notification type: ${type}`);
        }
    } catch (error) {
        console.error('Error sending email notifications:', error);
        // Don't throw error to avoid blocking booking operations
    }
};

/**
 * Send notifications when a new booking is created
 */
const sendBookingCreatedNotifications = async (booking, customer, producer_email) => {
    const emailServiceUrl = process.env.EMAIL_SERVICE_URL;
    
    // Send confirmation to customer
    try {
        await axios.post(`${emailServiceUrl}/api/email/booking-confirmation`, {
            to: customer.email,
            booking: {
                id: booking.id,
                package_name: booking.package_name,
                producer_name: booking.producer_name,
                booking_date: booking.booking_date,
                booking_time: booking.booking_time,
                participants: booking.participants,
                total_price: booking.total_price,
                qr_code: booking.qr_code
            },
            customer: {
                name: customer.name,
                surname: customer.surname,
                email: customer.email,
                phone: customer.phone
            }
        }, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`Booking confirmation email sent to customer: ${customer.email}`);
    } catch (error) {
        console.error('Error sending booking confirmation to customer:', error.message);
    }
    
    // Send notification to producer
    if (producer_email) {
        try {
            await axios.post(`${emailServiceUrl}/api/email/booking-notification`, {
                to: producer_email,
                booking: {
                    id: booking.id,
                    package_name: booking.package_name,
                    booking_date: booking.booking_date,
                    booking_time: booking.booking_time,
                    participants: booking.participants,
                    total_price: booking.total_price
                },
                customer: {
                    name: customer.name,
                    surname: customer.surname,
                    email: customer.email,
                    phone: customer.phone
                }
            }, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            console.log(`Booking notification email sent to producer: ${producer_email}`);
        } catch (error) {
            console.error('Error sending booking notification to producer:', error.message);
        }
    }
};

/**
 * Send booking confirmation email
 */
const sendBookingConfirmation = async (booking, customer) => {
    const emailServiceUrl = process.env.EMAIL_SERVICE_URL;
    
    try {
        await axios.post(`${emailServiceUrl}/api/email/booking-confirmation`, {
            to: customer.email,
            booking: {
                id: booking.id,
                package_name: booking.package_name,
                producer_name: booking.producer_name || 'VinBooking',
                booking_date: booking.booking_date,
                booking_time: booking.booking_time,
                participants: booking.participants,
                total_price: booking.total_price,
                qr_code: booking.qr_code
            },
            customer: {
                name: customer.name,
                surname: customer.surname,
                email: customer.email,
                phone: customer.phone
            }
        }, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`Booking confirmation email sent: ${customer.email}`);
    } catch (error) {
        console.error('Error sending booking confirmation:', error.message);
        throw new Error('Errore invio email conferma');
    }
};

/**
 * Send payment confirmation email
 */
const sendPaymentConfirmation = async (booking, customer) => {
    const emailServiceUrl = process.env.EMAIL_SERVICE_URL;
    
    try {
        await axios.post(`${emailServiceUrl}/api/email/payment-confirmation`, {
            to: customer.email,
            booking: {
                id: booking.id,
                package_name: booking.package_name,
                booking_date: booking.booking_date,
                booking_time: booking.booking_time,
                total_price: booking.total_price
            },
            customer: {
                name: customer.name,
                surname: customer.surname
            }
        }, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`Payment confirmation email sent: ${customer.email}`);
    } catch (error) {
        console.error('Error sending payment confirmation:', error.message);
        throw new Error('Errore invio email conferma pagamento');
    }
};

/**
 * Send booking cancellation email
 */
const sendBookingCancellation = async (booking, customer, reason) => {
    const emailServiceUrl = process.env.EMAIL_SERVICE_URL;
    
    try {
        await axios.post(`${emailServiceUrl}/api/email/send-custom`, {
            to: customer.email,
            subject: `Cancellazione Prenotazione - ${booking.package_name}`,
            htmlContent: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #dc3545;">Prenotazione Cancellata - VinBooking</h2>
                    
                    <p>Gentile ${customer.name} ${customer.surname},</p>
                    
                    <p>La informiamo che la sua prenotazione è stata cancellata:</p>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-left: 4px solid #dc3545; margin: 20px 0;">
                        <h3>Dettagli Prenotazione Cancellata</h3>
                        <ul style="list-style: none; padding: 0;">
                            <li><strong>ID Prenotazione:</strong> ${booking.id}</li>
                            <li><strong>Pacchetto:</strong> ${booking.package_name}</li>
                            <li><strong>Data:</strong> ${booking.booking_date}</li>
                            <li><strong>Orario:</strong> ${booking.booking_time}</li>
                            <li><strong>Partecipanti:</strong> ${booking.participants}</li>
                            <li><strong>Importo:</strong> €${booking.total_price}</li>
                        </ul>
                    </div>
                    
                    ${reason ? `<div style="background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
                        <h4>Motivo della Cancellazione:</h4>
                        <p>${reason}</p>
                    </div>` : ''}
                    
                    <p>Se ha effettuato un pagamento, verrà rimborsato entro 3-5 giorni lavorativi.</p>
                    
                    <p>Per qualsiasi domanda, può contattare il nostro servizio clienti.</p>
                    
                    <p>Cordiali saluti,<br>Il Team VinBooking</p>
                </div>
            `
        }, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`Booking cancellation email sent: ${customer.email}`);
    } catch (error) {
        console.error('Error sending booking cancellation:', error.message);
        throw new Error('Errore invio email cancellazione');
    }
};

/**
 * Send reminder email for upcoming bookings
 */
const sendBookingReminder = async (booking, customer) => {
    const emailServiceUrl = process.env.EMAIL_SERVICE_URL;
    
    try {
        await axios.post(`${emailServiceUrl}/api/email/send-custom`, {
            to: customer.email,
            subject: `Promemoria Prenotazione - ${booking.package_name}`,
            htmlContent: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #722F37;">Promemoria Prenotazione - VinBooking</h2>
                    
                    <p>Gentile ${customer.name} ${customer.surname},</p>
                    
                    <p>Le ricordiamo che ha una prenotazione per domani:</p>
                    
                    <div style="background: #e8f5e8; padding: 20px; border-left: 4px solid #28a745; margin: 20px 0;">
                        <h3>Dettagli Prenotazione</h3>
                        <ul style="list-style: none; padding: 0;">
                            <li><strong>Pacchetto:</strong> ${booking.package_name}</li>
                            <li><strong>Data:</strong> ${booking.booking_date}</li>
                            <li><strong>Orario:</strong> ${booking.booking_time}</li>
                            <li><strong>Partecipanti:</strong> ${booking.participants}</li>
                            <li><strong>Codice QR:</strong> ${booking.qr_code}</li>
                        </ul>
                    </div>
                    
                    <div style="background: #d1ecf1; padding: 15px; border-left: 4px solid #17a2b8; margin: 20px 0;">
                        <h4>Ricorda di portare:</h4>
                        <ul>
                            <li>Questo QR code (stampato o sul telefono)</li>
                            <li>Un documento di identità valido</li>
                            <li>Arrivare 10 minuti prima dell'orario</li>
                        </ul>
                    </div>
                    
                    <p>Non vediamo l'ora di accogliervi!</p>
                    
                    <p>Cordiali saluti,<br>Il Team VinBooking</p>
                </div>
            `
        }, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`Booking reminder email sent: ${customer.email}`);
    } catch (error) {
        console.error('Error sending booking reminder:', error.message);
        throw new Error('Errore invio email promemoria');
    }
};

/**
 * Test email service connection
 */
const testEmailService = async () => {
    const emailServiceUrl = process.env.EMAIL_SERVICE_URL;
    
    if (!emailServiceUrl) {
        throw new Error('EMAIL_SERVICE_URL not configured');
    }
    
    try {
        const response = await axios.get(`${emailServiceUrl}/health`, {
            timeout: 5000
        });
        
        return {
            connected: true,
            status: response.data.status,
            timestamp: response.data.timestamp
        };
    } catch (error) {
        console.error('Email service connection test failed:', error.message);
        return {
            connected: false,
            error: error.message
        };
    }
};

/**
 * Send bulk email notifications (for batch operations)
 */
const sendBulkNotifications = async (notifications) => {
    const results = [];
    const batchSize = 5; // Process 5 emails at a time
    
    for (let i = 0; i < notifications.length; i += batchSize) {
        const batch = notifications.slice(i, i + batchSize);
        
        try {
            const batchPromises = batch.map(notification => 
                sendEmailNotifications(notification)
            );
            
            await Promise.allSettled(batchPromises);
            
            results.push({
                batch: Math.floor(i / batchSize) + 1,
                processed: batch.length,
                success: true
            });
            
            // Small delay between batches
            if (i + batchSize < notifications.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } catch (error) {
            console.error(`Error processing batch ${Math.floor(i / batchSize) + 1}:`, error);
            results.push({
                batch: Math.floor(i / batchSize) + 1,
                processed: batch.length,
                success: false,
                error: error.message
            });
        }
    }
    
    return results;
};

module.exports = {
    sendEmailNotifications,
    sendBookingCreatedNotifications,
    sendBookingConfirmation,
    sendPaymentConfirmation,
    sendBookingCancellation,
    sendBookingReminder,
    testEmailService,
    sendBulkNotifications
};