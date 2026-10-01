<script setup>
import { ref, computed, onMounted } from 'vue';
import api, { errMsg } from '../api.js';
import { useAuth } from '../stores/auth.js';
import { money, dateFr, monthLabel } from '../utils/format.js';
import StatusBadge from '../components/StatusBadge.vue';

const auth = useAuth();
const data = ref(null);
const error = ref('');

async function load(currency) {
  try {
    data.value = (await api.get('/dashboard', { params: currency ? { currency } : {} })).data;
  } catch (e) {
    error.value = errMsg(e);
  }
}
onMounted(() => load());

// Les montants s'affichent dans la devise choisie (un tableau de bord par devise)
const eur = (n) => money(n, data.value?.currency);

const max = computed(() => Math.max(1, ...(data.value?.monthly.map((m) => m.amount) || [1])));
const bars = computed(() =>
  (data.value?.monthly || []).map((m, i) => {
    const h = m.amount > 0 ? Math.max(3, (m.amount / max.value) * 140) : 3;
    return { ...m, x: 8 + i * 48, h, y: 150 - h };
  }),
);
const year = new Date().getFullYear();
</script>

<template>
  <div class="page-head">
    <h1>Bonjour {{ auth.user?.name?.split(' ')[0] }}</h1>
    <div class="actions">
      <router-link to="/quotes/new" class="btn">Nouveau devis</router-link>
      <router-link to="/invoices/new" class="btn primary">Nouvelle facture</router-link>
    </div>
  </div>
  <div v-if="error" class="error">{{ error }}</div>

  <template v-if="data">
    <div v-if="data.currencies.length > 1" class="chips" style="margin-bottom: 14px" role="group" aria-label="Devise affichée">
      <button v-for="c in data.currencies" :key="c" class="chip" :class="{ active: c === data.currency }" @click="load(c)">{{ c }}</button>
    </div>
    <div class="panel kpis">
      <div class="kpi">
        <div class="label">Encaissé ce mois-ci</div>
        <div class="value">{{ eur(data.kpi.collected_month) }}</div>
      </div>
      <div class="kpi">
        <div class="label">Reste à encaisser</div>
        <div class="value">{{ eur(data.kpi.outstanding) }}</div>
        <div class="sub">{{ data.kpi.draft_count }} brouillon(s) non envoyé(s)</div>
      </div>
      <div class="kpi" :class="{ alert: data.kpi.overdue_count > 0 }">
        <div class="label">En retard</div>
        <div class="value">{{ eur(data.kpi.overdue_amount) }}</div>
        <div class="sub">{{ data.kpi.overdue_count }} facture(s)</div>
      </div>
      <div class="kpi">
        <div class="label">Facturé en {{ year }} (TTC)</div>
        <div class="value">{{ eur(data.kpi.invoiced_year) }}</div>
        <div class="sub">{{ data.kpi.open_quotes }} devis en cours</div>
      </div>
    </div>

    <div class="cols">
      <div class="panel">
        <div class="panel-head"><h2>Encaissements sur 12 mois</h2></div>
        <div class="chart">
          <svg viewBox="0 0 580 180" role="img" aria-label="Encaissements par mois">
            <line x1="0" y1="150.5" x2="580" y2="150.5" stroke="#d9dfe3" />
            <g v-for="b in bars" :key="b.month">
              <rect class="bar" :class="{ empty: b.amount === 0 }" :x="b.x" :y="b.y" width="32" :height="b.h" rx="2">
                <title>{{ monthLabel(b.month) }} : {{ eur(b.amount) }}</title>
              </rect>
              <text :x="b.x + 16" y="168" text-anchor="middle">{{ monthLabel(b.month) }}</text>
            </g>
          </svg>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h2>Factures en retard</h2></div>
        <div v-if="!data.overdue.length" class="empty"><strong>Rien en retard</strong>Toutes les factures envoyées sont dans les délais.</div>
        <table v-else>
          <tbody>
            <tr v-for="i in data.overdue" :key="i.id" class="click" @click="$router.push(`/invoices/${i.id}`)">
              <td>
                <div>{{ i.client_name }}</div>
                <div class="late">{{ i.days_late }} jour(s) de retard · {{ i.number }}</div>
              </td>
              <td class="num">{{ eur(i.balance_due) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <h2>Dernières factures</h2>
        <router-link to="/invoices">Tout voir</router-link>
      </div>
      <div v-if="!data.recent.length" class="empty">
        <strong>Aucune facture pour l'instant</strong>
        <router-link to="/invoices/new">Créer la première facture</router-link>
      </div>
      <div v-else class="table-wrap">
        <table>
          <tbody>
            <tr v-for="i in data.recent" :key="i.id" class="click" @click="$router.push(`/invoices/${i.id}`)">
              <td>{{ i.number }}</td>
              <td>{{ i.client_name }}</td>
              <td class="muted">{{ dateFr(i.issue_date) }}</td>
              <td class="num">{{ money(i.total, i.currency) }}</td>
              <td><StatusBadge :status="i.display_status" /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </template>
</template>
