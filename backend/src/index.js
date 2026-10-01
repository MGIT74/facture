import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import { pool } from './db.js';
import { requireAuth, errorHandler } from './middleware.js';
import authRouter from './routes/auth.js';
import { clientsRouter, itemsRouter } from './routes/crud.js';
import settingsRouter from './routes/settings.js';
import { documentsRouter } from './routes/documents.js';
import paymentsRouter from './routes/payments.js';
import dashboardRouter from './routes/dashboard.js';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error('JWT_SECRET manquant ou trop court (16 caractères minimum). Voir .env.example');
  process.exit(1);
}

const app = express();
app.use(cors(process.env.CORS_ORIGIN ? { origin: process.env.CORS_ORIGIN } : {}));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true });
});

app.use('/api/auth', authRouter);
app.use('/api/clients', requireAuth, clientsRouter());
app.use('/api/items', requireAuth, itemsRouter());
app.use('/api/settings', requireAuth, settingsRouter);
app.use('/api/invoices', requireAuth, documentsRouter('invoice'));
app.use('/api/quotes', requireAuth, documentsRouter('quote'));
app.use('/api/payments', requireAuth, paymentsRouter);
app.use('/api/dashboard', requireAuth, dashboardRouter);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Route inconnue' }));

// Production : si le front est compilé (frontend/dist), Node le sert aussi -> un seul processus à lancer.
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use(errorHandler);

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`API Facturio sur http://localhost:${port}`));
