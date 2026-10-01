<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api, { errMsg } from '../api.js';
import { money, CURRENCIES, todayISO, addDaysISO } from '../utils/format.js';
import { useCompany } from '../stores/company.js';
import { lineNet, totals } from '../utils/money.js';
import { toast } from '../utils/toast.js';

const props = defineProps({ type: String, id: String });
const route = useRoute();
const router = useRouter();
const company = useCompany();
const isInvoice = computed(() => props.type === 'invoice');
const base = computed(() => (isInvoice.value ? 'invoices' : 'quotes'));
const dateKey = computed(() => (isInvoice.value ? 'due_date' : 'valid_until'));

const clients = ref([]);
const templates = ref([]);
const items = ref([]);
const error = ref('');
const saving = ref(false);
const ready = ref(false);
const dateTouched = ref(false);
const form = ref({ client_id: '', template_id: null, currency: 'EUR', issue_date: todayISO(), due_date: '', valid_until: '', notes: '', terms: '', lines: [] });

// Montants affichés dans la devise du document
const eur = (n) => money(n, form.value.currency);
const settings = computed(() => company.current);

const newLine = () => ({
  item_id: null, description: '', quantity: 1, unit_price: 0, discount_rate: 0,
  tax_rate: settings.value?.default_tax_rate ?? 20,
});

onMounted(async () => {
  const [c, i, tp] = await Promise.all([api.get('/clients'), api.get('/items'), api.get('/templates', { params: { kind: props.type } })]);
  clients.value = c.data; items.value = i.data; templates.value = tp.data;

  if (props.id) {
    const d = (await api.get(`/${base.value}/${props.id}`)).data;
    if (d.status !== 'draft') { toast('Seul un brouillon peut être modifié', 'err'); return router.replace(`/${base.value}/${props.id}`); }
    form.value = {
      client_id: d.client_id, template_id: d.template_id, currency: d.currency, issue_date: d.issue_date, due_date: d.due_date || '', valid_until: d.valid_until || '',
      notes: d.notes || '', terms: d.terms || '', lines: d.lines.map((l) => ({ ...l })),
    };
    dateTouched.value = true;
  } else {
    // Modèle par défaut du type de document : il fournit notes et conditions pré-remplies
    const def = templates.value.find((x) => x.is_default);
    form.value.template_id = def?.id ?? null;
    form.value.notes = def?.notes || '';
    form.value.terms = def?.terms || settings.value?.default_terms || '';
    form.value.currency = settings.value?.default_currency || 'EUR';
    form.value.lines = [newLine()];
    if (route.query.client) form.value.client_id = Number(route.query.client);
    applyDefaultDate();
  }
  ready.value = true;
});

function applyDefaultDate() {
  const days = isInvoice.value ? settings.value.payment_terms_days : 30;
  form.value[dateKey.value] = addDaysISO(form.value.issue_date, days);
}
watch(() => form.value.issue_date, () => { if (!dateTouched.value && settings.value) applyDefaultDate(); });

// Changer de modèle : reprend ses notes et conditions s'il en définit
function onTemplate() {
  const tp = templates.value.find((x) => x.id === form.value.template_id);
  if (!tp) return;
  if (tp.notes) form.value.notes = tp.notes;
  if (tp.terms) form.value.terms = tp.terms;
}

function pickItem(line) {
  const it = items.value.find((x) => x.id === line.item_id);
  if (!it) return;
  line.description = it.description ? `${it.name} — ${it.description}` : it.name;
  line.unit_price = it.unit_price;
  line.tax_rate = it.tax_rate;
}

const sum = computed(() => totals(form.value.lines));

async function save() {
  error.value = '';
  saving.value = true;
  try {
    const payload = { ...form.value };
    const { data } = props.id
      ? await api.put(`/${base.value}/${props.id}`, payload)
      : await api.post(`/${base.value}`, payload);
    toast(`${data.number} enregistré${isInvoice.value ? 'e' : ''}`);
    router.push(`/${base.value}/${data.id}`);
  } catch (e) { error.value = errMsg(e); } finally { saving.value = false; }
}
</script>

<template>
  <div class="page-head">
    <h1>{{ id ? (isInvoice ? 'Modifier la facture' : 'Modifier le devis') : (isInvoice ? 'Nouvelle facture' : 'Nouveau devis') }}</h1>
    <div class="actions">
      <button @click="router.back()">Annuler</button>
      <button class="primary" :disabled="saving || !ready" @click="save">Enregistrer le brouillon</button>
    </div>
  </div>
  <div v-if="error" class="error">{{ error }}</div>

  <template v-if="ready">
    <div class="panel">
      <div class="panel-body grid">
        <div class="field span-2">
          <label for="client">Client *</label>
          <select id="client" v-model="form.client_id">
            <option value="" disabled>Choisir un client…</option>
            <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}{{ c.city ? ` — ${c.city}` : '' }}</option>
          </select>
          <div v-if="!clients.length" class="small muted" style="margin-top: 4px">
            Aucun client. <router-link to="/clients">En créer un</router-link>
          </div>
        </div>
        <div class="field">
          <label for="currency">Devise</label>
          <select id="currency" v-model="form.currency"><option v-for="c in CURRENCIES" :key="c.code" :value="c.code">{{ c.label }}</option></select>
        </div>
        <div v-if="templates.length" class="field">
          <label for="tpl">Modèle</label>
          <select id="tpl" v-model="form.template_id" @change="onTemplate">
            <option :value="null">Apparence standard</option>
            <option v-for="tp in templates" :key="tp.id" :value="tp.id">{{ tp.name }}{{ tp.is_default ? ' (par défaut)' : '' }}</option>
          </select>
        </div>
        <div class="field"><label>Date d'émission</label><input v-model="form.issue_date" type="date" /></div>
        <div class="field">
          <label>{{ isInvoice ? 'Échéance' : "Valable jusqu'au" }}</label>
          <input v-model="form[dateKey]" type="date" @input="dateTouched = true" />
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><h2>Lignes</h2></div>
      <div class="table-wrap">
        <table class="lines">
          <thead>
            <tr><th>Produit</th><th>Description</th><th>Qté</th><th>P.U. HT</th><th>Remise %</th><th>TVA %</th><th class="num">Total HT</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="(l, i) in form.lines" :key="i">
              <td style="width: 170px">
                <select v-model="l.item_id" @change="pickItem(l)" aria-label="Produit">
                  <option :value="null">Saisie libre</option>
                  <option v-for="it in items" :key="it.id" :value="it.id">{{ it.name }}</option>
                </select>
              </td>
              <td><input v-model="l.description" placeholder="Description de la prestation" aria-label="Description" /></td>
              <td><input v-model.number="l.quantity" class="w-qty" type="number" step="0.01" min="0" aria-label="Quantité" /></td>
              <td><input v-model.number="l.unit_price" class="w-pu" type="number" step="0.01" aria-label="Prix unitaire HT" /></td>
              <td><input v-model.number="l.discount_rate" class="w-pct" type="number" step="0.1" min="0" max="100" aria-label="Remise" /></td>
              <td><input v-model.number="l.tax_rate" class="w-pct" type="number" step="0.1" min="0" aria-label="TVA" /></td>
              <td class="num w-total">{{ eur(lineNet(l)) }}</td>
              <td class="w-x"><button class="link danger" :disabled="form.lines.length === 1" @click="form.lines.splice(i, 1)" aria-label="Supprimer la ligne">✕</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="panel-body" style="padding-top: 6px">
        <button @click="form.lines.push(newLine())">Ajouter une ligne</button>
        <p v-if="form.currency !== company.currency" class="muted small" style="margin: 10px 0 0">
          Les prix des produits sont enregistrés en {{ company.currency }} : adapte-les si besoin pour ce document en {{ form.currency }}.
        </p>
      </div>
    </div>

    <div class="panel totals-box">
      <div><span class="muted">Total HT</span><span>{{ eur(sum.ht) }}</span></div>
      <div><span class="muted">TVA</span><span>{{ eur(sum.tax) }}</span></div>
      <div class="ttc"><span>Total TTC</span><span>{{ eur(sum.ttc) }}</span></div>
    </div>

    <div class="panel">
      <div class="panel-body grid two">
        <div class="field"><label>Notes (visibles sur le document)</label><textarea v-model="form.notes"></textarea></div>
        <div class="field"><label>Conditions</label><textarea v-model="form.terms"></textarea></div>
      </div>
    </div>
  </template>
</template>
