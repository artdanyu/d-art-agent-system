import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import express from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import cors from 'cors';
import { openDb } from './db.js';
import { syncAgentsFromClients } from './clients/compose.js';
import { accessControl } from './middleware/accessControl.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import { createChatRouter } from './routes/chat.js';
import { createLeadRouter } from './routes/lead.js';
import { MSG_ERROR } from './security/messages.js';

const isProd = process.env.NODE_ENV === 'production';
const rawCors = (process.env.CORS_ORIGIN || '').trim();

if (isProd) {
  if (!rawCors || rawCors === '*') {
    console.error(
      'FATAL: Set CORS_ORIGIN to explicit origins (comma-separated), not *, in production.'
    );
    process.exit(1);
  }
  const hasKey = !!(process.env.API_KEY || '').trim();
  if (!hasKey && process.env.ALLOW_ANONYMOUS_ACCESS !== '1') {
    console.error(
      'FATAL: Set API_KEY or explicitly set ALLOW_ANONYMOUS_ACCESS=1 (see .env.example).'
    );
    process.exit(1);
  }
}

const corsOrigin =
  !rawCors || rawCors === '*'
    ? true
    : rawCors
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

const PORT = Number(process.env.PORT) || 3000;
const BIND = (process.env.BIND_ADDRESS || '0.0.0.0').trim();
const dbPath = process.env.DATABASE_PATH || './data/app.db';

const corsOptions = {
  origin: corsOrigin,
  credentials: false,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-API-Key', 'Authorization'],
  maxAge: 86400,
};

const app = express();
app.disable('x-powered-by');

if (process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

app.use(securityHeaders);

app.use(cors(corsOptions));

app.use((req, res, next) => {
  if (req.method === 'OPTIONS' && (req.path === '/chat' || req.path === '/lead')) {
    return res.sendStatus(204);
  }
  next();
});

const jsonLimit = (process.env.JSON_BODY_LIMIT || '128kb').trim();
app.use(express.json({ limit: jsonLimit }));

const db = openDb(dbPath);
syncAgentsFromClients(db);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/chat', accessControl, createChatRouter(db));
app.use('/lead', accessControl, createLeadRouter(db));

app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.statusCode || 500;
  const safe = status >= 500 ? MSG_ERROR : err.message || MSG_ERROR;
  res.status(status).json({ error: safe });
});

app.listen(PORT, BIND, () => {
  console.log(`D-Art AI backend listening on ${BIND}:${PORT}`);
});
