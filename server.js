// server.js
require('dotenv').config(); // Load .env for Supabase keys
const express = require('express');
const http = require('http');
const path = ('path');
const exphbs = require('express-handlebars');
const cookieParser = require('cookie-parser');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// --- FIX #1: CHECK FOR MISSING ENVIRONMENT VARIABLES ---
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error('FATAL ERROR: SUPABASE_URL and SUPABASE_ANON_KEY must be set in your .env file.');
    process.exit(1); // Stop the server if keys are missing
}

// --- FIX #2: SET A PROPER CONTENT SECURITY POLICY (CSP) ---
// This middleware will apply a new CSP to all responses, allowing scripts to be loaded.
app.use((req, res, next) => {
    res.setHeader(
        'Content-Security-Policy',
        "script-src 'self' https://cdn.jsdelivr.net; " + // Allow scripts from our domain and Supabase's CDN
        "default-src 'self';" // For everything else, only allow from our domain
    );
    next();
});


// Keep the rest of your existing server configuration
app.use(express.static(path.join(__dirname, 'public')));
app.engine('hbs', exphbs.engine({ extname: '.hbs', defaultLayout: false }));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// --- Auth Router ---
// This assumes your auth.js is correct from our previous conversation
const { router: authRouter, requireSupabaseAuth } = require('./api/auth.js');
app.use('/api/auth', authRouter);

// --- Home Route (Protected) ---
app.get('/', requireSupabaseAuth, (req, res) => {
    // For now, let's just render the index page without extra data
    res.render('index', { user: req.supabaseUser });
});

// --- Login Route (Public) ---
app.get('/login', (req, res) => {
  // Pass the (now confirmed to exist) keys to the template
  res.render('login', {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY
  });
});


// OAuth Redirects (keep these as they are)
app.get('/api/register/google', (req, res) => {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const appUrl = `${protocol}://${host}`;
  const providerUrl = `${process.env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(appUrl)}`;
  res.redirect(providerUrl);
});

app.get('/api/register/discord', (req, res) => {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const appUrl = `${protocol}://${host}`;
  const providerUrl = `${process.env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/authorize?provider=discord&redirect_to=${encodeURIComponent(appUrl)}`;
  res.redirect(providerUrl);
});


server.listen(PORT, () => {
  console.log(`[Server] Listening on port ${PORT}`);
});