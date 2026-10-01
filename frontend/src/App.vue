<script setup>
import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from './stores/auth.js';
import { useCompany } from './stores/company.js';
import { toasts } from './utils/toast.js';

const route = useRoute();
const router = useRouter();
const auth = useAuth();
const company = useCompany();
const isPublic = computed(() => route.meta.public);

// Charge les entreprises dès qu'on est connecté
watch(isPublic, (pub) => { if (!pub && !company.ready) company.load(); }, { immediate: true });

// Changer d'entreprise depuis une page de détail : retour à la liste correspondante
watch(() => company.currentId, (now, before) => {
  if (before != null && now !== before && /^\/(invoices|quotes)\/./.test(route.path)) {
    router.push('/' + route.path.split('/')[1]);
  }
});

function onSwitch(e) { company.select(Number(e.target.value)); }

function logout() {
  auth.logout();
  company.reset();
  router.push('/login');
}
</script>

<template>
  <router-view v-if="isPublic" />
  <div v-else class="shell">
    <aside class="side">
      <div class="brand">Facturio</div>
      <div v-if="company.list.length" class="company-switch">
        <label for="company">Entreprise</label>
        <select id="company" :value="company.currentId" @change="onSwitch">
          <option v-for="c in company.list" :key="c.id" :value="c.id">{{ c.company_name }}</option>
        </select>
      </div>
      <nav>
        <router-link to="/" class="exact">Tableau de bord</router-link>
        <router-link to="/invoices">Factures</router-link>
        <router-link to="/quotes">Devis</router-link>
        <router-link to="/clients">Clients</router-link>
        <router-link to="/items">Produits et services</router-link>
        <router-link to="/payments">Paiements</router-link>
        <router-link to="/settings">Entreprises</router-link>
      </nav>
      <div class="who">
        <div>{{ auth.user?.name }}</div>
        <button class="link" style="color: var(--side-ink)" @click="logout">Se déconnecter</button>
      </div>
    </aside>
    <main class="main">
      <router-view v-if="company.ready" :key="`${route.fullPath}|${company.currentId}`" />
    </main>
  </div>
  <div class="toasts" aria-live="polite">
    <div v-for="t in toasts" :key="t.id" class="toast" :class="{ err: t.type === 'err' }">{{ t.message }}</div>
  </div>
</template>
