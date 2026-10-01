<script setup>
import { ref, onMounted, watch } from 'vue';
import api, { errMsg } from '../api.js';
import { eur } from '../utils/format.js';
import { toast } from '../utils/toast.js';
import Modal from '../components/Modal.vue';

const rows = ref([]);
const q = ref('');
const editing = ref(null);
const error = ref('');
const saving = ref(false);

async function load() {
  rows.value = (await api.get('/items', { params: { q: q.value } })).data;
}
onMounted(load);
let t;
watch(q, () => { clearTimeout(t); t = setTimeout(load, 250); });

function open(i) {
  error.value = '';
  editing.value = i ? { ...i } : { name: '', description: '', unit_price: 0, tax_rate: 20, unit: 'unité' };
}

async function save() {
  error.value = '';
  saving.value = true;
  try {
    const i = editing.value;
    if (i.id) await api.put(`/items/${i.id}`, i);
    else await api.post('/items', i);
    editing.value = null;
    toast('Produit enregistré');
    await load();
  } catch (e) { error.value = errMsg(e); } finally { saving.value = false; }
}

async function remove(i) {
  if (!confirm(`Supprimer « ${i.name} » ? Les factures existantes ne sont pas modifiées.`)) return;
  try { await api.delete(`/items/${i.id}`); toast('Produit supprimé'); await load(); }
  catch (e) { toast(errMsg(e), 'err'); }
}
</script>

<template>
  <div class="page-head">
    <h1>Produits et services</h1>
    <button class="primary" @click="open()">Nouveau produit</button>
  </div>
  <div class="panel">
    <div class="searchbar"><input v-model="q" placeholder="Rechercher un produit" aria-label="Rechercher" /></div>
    <div v-if="!rows.length" class="empty">
      <strong>{{ q ? 'Aucun résultat' : 'Aucun produit' }}</strong>
      {{ q ? 'Essaie un autre terme.' : 'Enregistre tes prestations habituelles pour les ajouter en un clic aux factures.' }}
    </div>
    <div v-else class="table-wrap">
      <table>
        <thead><tr><th>Nom</th><th>Unité</th><th class="num">Prix HT</th><th class="num">TVA</th><th></th></tr></thead>
        <tbody>
          <tr v-for="i in rows" :key="i.id">
            <td>
              <button class="link" @click="open(i)">{{ i.name }}</button>
              <div v-if="i.description" class="muted small">{{ i.description }}</div>
            </td>
            <td>{{ i.unit }}</td>
            <td class="num">{{ eur(i.unit_price) }}</td>
            <td class="num">{{ i.tax_rate }} %</td>
            <td class="actions-cell"><button class="link danger" @click="remove(i)">Supprimer</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <Modal v-if="editing" :title="editing.id ? 'Modifier le produit' : 'Nouveau produit'" @close="editing = null">
    <div v-if="error" class="error">{{ error }}</div>
    <div class="grid">
      <div class="field span-2"><label>Nom *</label><input v-model="editing.name" autofocus /></div>
      <div class="field span-2"><label>Description</label><textarea v-model="editing.description"></textarea></div>
      <div class="field"><label>Prix unitaire HT *</label><input v-model.number="editing.unit_price" type="number" step="0.01" min="0" /></div>
      <div class="field"><label>TVA (%)</label><input v-model.number="editing.tax_rate" type="number" step="0.1" min="0" /></div>
      <div class="field"><label>Unité</label><input v-model="editing.unit" placeholder="heure, jour, forfait…" /></div>
    </div>
    <template #footer>
      <button @click="editing = null">Annuler</button>
      <button class="primary" :disabled="saving" @click="save">Enregistrer</button>
    </template>
  </Modal>
</template>
