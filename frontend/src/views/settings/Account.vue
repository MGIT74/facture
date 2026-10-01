<script setup>
import { ref } from 'vue';
import api, { errMsg } from '../../api.js';
import { useAuth } from '../../stores/auth.js';
import { toast } from '../../utils/toast.js';

const auth = useAuth();
const name = ref(auth.user?.name || '');
const pw = ref({ current_password: '', new_password: '', confirm: '' });
const error = ref('');
const nameError = ref('');
const saving = ref(false);

async function saveName() {
  nameError.value = '';
  try {
    const { data } = await api.put('/auth/me', { name: name.value });
    auth.setUser({ ...auth.user, name: data.name });
    toast('Nom enregistré');
  } catch (e) { nameError.value = errMsg(e); }
}

async function changePassword() {
  error.value = '';
  if (pw.value.new_password !== pw.value.confirm) { error.value = 'Les deux mots de passe ne correspondent pas'; return; }
  saving.value = true;
  try {
    await api.put('/auth/password', { current_password: pw.value.current_password, new_password: pw.value.new_password });
    pw.value = { current_password: '', new_password: '', confirm: '' };
    toast('Mot de passe modifié');
  } catch (e) { error.value = errMsg(e); } finally { saving.value = false; }
}
</script>

<template>
  <div style="max-width: 560px">
    <div class="panel">
      <div class="panel-head"><h2>Profil</h2></div>
      <div class="panel-body">
        <div v-if="nameError" class="error">{{ nameError }}</div>
        <div class="grid">
          <div class="field"><label>Nom</label><input v-model="name" /></div>
          <div class="field"><label>Email</label><input :value="auth.user?.email" disabled /></div>
        </div>
        <p class="muted small" style="margin: 10px 0 14px">Rôle : {{ auth.isAdmin ? 'Administrateur' : 'Utilisateur' }}</p>
        <button class="primary" @click="saveName">Enregistrer</button>
      </div>
    </div>
    <div class="panel">
      <div class="panel-head"><h2>Mot de passe</h2></div>
      <form class="panel-body" @submit.prevent="changePassword">
        <div v-if="error" class="error">{{ error }}</div>
        <input type="text" :value="auth.user?.email" autocomplete="username" hidden />
        <div class="field"><label>Mot de passe actuel</label><input v-model="pw.current_password" type="password" autocomplete="current-password" required /></div>
        <div class="grid" style="margin-top: 14px">
          <div class="field"><label>Nouveau mot de passe</label><input v-model="pw.new_password" type="password" autocomplete="new-password" minlength="8" required /></div>
          <div class="field"><label>Confirmer</label><input v-model="pw.confirm" type="password" autocomplete="new-password" required /></div>
        </div>
        <p class="muted small" style="margin: 10px 0 14px">8 caractères minimum.</p>
        <button class="primary" :disabled="saving">Changer le mot de passe</button>
      </form>
    </div>
  </div>
</template>
