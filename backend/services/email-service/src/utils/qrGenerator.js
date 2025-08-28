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

const generateQRCodeSVG = async (data, options = {}) => {
    try {
        const qrOptions = {
            type: 'svg',
            width: parseInt(process.env.QR_CODE_SIZE) || 200,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            },
            ...options
        };

        const svg = await QRCode.toString(data, qrOptions);
        return svg;
    } catch (error) {
        console.error('QR Code SVG generation error:', error);
        throw new Error('Errore nella generazione del QR Code SVG');
    }
};

module.exports = { 
    generateQRCodeImage,
    generateQRCodeBuffer,
    generateQRCodeSVG
};