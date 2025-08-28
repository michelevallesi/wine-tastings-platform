const paypal = require('paypal-rest-sdk');

let isConfigured = false;

const initializePayPal = () => {
    if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) {
        paypal.configure({
            'mode': process.env.PAYPAL_MODE || 'sandbox',
            'client_id': process.env.PAYPAL_CLIENT_ID,
            'client_secret': process.env.PAYPAL_CLIENT_SECRET
        });
        isConfigured = true;
        console.log('PayPal initialized successfully');
    } else {
        console.warn('PayPal not configured - credentials missing');
    }
};

const createPayment = async (paymentData) => {
    if (!isConfigured) {
        throw new Error('PayPal non configurato');
    }

    return new Promise((resolve, reject) => {
        const create_payment_json = {
            "intent": "sale",
            "payer": {
                "payment_method": "paypal"
            },
            "redirect_urls": {
                "return_url": paymentData.return_url,
                "cancel_url": paymentData.cancel_url
            },
            "transactions": [{
                "item_list": {
                    "items": [{
                        "name": paymentData.description,
                        "sku": `booking_${paymentData.booking_id}`,
                        "price": paymentData.amount.toFixed(2),
                        "currency": paymentData.currency,
                        "quantity": 1
                    }]
                },
                "amount": {
                    "currency": paymentData.currency,
                    "total": paymentData.amount.toFixed(2)
                },
                "description": paymentData.description
            }],
            "note_to_payer": "Grazie per la prenotazione su VinBooking!"
        };

        paypal.payment.create(create_payment_json, (error, payment) => {
            if (error) {
                console.error('PayPal payment creation error:', error);
                reject(error);
            } else {
                const approvalUrl = payment.links.find(link => link.rel === 'approval_url');
                resolve({
                    id: payment.id,
                    approval_url: approvalUrl ? approvalUrl.href : null,
                    payment
                });
            }
        });
    });
};

const executePayment = async (paymentId, payerId) => {
    if (!isConfigured) {
        throw new Error('PayPal non configurato');
    }

    return new Promise((resolve, reject) => {
        const execute_payment_json = {
            "payer_id": payerId
        };

        paypal.payment.execute(paymentId, execute_payment_json, (error, payment) => {
            if (error) {
                console.error('PayPal payment execution error:', error);
                reject(error);
            } else {
                resolve(payment);
            }
        });
    });
};

const processRefund = async (saleId, amount, currency, reason) => {
    if (!isConfigured) {
        throw new Error('PayPal non configurato');
    }

    return new Promise((resolve, reject) => {
        const refund_json = {
            "amount": {
                "total": amount.toFixed(2),
                "currency": currency
            },
            "reason": reason || "Rimborso richiesto dal cliente"
        };

        paypal.sale.refund(saleId, refund_json, (error, refund) => {
            if (error) {
                console.error('PayPal refund error:', error);
                reject(error);
            } else {
                resolve({
                    id: refund.id,
                    amount: parseFloat(refund.amount.total),
                    currency: refund.amount.currency,
                    status: refund.state,
                    reason: reason
                });
            }
        });
    });
};

const getPaymentDetails = async (paymentId) => {
    if (!isConfigured) {
        throw new Error('PayPal non configurato');
    }

    return new Promise((resolve, reject) => {
        paypal.payment.get(paymentId, (error, payment) => {
            if (error) {
                console.error('PayPal payment details error:', error);
                reject(error);
            } else {
                resolve(payment);
            }
        });
    });
};

const validateWebhook = async (headers, body, webhookId = null) => {
    if (!isConfigured) {
        throw new Error('PayPal non configurato');
    }

    const webhookIdToUse = webhookId || process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookIdToUse) {
        throw new Error('PayPal webhook ID non configurato');
    }

    return new Promise((resolve, reject) => {
        const requestBody = {
            "auth_algo": headers['paypal-auth-algo'],
            "cert_id": headers['paypal-cert-id'],
            "transmission_id": headers['paypal-transmission-id'],
            "transmission_sig": headers['paypal-transmission-sig'],
            "transmission_time": headers['paypal-transmission-time'],
            "webhook_id": webhookIdToUse,
            "webhook_event": body
        };

        paypal.notification.webhookEvent.verify(requestBody, (error, response) => {
            if (error) {
                console.error('PayPal webhook validation error:', error);
                resolve({ valid: false, error: error.message });
            } else {
                resolve({ valid: response.verification_status === 'SUCCESS' });
            }
        });
    });
};

const getSaleDetails = async (saleId) => {
    if (!isConfigured) {
        throw new Error('PayPal non configurato');
    }

    return new Promise((resolve, reject) => {
        paypal.sale.get(saleId, (error, sale) => {
            if (error) {
                console.error('PayPal sale details error:', error);
                reject(error);
            } else {
                resolve(sale);
            }
        });
    });
};

const createWebhook = async (url, eventTypes = []) => {
    if (!isConfigured) {
        throw new Error('PayPal non configurato');
    }

    const defaultEventTypes = [
        'PAYMENT.SALE.COMPLETED',
        'PAYMENT.SALE.DENIED',
        'PAYMENT.SALE.REFUNDED'
    ];

    const webhook_json = {
        "url": url,
        "event_types": (eventTypes.length > 0 ? eventTypes : defaultEventTypes).map(type => ({ name: type }))
    };

    return new Promise((resolve, reject) => {
        paypal.notification.webhook.create(webhook_json, (error, webhook) => {
            if (error) {
                console.error('PayPal webhook creation error:', error);
                reject(error);
            } else {
                resolve(webhook);
            }
        });
    });
};

const listWebhooks = async () => {
    if (!isConfigured) {
        throw new Error('PayPal non configurato');
    }

    return new Promise((resolve, reject) => {
        paypal.notification.webhook.list((error, webhooks) => {
            if (error) {
                console.error('PayPal webhooks list error:', error);
                reject(error);
            } else {
                resolve(webhooks);
            }
        });
    });
};

const formatPaymentForDatabase = (paypalPayment) => {
    const transaction = paypalPayment.transactions[0];
    const sale = transaction.related_resources.find(resource => resource.sale);
    
    return {
        provider_payment_id: paypalPayment.id,
        amount: parseFloat(transaction.amount.total),
        currency: transaction.amount.currency,
        status: mapPayPalStatusToOurStatus(paypalPayment.state),
        provider_data: {
            payer: paypalPayment.payer,
            sale_id: sale ? sale.sale.id : null,
            transaction_fee: sale ? sale.sale.transaction_fee : null
        }
    };
};

const mapPayPalStatusToOurStatus = (paypalStatus) => {
    const statusMapping = {
        'created': 'pending',
        'approved': 'processing',
        'executed': 'completed',
        'failed': 'failed',
        'canceled': 'cancelled',
        'expired': 'expired'
    };

    return statusMapping[paypalStatus] || 'unknown';
};

const getAccessToken = async () => {
    if (!isConfigured) {
        throw new Error('PayPal non configurato');
    }

    return new Promise((resolve, reject) => {
        // Use PayPal's internal method to get access token
        const requestOptions = {
            uri: `https://api${process.env.PAYPAL_MODE === 'sandbox' ? '.sandbox' : ''}.paypal.com/v1/oauth2/token`,
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Accept-Language': 'en_US',
                'Authorization': `Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64')}`
            },
            form: {
                'grant_type': 'client_credentials'
            }
        };

        const request = require('request');
        request(requestOptions, (error, response, body) => {
            if (error) {
                reject(error);
            } else {
                try {
                    const data = JSON.parse(body);
                    resolve(data.access_token);
                } catch (parseError) {
                    reject(parseError);
                }
            }
        });
    });
};

module.exports = {
    initializePayPal,
    createPayment,
    executePayment,
    processRefund,
    getPaymentDetails,
    validateWebhook,
    getSaleDetails,
    createWebhook,
    listWebhooks,
    formatPaymentForDatabase,
    mapPayPalStatusToOurStatus,
    getAccessToken,
    isConfigured: () => isConfigured
};