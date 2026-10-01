<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../stores/auth.js';
import { errMsg } from '../api.js';
import { useTheme } from '../stores/theme.js';
import Icon from '../components/Icon.vue';
import BrandMark from '../components/BrandMark.vue';

const router = useRouter();
const auth = useAuth();
const theme = useTheme();
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
    <button class="icon-btn" style="position: fixed; top: 18px; right: 18px" :aria-label="theme.mode === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'" @click="theme.toggle()">
      <Icon :name="theme.mode === 'dark' ? 'sun' : 'moon'" />
    </button>
    <div class="panel">
      <div class="brand"><BrandMark /> Facturio</div>
      <h1>Connexion</h1>
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
