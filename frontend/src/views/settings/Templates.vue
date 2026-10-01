<script setup>
import { ref, computed, onMounted } from 'vue';
import api, { errMsg } from '../../api.js';
import { useAuth } from '../../stores/auth.js';
import { toast } from '../../utils/toast.js';

const auth = useAuth();
const rows = ref([]);
const loading = ref(true);
const LAYOUTS = { classic: 'Classique', modern: 'Moderne', minimal: 'Minimal' };
const GROUPS = [
  { kind: 'invoice', title: 'Factures', empty: 'Aucun modèle de facture : l’apparence standard est utilisée.' },
  { kind: 'quote', title: 'Devis', empty: 'Aucun modèle de devis : l’apparence standard est utilisée.' },
];
const byKind = (k) => computed(() => rows.value.filter((r) => r.kind === k)).value;

async function load() {
  try { rows.value = (await api.get('/templates')).data; } finally { loading.value = false; }
}
onMounted(load);

async function makeDefault(t) {
  try { await api.put(`/templates/${t.id}`, { is_default: true }); toast(`« ${t.name} » est le modèle par défaut`); await load(); }
  catch (e) { toast(errMsg(e), 'err'); }
}
async function remove(t) {
  if (!confirm(`Supprimer le modèle « ${t.name} » ? Les documents existants repassent sur le modèle par défaut.`)) return;
  try { await api.delete(`/templates/${t.id}`); toast('Modèle supprimé'); await load(); }
  catch (e) { toast(errMsg(e), 'err'); }
}
</script>

<template>
  <p class="muted" style="margin-top: 0; max-width: 62ch">
    Un modèle fixe l'apparence et les textes de tes factures et devis : logo, couleur, disposition, colonnes affichées, notes,
    conditions et mention de pied de page. Le modèle par défaut s'applique aux nouveaux documents ; tu peux en choisir un autre à chaque fois.
  </p>

  <section v-for="g in GROUPS" :key="g.kind">
    <div class="section-title">
      <h2>{{ g.title }}</h2>
      <router-link v-if="auth.isAdmin" :to="`/settings/templates/new?kind=${g.kind}`" class="btn">Nouveau modèle</router-link>
    </div>
    <div v-if="!loading && !byKind(g.kind).length" class="panel"><div class="empty">
      <strong>{{ g.empty }}</strong>
      <router-link v-if="auth.isAdmin" :to="`/settings/templates/new?kind=${g.kind}`">Créer un modèle de {{ g.kind === 'invoice' ? 'facture' : 'devis' }}</router-link>
    </div></div>
    <div v-else class="tpl-grid">
      <div v-for="t in byKind(g.kind)" :key="t.id" class="panel tpl-card">
        <div class="swatch" :style="{ background: t.accent }"></div>
        <h3>
          {{ t.name }}
          <span v-if="t.is_default" class="badge paid">Par défaut</span>
        </h3>
        <div class="tpl-meta">
          <span>{{ LAYOUTS[t.layout] }}</span>
          <span v-if="t.title">Titre « {{ t.title }} »</span>
          <span v-if="t.has_logo">Logo</span>
          <span v-if="!t.show_discount">Sans remise</span>
          <span v-if="!t.show_tax">Sans TVA</span>
        </div>
        <div v-if="auth.isAdmin" class="tpl-actions">
          <router-link :to="`/settings/templates/${t.id}`" class="btn">Modifier</router-link>
          <button v-if="!t.is_default" @click="makeDefault(t)">Définir par défaut</button>
          <button class="danger" @click="remove(t)">Supprimer</button>
        </div>
      </div>
    </div>
  </section>
</template>
