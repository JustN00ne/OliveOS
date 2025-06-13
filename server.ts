import dotenv from 'dotenv';
dotenv.config(); // Load .env for Supabase keys

import express, { Request, Response } from 'express';
import path from 'path';

import fs from 'fs-extra';
import { program } from 'commander';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import request from 'request';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';
import { URL } from 'url';
import { RequestHandler } from 'express';
import { engine } from 'express-handlebars';

// --- Supabase Client Setup ---
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('Connected to Supabase.');

// --- Express App Setup ---
const app = express();
const PORT = process.env.PORT || 3000;

let globalData: Record<string, any> = {};
const globalDataPath = path.join(__dirname, 'data', 'default', 'data.json');
try {
  globalData = JSON.parse(fs.readFileSync(globalDataPath, 'utf-8'));
} catch (err: any) {
  console.warn('Warning: Failed to load global data for Handlebars template:', err.message);
}

app.engine('hbs', engine({ extname: '.hbs', defaultLayout: false }));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'public'));

// --- Static and Body Middleware ---
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// --- Home Route ---
app.get('/', (req: Request, res: Response) => {
  res.render('index', { ...globalData });
});

// --- Proxy Endpoint ---
const proxyHandler: RequestHandler = (req, res): void => {
    const targetUrl = req.method === 'POST' ? req.body.url : req.query.url as string;
    if (!targetUrl) {
        res.status(400).send('Missing ?url');
        return;
    }

    request(
        {
            url: targetUrl,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            },
            encoding: null,
        },
        (err, response, body) => {
            if (err || !response) {
                res.status(500).send('Request failed');
                return;
            }

            const contentType = response.headers['content-type'] || '';
            res.removeHeader('Content-Security-Policy');
            res.removeHeader('X-Frame-Options');
            res.setHeader('Content-Security-Policy', "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;");
            res.setHeader('X-Frame-Options', 'ALLOWALL');

            // Handle HTML
            if (contentType.includes('text/html')) {
                const html = iconv.decode(body, 'utf-8');
                const $ = cheerio.load(html);

                const rewriteAttrs: Record<string, string> = {
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
                            $el.prepend(`<input type="hidden" name="url" value="${abs}">`);
                        } else {
                            $el.attr(attr, `/proxy?url=${encodeURIComponent(abs)}`);
                        }
                    });
                });

                res.setHeader('Content-Type', 'text/html');
                res.send($.html());
                return;
            }

            // Non-HTML
            res.setHeader('Content-Type', contentType);
            res.send(body);
        }
    );
};

app.all('/proxy', proxyHandler);

// --- Server Start ---
function startServer(): void {
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

if (process.argv.length <= 2 || process.argv[2] === 'start') {
  startServer();
} else {
  program.parse(process.argv);
}
