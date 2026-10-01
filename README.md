# Facturio simple

Application interne de facturation : **Vue 3 + Node.js (Express) + MySQL**.
Version simplifiée de Facturio (Next.js + Supabase) : **plusieurs entreprises** gérées par la même équipe (sans multi-tenant), et une **devise par document**.

## Fonctionnalités
- **Espaces totalement isolés** : un administrateur peut créer d'autres administrateurs. Chacun crée ses propres entreprises, que personne d'autre ne voit (ni clients, ni produits, ni factures, ni utilisateurs). L'accès se règle entreprise par entreprise.
- **Modèles de factures et de devis** (Paramètres > Modèles) : logo, couleur, disposition (classique, moderne, minimal), titre, colonnes Remise/TVA, coordonnées bancaires, notes, conditions et pied de page, avec aperçu en direct. Un modèle par défaut par type, appliqué aussi au PDF.
- **Paramètres** : modèles, utilisateurs (création, rôles, accès par entreprise, mot de passe) et « Mon compte » (nom, mot de passe).
- **Interface moderne** : mode sombre et mode clair (bouton en haut à droite, choix mémorisé, sinon réglage du système), accent bleu Apple, recherche rapide (⌘K / Ctrl+K).
- **Plusieurs entreprises** : chacune a ses clients, produits, devis, factures, préfixes et numérotation. On change d'entreprise depuis le menu de la barre latérale.
- **Devises** : EUR, USD, GBP, CHF, CAD, AUD, MAD, TND, DZD, XOF, XAF, ZAR. Chaque entreprise a une devise par défaut, modifiable sur chaque devis ou facture (le PDF et le tableau de bord suivent).
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

Ouvre http://localhost:5173, connecte-toi, puis va dans **Entreprises** pour renseigner
tes entreprises (nom, SIRET, IBAN, devise, préfixes de numérotation, TVA par défaut).

## Production (un seul processus)
```bash
cd frontend && npm run build      # génère frontend/dist
cd ../backend && npm start        # sert l'API ET le front sur le port 3000
```
Mets un reverse proxy (nginx, Caddy) avec HTTPS devant, et un `JWT_SECRET` long et aléatoire.

## Déploiement Docker (xCloud, VPS…)
Le dépôt contient un `Dockerfile` et un `docker-compose.yml` (app + MySQL 8, schéma chargé au premier démarrage).
Variables à fournir (voir `.env.docker.example`) : `DB_PASSWORD`, `DB_ROOT_PASSWORD`, `JWT_SECRET`,
`ADMIN_EMAIL`, `ADMIN_PASSWORD` (le premier compte admin est créé automatiquement si aucun utilisateur n'existe). L'app est publiée sur `127.0.0.1:3002`.
```bash
cp .env.docker.example .env && docker compose up -d --build
```

## Structure
```
database/schema.sql          schéma MySQL
backend/src/
  index.js                   serveur Express
  routes/                    auth, companies, users, templates, crud (clients, produits),
                             documents (factures + devis), payments, dashboard
  migrate.js                 migrations automatiques de la base
  pdf.js                     génération des PDF (pdfkit)
  utils.js                   calcul des totaux, helpers
frontend/src/
  views/                     écrans (Dashboard, Clients, DocumentForm, DocumentView…)
  components/  stores/  utils/
```

## Mise à jour de la base
Au démarrage, le backend applique automatiquement les migrations nécessaires (`backend/src/migrate.js`).
Une base créée avec une ancienne version est convertie sans perte (données et numérotation conservées).
À la mise à jour vers les espaces isolés, les comptes existants gardent l'accès à toutes les entreprises existantes.

## Ajouter un utilisateur
Depuis l'application : **Paramètres > Utilisateurs > Nouveau compte** (rôle, mot de passe, entreprises accessibles).
Un administrateur sans entreprise cochée démarre avec un espace vide et crée la sienne : elle est invisible pour les autres.

En ligne de commande (outil d'exploitation, donne accès à **toutes** les entreprises existantes) :
```bash
cd backend && npm run create-user -- collegue@exemple.fr "Prénom Nom" motdepasse user
```

## Pistes pour la suite
Envoi des factures par email (nodemailer), factures récurrentes, multi-devises, export CSV comptable, gestion des utilisateurs dans l'interface.
