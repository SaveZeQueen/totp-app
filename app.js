const express = require('express');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const util = require('util'); // Polyfill for TextEncoder
require('dotenv').config();   // Load environment variables from .env
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

// Polyfill for TextEncoder if it's not defined
if (typeof TextEncoder === 'undefined') {
    global.TextEncoder = util.TextEncoder;
}


const app = express();

if (process.env.NODE_ENV === 'development') {
const cors = require('cors'); // Polyfill for TextEncoder
app.use(cors())  // only this should works for every case also you can try 
app.use(cors({
  origin: '*' // that will for all like  https / http 
}))
}

// Create a connection pool based on the environment
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.NODE_ENV === 'development' ? process.env.DEV_DB_USER : process.env.DB_USER,
    password: process.env.NODE_ENV === 'development' ? process.env.DEV_DB_PASSWORD : process.env.DB_PASSWORD,
    database: process.env.NODE_ENV === 'development' ? process.env.DEV_DB_NAME : process.env.DB_NAME
});


// Middleware to parse JSON body
app.use(express.json());


// Function to generate a random recovery key
function generateRecoveryKey(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length }, () => characters.charAt(Math.floor(Math.random() * characters.length))).join('');
}

// Functions for handling hashed passwords and salt
async function generateSalt(length = 32) {
    const salt = await bcrypt.genSalt(length);
    return salt;
}

async function hashPassword(password, salt) {
    const hash = await bcrypt.hash(password + salt, 10);
    return hash;
}

// Email sending function using nodemailer
async function sendEmail(from, to, subject, messageBody) {
    const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: process.env.EMAIL_SECURE === 'true', // Use SSL
        auth: {
            user: process.env.EMAIL_USER, // Email username from .env
            pass: process.env.EMAIL_PASSWORD // Email password from .env
        }
    });

    try {
        const info = await transporter.sendMail({
            from,
            to,
            subject,
            html: messageBody
        });
        console.log('Email sent: %s', info.messageId);
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
}

// Route to handle sending emails
app.post('/totp-auth/send-email', async (req, res) => {
    const { from, to, subject, api_key, template_name, variables } = req.body;

    const API_KEY = process.env.API_KEY;

    if (api_key !== API_KEY) {
        return res.status(403).json({ success: false, message: 'Unauthorized request' });
    }

    try {
        // Read the email template from the emailTemplates directory
        const templatePath = path.join(__dirname, 'emailTemplates', `${template_name}.html`);
        let template = fs.readFileSync(templatePath, 'utf-8');

        // Replace placeholders with actual values
        for (const [key, value] of Object.entries(variables)) {
            template = template.replace(new RegExp(`{{${key}}}`, 'g'), value);
        }

        // Send the email
        await sendEmail(from, to, subject, template);
        res.json({ success: true, message: 'Email sent successfully' });
    } catch (error) {
        console.error('Error in sending email:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send email',
            error: error.message || 'Unknown error'
        });
    }
});

// If /totp-auth/ empty path 404 error page
app.route('/totp-auth/')
    .get((req, res) => {
        res.status(404).send('404 Not Found');
    })
    .post((req, res) => {
        res.status(404).send('404 Not Found');
    });

// Handle POST requests to '/totp-auth/generate-qr' and redirect GET requests to 404
app.route('/totp-auth/generate-qr')
    .get((req, res) => {
        res.status(404).send('404 Not Found');
    })
    .post(async (req, res) => {
        const { api_key } = req.body;

        // Use API_KEY from dotenv
        const API_KEY = process.env.API_KEY;

        if (api_key !== API_KEY) {
            return res.status(403).json({ success: false, message: 'Invalid API key' });
        }

        // Generate TOTP secret using TOTP_SECRET_KEY from dotenv
        const secretKey = process.env.TOTP_SECRET_KEY;
        const secret = speakeasy.generateSecret({ 
            name: 'The Miracle One', 
            length: 20,
            secret: secretKey
        });

        // Generate a recovery key
        const recoveryKey = generateRecoveryKey(16);

        try {
            // Generate QR code for the TOTP secret
            const qrCode = await qrcode.toDataURL(secret.otpauth_url);

            res.json({
                success: true,
                message: 'QR code generated successfully.',
                output: {
                    secret: secret.base32,  // Secret key in base32 format
                    qr_code: qrCode,        // QR code as a data URL
                    recovery_key: recoveryKey // Generated recovery key
                }
            });
        } catch (error) {
            console.error("QR code generation error:", error);
            res.status(500).json({
                success: false,
                message: 'Failed to generate QR code',
                error: error.message || 'Unknown error'
            });
        }
    });

// Handle POST requests to '/totp-auth/setup'
app.route('/totp-auth/setup')
    .get((req, res) => {
        res.status(404).send('404 Not Found');
    })
    .post(async (req, res) => {
        const { api_key, token, secret, recovery_key, client_id } = req.body;
        const API_KEY = process.env.API_KEY;

        console.log('Request body:', req.body);  // Log the request body for debugging
        console.log('API_KEY:', API_KEY);
        console.log('Token provided:', token);
        console.log('TOTP Secret:', secret);

        // Check if api_key, token, and client_id are present
        if (!api_key || !token || !client_id) {
            return res.status(400).json({ success: false, message: 'Missing API key, token, or client ID' });
        }

        if (api_key !== API_KEY) {
            return res.status(403).json({ success: false, message: 'Invalid API key' });
        }

        try {
            // Verify the token using the user-provided secret
            const verified = speakeasy.totp.verify({ secret, encoding: 'base32', token });

            if (!verified) {
                return res.status(400).json({ success: false, message: 'Invalid token' });
            }

            // Hash and salt the recovery key
            const recoverySalt = await generateSalt();
            const hashedRecoveryKey = await hashPassword(recovery_key, recoverySalt);

            // Store the hashed secret and recovery key in the database
            const updateQuery = `
                UPDATE clients
                SET totp_secret = ?, recovery_key = ?, recovery_salt = ?
                WHERE id = ?
            `;
            const [result] = await pool.execute(updateQuery, [secret, hashedRecoveryKey, recoverySalt, client_id]);

            // If no rows were affected, return an error
            if (result.affectedRows === 0) {
                return res.status(500).json({ success: false, message: 'Failed to update client TOTP information' });
            }

            // If verification and update are successful, return a success message
            res.json({ success: true, message: 'Setup completed successfully' });
        } catch (error) {
            console.error('Error in verifying token or updating database:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to verify token or update TOTP information',
                error: error.message || 'Unknown error'
            });
        }
    });

// Handle post requests to '/totp-auth/deactivate'
app.route('/totp-auth/deactivate')
    .get((req, res) => {
        res.status(404).send('404 Not Found');
    })
    .post(async (req, res) => {
        const { api_key, token, client_id } = req.body;
        const API_KEY = process.env.API_KEY;

        if (api_key !== API_KEY) {
            return res.status(403).json({ success: false, message: 'Invalid API key' });
        }

        // Get Secret and decrypt it from the database for use in verification
        const query = `
            SELECT totp_secret
            FROM clients
            WHERE id = ?
        `;
        const [rows] = await pool.execute(query, [client_id]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Client not found' });
        }

        // Decrypt the secret and salt from the database
        const secret = rows[0].totp_secret;
        
        // verify secret is not empty
        if (!secret) {
            return res.status(400).json({ success: false, message: 'Error finding client: Contact admin' });
        }

        // Verify the TOTP token for login or regular verification
        const verified = speakeasy.totp.verify({ secret, encoding: 'base32', token });

        if (!verified) {
            return res.status(400).json({ success: false, message: 'Verification failed' });
        }

        // If verification is successful, update the client's TOTP information
        const updateQuery = `
            UPDATE clients
            SET totp_secret = NULL, recovery_key = NULL, recovery_salt = NULL
            WHERE id = ?
        `;
        const [result] = await pool.execute(updateQuery, [client_id]);

        // If no rows were affected, return an error
        if (result.affectedRows === 0) {
            return res.status(500).json({ success: false, message: 'Failed to deactivate. Contact admin.' });
        }

        // If verification and update are successful, return a success message
        res.json({ success: true, message: 'Two-Factor Authentication Deactivated' });
    });


// Handle POST requests to '/totp-auth/verify-totp'
app.route('/totp-auth/verify-totp')
    .get((req, res) => {
        res.status(404).send('404 Not Found');
    })
    .post((req, res) => {
        const { api_key, token, secret } = req.body;
        const API_KEY = process.env.API_KEY;

        if (api_key !== API_KEY) {
            return res.status(403).json({ success: false, message: 'Invalid API key' });
        }

        // Verify the TOTP token for login or regular verification
        const verified = speakeasy.totp.verify({ secret, encoding: 'base32', token });

        if (!verified) {
            return res.status(400).json({ success: false, message: 'Verification failed' });
        }

        // If verification is successful, return a success message
        res.json({ success: true, message: 'Verification successful' });
    });

const port = process.env.NODE_ENV==='production' ? 0 : 3000;
app.listen(port, () => console.log('Application is running on port', port));

