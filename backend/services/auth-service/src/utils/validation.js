const Joi = require('joi');

const validateLogin = (data) => {
    const schema = Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required()
    });
    return schema.validate(data);
};

const validateRegister = (data) => {
    const schema = Joi.object({
        name: Joi.string().min(2).max(255).required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required(),
        address: Joi.string().max(1000).optional(),
        phone: Joi.string().max(50).optional(),
        description: Joi.string().max(2000).optional()
    });
    return schema.validate(data);
};

module.exports = { validateLogin, validateRegister };
