<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import api from '../api.js';
import { money, dateFr, STATUS } from '../utils/format.js';
import StatusBadge from '../components/StatusBadge.vue';

const props = defineProps({ type: String });
const base = computed(() => (props.type === 'invoice' ? 'invoices' : 'quotes'));
const isInvoice = computed(() => props.type === 'invoice');

const route = useRoute();
const rows = ref([]);
const q = ref(String(route.query.q || ''));
const status = ref('');
const loading = ref(true);

const filters = computed(() => {
  const keys = isInvoice.value
    ? ['draft', 'sent', 'overdue', 'paid', 'cancelled']
    : ['draft', 'sent', 'accepted', 'rejected', 'invoiced'];
  return keys.map((k) => ({ value: k, label: STATUS[props.type][k] }));
});

async function load() {
  loading.value = true;
  try {
    rows.value = (await api.get(`/${base.value}`, { params: { q: q.value || undefined, status: status.value || undefined } })).data;
  } finally { loading.value = false; }
}
onMounted(load);
watch(status, load);
let t;
watch(q, () => { clearTimeout(t); t = setTimeout(load, 250); });
</script>

<template>
  <div class="page-head">
    <h1>{{ isInvoice ? 'Factures' : 'Devis' }}</h1>
    <router-link :to="`/${base}/new`" class="btn primary">{{ isInvoice ? 'Nouvelle facture' : 'Nouveau devis' }}</router-link>
  </div>
  <div class="panel">
    <div class="searchbar">
      <input v-model="q" placeholder="Numéro ou client" aria-label="Rechercher" />
      <select v-model="status" aria-label="Filtrer par statut">
        <option value="">Tous les statuts</option>
        <option v-for="f in filters" :key="f.value" :value="f.value">{{ f.label }}</option>
      </select>
    </div>
    <div v-if="!loading && !rows.length" class="empty">
      <strong>{{ q || status ? 'Aucun résultat' : isInvoice ? 'Aucune facture' : 'Aucun devis' }}</strong>
      <router-link v-if="!q && !status" :to="`/${base}/new`">{{ isInvoice ? 'Créer une facture' : 'Créer un devis' }}</router-link>
    </div>
    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Numéro</th><th>Client</th><th>Date</th><th>{{ isInvoice ? 'Échéance' : 'Valable jusqu\'au' }}</th>
            <th class="num">Total TTC</th><th v-if="isInvoice" class="num">Reste dû</th><th>Statut</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in rows" :key="d.id" class="click" @click="$router.push(`/${base}/${d.id}`)">
            <td><strong>{{ d.number }}</strong></td>
            <td>{{ d.client_name }}</td>
            <td class="muted">{{ dateFr(d.issue_date) }}</td>
            <td class="muted">{{ dateFr(isInvoice ? d.due_date : d.valid_until) }}</td>
            <td class="num">{{ money(d.total, d.currency) }}</td>
            <td v-if="isInvoice" class="num">{{ d.status === 'cancelled' ? '' : money(d.total - d.amount_paid, d.currency) }}</td>
            <td><StatusBadge :type="type" :status="d.display_status" /></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
