<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../stores/auth.js';
import { errMsg } from '../api.js';

const router = useRouter();
const auth = useAuth();
const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    await auth.login(email.value, password.value);
    router.push('/');
  } catch (e) {
    error.value = errMsg(e);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login">
    <div class="panel">
      <h1>Facturio</h1>
      <p class="muted" style="margin: 4px 0 0">Connecte-toi pour gérer tes factures.</p>
      <form @submit.prevent="submit">
        <div class="field" style="margin-top: 22px">
          <label for="email">Email</label>
          <input id="email" v-model="email" type="email" autocomplete="username" required autofocus />
        </div>
        <div class="field">
          <label for="pw">Mot de passe</label>
          <input id="pw" v-model="password" type="password" autocomplete="current-password" required />
        </div>
        <div v-if="error" class="error" style="margin: 14px 0 0">{{ error }}</div>
        <button class="primary" :disabled="loading">{{ loading ? 'Connexion…' : 'Se connecter' }}</button>
      </form>
    </div>
  </div>
</template>
