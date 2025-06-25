// W:\OliveOS V2 Web\api\auth.js

require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Middleware to require authentication
function requireSupabaseAuth(req, res, next) {
  // Use 'sb-access-token' to be consistent with your existing code
  const token = req.cookies['sb-access-token'] || req.headers['authorization'];
  if (!token) return res.redirect('/login');
  supabase.auth.getUser(token).then(({ data, error }) => {
    if (error || !data?.user) return res.redirect('/login');
    req.supabaseUser = data.user;
    next();
  }).catch(() => res.redirect('/login'));
}

// --- NEW: Registration Endpoint ---
// Handles POST requests to /api/auth/register
router.post('/register', express.json(), (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    supabase.auth.signUp({ email, password }).then(({ data, error }) => {
        if (error || !data.session) {
            console.error('Supabase Registration Error:', error?.message);
            return res.status(401).json({ error: error?.message || 'Registration failed' });
        }
        
        // On successful registration, log the user in immediately by setting the cookie
        res.cookie('sb-access-token', data.session.access_token, { httpOnly: true, sameSite: 'Lax' });
        
        // Return success and user data. The front-end will handle the redirect.
        res.json({ success: true, user: data.user });
    });
});


// Login endpoint (your existing code)
router.post('/login', express.json(), (req, res) => {
  const { email, password } = req.body;
  supabase.auth.signInWithPassword({ email, password }).then(({ data, error }) => {
    if (error || !data.session) {
      return res.status(401).json({ error: error?.message || 'Invalid credentials' });
    }
    res.cookie('sb-access-token', data.session.access_token, { httpOnly: true, sameSite: 'Lax' });
    
    // Check if the request prefers HTML for redirection
    if (req.accepts('html')) {
      // For a form submission that doesn't use JS, this would redirect.
      // Since your form uses JS fetch, we send JSON and let the client redirect.
      return res.json({ success: true, user: data.user });
    }
    // Default to sending JSON
    res.json({ success: true, user: data.user });
  });
});

// Logout endpoint (your existing code)
router.post('/logout', (req, res) => {
  res.clearCookie('sb-access-token');
  res.redirect('/login');
});

// --- NEW: Endpoint to set the auth cookie from a client-side session ---
router.post('/set-session', express.json(), (req, res) => {
  const { session } = req.body;

  if (!session || !session.access_token) {
    return res.status(400).json({ error: 'No session provided.' });
  }

  // Set the cookie using the access token from the client-side session
  res.cookie('sb-access-token', session.access_token, { httpOnly: true, sameSite: 'Lax' });
  
  return res.status(200).json({ message: 'Session cookie set successfully.' });
});

module.exports = { router, requireSupabaseAuth };