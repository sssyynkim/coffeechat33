const express = require('express');
const AWS = require('aws-sdk');
const { CognitoIdentityProviderClient, ForgotPasswordCommand, ConfirmForgotPasswordCommand } = require('@aws-sdk/client-cognito-identity-provider');
const router = express.Router();
const authController = require('../controllers/authController');
const axios = require('axios');
const querystring = require('querystring');
const jwt = require('jsonwebtoken');



// AWS Cognito Setup
const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });
// AWS Cognito Setup
const cognitoDomain = process.env.COGNITO_DOMAIN;
const clientId = process.env.COGNITO_CLIENT_ID;
const clientSecret = process.env.COGNITO_CLIENT_SECRET;
const redirectUri = process.env.COGNITO_REDIRECT_URI;


// Routes for registration, login, and logout
router.get('/register', authController.showRegisterPage);
router.post('/register', authController.registerUser);
router.get('/login', authController.showLoginPage);
router.post('/login', authController.loginUserCognito);
router.get('/logout', authController.logoutUser);
router.get('/confirm', authController.showConfirmPage);



// Reset Password Routes
router.get('/forgot-password', (req, res) => {
    res.render('requestResetPassword', { error_msg: req.flash('error_msg'), success_msg: req.flash('success_msg') });
});

router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    const params = {
        ClientId: process.env.COGNITO_CLIENT_ID,
        Username: email
    };

    try {
        const command = new ForgotPasswordCommand(params);
        await cognitoClient.send(command);

        req.flash('success_msg', 'A password reset code has been sent to your email.');
        res.redirect(`/auth/reset-password?email=${encodeURIComponent(email)}`); // Redirect to reset form
    } catch (err) {
        console.error('Error sending reset code:', err);
        req.flash('error_msg', err.message || 'Error sending reset code');
        res.redirect('/auth/forgot-password');
    }
});

// Render Reset Password Page
router.get('/reset-password', (req, res) => {
    const { email } = req.query;
    if (!email) {
        req.flash('error_msg', 'No email provided for password reset');
        return res.redirect('/auth/forgot-password');
    }
    res.render('resetPassword', { email, error_msg: req.flash('error_msg'), success_msg: req.flash('success_msg') });
});

router.post('/confirm', authController.confirmUser);

// Handle Password Reset Submission
router.post('/confirm-reset-password', async (req, res) => {
    const { email, verificationCode, newPassword } = req.body;

    const params = {
        ClientId: process.env.COGNITO_CLIENT_ID,
        Username: email,
        ConfirmationCode: verificationCode,
        Password: newPassword
    };

    try {
        const command = new ConfirmForgotPasswordCommand(params);
        await cognitoClient.send(command);

        req.flash('success_msg', 'Password reset successfully! You can now log in.');
        res.redirect('/auth/login');
    } catch (err) {
        console.error('Error resetting password:', err);
        req.flash('error_msg', err.message || 'Error resetting password');
        res.redirect(`/auth/reset-password?email=${encodeURIComponent(email)}`);
    }
});


// Handle OAuth2 callback
router.get('/callback', async (req, res) => {
    const { code, state } = req.query;
    
    // Verify the state matches what we stored in the session to prevent CSRF attacks
    if (req.session.state !== state) {
        req.flash('error_msg', 'Invalid state parameter. Possible CSRF attack.');
        return res.redirect('/auth/login');
    }

    try {
        // Exchange authorization code for tokens
        const tokenResponse = await axios.post(
            `https://${cognitoDomain}/oauth2/token`,
            querystring.stringify({
                grant_type: 'authorization_code',
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                code: code
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const { id_token, access_token } = tokenResponse.data;

        // Verify the JWT token
        const decoded = jwt.decode(id_token);

        // Save the token and user info in the session
        req.session.token = access_token;
        req.session.user = decoded;

        // Redirect to the protected page (e.g., post list)
        res.redirect('/posts/list');
    } catch (error) {
        console.error('Error exchanging authorization code:', error);
        req.flash('error_msg', 'Authentication failed.');
        res.redirect('/auth/login');
    }
});


module.exports = router;
