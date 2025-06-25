// /api/register.js
require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Register endpoint
router.post('/', express.json(), async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  res.json({ success: true, user: data.user });
});

// Google OAuth endpoint
router.get('/google', async (req, res) => {
  const redirectTo = req.query.redirectTo || 'https://zoiqztkjexeadgnnulpg.supabase.co/auth/v1/callback';
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo }
  });
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  res.redirect(data.url);
});

// Discord OAuth endpoint
router.get('/discord', async (req, res) => {
  const redirectTo = req.query.redirectTo || 'https://zoiqztkjexeadgnnulpg.supabase.co/auth/v1/callback';
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: { redirectTo }
  });
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  res.redirect(data.url);
});

module.exports = router;
