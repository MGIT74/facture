<script setup>
import { useAuth } from '../stores/auth.js';
const auth = useAuth();
</script>

<template>
  <div class="page-head"><h1>Paramètres</h1></div>
  <nav class="tabs" aria-label="Sections des paramètres">
    <router-link to="/settings/templates" active-class="active">Modèles de documents</router-link>
    <router-link to="/settings/email" active-class="active">Email</router-link>
    <router-link to="/settings/email-templates" active-class="active">Emails types</router-link>
    <router-link v-if="auth.isAdmin" to="/settings/users" active-class="active">Utilisateurs</router-link>
    <router-link to="/settings/account" active-class="active">Mon compte</router-link>
  </nav>
  <router-view />
</template>
