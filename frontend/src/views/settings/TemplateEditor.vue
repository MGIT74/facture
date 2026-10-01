<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api, { errMsg } from '../../api.js';
import { useCompany } from '../../stores/company.js';
import { todayISO, addDaysISO } from '../../utils/format.js';
import { toast } from '../../utils/toast.js';
import DocumentSheet from '../../components/DocumentSheet.vue';

const route = useRoute();
const router = useRouter();
const company = useCompany();
const id = route.params.id;
const loading = ref(!!id);
const saving = ref(false);
const error = ref('');

const form = ref({
  name: '', kind: route.query.kind === 'quote' ? 'quote' : 'invoice', layout: 'classic', accent: '#0071e3', title: '',
  logo: null, show_discount: true, show_tax: true, show_bank: true, notes: '', terms: '', footer: '', is_default: false,
});
const LAYOUTS = [{ v: 'classic', l: 'Classique' }, { v: 'modern', l: 'Moderne' }, { v: 'minimal', l: 'Minimal' }];
const SWATCHES = ['#0071e3', '#5e5ce6', '#30b0c7', '#248a3d', '#1c1c1e', '#d70015'];
const isInvoice = computed(() => form.value.kind === 'invoice');

onMounted(async () => {
  if (!id) return;
  try {
    const t = (await api.get(`/templates/${id}`)).data;
    form.value = {
      ...t, title: t.title || '', notes: t.notes || '', terms: t.terms || '', footer: t.footer || '',
      show_discount: !!t.show_discount, show_tax: !!t.show_tax, show_bank: !!t.show_bank, is_default: !!t.is_default,
    };
  } catch (e) { error.value = errMsg(e); } finally { loading.value = false; }
});

function onLogo(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  if (!/^image\/(png|jpeg)$/.test(file.type)) { toast('Logo : image PNG ou JPEG uniquement', 'err'); return; }
  if (file.size > 400 * 1024) { toast('Logo trop lourd (400 Ko maximum)', 'err'); return; }
  const reader = new FileReader();
  reader.onload = () => { form.value.logo = reader.result; };
  reader.readAsDataURL(file);
}

// Aperçu en direct : un document d'exemple avec les infos réelles de l'entreprise
const preview = computed(() => {
  const today = todayISO();
  const co = company.current || {};
  return {
    number: isInvoice.value ? 'FAC-2026-0001' : 'DEV-2026-0001',
    currency: co.default_currency || 'EUR',
    issue_date: today, due_date: addDaysISO(today, co.payment_terms_days ?? 30), valid_until: addDaysISO(today, 30),
    notes: form.value.notes, terms: form.value.terms,
    subtotal: 1080, tax_total: 216, total: 1296, amount_paid: 0, balance_due: 1296,
    company: co,
    client: { name: 'Client exemple', address: '1 rue de l’Exemple', postal_code: '75001', city: 'Paris', country: 'France' },
    lines: [
      { id: 1, description: 'Prestation de conseil', quantity: 2, unit_price: 450, discount_rate: 10, tax_rate: 20, line_total: 810 },
      { id: 2, description: 'Hébergement annuel', quantity: 1, unit_price: 270, discount_rate: 0, tax_rate: 20, line_total: 270 },
    ],
  };
});

async function save() {
  error.value = '';
  saving.value = true;
  try {
    const body = { ...form.value };
    if (id) await api.put(`/templates/${id}`, body);
    else await api.post('/templates', body);
    toast('Modèle enregistré');
    router.push('/settings/templates');
  } catch (e) { error.value = errMsg(e); } finally { saving.value = false; }
}
</script>

<template>
  <div class="page-head" style="margin-top: 0">
    <h2 style="font-size: 1.25rem">{{ id ? 'Modifier le modèle' : `Nouveau modèle de ${isInvoice ? 'facture' : 'devis'}` }}</h2>
    <div class="actions">
      <router-link to="/settings/templates" class="btn">Annuler</router-link>
      <button class="primary" :disabled="saving || loading" @click="save">Enregistrer le modèle</button>
    </div>
  </div>
  <div v-if="error" class="error">{{ error }}</div>

  <div v-if="!loading" class="editor-grid">
    <div>
      <div class="panel"><div class="panel-body">
        <div class="field"><label for="tname">Nom du modèle *</label><input id="tname" v-model="form.name" placeholder="Ex : Facture moderne bleue" autofocus /></div>
        <label class="check" style="margin-top: 14px"><input v-model="form.is_default" type="checkbox" />Utiliser par défaut pour les nouveaux {{ isInvoice ? 'factures' : 'devis' }}</label>
      </div></div>

      <div class="panel"><div class="panel-body">
        <h3 class="form-section">Disposition</h3>
        <div class="seg" role="group" aria-label="Disposition">
          <button v-for="l in LAYOUTS" :key="l.v" type="button" :class="{ on: form.layout === l.v }" :aria-pressed="form.layout === l.v" @click="form.layout = l.v">
            <span class="mini" :class="l.v"></span>{{ l.l }}
          </button>
        </div>
        <h3 class="form-section">Couleur</h3>
        <div class="swatches">
          <button v-for="c in SWATCHES" :key="c" type="button" class="swatch-btn" :class="{ on: form.accent === c }" :style="{ background: c }" :aria-label="`Couleur ${c}`" @click="form.accent = c"></button>
          <input v-model="form.accent" type="color" aria-label="Couleur personnalisée" />
          <input v-model="form.accent" style="width: 100px" maxlength="7" aria-label="Code couleur" />
        </div>
        <h3 class="form-section">Logo</h3>
        <div class="logo-row">
          <img v-if="form.logo" :src="form.logo" class="thumb" alt="Logo actuel" />
          <label class="btn" style="margin: 0; cursor: pointer">
            {{ form.logo ? 'Changer le logo' : 'Ajouter un logo' }}
            <input type="file" accept="image/png,image/jpeg" style="display: none" @change="onLogo" />
          </label>
          <button v-if="form.logo" type="button" class="danger" @click="form.logo = null">Retirer</button>
        </div>
        <p class="muted small" style="margin: 8px 0 0">PNG ou JPEG, 400 Ko maximum.</p>
      </div></div>

      <div class="panel"><div class="panel-body">
        <h3 class="form-section">Contenu</h3>
        <div class="field"><label>Titre du document</label><input v-model="form.title" :placeholder="isInvoice ? 'Facture' : 'Devis'" maxlength="60" /></div>
        <div style="margin-top: 14px">
          <label class="check"><input v-model="form.show_discount" type="checkbox" />Afficher la colonne Remise</label>
          <label class="check"><input v-model="form.show_tax" type="checkbox" />Afficher la TVA (colonne et totaux)</label>
          <label v-if="isInvoice" class="check"><input v-model="form.show_bank" type="checkbox" />Afficher les coordonnées bancaires</label>
        </div>
        <h3 class="form-section">Textes pré-remplis</h3>
        <div class="field"><label>Notes</label><textarea v-model="form.notes" placeholder="Ex : Merci de votre confiance."></textarea></div>
        <div class="field" style="margin-top: 12px"><label>Conditions</label><textarea v-model="form.terms" placeholder="Ex : paiement à 30 jours, pénalités de retard…"></textarea></div>
        <div class="field" style="margin-top: 12px"><label>Mention de pied de page</label><textarea v-model="form.footer" style="min-height: 56px" placeholder="Ex : SARL au capital de 10 000 €, RCS Annecy…"></textarea></div>
      </div></div>
    </div>

    <div class="preview-col">
      <div class="muted small" style="margin: 0 0 8px 4px">Aperçu avec un document d'exemple</div>
      <div class="preview-wrap"><DocumentSheet :doc="preview" :kind="form.kind" :template="form" /></div>
    </div>
  </div>
</template>
