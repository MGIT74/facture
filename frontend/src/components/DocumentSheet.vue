<script setup>
import { computed } from 'vue';
import { money, dateFr } from '../utils/format.js';

// Feuille de facture / devis, aux couleurs du modèle choisi (aussi utilisée pour l'aperçu des modèles)
const props = defineProps({ doc: { type: Object, required: true }, kind: { type: String, default: 'invoice' }, template: Object });

const DEFAULTS = { layout: 'classic', accent: '#0071e3', title: null, logo: null, show_discount: 1, show_tax: 1, show_bank: 1, footer: null };
const t = computed(() => {
  const src = props.template || props.doc.template || {};
  return Object.fromEntries(Object.keys(DEFAULTS).map((k) => [k, src[k] ?? DEFAULTS[k]]));
});
const isInvoice = computed(() => props.kind === 'invoice');
const title = computed(() => t.value.title || (isInvoice.value ? 'Facture' : 'Devis'));
const eur = (n) => money(n, props.doc.currency);
const address = (o) => [o.address, [o.postal_code, o.city].filter(Boolean).join(' '), o.country].filter(Boolean);
</script>

<template>
  <article class="sheet" :class="`layout-${t.layout}`" :style="{ '--doc-accent': t.accent }">
    <div class="sheet-band">
      <div class="brand-block">
        <div v-if="t.logo" :class="{ 'logo-box': t.layout === 'modern' }"><img class="logo" :src="t.logo" alt="Logo" /></div>
        <div v-else class="co-name">{{ doc.company.company_name }}</div>
      </div>
      <div class="doc-title">
        <div class="kind">{{ title }}</div>
        <div class="number">{{ doc.number }}</div>
      </div>
    </div>

    <div class="sheet-meta">
      <div>
        <div v-if="t.logo" style="font-weight: 600; color: var(--text)">{{ doc.company.company_name }}</div>
        <div v-if="doc.company.legal_name && doc.company.legal_name !== doc.company.company_name">{{ doc.company.legal_name }}</div>
        <div v-for="l in address(doc.company)" :key="l">{{ l }}</div>
        <div v-if="doc.company.siret">SIRET {{ doc.company.siret }}</div>
        <div v-if="doc.company.vat_number">TVA {{ doc.company.vat_number }}</div>
        <div v-if="doc.company.email">{{ doc.company.email }}</div>
      </div>
      <div class="dates">
        <div>Devise : {{ doc.currency }}</div>
        <div>Émise le {{ dateFr(doc.issue_date) }}</div>
        <div v-if="isInvoice">Échéance le {{ dateFr(doc.due_date) }}</div>
        <div v-else>Valable jusqu'au {{ dateFr(doc.valid_until) }}</div>
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
          <tr>
            <th>Description</th><th class="num">Qté</th><th class="num">P.U. HT</th>
            <th v-if="t.show_discount" class="num">Remise</th><th v-if="t.show_tax" class="num">TVA</th><th class="num">Total HT</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="l in doc.lines" :key="l.id">
            <td>{{ l.description }}</td>
            <td class="num">{{ l.quantity }}</td>
            <td class="num">{{ eur(l.unit_price) }}</td>
            <td v-if="t.show_discount" class="num">{{ l.discount_rate ? `${l.discount_rate} %` : '' }}</td>
            <td v-if="t.show_tax" class="num">{{ l.tax_rate }} %</td>
            <td class="num">{{ eur(l.line_total) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="totals">
      <template v-if="t.show_tax">
        <div><span class="muted">Total HT</span><span>{{ eur(doc.subtotal) }}</span></div>
        <div><span class="muted">TVA</span><span>{{ eur(doc.tax_total) }}</span></div>
      </template>
      <div class="ttc"><span>{{ t.show_tax ? 'Total TTC' : 'Total' }}</span><span>{{ eur(doc.total) }}</span></div>
      <template v-if="isInvoice && doc.amount_paid > 0">
        <div><span class="muted">Déjà réglé</span><span>{{ eur(doc.amount_paid) }}</span></div>
        <div v-if="doc.balance_due > 0" class="due"><span>Reste à payer</span><span>{{ eur(doc.balance_due) }}</span></div>
      </template>
    </div>

    <div v-if="doc.notes || doc.terms || (isInvoice && t.show_bank && doc.company.iban)" class="foot">
      <div v-if="doc.notes"><h3>Notes</h3><p>{{ doc.notes }}</p></div>
      <div v-if="doc.terms"><h3>Conditions</h3><p>{{ doc.terms }}</p></div>
      <div v-if="isInvoice && t.show_bank && doc.company.iban">
        <h3>Règlement par virement</h3>
        <p>IBAN {{ doc.company.iban }}<template v-if="doc.company.bic">{{ '\n' }}BIC {{ doc.company.bic }}</template></p>
      </div>
    </div>
    <div v-if="t.footer" class="page-foot">{{ t.footer }}</div>
  </article>
</template>
