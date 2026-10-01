# Facturio simple

Application interne de facturation : **Vue 3 + Node.js (Express) + MySQL**.
Version simplifiée de Facturio (Next.js + Supabase) : une seule entreprise, pas de multi-tenant.

## Fonctionnalités
- Clients, produits et services
- Devis → transformation en facture en un clic
- Factures : lignes avec remise et TVA, numérotation automatique `FAC-2026-0001` (sans doublon, même en parallèle)
- Statuts : brouillon, envoyée, payée, annulée, **en retard** (calculé automatiquement selon l'échéance)
- Paiements partiels ou complets (le statut et le reste dû se recalculent tout seuls)
- PDF des factures et devis
- Tableau de bord : encaissé du mois, reste à encaisser, retards, graphique 12 mois
- Connexion par email / mot de passe (JWT), rôles `admin` / `user`

## Installation

Prérequis : Node.js 18+ et MySQL 8 (ou MariaDB 10.5+).

```bash
# 1. Base de données
mysql -u root -p < database/schema.sql
# (optionnel) un utilisateur dédié :
# CREATE USER 'facturio'@'localhost' IDENTIFIED BY 'motdepasse';
# GRANT ALL ON facturio.* TO 'facturio'@'localhost';

# 2. Backend
cd backend
npm install
cp .env.example .env          # puis édite DB_USER, DB_PASSWORD, JWT_SECRET
npm run create-user -- toi@exemple.fr "Ton Nom" unMotDePasse admin
npm run dev                   # API sur http://localhost:3000

# 3. Frontend (dans un autre terminal)
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

Ouvre http://localhost:5173, connecte-toi, puis va dans **Paramètres** pour renseigner
ton entreprise (nom, SIRET, IBAN, préfixes de numérotation, TVA par défaut).

## Production (un seul processus)
```bash
cd frontend && npm run build      # génère frontend/dist
cd ../backend && npm start        # sert l'API ET le front sur le port 3000
```
Mets un reverse proxy (nginx, Caddy) avec HTTPS devant, et un `JWT_SECRET` long et aléatoire.

## Déploiement Docker (xCloud, VPS…)
Le dépôt contient un `Dockerfile` et un `docker-compose.yml` (app + MySQL 8, schéma chargé au premier démarrage).
Variables à fournir (voir `.env.docker.example`) : `DB_PASSWORD`, `DB_ROOT_PASSWORD`, `JWT_SECRET`,
`ADMIN_EMAIL`, `ADMIN_PASSWORD` (le premier compte admin est créé automatiquement si aucun utilisateur n'existe), `APP_PORT`.
```bash
cp .env.docker.example .env && docker compose up -d --build
```

## Structure
```
database/schema.sql          schéma MySQL
backend/src/
  index.js                   serveur Express
  routes/                    auth, crud (clients, produits), documents (factures + devis),
                             payments, dashboard, settings
  pdf.js                     génération des PDF (pdfkit)
  utils.js                   calcul des totaux, helpers
frontend/src/
  views/                     écrans (Dashboard, Clients, DocumentForm, DocumentView…)
  components/  stores/  utils/
```

## Ajouter un utilisateur
```bash
cd backend && npm run create-user -- collegue@exemple.fr "Prénom Nom" motdepasse user
```

## Pistes pour la suite
Envoi des factures par email (nodemailer), factures récurrentes, multi-devises, export CSV comptable, gestion des utilisateurs dans l'interface.
