# Facturio - Application SaaS de Facturation

Application web de facturation multi-entreprises avec support multi-devises (EUR, USD, CHF), gestion complète des clients, produits, devis et factures.

## Caractéristiques principales

- **Multi-tenant strict** : Un utilisateur peut gérer plusieurs entreprises
- **Multi-devises** : Support EUR, USD, CHF (extensible)
- **Authentification sécurisée** : via Supabase Auth (email/password)
- **Gestion complète** :
  - Clients avec coordonnées complètes
  - Catalogue produits/services
  - Devis avec lignes détaillées
  - Factures avec numérotation automatique
  - Suivi des paiements
- **Sécurité RLS** : Row Level Security strict pour l'isolation des données
- **Dashboard** : KPIs et activité récente
- **Responsive** : Interface moderne adaptée desktop

## Stack technique

- **Frontend** : Next.js 13 (App Router) + TypeScript + TailwindCSS
- **UI** : shadcn/ui + Radix UI
- **Backend** : Supabase (PostgreSQL + Auth)
- **Data Access** : Server Actions + API Routes
- **Validation** : Zod
- **Icons** : Lucide React

## Prérequis

- Node.js 18+ et npm
- Un projet Supabase (auto-hébergé ou cloud)

## Installation

1. **Cloner le projet**
```bash
git clone <votre-repo>
cd facturio
npm install
```

2. **Configuration Supabase**

Créez un fichier `.env.local` à la racine du projet:

```env
NEXT_PUBLIC_SUPABASE_URL=votre-url-supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre-anon-key
```

3. **Migrations de base de données**

Les migrations SQL sont dans le fichier de migration Supabase. Exécutez-les via le dashboard Supabase ou via la CLI.

Le schéma inclut:
- Tables : profiles, companies, company_members, clients, items, quotes, quote_lines, invoices, invoice_lines, payments
- RLS policies strictes pour isolation multi-tenant
- Triggers auto pour profils et memberships
- Indexes de performance

4. **Lancer en développement**

```bash
npm run dev
```

L'application sera disponible sur `http://localhost:3000`

5. **Build production**

```bash
npm run build
npm start
```

## Structure du projet

```
/app
  /(auth)           # Pages d'authentification (login, signup, onboarding)
  /(dashboard)      # Pages de l'application (protégées)
    /dashboard      # Tableau de bord
    /clients        # Gestion clients
    /items          # Gestion produits/services
    /invoices       # Gestion factures
    /quotes         # Gestion devis
    /payments       # Gestion paiements
    /settings       # Paramètres entreprise
  /api              # API Routes
/components         # Composants réutilisables + UI components (shadcn)
/lib
  /actions          # Server Actions (auth, clients, items, invoices, companies)
  /supabase         # Clients Supabase (server & browser)
  /context          # Context React (CompanyProvider)
  currency.ts       # Utils devises et formatage
/types
  database.ts       # Types TypeScript générés du schéma DB
```

## Utilisation

### Première connexion

1. Créez un compte sur `/signup`
2. Complétez l'onboarding (création première entreprise)
3. Vous êtes redirigé sur le dashboard

### Gestion multi-entreprises

- Utilisez le **company switcher** en haut de la sidebar
- Créez de nouvelles entreprises via le bouton "+"
- Toutes les données sont isolées par entreprise (RLS)

### Workflow facturation

1. **Créer des clients** : Menu Clients → Nouveau client
2. **Créer des produits** : Menu Produits & Services → Nouveau produit
3. **Créer une facture** : Menu Factures → Nouvelle facture
   - Sélectionnez un client
   - Choisissez la devise
   - Ajoutez des lignes (produits ou personnalisées)
   - Les calculs (TVA, remises, totaux) sont automatiques
   - La numérotation est automatique par entreprise
4. **Enregistrer des paiements** : Menu Paiements → Enregistrer un paiement

### Paramètres entreprise

Dans Paramètres, configurez:
- Informations légales (nom, SIRET, TVA)
- Coordonnées (adresse, email, téléphone)
- Devise par défaut
- Préfixes de numérotation (factures, devis)
- TVA par défaut
- Délai de paiement standard

## Sécurité

- **RLS strict** : Chaque requête DB vérifie le membership via `company_members`
- **Authentification** : Session Supabase via cookies sécurisés
- **Server Actions** : Toutes les mutations passent par le serveur
- **Validation** : Toutes les entrées utilisateur sont validées
- **Service Role Key** : Jamais exposée au client (utilisée uniquement côté serveur)

## Multi-devises

L'application supporte nativement EUR, USD, CHF:
- Chaque entreprise a une devise par défaut
- Chaque facture/devis peut avoir sa propre devise
- Formatage automatique selon la locale de la devise
- Préparé pour l'ajout de taux de change

Pour ajouter une devise:
1. Ajouter dans `lib/currency.ts` → `CURRENCIES`
2. Ajouter le format et symbole

## Développement

### Commandes utiles

```bash
npm run dev        # Développement
npm run build      # Build production
npm run start      # Serveur production
npm run lint       # Linter
npm run typecheck  # Vérification TypeScript
```

### Ajout de fonctionnalités

Pour ajouter une nouvelle entité (ex: fournisseurs):

1. **Migration DB** :
   - Créer la table avec `company_id`
   - Activer RLS
   - Créer les policies (SELECT, INSERT, UPDATE, DELETE)

2. **Types TypeScript** :
   - Mettre à jour `types/database.ts`

3. **Server Actions** :
   - Créer `lib/actions/nomEntite.ts`
   - Implémenter CRUD functions

4. **UI** :
   - Page liste dans `app/(dashboard)/nomEntite/page.tsx`
   - Dialog formulaire dans `components/nomEntite-dialog.tsx`
   - Table dans `components/nomEntite-table.tsx`

5. **Navigation** :
   - Ajouter dans `components/dashboard-layout.tsx`

## Déploiement

### Variables d'environnement requises

```env
NEXT_PUBLIC_SUPABASE_URL=votre-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre-anon-key
```

### Options de déploiement

- **Vercel** : Connexion directe du repo GitHub
- **Netlify** : Support Next.js intégré
- **Docker** : Créer un Dockerfile standard Next.js
- **VPS** : `npm run build && npm start`

Assurez-vous que:
- Les variables d'environnement sont configurées
- Le projet Supabase est accessible
- Les migrations DB sont appliquées

## Roadmap / Améliorations futures

- [ ] Génération PDF des factures (server-side)
- [ ] Envoi email automatique
- [ ] Gestion des devis (workflow complet)
- [ ] Paiements automatiques (Stripe)
- [ ] Récurrence factures
- [ ] Multi-langues (i18n)
- [ ] Export comptable
- [ ] Rapports avancés
- [ ] API publique

## Support

Pour toute question ou problème:
1. Vérifiez la documentation Supabase
2. Consultez les logs serveur
3. Vérifiez les RLS policies

## Licence

MIT

---

**Note** : Cette application est un MVP fonctionnel. Pour une utilisation production, ajoutez tests, monitoring, et génération PDF.
