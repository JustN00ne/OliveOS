// server.js
require('dotenv').config(); // Load .env for Supabase keys
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const exphbs = require('express-handlebars');
const fs = require('fs-extra');
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
const request = require('request');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');

// --- Supabase Client Setup ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('{log} Connected to Supabase.');

// Log environment variables for debugging

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Log server start
console.log(`[Server] Starting on port ${PORT}`);

let globalData = {};
const globalDataPath = path.join(__dirname, 'data', 'default', 'data.json');
try {
  globalData = JSON.parse(fs.readFileSync(globalDataPath, 'utf-8'));
  console.log('[Server] Loaded global data from', globalDataPath);
} catch (err) {
  console.warn('Warning: Failed to load global data for Handlebars template:', err.message);
}
app.engine('hbs', exphbs.engine({ extname: '.hbs', defaultLayout: false }));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'public'));

// --- Static File Serving ---
app.use(express.static(path.join(__dirname, 'public')));
app.use('/data/applicaton', express.static(path.join(__dirname, 'data', 'applicaton')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Log all requests
app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.url}`);
  next();
});

// --- Home Route ---
app.get('/', (req, res) => {
  console.log('[Route] GET /');
  res.render('index', { ...globalData });
});

// --- Proxy Endpoint for Iframe Embedding (improved version) ---
app.all('/proxy', (req, res) => {
  const targetUrl = req.method === 'POST' ? req.body.url : req.query.url;
  if (!targetUrl) {
    console.error('[Proxy] Missing ?url');
    return res.status(400).send('Missing ?url');
  }
  console.log(`[Proxy] Proxying request to: ${targetUrl}`);
  request({
    url: targetUrl,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    },
    encoding: null,
  }, (err, response, body) => {
    if (err || !response) {
      console.error('[Proxy] Request failed:', err);
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
      
      // Remove base tags to prevent URL resolution conflicts
      $('base').remove();
      
      // Remove CSP meta tags that could block content
      $('meta[http-equiv="Content-Security-Policy"]').remove();
      $('meta[http-equiv="content-security-policy"]').remove();
      
      // Rewrite CSS url() references in style tags
      $('style').each((_, el) => {
        const $el = $(el);
        let styleContent = $el.html();
        styleContent = styleContent.replace(/url\((?!['"]?(?:data|blob):)(['"]?)(.*?)\1\)/gi, (match, quote, url) => {
          const abs = new URL(url, targetUrl).toString();
          return `url(${quote}/proxy?url=${encodeURIComponent(abs)}${quote ? quote : ''})`;
        });
        $el.html(styleContent);
      });

      // Rewrite CSS url() in style attributes
      $('[style]').each((_, el) => {
        const $el = $(el);
        let styleContent = $el.attr('style');
        styleContent = styleContent.replace(/url\((?!['"]?(?:data|blob):)(['"]?)(.*?)\1\)/gi, (match, quote, url) => {
          const abs = new URL(url, targetUrl).toString();
          return `url(${quote}/proxy?url=${encodeURIComponent(abs)}${quote ? quote : ''})`;
        });
        $el.attr('style', styleContent);
      });

      const rewriteAttrs = {
        img: 'src',
        script: 'src',
        link: 'href',
        iframe: 'src',
        source: 'src',
        video: 'src',
        audio: 'src',
        form: 'action',
        a: 'href',
        area: 'href',
        embed: 'src',
        object: 'data',
        track: 'src'
      };

      Object.entries(rewriteAttrs).forEach(([tag, attr]) => {
        $(tag).each((_, el) => {
          const $el = $(el);
          const val = $el.attr(attr);
          if (!val || val.startsWith('data:') || val.startsWith('blob:') || val.startsWith('javascript:') || val.startsWith('/proxy?url=')) return;
          try {
            const abs = new URL(val, targetUrl).toString();
            if (tag === 'form') {
              if ($el.attr('enctype') === 'multipart/form-data') {
                $el.attr('enctype', 'application/x-www-form-urlencoded');
              }
              $el.attr(attr, '/proxy');
              $el.prepend(`<input type="hidden" name="url" value="${abs}">`);
            } else if (tag === 'a' || tag === 'area') {
              $el.attr(attr, '#');
              $el.attr('onclick', `event.preventDefault(); location.href='/proxy?url=${encodeURIComponent(abs)}'`);
            } else {
              $el.attr(attr, `/proxy?url=${encodeURIComponent(abs)}`);
            }
          } catch (e) {
            console.warn(`URL rewrite failed for: ${val}`, e.message);
          }
        });
      });
      // Client-side overrides injection
      const injectionScript = `
        window.__proxyBase = ${JSON.stringify(targetUrl)};
        const elementProperties = {
          HTMLImageElement: ['src'],
          HTMLScriptElement: ['src'],
          HTMLLinkElement: ['href'],
          HTMLIFrameElement: ['src'],
          HTMLSourceElement: ['src'],
          HTMLVideoElement: ['src', 'poster'],
          HTMLAudioElement: ['src'],
          HTMLEmbedElement: ['src'],
          HTMLObjectElement: ['data'],
          HTMLAnchorElement: ['href'],
          HTMLAreaElement: ['href']
        };
        Object.entries(elementProperties).forEach(([interfaceName, props]) => {
          if (!window[interfaceName]) return;
          const proto = window[interfaceName].prototype;
          props.forEach(prop => {
            const descriptor = Object.getOwnPropertyDescriptor(proto, prop);
            if (descriptor && descriptor.set) {
              Object.defineProperty(proto, prop, {
                set: function(value) {
                  if (typeof value === 'string' &&
                      !value.startsWith('blob:') &&
                      !value.startsWith('data:') &&
                      !value.startsWith('javascript:') &&
                      !value.startsWith('/proxy?url=')) {
                    try {
                      value = '/proxy?url=' + encodeURIComponent(new URL(value, window.__proxyBase).toString());
                    } catch (e) {
                      console.warn('URL rewrite error:', e);
                    }
                  }
                  descriptor.set.call(this, value);
                },
                configurable: true
              });
            }
          });
        });
        const observer = new MutationObserver(mutations => {
          mutations.forEach(mutation => {
            if (mutation.type === 'childList') {
              mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) {
                  rewriteNodeAttributes(node);
                }
              });
            }
          });
        });
        function rewriteNodeAttributes(node) {
          const tagAttrMap = {
            img: ['src'],
            script: ['src'],
            link: ['href'],
            iframe: ['src'],
            source: ['src'],
            video: ['src', 'poster'],
            audio: ['src'],
            form: ['action'],
            a: ['href'],
            area: ['href'],
            embed: ['src'],
            object: ['data'],
            track: ['src']
          };
          const walk = (el) => {
            const tag = el.tagName && el.tagName.toLowerCase();
            if (tag && tagAttrMap[tag]) {
              tagAttrMap[tag].forEach(attr => {
                const val = el.getAttribute(attr);
                if (val && !val.startsWith('blob:') && !val.startsWith('data:') &&
                    !val.startsWith('javascript:') && !val.startsWith('/proxy?url=')) {
                  try {
                    const abs = new URL(val, window.__proxyBase).toString();
                    el.setAttribute(attr, '/proxy?url=' + encodeURIComponent(abs));
                  } catch (e) {}
                }
              });
            }
            el.children && Array.from(el.children).forEach(walk);
          };
          walk(node);
        }
        observer.observe(document.body, { childList: true, subtree: true });
        window.onscroll = function() {
          if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight) {
            var img = document.createElement('img');
            img.src = 'horse.png';
            document.body.appendChild(img);
          }
        };
        const originalXHR = window.XMLHttpRequest;
        window.XMLHttpRequest = function() {
          const xhr = new originalXHR();
          const originalOpen = xhr.open.bind(xhr);
          xhr.open = function(method, url, async) {
            if (typeof url === 'string' &&
                !url.startsWith('blob:') &&
                !url.startsWith('data:') &&
                !url.startsWith('/proxy?url=')) {
              url = '/proxy?url=' + encodeURIComponent(new URL(url, window.__proxyBase).toString());
            }
            return originalOpen(method, url, async);
          };
          return xhr;
        };
        const originalFetch = window.fetch;
        window.fetch = function(input, init) {
          let url = input.url || input;
          if (typeof url === 'string' &&
              !url.startsWith('blob:') &&
              !url.startsWith('data:') &&
              !url.startsWith('/proxy?url=')) {
            url = '/proxy?url=' + encodeURIComponent(new URL(url, window.__proxyBase).toString());
          }
          return originalFetch(url, init);
        };
        const originalCreateElement = document.createElement.bind(document);
        document.createElement = function(tagName) {
          const el = originalCreateElement(tagName);
          if (tagName.toLowerCase() === 'script') {
            const originalSetAttribute = el.setAttribute.bind(el);
            el.setAttribute = function(name, value) {
              if (name === 'src' &&
                  !value.startsWith('blob:') &&
                  !value.startsWith('data:') &&
                  !value.startsWith('/proxy?url=')) {
                value = '/proxy?url=' + encodeURIComponent(new URL(value, window.__proxyBase).toString());
              }
              originalSetAttribute(name, value);
            };
          }
          return el;
        };
        rewriteNodeAttributes(document.body);
      `;
      $('script:first').before(`<script>${injectionScript}</script>`);
      res.setHeader('Content-Type', 'text/html');
      console.log('[Proxy] HTML content proxied.');
      return res.send($.html());
    }
    res.setHeader('Content-Type', contentType);
    res.send(body);
  });
});

// --- Filesystem API Routes ---
app.post('/api/filesystem/list/*', async (req, res) => {
  const path = req.params[0] || '';
  const operationId = 'op_' + Date.now() + Math.random().toString(36).substr(2, 6);
  try {
    // Simulated filesystem data - in a real app, you'd use Supabase Storage
    const files = [];
    // Generate sample folders
    for (let i = 1; i <= 3; i++) {
      files.push({
        name: `Folder ${i}`,
        type: 'folder',
        size: 0,
        created: new Date().toISOString()
      });
    }
    // Generate sample files
    for (let i = 1; i <= 5; i++) {
      files.push({
        name: `Document ${i}.txt`,
        type: 'file',
        size: Math.floor(Math.random() * 10000),
        created: new Date().toISOString()
      });
    }
    // Log operation
    console.log(`[${operationId}] LIST ${path}`);
    res.json({
      success: true,
      files,
      path,
      operationId
    });
  } catch (error) {
    console.error(`[${operationId}] Error listing ${path}:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      operationId
    });
  }
});

app.post('/api/filesystem/create/*', async (req, res) => {
  const path = req.params[0] || '';
  const { type, content } = req.body;
  const operationId = 'op_' + Date.now() + Math.random().toString(36).substr(2, 6);
  try {
    if (!type || (type !== 'file' && type !== 'folder')) {
      console.error(`[${operationId}] Invalid type specified:`, type);
      throw new Error('Invalid type specified. Must be "file" or "folder"');
    }
    // In a real app, you'd create the file/folder in Supabase Storage here
    const result = {
      path,
      name: path.split('/').pop(),
      type,
      size: type === 'file' ? (content?.length || 0) : 0,
      created: new Date().toISOString(),
      operationId
    };
    // Log operation
    console.log(`[${operationId}] CREATE ${type} at ${path}`);
    res.json({
      success: true,
      message: `${type === 'file' ? 'File' : 'Folder'} created successfully`,
      item: result,
      operationId
    });
  } catch (error) {
    console.error(`[${operationId}] Error creating ${path}:`, error);
    res.status(400).json({
      success: false,
      error: error.message,
      operationId
    });
  }
});

app.post('/api/filesystem/delete/*', async (req, res) => {
  const path = req.params[0] || '';
  const operationId = 'op_' + Date.now() + Math.random().toString(36).substr(2, 6);
  try {
    // In a real app, you'd delete from Supabase Storage here
    const result = {
      path,
      name: path.split('/').pop(),
      deleted: true,
      operationId
    };
    // Log operation
    console.log(`[${operationId}] DELETE ${path}`);
    res.json({
      success: true,
      message: 'Item deleted successfully',
      item: result,
      operationId
    });
  } catch (error) {
    console.error(`[${operationId}] Error deleting ${path}:`, error);
    res.status(400).json({
      success: false,
      error: error.message,
      operationId
    });
  }
});

app.get('/list-apps', (req, res) => {
  const showAll = req.query.all === 'true';
  const appsDir = path.join(__dirname, 'data', 'applicaton');
  fs.readdir(appsDir, { withFileTypes: true }, async (err, files) => {
    if (err) {
      console.error('[list-apps] Failed to read apps directory:', err);
      return res.status(500).json([]);
    }
    const folders = [];
    for (const f of files) {
      if (!f.isDirectory()) continue;
      const folder = f.name;
      const manifestPath = path.join(appsDir, folder, '@manifest.oman');
      if (!fs.existsSync(manifestPath)) continue;
      try {
        const manifestText = fs.readFileSync(manifestPath, 'utf-8');
        let invisible = false;
        const lines = manifestText.split(/\r?\n/);
        let section = null;
        for (let line of lines) {
          line = line.trim();
          if (!line || line.startsWith('#') || line.startsWith('//')) continue;
          if (line.startsWith('@#[')) {
            section = line.match(/@#\[(.+?)\]/)?.[1]?.toLowerCase() || null;
            continue;
          }
          if (section === 'ui' && line.toLowerCase().startsWith('invisible')) {
            let [k, v] = line.split('=').map(s => s.trim());
            if (k.toLowerCase() === 'invisible') {
              v = v.replace(/['\"]/g, '').toLowerCase();
              if (v === 'true' || v === '1') {
                invisible = true;
                break;
              }
            }
          }
        }
        if (!invisible || showAll) folders.push(folder);
      } catch (e) {
        folders.push(folder); // fallback: show if error
      }
    }
    console.log(`[list-apps] Found app folders:`, folders);
    res.json(folders);
  });
});

// --- CLI logic removed for Vercel compatibility ---
if (process.env.NODE_ENV !== 'production') {
  console.log('Nodemon is watching for changes...');
}

// Start the server
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

console.log("Server is running in https://localhost:" + PORT);
module.exports = app;
