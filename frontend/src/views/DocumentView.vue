<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import api, { errMsg, openPdf } from '../api.js';
import { money, dateFr, todayISO, METHODS } from '../utils/format.js';
import { toast } from '../utils/toast.js';
import StatusBadge from '../components/StatusBadge.vue';

const props = defineProps({ type: String, id: String });
const router = useRouter();
const isInvoice = computed(() => props.type === 'invoice');
const base = computed(() => (isInvoice.value ? 'invoices' : 'quotes'));

const doc = ref(null);
const loadError = ref('');
// Montants affichés dans la devise du document
const eur = (n) => money(n, doc.value?.currency);
const busy = ref(false);
const pay = ref({ amount: 0, payment_date: todayISO(), payment_method: 'bank_transfer', reference: '' });

async function load() {
  try {
    doc.value = (await api.get(`/${base.value}/${props.id}`)).data;
    if (isInvoice.value) pay.value.amount = doc.value.balance_due;
  } catch (e) { loadError.value = errMsg(e); }
}
onMounted(load);

async function run(fn, okMsg) {
  busy.value = true;
  try { await fn(); if (okMsg) toast(okMsg); }
  catch (e) { toast(errMsg(e), 'err'); }
  finally { busy.value = false; }
}

const setStatus = (status, msg) => run(async () => {
  doc.value = (await api.post(`/${base.value}/${props.id}/status`, { status })).data;
  if (isInvoice.value) pay.value.amount = doc.value.balance_due;
}, msg);

const downloadPdf = () => run(() => openPdf(`/${base.value}/${props.id}/pdf`, `${doc.value.number}.pdf`));

const convert = () => run(async () => {
  const { data } = await api.post(`/quotes/${props.id}/convert`);
  toast(`Facture ${data.number} créée`);
  router.push(`/invoices/${data.id}`);
});

async function remove() {
  if (!confirm(`Supprimer ${doc.value.number} ?`)) return;
  await run(async () => { await api.delete(`/${base.value}/${props.id}`); router.replace(`/${base.value}`); }, 'Supprimé');
}

const addPayment = () => run(async () => {
  await api.post('/payments', { ...pay.value, invoice_id: props.id });
  pay.value.reference = '';
  await load();
}, 'Paiement enregistré');

const removePayment = async (p) => {
  if (!confirm(`Supprimer le paiement de ${eur(p.amount)} ?`)) return;
  await run(async () => { await api.delete(`/payments/${p.id}`); await load(); }, 'Paiement supprimé');
};

const canPay = computed(() => isInvoice.value && doc.value && doc.value.status !== 'cancelled' && doc.value.balance_due > 0);
const address = (o) => [o.address, [o.postal_code, o.city].filter(Boolean).join(' '), o.country].filter(Boolean);
</script>

<template>
  <div v-if="loadError" class="panel"><div class="empty"><strong>{{ loadError }}</strong>
    <router-link :to="`/${base}`">Retour à la liste</router-link></div></div>
  <template v-if="doc">
    <div class="page-head">
      <div class="actions">
        <router-link :to="`/${base}`" class="btn">← {{ isInvoice ? 'Factures' : 'Devis' }}</router-link>
        <StatusBadge :type="type" :status="doc.display_status" />
      </div>
      <div class="actions">
        <router-link v-if="doc.status === 'draft'" :to="`/${base}/${id}/edit`" class="btn">Modifier</router-link>
        <button :disabled="busy" @click="downloadPdf">Télécharger le PDF</button>
      </div>
    </div>

    <div class="doc-layout">
      <article class="sheet">
        <div class="sheet-head">
          <div>
            <div class="co-name">{{ doc.company.company_name }}</div>
            <div class="small muted">
              <div v-if="doc.company.legal_name">{{ doc.company.legal_name }}</div>
              <div v-for="l in address(doc.company)" :key="l">{{ l }}</div>
              <div v-if="doc.company.siret">SIRET {{ doc.company.siret }}</div>
              <div v-if="doc.company.vat_number">TVA {{ doc.company.vat_number }}</div>
              <div v-if="doc.company.email">{{ doc.company.email }}</div>
            </div>
          </div>
          <div class="doc-title">
            <div class="kind">{{ isInvoice ? 'Facture' : 'Devis' }}</div>
            <div class="muted">{{ doc.number }}</div>
            <div class="small muted" style="margin-top: 8px">
              <div>Devise : {{ doc.currency }}</div>
              <div>Émise le {{ dateFr(doc.issue_date) }}</div>
              <div v-if="isInvoice">Échéance le {{ dateFr(doc.due_date) }}</div>
              <div v-else>Valable jusqu'au {{ dateFr(doc.valid_until) }}</div>
            </div>
          </div>
        </div>

        <div class="parties">
          <div class="to">
            <div class="small muted">{{ isInvoice ? 'Facturé à' : 'Destinataire' }}</div>
            <strong>{{ doc.client.name }}</strong>
            <div v-for="l in address(doc.client)" :key="l">{{ l }}</div>
            <div v-if="doc.client.vat_number" class="small muted">TVA {{ doc.client.vat_number }}</div>
          </div>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Description</th><th class="num">Qté</th><th class="num">P.U. HT</th><th class="num">Remise</th><th class="num">TVA</th><th class="num">Total HT</th></tr>
            </thead>
            <tbody>
              <tr v-for="l in doc.lines" :key="l.id">
                <td>{{ l.description }}</td>
                <td class="num">{{ l.quantity }}</td>
                <td class="num">{{ eur(l.unit_price) }}</td>
                <td class="num">{{ l.discount_rate ? `${l.discount_rate} %` : '' }}</td>
                <td class="num">{{ l.tax_rate }} %</td>
                <td class="num">{{ eur(l.line_total) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="totals">
          <div><span class="muted">Total HT</span><span>{{ eur(doc.subtotal) }}</span></div>
          <div><span class="muted">TVA</span><span>{{ eur(doc.tax_total) }}</span></div>
          <div class="ttc"><span>Total TTC</span><span>{{ eur(doc.total) }}</span></div>
          <template v-if="isInvoice && doc.amount_paid > 0">
            <div><span class="muted">Déjà réglé</span><span>{{ eur(doc.amount_paid) }}</span></div>
            <div v-if="doc.balance_due > 0" class="due"><span>Reste à payer</span><span>{{ eur(doc.balance_due) }}</span></div>
          </template>
        </div>

        <div v-if="doc.notes || doc.terms || (isInvoice && doc.company.iban)" class="foot">
          <div v-if="doc.notes"><h3>Notes</h3><p>{{ doc.notes }}</p></div>
          <div v-if="doc.terms"><h3>Conditions</h3><p>{{ doc.terms }}</p></div>
          <div v-if="isInvoice && doc.company.iban">
            <h3>Règlement par virement</h3>
            <p>IBAN {{ doc.company.iban }}<template v-if="doc.company.bic">{{ '\n' }}BIC {{ doc.company.bic }}</template></p>
          </div>
        </div>
      </article>

      <aside class="side-panel">
        <div class="panel">
          <div class="panel-head"><h2>Actions</h2></div>
          <div class="panel-body">
            <template v-if="isInvoice">
              <button v-if="doc.status === 'draft'" class="primary" :disabled="busy" @click="setStatus('sent', 'Facture marquée comme envoyée')">Marquer comme envoyée</button>
              <button v-if="doc.status === 'sent' && doc.amount_paid === 0" :disabled="busy" @click="setStatus('draft')">Repasser en brouillon</button>
              <button v-if="['draft', 'sent'].includes(doc.status)" class="danger" :disabled="busy" @click="setStatus('cancelled', 'Facture annulée')">Annuler la facture</button>
              <button v-if="doc.status === 'cancelled'" :disabled="busy" @click="setStatus('draft')">Rouvrir en brouillon</button>
              <button v-if="['draft', 'cancelled'].includes(doc.status) && !doc.amount_paid" class="danger" :disabled="busy" @click="remove">Supprimer</button>
              <p v-if="doc.status === 'paid'" class="muted small" style="margin: 0">Cette facture est soldée : aucune action n'est disponible.</p>
            </template>
            <template v-else>
              <button v-if="doc.status === 'draft'" class="primary" :disabled="busy" @click="setStatus('sent', 'Devis marqué comme envoyé')">Marquer comme envoyé</button>
              <button v-if="['draft', 'sent'].includes(doc.status)" :disabled="busy" @click="setStatus('accepted', 'Devis accepté')">Marquer comme accepté</button>
              <button v-if="['draft', 'sent'].includes(doc.status)" :disabled="busy" @click="setStatus('rejected', 'Devis refusé')">Marquer comme refusé</button>
              <button v-if="doc.status !== 'invoiced'" :class="{ primary: doc.status === 'accepted' }" :disabled="busy" @click="convert">Transformer en facture</button>
              <button v-if="doc.status !== 'invoiced'" class="danger" :disabled="busy" @click="remove">Supprimer</button>
              <p v-if="doc.status === 'invoiced'" class="muted small" style="margin: 0">Ce devis a été transformé en facture.</p>
            </template>
          </div>
        </div>

        <div v-if="isInvoice" class="panel">
          <div class="panel-head"><h2>Paiements</h2></div>
          <div class="panel-body">
            <div v-if="!doc.payments.length" class="muted small">Aucun paiement enregistré.</div>
            <div v-for="p in doc.payments" :key="p.id" class="pay-row">
              <div>
                <div>{{ eur(p.amount) }}</div>
                <div class="muted small">{{ dateFr(p.payment_date) }} · {{ METHODS[p.payment_method] }}<template v-if="p.reference"> · {{ p.reference }}</template></div>
              </div>
              <button class="link danger" @click="removePayment(p)">Retirer</button>
            </div>

            <form v-if="canPay" style="display: grid; gap: 10px; margin-top: 8px" @submit.prevent="addPayment">
              <div class="field"><label>Montant</label><input v-model.number="pay.amount" type="number" step="0.01" min="0.01" :max="doc.balance_due" /></div>
              <div class="field"><label>Date</label><input v-model="pay.payment_date" type="date" /></div>
              <div class="field">
                <label>Mode</label>
                <select v-model="pay.payment_method"><option v-for="(label, key) in METHODS" :key="key" :value="key">{{ label }}</option></select>
              </div>
              <div class="field"><label>Référence</label><input v-model="pay.reference" placeholder="N° de virement, de chèque…" /></div>
              <button class="primary" :disabled="busy">Enregistrer le paiement</button>
            </form>
          </div>
        </div>
      </aside>
    </div>
  </template>
</template>
