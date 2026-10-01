import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import { pool } from './db.js';
import { requireAuth, withCompany, errorHandler } from './middleware.js';
import authRouter from './routes/auth.js';
import { clientsRouter, itemsRouter } from './routes/crud.js';
import companiesRouter from './routes/companies.js';
import { documentsRouter } from './routes/documents.js';
import paymentsRouter from './routes/payments.js';
import dashboardRouter from './routes/dashboard.js';
import { bootstrapAdmin } from './bootstrap.js';
import { migrate } from './migrate.js';

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
app.use('/api/companies', requireAuth, companiesRouter);
// Les routes suivantes travaillent sur l'entreprise courante (en-tête X-Company-Id)
app.use('/api/clients', requireAuth, withCompany, clientsRouter());
app.use('/api/items', requireAuth, withCompany, itemsRouter());
app.use('/api/invoices', requireAuth, withCompany, documentsRouter('invoice'));
app.use('/api/quotes', requireAuth, withCompany, documentsRouter('quote'));
app.use('/api/payments', requireAuth, withCompany, paymentsRouter);
app.use('/api/dashboard', requireAuth, withCompany, dashboardRouter);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Route inconnue' }));

// Production : si le front est compilé (frontend/dist), Node le sert aussi -> un seul processus à lancer.
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use(errorHandler);

const port = Number(process.env.PORT || 3000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function start() {
  // Migration de la base au démarrage (avec réessais : MySQL peut être encore en train de démarrer)
  for (let attempt = 1; ; attempt++) {
    try { await migrate(); break; }
    catch (err) {
      if (attempt >= 20) { console.error('Migration impossible :', err); process.exit(1); }
      console.log(`Base pas prête (${err.code || err.message}), nouvel essai…`);
      await sleep(3000);
    }
  }
  app.listen(port, () => {
    console.log(`API Facturio sur http://localhost:${port}`);
    bootstrapAdmin();
  });
}
start();
