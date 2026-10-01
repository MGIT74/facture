<script setup>
import { ref, onMounted, watch } from 'vue';
import api, { errMsg } from '../api.js';
import { toast } from '../utils/toast.js';
import Modal from '../components/Modal.vue';

const rows = ref([]);
const q = ref('');
const editing = ref(null);
const error = ref('');
const saving = ref(false);

const blank = () => ({ name: '', email: '', phone: '', address: '', postal_code: '', city: '', country: 'France', vat_number: '', notes: '' });

async function load() {
  rows.value = (await api.get('/clients', { params: { q: q.value } })).data;
}
onMounted(load);
let t;
watch(q, () => { clearTimeout(t); t = setTimeout(load, 250); });

function open(c) { error.value = ''; editing.value = c ? { ...c } : blank(); }

async function save() {
  error.value = '';
  saving.value = true;
  try {
    const c = editing.value;
    if (c.id) await api.put(`/clients/${c.id}`, c);
    else await api.post('/clients', c);
    editing.value = null;
    toast('Client enregistré');
    await load();
  } catch (e) { error.value = errMsg(e); } finally { saving.value = false; }
}

async function remove(c) {
  if (!confirm(`Supprimer le client « ${c.name} » ?`)) return;
  try { await api.delete(`/clients/${c.id}`); toast('Client supprimé'); await load(); }
  catch (e) { toast(errMsg(e), 'err'); }
}
</script>

<template>
  <div class="page-head">
    <h1>Clients</h1>
    <button class="primary" @click="open()">Nouveau client</button>
  </div>
  <div class="panel">
    <div class="searchbar"><input v-model="q" placeholder="Rechercher un nom, un email, une ville" aria-label="Rechercher" /></div>
    <div v-if="!rows.length" class="empty">
      <strong>{{ q ? 'Aucun résultat' : 'Aucun client' }}</strong>
      {{ q ? 'Essaie un autre terme.' : 'Ajoute ton premier client pour pouvoir lui facturer quelque chose.' }}
    </div>
    <div v-else class="table-wrap">
      <table>
        <thead><tr><th>Nom</th><th>Email</th><th>Téléphone</th><th>Ville</th><th></th></tr></thead>
        <tbody>
          <tr v-for="c in rows" :key="c.id">
            <td><button class="link" @click="open(c)">{{ c.name }}</button></td>
            <td>{{ c.email }}</td><td>{{ c.phone }}</td><td>{{ c.city }}</td>
            <td class="actions-cell">
              <router-link :to="`/invoices/new?client=${c.id}`" class="small">Facturer</router-link>
              <button class="link danger" @click="remove(c)">Supprimer</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <Modal v-if="editing" :title="editing.id ? 'Modifier le client' : 'Nouveau client'" @close="editing = null">
    <div v-if="error" class="error">{{ error }}</div>
    <div class="grid">
      <div class="field span-2"><label>Nom ou raison sociale *</label><input v-model="editing.name" autofocus /></div>
      <div class="field"><label>Email</label><input v-model="editing.email" type="email" /></div>
      <div class="field"><label>Téléphone</label><input v-model="editing.phone" /></div>
      <div class="field span-2"><label>Adresse</label><input v-model="editing.address" /></div>
      <div class="field"><label>Code postal</label><input v-model="editing.postal_code" /></div>
      <div class="field"><label>Ville</label><input v-model="editing.city" /></div>
      <div class="field"><label>Pays</label><input v-model="editing.country" /></div>
      <div class="field"><label>N° de TVA</label><input v-model="editing.vat_number" /></div>
      <div class="field span-2"><label>Notes internes</label><textarea v-model="editing.notes"></textarea></div>
    </div>
    <template #footer>
      <button @click="editing = null">Annuler</button>
      <button class="primary" :disabled="saving" @click="save">Enregistrer</button>
    </template>
  </Modal>
</template>
