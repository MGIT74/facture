<script setup>
import { ref } from 'vue';
import api, { errMsg } from '../api.js';
import { useAuth } from '../stores/auth.js';
import { useCompany } from '../stores/company.js';
import { CURRENCIES } from '../utils/format.js';
import { toast } from '../utils/toast.js';
import Modal from '../components/Modal.vue';

const auth = useAuth();
const company = useCompany();
const editing = ref(null);
const error = ref('');
const saving = ref(false);

const blank = () => ({
  company_name: '', legal_name: '', siret: '', vat_number: '', address: '', postal_code: '', city: '',
  country: 'France', email: '', phone: '', iban: '', bic: '', invoice_prefix: 'FAC', quote_prefix: 'DEV',
  default_currency: 'EUR', default_tax_rate: 20, payment_terms_days: 30, default_terms: '',
});

function open(c) { error.value = ''; editing.value = c ? { ...c } : blank(); }

async function save() {
  error.value = '';
  saving.value = true;
  try {
    const c = editing.value;
    const creating = !c.id;
    const { data } = creating ? await api.post('/companies', c) : await api.put(`/companies/${c.id}`, c);
    editing.value = null;
    await company.load();
    if (creating) {
      company.select(data.id);
      toast(`Entreprise « ${data.company_name} » créée et sélectionnée`);
    } else toast('Entreprise enregistrée');
  } catch (e) { error.value = errMsg(e); } finally { saving.value = false; }
}

async function remove(c) {
  if (!confirm(`Supprimer l'entreprise « ${c.company_name} » ?`)) return;
  try { await api.delete(`/companies/${c.id}`); await company.load(); toast('Entreprise supprimée'); }
  catch (e) { toast(errMsg(e), 'err'); }
}
</script>

<template>
  <div class="page-head">
    <h1>Entreprises</h1>
    <button v-if="auth.isAdmin" class="primary" @click="open()">Nouvelle entreprise</button>
  </div>
  <p class="muted" style="margin-top: -10px">
    Chaque entreprise a ses propres clients, produits, devis, factures et numérotation. Change d'entreprise avec le menu en haut à gauche.
    <template v-if="!auth.isAdmin">Seuls les administrateurs peuvent créer ou modifier une entreprise.</template>
  </p>

  <div class="panel">
    <div class="table-wrap">
      <table>
        <thead><tr><th>Entreprise</th><th>Ville</th><th>Devise par défaut</th><th>Numérotation</th><th></th></tr></thead>
        <tbody>
          <tr v-for="c in company.list" :key="c.id">
            <td>
              <strong>{{ c.company_name }}</strong>
              <span v-if="c.id === company.currentId" class="badge paid" style="margin-left: 8px">Active</span>
              <div v-if="c.siret" class="muted small">SIRET {{ c.siret }}</div>
            </td>
            <td>{{ c.city }}</td>
            <td>{{ c.default_currency }}</td>
            <td class="muted">{{ c.invoice_prefix }} / {{ c.quote_prefix }}</td>
            <td class="actions-cell">
              <button v-if="c.id !== company.currentId" class="link" @click="company.select(c.id)">Utiliser</button>
              <button v-if="auth.isAdmin" class="link" @click="open(c)">Modifier</button>
              <button v-if="auth.isAdmin" class="link danger" @click="remove(c)">Supprimer</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <Modal v-if="editing" :title="editing.id ? 'Modifier l\'entreprise' : 'Nouvelle entreprise'" @close="editing = null">
    <div v-if="error" class="error">{{ error }}</div>
    <h3 class="form-section">Identité</h3>
    <div class="grid">
      <div class="field span-2"><label>Nom commercial *</label><input v-model="editing.company_name" autofocus /></div>
      <div class="field"><label>Raison sociale</label><input v-model="editing.legal_name" /></div>
      <div class="field"><label>SIRET / identifiant</label><input v-model="editing.siret" /></div>
      <div class="field"><label>N° de TVA</label><input v-model="editing.vat_number" /></div>
      <div class="field"><label>Pays</label><input v-model="editing.country" /></div>
      <div class="field span-2"><label>Adresse</label><input v-model="editing.address" /></div>
      <div class="field"><label>Code postal</label><input v-model="editing.postal_code" /></div>
      <div class="field"><label>Ville</label><input v-model="editing.city" /></div>
      <div class="field"><label>Email</label><input v-model="editing.email" type="email" /></div>
      <div class="field"><label>Téléphone</label><input v-model="editing.phone" /></div>
    </div>
    <h3 class="form-section">Facturation</h3>
    <div class="grid">
      <div class="field">
        <label>Devise par défaut</label>
        <select v-model="editing.default_currency"><option v-for="c in CURRENCIES" :key="c.code" :value="c.code">{{ c.label }}</option></select>
      </div>
      <div class="field"><label>TVA par défaut (%)</label><input v-model.number="editing.default_tax_rate" type="number" step="0.1" /></div>
      <div class="field"><label>Préfixe des factures</label><input v-model="editing.invoice_prefix" maxlength="10" /></div>
      <div class="field"><label>Préfixe des devis</label><input v-model="editing.quote_prefix" maxlength="10" /></div>
      <div class="field"><label>Délai de paiement (jours)</label><input v-model.number="editing.payment_terms_days" type="number" min="0" /></div>
      <div class="field span-2"><label>Conditions affichées sur les documents</label><textarea v-model="editing.default_terms"></textarea></div>
    </div>
    <h3 class="form-section">Coordonnées bancaires</h3>
    <div class="grid">
      <div class="field"><label>IBAN</label><input v-model="editing.iban" /></div>
      <div class="field"><label>BIC</label><input v-model="editing.bic" /></div>
    </div>
    <template #footer>
      <button @click="editing = null">Annuler</button>
      <button class="primary" :disabled="saving" @click="save">Enregistrer</button>
    </template>
  </Modal>
</template>
