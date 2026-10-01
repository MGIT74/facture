<script setup>
import { ref, onMounted } from 'vue';
import api, { errMsg } from '../api.js';
import { useAuth } from '../stores/auth.js';
import { toast } from '../utils/toast.js';

const auth = useAuth();
const s = ref(null);
const error = ref('');
const saving = ref(false);

onMounted(async () => { s.value = (await api.get('/settings')).data; });

async function save() {
  error.value = '';
  saving.value = true;
  try {
    s.value = (await api.put('/settings', s.value)).data;
    toast('Paramètres enregistrés');
  } catch (e) { error.value = errMsg(e); } finally { saving.value = false; }
}
</script>

<template>
  <div class="page-head">
    <h1>Paramètres</h1>
    <button v-if="auth.isAdmin" class="primary" :disabled="saving" @click="save">Enregistrer</button>
  </div>
  <div v-if="error" class="error">{{ error }}</div>
  <p v-if="!auth.isAdmin" class="muted">Seuls les administrateurs peuvent modifier ces informations.</p>

  <template v-if="s">
    <fieldset :disabled="!auth.isAdmin" style="border: 0; padding: 0; margin: 0">
      <div class="panel">
        <div class="panel-head"><h2>Entreprise</h2></div>
        <div class="panel-body grid">
          <div class="field"><label>Nom commercial *</label><input v-model="s.company_name" /></div>
          <div class="field"><label>Raison sociale</label><input v-model="s.legal_name" /></div>
          <div class="field"><label>SIRET</label><input v-model="s.siret" /></div>
          <div class="field"><label>N° de TVA</label><input v-model="s.vat_number" /></div>
          <div class="field span-2"><label>Adresse</label><input v-model="s.address" /></div>
          <div class="field"><label>Code postal</label><input v-model="s.postal_code" /></div>
          <div class="field"><label>Ville</label><input v-model="s.city" /></div>
          <div class="field"><label>Email</label><input v-model="s.email" type="email" /></div>
          <div class="field"><label>Téléphone</label><input v-model="s.phone" /></div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h2>Facturation</h2></div>
        <div class="panel-body grid">
          <div class="field"><label>Préfixe des factures</label><input v-model="s.invoice_prefix" maxlength="10" /></div>
          <div class="field"><label>Préfixe des devis</label><input v-model="s.quote_prefix" maxlength="10" /></div>
          <div class="field"><label>TVA par défaut (%)</label><input v-model.number="s.default_tax_rate" type="number" step="0.1" /></div>
          <div class="field"><label>Délai de paiement (jours)</label><input v-model.number="s.payment_terms_days" type="number" min="0" /></div>
          <div class="field span-2"><label>Conditions affichées sur les documents</label><textarea v-model="s.default_terms" placeholder="Ex : pénalité de retard, escompte, mentions utiles…"></textarea></div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h2>Coordonnées bancaires</h2></div>
        <div class="panel-body grid">
          <div class="field"><label>IBAN</label><input v-model="s.iban" /></div>
          <div class="field"><label>BIC</label><input v-model="s.bic" /></div>
        </div>
      </div>
    </fieldset>
  </template>
</template>
