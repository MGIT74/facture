<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import api, { errMsg } from '../api.js';
import { useAuth } from '../stores/auth.js';
import { useCompany } from '../stores/company.js';
import { CURRENCIES } from '../utils/format.js';
import { toast } from '../utils/toast.js';
import BrandMark from './BrandMark.vue';

// Affiché quand le compte n'a encore aucune entreprise
const auth = useAuth();
const company = useCompany();
const router = useRouter();
const form = ref({ company_name: '', country: 'France', default_currency: 'EUR' });
const error = ref('');
const saving = ref(false);

async function create() {
  error.value = '';
  saving.value = true;
  try {
    const { data } = await api.post('/companies', form.value);
    await company.load();
    company.select(data.id);
    toast(`Entreprise « ${data.company_name} » créée`);
  } catch (e) { error.value = errMsg(e); } finally { saving.value = false; }
}
function logout() { auth.logout(); company.reset(); router.push('/login'); }
</script>

<template>
  <div class="onboarding panel">
    <div class="panel-body" style="padding: 32px">
      <div class="brand" style="padding: 0 0 16px"><BrandMark /> Facturio</div>
      <template v-if="auth.isAdmin">
        <h1>Crée ta première entreprise</h1>
        <p class="muted">Cet espace est entièrement à toi : personne d'autre ne verra tes clients ni tes factures. Tu pourras compléter le reste (SIRET, IBAN, logo…) ensuite.</p>
        <div v-if="error" class="error">{{ error }}</div>
        <form @submit.prevent="create">
          <div class="field" style="margin-top: 16px"><label for="oname">Nom de l'entreprise *</label><input id="oname" v-model="form.company_name" required autofocus /></div>
          <div class="grid" style="margin-top: 14px">
            <div class="field"><label>Pays</label><input v-model="form.country" /></div>
            <div class="field"><label>Devise</label><select v-model="form.default_currency"><option v-for="c in CURRENCIES" :key="c.code" :value="c.code">{{ c.label }}</option></select></div>
          </div>
          <button class="primary" style="margin-top: 22px" :disabled="saving">Créer l'entreprise</button>
        </form>
      </template>
      <template v-else>
        <h1>Aucune entreprise</h1>
        <p class="muted">Ton compte n'a accès à aucune entreprise pour l'instant. Demande à un administrateur de t'en attribuer une.</p>
      </template>
      <button class="link" style="margin-top: 18px" @click="logout">Se déconnecter</button>
    </div>
  </div>
</template>
