// W:\OliveOS V2 Web\api\auth.js

require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Middleware to protect routes
async function requireSupabaseAuth(req, res, next) {
    const token = req.cookies['sb-access-token'];
    if (!token) {
        return res.redirect('/login');
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
        res.clearCookie('sb-access-token', { path: '/' });
        return res.redirect('/login');
    }

    req.supabaseUser = user;
    next();
}

// Endpoint to set the auth cookie from a client-side session
router.post('/set-session', express.json(), (req, res) => {
  const { session } = req.body;
  if (!session || !session.access_token) {
    return res.status(400).json({ error: 'No session provided.' });
  }
  res.cookie('sb-access-token', session.access_token, { httpOnly: true, sameSite: 'Lax' });
  return res.status(200).json({ message: 'Session cookie set successfully.' });
});

// Registration endpoint
router.post('/register', express.json(), async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return res.status(401).json({ error: error.message });
    if (data.session) {
      res.cookie('sb-access-token', data.session.access_token, { httpOnly: true, sameSite: 'Lax' });
    }
    return res.json({ success: true, user: data.user, session: data.session });
});

// Login endpoint
router.post('/login', express.json(), async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: error.message });
    res.cookie('sb-access-token', data.session.access_token, { httpOnly: true, sameSite: 'Lax' });
    return res.json({ success: true, user: data.user });
});

module.exports = { router, requireSupabaseAuth };