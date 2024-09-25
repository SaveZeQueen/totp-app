
# TOTP Authentication App

## Overview

This application is built using **Node.js**, **Express**, **speakeasy** for TOTP generation/verification, **qrcode** for generating QR codes, **nodemailer** for sending emails, and **MySQL** for database interactions. It allows for the setup and verification of Two-Factor Authentication (2FA) using Time-based One-Time Passwords (TOTP). Users can generate a QR code for TOTP setup, verify tokens, and deactivate the TOTP service.

---

## Features

- **TOTP Generation**: Generates a secret key and QR code for users to scan with their authenticator apps.
- **TOTP Verification**: Verifies tokens from users based on the stored secret.
- **TOTP Deactivation**: Removes the secret from the database and disables 2FA (still under development).
- **Recovery Key Generation**: Generates a recovery key for users in case they lose access to their TOTP device.
- **Email Notifications**: Uses **nodemailer** to send emails (such as recovery keys) to users.
- **Database Storage**: Stores TOTP secrets, recovery keys, and other authentication data securely in a MySQL database.

---

## Setup

### Prerequisites

- Node.js (>= 14.x)
- MySQL Database
- Email service configuration for sending emails (e.g., SMTP server)

### Install Dependencies

```bash
npm install
```

### Environment Variables

Create a `.env` file in the root directory of your project and include the following environment variables:

```bash
# Environment Variables for Development Mode
NODE_ENV=development

# MySQL Database Configuration for Production
DB_HOST=your_database_host
DB_NAME=your_database_name
DB_USER=your_database_user
DB_PASSWORD=your_database_password

# MySQL Database Configuration for Development
DEV_DB_HOST=localhost
DEV_DB_NAME=your_dev_database_name
DEV_DB_USER=your_dev_database_user
DEV_DB_PASSWORD=your_dev_database_password

# API Key for Authentication (Used for securing API requests)
API_KEY=your_api_key

# TOTP Secret Key for Generating QR Codes
TOTP_SECRET_KEY=your_totp_secret_key

# Email Configuration
EMAIL_HOST=your_smtp_server
EMAIL_PORT=your_smtp_port
EMAIL_SECURE=true_or_false # Use true for SSL, false for TLS
EMAIL_USER=your_email_address
EMAIL_PASSWORD=your_email_password
```

---

## Running the App

To start the application, run:

```bash
npm start
```

By default, the app listens on port `3000` in development mode.

---

## API Endpoints

- **Generate QR Code for TOTP Setup**

    **POST** `/totp-auth/generate-qr`
    
    Request Body:
    ```json
    {
      "api_key": "your_api_key"
    }
    ```
    Response:
    ```json
    {
      "success": true,
      "message": "QR code generated successfully.",
      "output": {
        "secret": "TOTP_secret_in_base32_format",
        "qr_code": "QR_code_as_data_URL",
        "recovery_key": "randomly_generated_recovery_key"
      }
    }
    ```

- **Verify TOTP Token**

    **POST** `/totp-auth/verify-totp`
    
    Request Body:
    ```json
    {
      "api_key": "your_api_key",
      "token": "totp_token",
      "secret": "totp_secret_in_base32_format"
    }
    ```
    Response:
    ```json
    {
      "success": true,
      "message": "Verification successful"
    }
    ```

- **Setup TOTP for a Client**

    **POST** `/totp-auth/setup`
    
    Request Body:
    ```json
    {
      "api_key": "your_api_key",
      "token": "totp_token",
      "secret": "totp_secret_in_base32_format",
      "recovery_key": "recovery_key",
      "client_id": "client_id_in_database"
    }
    ```

- **Deactivate TOTP (Work in Progress)**

    **POST** `/totp-auth/deactivate`
    
    Request Body:
    ```json
    {
      "api_key": "your_api_key",
      "token": "totp_token",
      "client_id": "client_id_in_database"
    }
    ```

---

## Future Improvements

- Complete the deactivation process for TOTP.
- Add more robust error handling for edge cases.
- Extend functionality for recovery key usage.
