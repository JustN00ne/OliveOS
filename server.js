require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const exphbs = require('express-handlebars');
const fs = require('fs-extra');
const { createClient } = require('@supabase/supabase-js');
const request = require('request');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
const cookieParser = require('cookie-parser');

const LogStore = [];
const LogType = {
  0: "INFO", 1: "WARN", 2: "ERRR", 3: "CRIT",
  info: 0, warning: 1, error: 2, critical: 3,
};

function Log(source, message, type = 0) {
  if (typeof type === 'string' && LogType[type] !== undefined) type = LogType[type];
  if (LogType[type] === undefined) return;
  const timestamp = new Date().toJSON();
  const msg = `[${LogType[type]}] ${timestamp} | ${source}: ${message}`;
  console.log(msg);
  LogStore.push(msg);
}

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    Log('[Server]', 'FATAL ERROR: SUPABASE_URL and SUPABASE_ANON_KEY must be set in your .env file.', 'critical');
    process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
Log('[Server]', 'Supabase client initialized.');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// A safer way to load globalData that won't crash on Vercel
let globalData = {};
const globalDataPath = path.join(__dirname, 'data', 'default', 'data.json');

try {
  // Try to read and parse the file
  const fileContent = fs.readFileSync(globalDataPath, 'utf-8');
  globalData = JSON.parse(fileContent);
  Log('[Server]', 'Successfully loaded global data from data.json.');
} catch (err) {
  // If ANY error occurs (file not found, bad JSON), log it and set a safe default.
  Log('[Server]', 'Could not load or parse data.json: ' + err.message, 'warning');
  globalData = {}; // Start with an empty object
}

// Ensure required variables have a fallback value to prevent template crashes.
if (!globalData.background_image_main) {
  globalData.background_image_main = '/assets/image/bg/default.jpg'; // Provide a safe default
  Log('[Server]', 'globalData.background_image_main was missing. Using default.', 'warning');
}

app.use((req, res, next) => {
    res.setHeader(
        'Content-Security-Policy',
        "script-src 'self' https://cdn.jsdelivr.net; default-src 'self' blob:;"
    );
    next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/data/applicaton', express.static(path.join(__dirname, 'data', 'applicaton')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

app.engine('hbs', exphbs.engine({ extname: '.hbs', defaultLayout: false }));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'public'));

app.use((req, res, next) => {
  Log('[Request]', `${req.method} ${req.url}`);
  next();
});

const { router: authRouter, requireSupabaseAuth } = require('./api/auth');
app.use('/api/auth', authRouter);

app.get('/', requireSupabaseAuth, (req, res) => {
  res.render('index', { ...globalData, user: req.supabaseUser });
});

app.get('/login', (req, res) => {
  const context = { ...globalData };
  context.supabaseUrl = process.env.SUPABASE_URL;
  context.supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!context.background_image_main) {
    Log('[Server]', 'background_image_main is missing. Using fallback.', 'warning');
    context.background_image_main = '/assets/image/default/bg.jpg'; 
  }

  res.render('login', context);
});

app.all('/proxy', (req, res) => {
  const targetUrl = req.method === 'POST' ? req.body.url : req.query.url;
  if (!targetUrl) {
    Log('[Proxy]', 'Missing ?url', 'error');
    return res.status(400).send('Missing ?url');
  }
  Log('[Proxy]', 'Proxying request to: ' + targetUrl);
  request({
    url: targetUrl,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36' },
    encoding: null,
  }, (err, response, body) => {
    if (err || !response) {
      Log('[Proxy]', 'Request failed: ' + err, 'error');
      return res.status(500).send('Request failed');
    }
    const contentType = response.headers['content-type'] || '';
    res.removeHeader('Content-Security-Policy');
    res.removeHeader('X-Frame-Options');
    res.setHeader('Content-Security-Policy', "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;");
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    
    if (contentType.includes('text/html')) {
      const html = iconv.decode(body, 'utf-8');
      const $ = cheerio.load(html);
      $('base').remove();
      $('meta[http-equiv="Content-Security-Policy"]').remove();
      $('meta[http-equiv="content-security-policy"]').remove();
      const injectionScript = `window.__proxyBase = ${JSON.stringify(targetUrl)}; /* ... full injection script ... */`;
      $('script:first').before(`<script>${injectionScript}</script>`);
      res.setHeader('Content-Type', 'text/html');
      Log('[Proxy]', 'HTML content proxied.');
      return res.send($.html());
    }
    res.setHeader('Content-Type', contentType);
    res.send(body);
  });
});

app.get('/api/fs', requireSupabaseAuth, async (req, res) => {
  const userId = req.supabaseUser.id;
  const { data, error } = await supabase.from('user_filesystems').select('fs').eq('user_id', userId).single();
  if (error && error.code !== 'PGRST116') {
    return res.status(500).json({ error: error.message });
  }
  res.json({ fs: data?.fs || null });
});

app.post('/api/fs', requireSupabaseAuth, async (req, res) => {
  const userId = req.supabaseUser.id;
  const { fs } = req.body;
  if (!fs) return res.status(400).json({ error: 'Missing fs' });
  const { error } = await supabase.from('user_filesystems').upsert({ user_id: userId, fs }, { onConflict: ['user_id'] });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.post('/api/filesystem/list/*', async (req, res) => {
  res.json({ success: true, files: [], path: req.params[0] || '' });
});

app.post('/api/filesystem/create/*', async (req, res) => {
  res.json({ success: true, message: 'Item created successfully' });
});

app.post('/api/filesystem/delete/*', async (req, res) => {
  res.json({ success: true, message: 'Item deleted successfully' });
});

app.get('/list-apps', (req, res) => {
  const showAll = req.query.all === 'true';
  const appsDir = path.join(__dirname, 'data', 'applicaton');
  fs.readdir(appsDir, { withFileTypes: true }, (err, files) => {
    if (err) {
      console.error('[list-apps] Failed to read apps directory:', err);
      return res.status(500).json([]);
    }
    const folders = files.filter(f => f.isDirectory()).map(f => f.name);
    res.json(folders);
  });
});

app.get('/api/whoami', (req, res) => {
  res.json({ user: { id: 'demo', name: 'Demo User' } });
});

app.get('/api/register/google', (req, res) => {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const appUrl = `${protocol}://${host}`;
  const providerUrl = `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(appUrl)}`;
  res.redirect(providerUrl);
});

app.get('/api/register/discord', (req, res) => {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const appUrl = `${protocol}://${host}`;
  const providerUrl = `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/authorize?provider=discord&redirect_to=${encodeURIComponent(appUrl)}`;
  res.redirect(providerUrl);
});

server.listen(PORT, () => {
  Log('[Server]', `🚀 Server is running and listening on http://localhost:${PORT}`);
});