<script setup>
import { ref, onMounted } from 'vue';
import api, { errMsg } from '../../api.js';
import { useCompany } from '../../stores/company.js';
import { toast } from '../../utils/toast.js';
import Modal from '../../components/Modal.vue';
import Icon from '../../components/Icon.vue';

const company = useCompany();
const users = ref([]);
const editing = ref(null);
const error = ref('');
const saving = ref(false);

async function load() { users.value = (await api.get('/users')).data; }
onMounted(load);

const genPassword = () => {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
};

function open(u) {
  error.value = '';
  editing.value = u
    ? { id: u.id, name: u.name, email: u.email, role: u.role, password: '', company_ids: u.companies.map((c) => c.id) }
    : { name: '', email: '', role: 'user', password: genPassword(), company_ids: company.currentId ? [company.currentId] : [] };
}
function toggle(cid) {
  const ids = editing.value.company_ids;
  const i = ids.indexOf(cid);
  if (i >= 0) ids.splice(i, 1); else ids.push(cid);
}

async function save() {
  error.value = '';
  saving.value = true;
  try {
    const u = editing.value;
    if (u.id) {
      const body = { name: u.name, company_ids: u.company_ids, role: u.role };
      if (u.password) body.password = u.password;
      await api.put(`/users/${u.id}`, body);
      toast('Compte modifié');
    } else {
      await api.post('/users', u);
      toast('Compte créé : transmets-lui son mot de passe');
    }
    editing.value = null;
    await load();
  } catch (e) { error.value = errMsg(e); } finally { saving.value = false; }
}

async function remove(u) {
  if (!confirm(`Supprimer le compte de ${u.name} ? Il ne pourra plus se connecter.`)) return;
  try { await api.delete(`/users/${u.id}`); toast('Compte supprimé'); await load(); }
  catch (e) { toast(errMsg(e), 'err'); }
}
</script>

<template>
  <div class="note">
    <Icon name="shield" />
    <div>
      <strong>Chaque espace est isolé.</strong> Un administrateur que tu crées peut monter ses propres entreprises : tu ne verras jamais
      leurs clients, factures ni utilisateurs, et il ne verra jamais les tiens. Tu ne partages que les entreprises que tu coches pour un compte.
    </div>
  </div>

  <div class="panel">
    <div class="panel-head">
      <h2>Utilisateurs</h2>
      <button class="primary" @click="open()"><Icon name="plus" />Nouveau compte</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Nom</th><th>Rôle</th><th>Accès à tes entreprises</th><th></th></tr></thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td>
              <strong>{{ u.name }}</strong><span v-if="u.is_me" class="badge" style="margin-left: 8px">Toi</span>
              <div class="muted small">{{ u.email }}</div>
            </td>
            <td><span class="badge" :class="u.role === 'admin' ? 'sent' : ''">{{ u.role === 'admin' ? 'Administrateur' : 'Utilisateur' }}</span></td>
            <td>
              <div v-if="u.companies.length" class="company-chips"><span v-for="c in u.companies" :key="c.id" class="company-chip">{{ c.name }}</span></div>
              <span v-else class="muted small">{{ u.role === 'admin' ? 'Aucune : il crée ses propres entreprises' : 'Aucune' }}</span>
            </td>
            <td class="actions-cell">
              <template v-if="!u.is_me">
                <button class="link" @click="open(u)">Modifier</button>
                <button class="link danger" @click="remove(u)">Supprimer</button>
              </template>
              <router-link v-else to="/settings/account" class="small">Mon compte</router-link>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <Modal v-if="editing" :title="editing.id ? 'Modifier le compte' : 'Nouveau compte'" @close="editing = null">
    <div v-if="error" class="error">{{ error }}</div>
    <div class="grid">
      <div class="field"><label>Nom *</label><input v-model="editing.name" autofocus /></div>
      <div class="field"><label>Email *</label><input v-model="editing.email" type="email" :disabled="!!editing.id" autocomplete="off" /></div>
      <div class="field">
        <label>Rôle</label>
        <select v-model="editing.role">
          <option value="user">Utilisateur : travaille dans les entreprises cochées</option>
          <option value="admin">Administrateur : peut aussi créer ses entreprises</option>
        </select>
      </div>
      <div class="field">
        <label>{{ editing.id ? 'Nouveau mot de passe (facultatif)' : 'Mot de passe *' }}</label>
        <div style="display: flex; gap: 6px">
          <input v-model="editing.password" :type="editing.id ? 'password' : 'text'" autocomplete="new-password" placeholder="8 caractères minimum" />
          <button type="button" @click="editing.password = genPassword()">Générer</button>
        </div>
      </div>
    </div>
    <h3 class="form-section">Entreprises auxquelles il a accès</h3>
    <div v-if="!company.list.length" class="muted small">Tu n'as pas encore d'entreprise.</div>
    <label v-for="c in company.list" :key="c.id" class="check">
      <input type="checkbox" :checked="editing.company_ids.includes(c.id)" @change="toggle(c.id)" />{{ c.company_name }}
    </label>
    <p v-if="editing.role === 'admin'" class="muted small" style="margin: 10px 0 0">
      Sans entreprise cochée, cet administrateur démarre avec un espace vide et crée la sienne, totalement isolée de la tienne.
    </p>
    <template #footer>
      <button @click="editing = null">Annuler</button>
      <button class="primary" :disabled="saving" @click="save">{{ editing.id ? 'Enregistrer' : 'Créer le compte' }}</button>
    </template>
  </Modal>
</template>
