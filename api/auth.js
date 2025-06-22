// /api/auth.js
require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cookieParser = require('cookie-parser');

const router = express.Router();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Middleware to require authentication
function requireSupabaseAuth(req, res, next) {
  const token = req.cookies['sb-access-token'] || req.headers['authorization'];
  if (!token) return res.redirect('/login');
  supabase.auth.getUser(token).then(({ data, error }) => {
    if (error || !data?.user) return res.redirect('/login');
    req.supabaseUser = data.user;
    next();
  }).catch(() => res.redirect('/login'));
}

// Login endpoint
router.post('/login', express.json(), (req, res) => {
  const { email, password } = req.body;
  supabase.auth.signInWithPassword({ email, password }).then(({ data, error }) => {
    if (error || !data.session) {
      return res.status(401).json({ error: error?.message || 'Invalid credentials' });
    }
    res.cookie('sb-access-token', data.session.access_token, { httpOnly: true, sameSite: 'Lax' });
    res.json({ success: true });
  });
});

// Logout endpoint
router.post('/logout', (req, res) => {
  res.clearCookie('sb-access-token');
  res.redirect('/login');
});

module.exports = { router, requireSupabaseAuth };
