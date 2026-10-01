<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from './stores/auth.js';
import { toasts } from './utils/toast.js';

const route = useRoute();
const router = useRouter();
const auth = useAuth();
const isPublic = computed(() => route.meta.public);

function logout() {
  auth.logout();
  router.push('/login');
}
</script>

<template>
  <router-view v-if="isPublic" />
  <div v-else class="shell">
    <aside class="side">
      <div class="brand">Facturio</div>
      <nav>
        <router-link to="/" class="exact">Tableau de bord</router-link>
        <router-link to="/invoices">Factures</router-link>
        <router-link to="/quotes">Devis</router-link>
        <router-link to="/clients">Clients</router-link>
        <router-link to="/items">Produits et services</router-link>
        <router-link to="/payments">Paiements</router-link>
        <router-link to="/settings">Paramètres</router-link>
      </nav>
      <div class="who">
        <div>{{ auth.user?.name }}</div>
        <button class="link" style="color: var(--side-ink)" @click="logout">Se déconnecter</button>
      </div>
    </aside>
    <main class="main">
      <router-view :key="route.fullPath" />
    </main>
  </div>
  <div class="toasts" aria-live="polite">
    <div v-for="t in toasts" :key="t.id" class="toast" :class="{ err: t.type === 'err' }">{{ t.message }}</div>
  </div>
</template>
