<script setup>
import { ref, computed, onMounted } from 'vue';
import api, { errMsg } from '../api.js';
import { EMAIL_TEMPLATES } from '../utils/format.js';
import { toast } from '../utils/toast.js';
import Modal from './Modal.vue';

// Fenêtre d'envoi d'un email pour une facture ou un devis, pré-remplie depuis l'email type choisi
const props = defineProps({ kind: String, documentId: [Number, String], templateKey: String, number: String });
const emit = defineEmits(['close', 'sent']);

const form = ref({ template_key: props.templateKey, to: '', cc: '', subject: '', body: '', attach_pdf: true });
const configured = ref(true);
const from = ref('');
const loading = ref(true);
const sending = ref(false);
const error = ref('');
const keys = computed(() => Object.entries(EMAIL_TEMPLATES).filter(([, t]) => t.kind === props.kind).map(([k, t]) => ({ key: k, label: t.label })));

async function load(keepRecipients = false) {
  loading.value = true;
  error.value = '';
  try {
    const { data } = await api.post('/email/preview', { kind: props.kind, document_id: Number(props.documentId), template_key: form.value.template_key });
    form.value.subject = data.subject;
    form.value.body = data.body;
    if (!keepRecipients) form.value.to = data.to;
    configured.value = data.configured;
    from.value = data.from || '';
  } catch (e) { error.value = errMsg(e); } finally { loading.value = false; }
}
onMounted(() => load());

async function send() {
  error.value = '';
  sending.value = true;
  try {
    await api.post('/email/send', { kind: props.kind, document_id: Number(props.documentId), ...form.value });
    toast('Email envoyé');
    emit('sent');
    emit('close');
  } catch (e) { error.value = errMsg(e); } finally { sending.value = false; }
}
</script>

<template>
  <Modal title="Envoyer par email" @close="emit('close')">
    <div v-if="!configured" class="error">
      Le serveur d'envoi n'est pas configuré. <router-link to="/settings/email" @click="emit('close')">Configurer l'email</router-link>
    </div>
    <div v-if="error" class="error">{{ error }}</div>
    <div class="grid">
      <div class="field span-2">
        <label for="tplkey">Type de message</label>
        <select id="tplkey" v-model="form.template_key" @change="load(true)">
          <option v-for="k in keys" :key="k.key" :value="k.key">{{ k.label }}</option>
        </select>
      </div>
      <div class="field span-2"><label for="to">À *</label><input id="to" v-model="form.to" type="text" placeholder="client@exemple.fr (plusieurs adresses séparées par une virgule)" /></div>
      <div class="field span-2"><label for="cc">Copie (Cc)</label><input id="cc" v-model="form.cc" type="text" /></div>
      <div class="field span-2"><label for="subj">Objet *</label><input id="subj" v-model="form.subject" :disabled="loading" /></div>
      <div class="field span-2"><label for="msg">Message *</label><textarea id="msg" v-model="form.body" rows="11" :disabled="loading" style="min-height: 230px"></textarea></div>
    </div>
    <label class="check" style="margin: 14px 0 0"><input v-model="form.attach_pdf" type="checkbox" />Joindre le PDF ({{ number }}.pdf)</label>
    <p v-if="from" class="muted small" style="margin: 8px 0 0">Expéditeur : {{ from }}</p>
    <template #footer>
      <button @click="emit('close')">Annuler</button>
      <button class="primary" :disabled="sending || loading || !configured" @click="send">{{ sending ? 'Envoi…' : 'Envoyer' }}</button>
    </template>
  </Modal>
</template>
