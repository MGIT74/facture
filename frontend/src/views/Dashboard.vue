<script setup>
import { ref, computed, onMounted } from 'vue';
import api, { errMsg } from '../api.js';
import { useAuth } from '../stores/auth.js';
import { money, dateFr, monthLabel, STATUS } from '../utils/format.js';
import StatusBadge from '../components/StatusBadge.vue';
import Icon from '../components/Icon.vue';

const auth = useAuth();
const data = ref(null);
const error = ref('');
const hover = ref(null);

async function load(currency) {
  try {
    data.value = (await api.get('/dashboard', { params: currency ? { currency } : {} })).data;
    hover.value = null;
  } catch (e) { error.value = errMsg(e); }
}
onMounted(() => load());

// Les montants s'affichent dans la devise choisie (une carte par devise)
const eur = (n) => money(n, data.value?.currency);
const symbol = (c) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: c, currencyDisplay: 'narrowSymbol' })
  .formatToParts(0).find((p) => p.type === 'currency')?.value || c;
const monthLong = (ym) => new Date(ym + '-01T00:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
const year = new Date().getFullYear();

const delta = computed(() => {
  const k = data.value?.kpi;
  if (!k || !k.collected_prev_month) return null;
  return Math.round(((k.collected_month - k.collected_prev_month) / k.collected_prev_month) * 100);
});

// ---------- graphique « facturé et encaissé » ----------
const W = 640, H = 230, PT = 18, PB = 10, PX = 8;
const ser = computed(() => data.value?.series[data.value.currency] || { collected: Array(12).fill(0), invoiced: Array(12).fill(0) });
const maxV = computed(() => Math.max(1, ...ser.value.collected, ...ser.value.invoiced));
const x = (i) => PX + (i * (W - 2 * PX)) / 11;
const y = (v) => PT + (H - PT - PB) * (1 - v / maxV.value);
const clampY = (v) => Math.min(Math.max(v, PT), H - PB);

function smooth(vals) {
  const pts = vals.map((v, i) => [x(i), y(v)]);
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, clampY(p1[1] + (p2[1] - p0[1]) / 6)];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, clampY(p2[1] - (p3[1] - p1[1]) / 6)];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}
const invoicedPath = computed(() => smooth(ser.value.invoiced));
const collectedPath = computed(() => smooth(ser.value.collected));
const areaPath = computed(() => `${collectedPath.value} L${x(11).toFixed(1)},${H - PB} L${x(0).toFixed(1)},${H - PB} Z`);
const total12 = computed(() => ser.value.collected.reduce((a, b) => a + b, 0));

const sel = computed(() => hover.value ?? 11);
const tip = computed(() => {
  const i = sel.value, w = 176, h = 66;
  const px = x(i), py = y(ser.value.collected[i]);
  return { i, px, py, w, h, tx: Math.min(Math.max(px - w / 2, 4), W - w - 4), ty: Math.min(Math.max(py - h - 14, 2), H - h - 4) };
});

// ---------- mini courbes des cartes devise ----------
function spark(vals) {
  const m = Math.max(1, ...vals);
  return vals.map((v, i) => `${i ? 'L' : 'M'}${(i * 86) / 11},${(30 - (v / m) * 26).toFixed(1)}`).join(' ');
}

// ---------- répartition par statut ----------
const ORDER = ['draft', 'sent', 'overdue', 'paid', 'cancelled'];
const statusBars = computed(() => {
  const rows = data.value?.status_breakdown || [];
  const max = Math.max(1, ...rows.map((r) => r.count));
  return ORDER.map((s) => {
    const n = rows.find((r) => r.status === s)?.count || 0;
    return { status: s, count: n, pct: n ? Math.max(8, (n / max) * 100) : 0 };
  });
});
const invoiceCount = computed(() => statusBars.value.reduce((a, b) => a + b.count, 0));
</script>

<template>
  <div v-if="error" class="error">{{ error }}</div>

  <template v-if="data">
    <section class="hero">
      <div>
        <div class="hero-label">Encaissé ce mois-ci</div>
        <div class="hero-value">
          {{ eur(data.kpi.collected_month) }}
          <span v-if="delta !== null" class="delta" :class="{ down: delta < 0 }" title="Par rapport au mois dernier">{{ delta > 0 ? '+' : '' }}{{ delta }} %</span>
        </div>
        <div class="hero-sub">
          <span>À encaisser<strong>{{ eur(data.kpi.outstanding) }}</strong></span>
          <span :class="{ late: data.kpi.overdue_count > 0 }">En retard<strong>{{ eur(data.kpi.overdue_amount) }}</strong></span>
          <span>Facturé en {{ year }}<strong>{{ eur(data.kpi.invoiced_year) }}</strong></span>
        </div>
      </div>
      <div class="actions">
        <router-link to="/invoices/new" class="btn primary"><Icon name="plus" />Nouvelle facture</router-link>
        <router-link to="/quotes/new" class="btn">Nouveau devis</router-link>
        <router-link to="/clients" class="btn">Nouveau client</router-link>
      </div>
    </section>

    <section class="cur-cards" aria-label="Devises">
      <button v-for="c in data.by_currency" :key="c.currency" class="cur-card" :class="{ active: c.currency === data.currency }"
        :aria-pressed="c.currency === data.currency" @click="load(c.currency)">
        <span class="cur-head"><span class="cur-sym" :class="{ long: symbol(c.currency).length > 2 }">{{ symbol(c.currency) }}</span>{{ c.currency }}</span>
        <span class="cur-foot">
          <span>
            <span class="cur-amount">{{ money(c.outstanding, c.currency) }}</span>
            <span class="cur-note" :class="{ late: c.overdue_count > 0 }" style="display: block">
              {{ c.overdue_count > 0 ? `${c.overdue_count} en retard` : 'à encaisser' }}
            </span>
          </span>
          <svg class="spark" viewBox="0 0 86 34" aria-hidden="true"><path :d="spark(data.series[c.currency].collected)" /></svg>
        </span>
      </button>
      <router-link to="/invoices/new" class="cur-card cur-add">
        <span class="plus"><Icon name="plus" /></span>
        Facturer dans une autre devise
      </router-link>
    </section>

    <section class="dash-grid">
      <div class="panel card-pad">
        <div class="card-head">
          <div>
            <div class="card-title">Encaissé sur 12 mois</div>
            <div class="card-big">{{ eur(total12) }}</div>
          </div>
          <div class="legend">
            <span><i style="background: var(--muted)"></i>Facturé</span>
            <span><i style="background: var(--chart)"></i>Encaissé</span>
          </div>
        </div>
        <div class="line-chart">
          <svg :viewBox="`0 0 ${W} ${H}`" role="img" aria-label="Facturé et encaissé sur 12 mois">
            <defs>
              <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" style="stop-color: var(--chart); stop-opacity: 0.26" />
                <stop offset="1" style="stop-color: var(--chart); stop-opacity: 0" />
              </linearGradient>
            </defs>
            <line v-for="n in 5" :key="n" :x1="0" :x2="W" :y1="PT + ((H - PT - PB) / 4) * (n - 1)" :y2="PT + ((H - PT - PB) / 4) * (n - 1)"
              style="stroke: var(--grid)" stroke-dasharray="2 6" />
            <path :d="areaPath" fill="url(#area)" />
            <path :d="invoicedPath" fill="none" style="stroke: var(--muted)" stroke-width="2" stroke-linecap="round" />
            <path :d="collectedPath" fill="none" style="stroke: var(--chart)" stroke-width="2.6" stroke-linecap="round" />
            <line :x1="tip.px" :x2="tip.px" :y1="PT" :y2="H - PB" style="stroke: var(--grid)" />
            <circle :cx="tip.px" :cy="tip.py" r="5.5" style="fill: var(--chart); stroke: var(--bg); stroke-width: 2.5" />
            <g :transform="`translate(${tip.tx}, ${tip.ty})`">
              <rect :width="tip.w" :height="tip.h" rx="12" style="fill: var(--card-2); stroke: var(--line)" />
              <text x="12" y="19" font-size="11" style="fill: var(--muted)">{{ monthLong(data.months[tip.i]) }}</text>
              <text x="12" y="39" font-size="12" font-weight="600" style="fill: var(--chart)">Encaissé {{ eur(ser.collected[tip.i]) }}</text>
              <text x="12" y="57" font-size="12" style="fill: var(--text)">Facturé {{ eur(ser.invoiced[tip.i]) }}</text>
            </g>
            <rect v-for="(m, i) in data.months" :key="m" :x="x(i) - (W - 2 * PX) / 22" :y="0" :width="(W - 2 * PX) / 11" :height="H"
              fill="transparent" @mouseenter="hover = i" @mouseleave="hover = null" />
          </svg>
        </div>
        <div class="month-pills" role="group" aria-label="Mois">
          <button v-for="(m, i) in data.months" :key="m" class="pill-btn" :class="{ on: i === sel }" @click="hover = i">{{ monthLabel(m) }}</button>
        </div>
      </div>

      <div class="panel card-pad">
        <div class="card-head">
          <div>
            <div class="card-title">Factures par statut</div>
            <div class="card-big">{{ invoiceCount }}</div>
          </div>
          <router-link to="/invoices" class="small">Voir tout</router-link>
        </div>
        <div class="bars">
          <div v-for="b in statusBars" :key="b.status" class="bar-col">
            <span class="bar-val">{{ b.count }}</span>
            <div class="capsule"><i :class="b.status" :style="{ height: b.pct + '%' }"></i></div>
            <span class="bar-label">{{ STATUS.invoice[b.status] }}</span>
          </div>
        </div>
      </div>
    </section>

    <section class="bottom-grid">
      <div class="panel">
        <div class="panel-head"><h2>Activité récente</h2><router-link to="/invoices" class="small">Voir tout</router-link></div>
        <div v-if="!data.recent.length" class="empty">
          <strong>Aucune facture pour l'instant</strong>
          <router-link to="/invoices/new">Créer la première facture</router-link>
        </div>
        <div v-for="i in data.recent" :key="i.id" class="act-row click" @click="$router.push(`/invoices/${i.id}`)">
          <span class="act-ico"><Icon name="invoice" /></span>
          <div style="min-width: 0">
            <div class="act-title">{{ i.client_name }}</div>
            <div class="act-sub">{{ i.number }} le {{ dateFr(i.issue_date) }}</div>
          </div>
          <div class="act-amt">
            {{ money(i.total, i.currency) }}
            <div><StatusBadge :status="i.display_status" /></div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head">
          <h2>En retard</h2>
          <span class="late" style="font-weight: 600; font-variant-numeric: tabular-nums">{{ eur(data.kpi.overdue_amount) }}</span>
        </div>
        <div v-if="!data.overdue.length" class="empty"><strong>Rien en retard</strong>Toutes les factures envoyées sont dans les délais.</div>
        <div v-for="i in data.overdue" :key="i.id" class="act-row late click" @click="$router.push(`/invoices/${i.id}`)">
          <span class="act-ico"><Icon name="clock" /></span>
          <div style="min-width: 0">
            <div class="act-title">{{ i.client_name }}</div>
            <div class="act-sub">{{ i.days_late }} jour(s) de retard, {{ i.number }}</div>
          </div>
          <div class="act-amt">{{ eur(i.balance_due) }}</div>
        </div>
      </div>
    </section>
  </template>
</template>
