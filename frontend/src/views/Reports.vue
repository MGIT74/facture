<script setup>
import { ref, computed, onMounted } from 'vue';
import api, { errMsg, downloadFile } from '../api.js';
import { money, dateFr, monthLabel, todayISO } from '../utils/format.js';
import { toast } from '../utils/toast.js';
import Icon from '../components/Icon.vue';

const now = new Date();
const y = now.getFullYear();
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const range = ref({ from: `${y}-01-01`, to: todayISO() });
const currency = ref(null);
const data = ref(null);
const error = ref('');
const preset = ref('year');

async function load() {
  error.value = '';
  try {
    data.value = (await api.get('/reports', { params: { ...range.value, currency: currency.value || undefined } })).data;
    currency.value = data.value.currency;
  } catch (e) { error.value = errMsg(e); }
}
onMounted(load);

function setPreset(p) {
  preset.value = p;
  const d = new Date();
  if (p === 'month') range.value = { from: iso(new Date(d.getFullYear(), d.getMonth(), 1)), to: iso(d) };
  else if (p === 'quarter') range.value = { from: iso(new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1)), to: iso(d) };
  else if (p === 'year') range.value = { from: `${d.getFullYear()}-01-01`, to: iso(d) };
  else if (p === '12m') range.value = { from: iso(new Date(d.getFullYear() - 1, d.getMonth() + 1, 1)), to: iso(d) };
  load();
}
const eur = (n) => money(n, data.value?.currency);
const maxMonth = computed(() => Math.max(1, ...(data.value?.months || []).map((m) => Math.max(m.invoiced, m.collected))));
const QUOTE = { draft: 'Brouillons', sent: 'Envoyés', accepted: 'Acceptés', rejected: 'Refusés', invoiced: 'Facturés' };

async function exportCsv(what) {
  try { await downloadFile(`/reports/export/${what}`, range.value, `${what}.csv`); }
  catch (e) { toast(errMsg(e), 'err'); }
}
</script>

<template>
  <div class="page-head">
    <h1>Rapports</h1>
    <div class="actions">
      <button v-for="p in [['month', 'Ce mois'], ['quarter', 'Ce trimestre'], ['year', 'Cette année'], ['12m', '12 mois']]" :key="p[0]" class="chip" :class="{ active: preset === p[0] }" @click="setPreset(p[0])">{{ p[1] }}</button>
    </div>
  </div>
  <div v-if="error" class="error">{{ error }}</div>

  <div class="panel" style="margin-bottom: 16px"><div class="panel-body" style="display: flex; gap: 14px; flex-wrap: wrap; align-items: flex-end">
    <div class="field"><label>Du</label><input v-model="range.from" type="date" @change="preset = ''; load()" /></div>
    <div class="field"><label>Au</label><input v-model="range.to" type="date" @change="preset = ''; load()" /></div>
    <div v-if="data && data.currencies.length > 1" class="chips" role="group" aria-label="Devise">
      <button v-for="c in data.currencies" :key="c" class="chip" :class="{ active: c === data.currency }" @click="currency = c; load()">{{ c }}</button>
    </div>
  </div></div>

  <template v-if="data">
    <div class="cur-cards">
      <div class="panel card-pad"><div class="card-title">Facturé HT</div><div class="card-big">{{ eur(data.totals.ht) }}</div><div class="muted small">{{ data.totals.invoices }} facture(s)</div></div>
      <div class="panel card-pad"><div class="card-title">TVA</div><div class="card-big">{{ eur(data.totals.tax) }}</div></div>
      <div class="panel card-pad"><div class="card-title">Facturé TTC</div><div class="card-big">{{ eur(data.totals.ttc) }}</div></div>
      <div class="panel card-pad"><div class="card-title">Encaissé sur la période</div><div class="card-big">{{ eur(data.totals.collected) }}</div></div>
      <div class="panel card-pad"><div class="card-title">Reste à encaisser</div><div class="card-big">{{ eur(data.totals.outstanding) }}</div></div>
      <div class="panel card-pad"><div class="card-title">dont en retard</div><div class="card-big" :class="{ late: data.totals.overdue > 0 }">{{ eur(data.totals.overdue) }}</div></div>
    </div>

    <div class="dash-grid" style="grid-template-columns: 1.4fr 1fr">
      <div class="panel">
        <div class="panel-head"><h2>Par mois</h2><div class="legend"><span><i style="background: var(--muted)"></i>Facturé TTC</span><span><i style="background: var(--chart)"></i>Encaissé</span></div></div>
        <div class="table-wrap"><table>
          <tbody>
            <tr v-for="m in data.months" :key="m.month">
              <td class="nowrap" style="width: 90px">{{ monthLabel(m.month) }} {{ m.month.slice(2, 4) }}</td>
              <td>
                <div class="bar-h" :style="{ width: (m.invoiced / maxMonth) * 100 + '%', background: 'var(--muted)', opacity: .55 }"></div>
                <div class="bar-h" :style="{ width: (m.collected / maxMonth) * 100 + '%', background: 'var(--chart)' }"></div>
              </td>
              <td class="num small">{{ eur(m.invoiced) }}<div class="muted">{{ eur(m.collected) }}</div></td>
            </tr>
          </tbody>
        </table></div>
      </div>

      <div>
        <div class="panel">
          <div class="panel-head"><h2>TVA par taux</h2></div>
          <div v-if="!data.by_tax.length" class="empty">Aucune facture sur la période.</div>
          <table v-else>
            <thead><tr><th>Taux</th><th class="num">Base HT</th><th class="num">TVA</th></tr></thead>
            <tbody><tr v-for="t in data.by_tax" :key="t.tax_rate"><td>{{ t.tax_rate }} %</td><td class="num">{{ eur(t.base) }}</td><td class="num">{{ eur(t.tax) }}</td></tr></tbody>
          </table>
        </div>
        <div class="panel" style="margin-top: 16px">
          <div class="panel-head"><h2>Devis de la période</h2></div>
          <div v-if="!data.quotes.length" class="empty">Aucun devis.</div>
          <table v-else>
            <tbody><tr v-for="q in data.quotes" :key="q.status"><td>{{ QUOTE[q.status] }}</td><td class="num">{{ q.count }}</td><td class="num">{{ eur(q.total) }}</td></tr></tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="panel" style="margin-top: 16px">
      <div class="panel-head"><h2>Meilleurs clients</h2></div>
      <div v-if="!data.by_client.length" class="empty">Aucune facture sur la période.</div>
      <div v-else class="table-wrap"><table>
        <thead><tr><th>Client</th><th class="num">Factures</th><th class="num">Facturé TTC</th><th class="num">Payé</th><th class="num">Reste dû</th></tr></thead>
        <tbody><tr v-for="c in data.by_client" :key="c.id"><td>{{ c.name }}</td><td class="num">{{ c.invoices }}</td><td class="num">{{ eur(c.total) }}</td><td class="num">{{ eur(c.paid) }}</td><td class="num">{{ eur(c.balance) }}</td></tr></tbody>
      </table></div>
    </div>

    <div class="panel" style="margin-top: 16px">
      <div class="panel-head"><h2>Exporter pour la comptabilité</h2><span class="muted small">Fichiers CSV pour Excel, du {{ dateFr(range.from) }} au {{ dateFr(range.to) }}</span></div>
      <div class="panel-body actions">
        <button @click="exportCsv('invoices')"><Icon name="download" />Factures</button>
        <button @click="exportCsv('payments')"><Icon name="download" />Paiements</button>
        <button @click="exportCsv('quotes')"><Icon name="download" />Devis</button>
        <button @click="exportCsv('clients')"><Icon name="download" />Clients</button>
      </div>
    </div>
  </template>
</template>
