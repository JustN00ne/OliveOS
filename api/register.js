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
  // On success, redirect to index page
  return res.redirect('/');
});

// Google OAuth endpoint
router.get('/google', (req, res) => {
  // Dynamically determine the app URL from the request
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const appUrl = `${protocol}://${host}`;
  const providerUrl = `${process.env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(appUrl)}`;
  res.redirect(providerUrl);
});

// Discord OAuth endpoint
router.get('/discord', (req, res) => {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const appUrl = `${protocol}://${host}`;
  const providerUrl = `${process.env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/authorize?provider=discord&redirect_to=${encodeURIComponent(appUrl)}`;
  res.redirect(providerUrl);
});

module.exports = router;
