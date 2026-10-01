<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from './stores/auth.js';
import { useCompany } from './stores/company.js';
import { useTheme } from './stores/theme.js';
import { toasts } from './utils/toast.js';
import Icon from './components/Icon.vue';
import BrandMark from './components/BrandMark.vue';
import Onboarding from './components/Onboarding.vue';

const route = useRoute();
const router = useRouter();
const auth = useAuth();
const company = useCompany();
const theme = useTheme();
const isPublic = computed(() => route.meta.public);

// Route résolue (avant, route.meta est vide et on ne sait pas encore si la page est publique)
const resolved = computed(() => route.matched.length > 0);

// Charge les entreprises dès qu'on est connecté sur une page privée
watch(() => [route.matched.length, route.meta.public], ([n, pub]) => {
  if (n && !pub && auth.user && !company.ready) company.load();
}, { immediate: true });

// Changer d'entreprise depuis une page de détail : retour à la liste correspondante
watch(() => company.currentId, (now, before) => {
  if (before != null && now !== before && /^\/(invoices|quotes)\/./.test(route.path)) {
    router.push('/' + route.path.split('/')[1]);
  }
});

const SECTIONS = {
  '': 'Tableau de bord', invoices: 'Factures', quotes: 'Devis', clients: 'Clients',
  items: 'Produits et services', payments: 'Paiements', reminders: 'Relances', reports: 'Rapports', companies: 'Entreprises', settings: 'Paramètres',
};
const crumbs = computed(() => {
  const [a, b] = route.path.split('/').filter(Boolean);
  const SETTINGS = { templates: 'Modèles de documents', email: 'Email', 'email-templates': 'Emails types', users: 'Utilisateurs', account: 'Mon compte' };
  const sub = !b ? null : a === 'settings' ? SETTINGS[b] : b === 'new' ? 'Nouveau' : route.path.endsWith('/edit') ? 'Modifier' : 'Détail';
  if (company.ready && !company.list.length) return { section: 'Bienvenue', sub: null };
  return { section: SECTIONS[a || ''] || '', sub };
});
const initials = computed(() => (auth.user?.name || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase());

// Recherche : ⌘K / Ctrl+K pour la sélectionner, Entrée pour chercher une facture ou un client
const query = ref('');
const searchInput = ref(null);
function search() {
  const q = query.value.trim();
  if (q) router.push({ path: '/invoices', query: { q } });
}
function onKey(e) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchInput.value?.focus(); }
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));

function onSwitch(e) { company.select(Number(e.target.value)); }
function logout() {
  auth.logout();
  company.reset();
  router.push('/login');
}
</script>

<template>
  <router-view v-if="resolved && isPublic" />
  <div v-else-if="resolved" class="shell">
    <aside class="side">
      <div class="brand"><BrandMark /> Facturio</div>

      <div v-if="company.list.length" class="company-switch">
        <label for="company">Entreprise</label>
        <select id="company" :value="company.currentId" @change="onSwitch">
          <option v-for="c in company.list" :key="c.id" :value="c.id">{{ c.company_name }}</option>
        </select>
      </div>

      <nav v-if="company.list.length" aria-label="Navigation principale">
        <div class="nav-group">
          <div class="nav-label">Général</div>
          <router-link to="/" class="nav-item" active-class="" exact-active-class="active"><span class="nav-ico"><Icon name="home" /></span>Tableau de bord</router-link>
          <router-link to="/invoices" class="nav-item" active-class="active"><span class="nav-ico"><Icon name="invoice" /></span>Factures</router-link>
          <router-link to="/quotes" class="nav-item" active-class="active"><span class="nav-ico"><Icon name="quote" /></span>Devis</router-link>
          <router-link to="/reminders" class="nav-item" active-class="active"><span class="nav-ico"><Icon name="bell" /></span>Relances</router-link>
        </div>
        <div class="nav-group">
          <div class="nav-label">Outils</div>
          <router-link to="/clients" class="nav-item" active-class="active"><span class="nav-ico"><Icon name="users" /></span>Clients</router-link>
          <router-link to="/items" class="nav-item" active-class="active"><span class="nav-ico"><Icon name="package" /></span>Produits et services</router-link>
          <router-link to="/payments" class="nav-item" active-class="active"><span class="nav-ico"><Icon name="card" /></span>Paiements</router-link>
          <router-link to="/reports" class="nav-item" active-class="active"><span class="nav-ico"><Icon name="chart" /></span>Rapports</router-link>
        </div>
        <div class="nav-group">
          <div class="nav-label">Administration</div>
          <router-link to="/companies" class="nav-item" active-class="active"><span class="nav-ico"><Icon name="building" /></span>Entreprises</router-link>
          <router-link to="/settings" class="nav-item" active-class="active"><span class="nav-ico"><Icon name="gear" /></span>Paramètres</router-link>
        </div>
      </nav>

      <div class="who">
        <span class="avatar">{{ initials }}</span>
        <div class="meta">
          <div>{{ auth.user?.name }}</div>
          <div>{{ auth.isAdmin ? 'Administrateur' : 'Utilisateur' }}</div>
        </div>
        <button class="icon-btn" style="width: 34px; height: 34px" aria-label="Se déconnecter" title="Se déconnecter" @click="logout"><Icon name="logout" /></button>
      </div>
    </aside>

    <div class="content">
      <header class="topbar">
        <div class="crumbs">
          Facturio / <b>{{ crumbs.section }}</b><template v-if="crumbs.sub"> / {{ crumbs.sub }}</template>
        </div>
        <form v-if="company.list.length" class="search" role="search" @submit.prevent="search">
          <Icon name="search" />
          <input ref="searchInput" v-model="query" type="search" placeholder="Rechercher une facture ou un client" aria-label="Rechercher" />
          <span class="kbd">⌘K</span>
        </form>
        <div class="top-actions">
          <button class="icon-btn" :aria-label="theme.mode === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'"
            :title="theme.mode === 'dark' ? 'Mode clair' : 'Mode sombre'" @click="theme.toggle()">
            <Icon :name="theme.mode === 'dark' ? 'sun' : 'moon'" />
          </button>
        </div>
      </header>
      <main class="main">
        <Onboarding v-if="company.ready && !company.list.length" />
        <router-view v-else-if="company.ready" :key="`${route.path.startsWith('/settings') ? '/settings' : route.fullPath}|${company.currentId}`" />
      </main>
    </div>
  </div>
  <div class="toasts" aria-live="polite">
    <div v-for="t in toasts" :key="t.id" class="toast" :class="{ err: t.type === 'err' }">{{ t.message }}</div>
  </div>
</template>
