// server.js
require('dotenv').config(); // Load .env for Supabase keys
const express = require('express');
const path = require('path');
const exphbs = require('express-handlebars');
const fs = require('fs-extra');
const { program } = require('commander');
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
const request = require('request');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');

// --- Supabase Client Setup ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('Connected to Supabase.');

// You can now use `supabase` for DB operations (auth, storage, etc.)
// Example: supabase.from('table').select('*')

const app = express();
const PORT = process.env.PORT || 3000;

let globalData = {};
const globalDataPath = path.join(__dirname, 'data', 'default', 'data.json');
try {
  globalData = JSON.parse(fs.readFileSync(globalDataPath, 'utf-8'));
} catch (err) {
  console.warn('Warning: Failed to load global data for Handlebars template:', err.message);
}
app.engine('hbs', exphbs.engine({ extname: '.hbs', defaultLayout: false }));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'public'));

// --- Static File Serving ---
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// --- Home Route ---
app.get('/', (req, res) => {
  res.render('index', { ...globalData });
});

// --- Proxy Endpoint for Iframe Embedding (improved version) ---
app.all('/proxy', (req, res) => {
  const targetUrl = req.method === 'POST' ? req.body.url : req.query.url;
  if (!targetUrl) return res.status(400).send('Missing ?url');

  request({
    url: targetUrl,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    },
    encoding: null,
  }, (err, response, body) => {
    if (err || !response) return res.status(500).send('Request failed');
    const contentType = response.headers['content-type'] || '';
    res.removeHeader('Content-Security-Policy');
    res.removeHeader('X-Frame-Options');
    res.setHeader('Content-Security-Policy', "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;");
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    if (contentType.includes('text/html')) {
      const html = iconv.decode(body, 'utf-8');
      const $ = cheerio.load(html);
      const rewriteAttrs = {
        img: 'src',
        script: 'src',
        link: 'href',
        iframe: 'src',
        source: 'src',
        video: 'src',
        audio: 'src',
        form: 'action',
      };
      Object.entries(rewriteAttrs).forEach(([tag, attr]) => {
        $(tag).each((_, el) => {
          const $el = $(el);
          const val = $el.attr(attr);
          if (!val || val.startsWith('data:') || val.startsWith('blob:') || val.startsWith('javascript:')) return;
          const abs = new URL(val, targetUrl).toString();
          if (tag === 'form') {
            $el.attr(attr, '/proxy');
            $el.prepend(`<input type=\"hidden\" name=\"url\" value=\"${abs}\">`);
          } else {
            $el.attr(attr, `/proxy?url=${encodeURIComponent(abs)}`);
          }
        });
      });
      res.setHeader('Content-Type', 'text/html');
      return res.send($.html());
    }
    res.setHeader('Content-Type', contentType);
    res.send(body);
  });
});

// --- Server Start and App Discovery Function ---
function startServer() {
    app.listen(PORT, () => {
        console.log(`OliveOS Web Server running on http://localhost:${PORT}`);
    });
}

// --- CLI ---
program
    .name('oliveos-server-cli')
    .description('OliveOS Web Server');

program
    .command('start')
    .description('Start the OliveOS web server')
    .action(startServer);

// Default to start if no command or 'start' is given
if (process.argv.length <= 2 || process.argv[2] === 'start') {
    startServer();
} else {
    program.parse(process.argv);
}

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`OliveOS Web Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
