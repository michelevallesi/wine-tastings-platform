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

const validateBookingNotification = (data) => {
    const schema = Joi.object({
        to: Joi.string().email().required(),
        booking: Joi.object({
            id: Joi.string().required(),
            package_name: Joi.string().required(),
            booking_date: Joi.date().required(),
            booking_time: Joi.string().required(),
            participants: Joi.number().integer().min(1).required(),
            total_price: Joi.number().positive().required()
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

const validatePaymentConfirmation = (data) => {
    const schema = Joi.object({
        to: Joi.string().email().required(),
        booking: Joi.object({
            id: Joi.string().required(),
            package_name: Joi.string().required(),
            booking_date: Joi.date().required(),
            booking_time: Joi.string().required(),
            total_price: Joi.number().positive().required()
        }).required(),
        customer: Joi.object({
            name: Joi.string().required(),
            surname: Joi.string().required()
        }).required()
    });
    return schema.validate(data);
};

const validateCustomEmail = (data) => {
    const schema = Joi.object({
        to: Joi.alternatives().try(
            Joi.string().email(),
            Joi.array().items(Joi.string().email())
        ).required(),
        subject: Joi.string().min(1).max(200).required(),
        htmlContent: Joi.string().required(),
        attachments: Joi.array().items(Joi.object({
            filename: Joi.string().required(),
            content: Joi.alternatives().try(Joi.string(), Joi.binary()).required(),
            encoding: Joi.string().optional(),
            contentType: Joi.string().optional(),
            cid: Joi.string().optional()
        })).optional()
    });
    return schema.validate(data);
};

module.exports = {
    validateBookingConfirmation,
    validateBookingNotification,
    validatePaymentConfirmation,
    validateCustomEmail
};