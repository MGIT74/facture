<script setup>
import { ref, onMounted } from 'vue';
import api, { errMsg } from '../../api.js';
import { useAuth } from '../../stores/auth.js';
import { toast } from '../../utils/toast.js';
import Icon from '../../components/Icon.vue';

const auth = useAuth();
const s = ref(null);
const password = ref('');
const testTo = ref(auth.user?.email || '');
const error = ref('');
const saving = ref(false);
const testing = ref(false);
const testResult = ref(null);

// Réglages usuels : ils pré-remplissent le formulaire (à vérifier auprès du fournisseur)
const PRESETS = [
  { id: 'gmail', label: 'Gmail', host: 'smtp.gmail.com', port: 587, secure: 'starttls', help: 'Active la validation en deux étapes et crée un « mot de passe d\'application » : c\'est lui qu\'il faut saisir ici.' },
  { id: 'm365', label: 'Microsoft 365 / Outlook', host: 'smtp.office365.com', port: 587, secure: 'starttls', help: 'L\'envoi SMTP doit être autorisé pour la boîte dans l\'administration Microsoft 365.' },
  { id: 'ovh', label: 'OVH', host: 'ssl0.ovh.net', port: 465, secure: 'ssl', help: 'Utilise l\'adresse email complète comme identifiant.' },
  { id: 'infomaniak', label: 'Infomaniak', host: 'mail.infomaniak.com', port: 587, secure: 'starttls', help: 'Utilise l\'adresse email complète comme identifiant.' },
  { id: 'brevo', label: 'Brevo', host: 'smtp-relay.brevo.com', port: 587, secure: 'starttls', help: 'Identifiant et clé SMTP disponibles dans ton compte Brevo, rubrique SMTP et API.' },
  { id: 'sendgrid', label: 'SendGrid', host: 'smtp.sendgrid.net', port: 587, secure: 'starttls', help: 'L\'identifiant est le mot « apikey », le mot de passe est ta clé API.' },
];
const preset = ref('');
const presetHelp = ref('');
function applyPreset() {
  const p = PRESETS.find((x) => x.id === preset.value);
  if (!p) { presetHelp.value = ''; return; }
  s.value.smtp_host = p.host; s.value.smtp_port = p.port; s.value.smtp_secure = p.secure;
  presetHelp.value = p.help;
}
const SECURE = [{ v: 'starttls', l: 'STARTTLS (port 587)' }, { v: 'ssl', l: 'SSL / TLS (port 465)' }, { v: 'none', l: 'Aucune (déconseillé)' }];

async function load() { s.value = (await api.get('/email/settings')).data; }
onMounted(load);

function body() {
  const x = s.value;
  const b = {
    smtp_host: x.smtp_host || '', smtp_port: x.smtp_port, smtp_secure: x.smtp_secure, smtp_user: x.smtp_user || '',
    tls_reject_unauthorized: !!x.tls_reject_unauthorized, from_name: x.from_name || '', from_email: x.from_email || '', reply_to: x.reply_to || '',
    bcc_self: !!x.bcc_self, signature: x.signature || '', reminders_enabled: !!x.reminders_enabled,
    reminder1_days: x.reminder1_days, reminder2_days: x.reminder2_days, reminder3_days: x.reminder3_days,
  };
  if (password.value) b.smtp_password = password.value;
  return b;
}

async function save(silent = false) {
  error.value = '';
  saving.value = true;
  try {
    s.value = (await api.put('/email/settings', body())).data;
    password.value = '';
    if (!silent) toast('Réglages email enregistrés');
    return true;
  } catch (e) { error.value = errMsg(e); return false; } finally { saving.value = false; }
}

async function clearPassword() {
  if (!confirm('Supprimer le mot de passe SMTP enregistré ?')) return;
  try { s.value = (await api.put('/email/settings', { clear_password: true })).data; toast('Mot de passe supprimé'); }
  catch (e) { error.value = errMsg(e); }
}

async function sendTest() {
  testResult.value = null;
  if (!(await save(true))) return;
  testing.value = true;
  try {
    const { data } = await api.post('/email/test', { to: testTo.value });
    testResult.value = { ok: true, text: `Email de test envoyé à ${data.to}. Vérifie ta boîte de réception.` };
  } catch (e) { testResult.value = { ok: false, text: errMsg(e) }; } finally { testing.value = false; }
}
</script>

<template>
  <div v-if="s">
    <div class="page-head" style="margin-top: 0">
      <div style="display: flex; align-items: center; gap: 10px">
        <h2 style="font-size: 1.25rem">Envoi des emails</h2>
        <span class="badge" :class="s.configured ? 'paid' : 'overdue'">{{ s.configured ? 'Serveur configuré' : 'Non configuré' }}</span>
      </div>
      <button v-if="auth.isAdmin" class="primary" :disabled="saving" @click="save()">Enregistrer</button>
    </div>
    <div v-if="error" class="error">{{ error }}</div>
    <div v-if="!auth.isAdmin" class="note"><Icon name="shield" /><div>Seuls les administrateurs peuvent modifier ces réglages.</div></div>

    <fieldset :disabled="!auth.isAdmin" style="border: 0; padding: 0; margin: 0">
      <div class="panel">
        <div class="panel-head"><h2>Serveur d'envoi (SMTP)</h2></div>
        <div class="panel-body">
          <div class="field" style="max-width: 340px">
            <label for="preset">Fournisseur courant</label>
            <select id="preset" v-model="preset" @change="applyPreset">
              <option value="">Saisir à la main…</option>
              <option v-for="p in PRESETS" :key="p.id" :value="p.id">{{ p.label }}</option>
            </select>
          </div>
          <p v-if="presetHelp" class="muted small" style="margin: 8px 0 0">{{ presetHelp }}</p>
          <div class="grid" style="margin-top: 16px">
            <div class="field span-2"><label>Serveur *</label><input v-model="s.smtp_host" placeholder="smtp.exemple.fr" autocomplete="off" /></div>
            <div class="field"><label>Port</label><input v-model.number="s.smtp_port" type="number" min="1" max="65535" /></div>
            <div class="field"><label>Sécurité</label><select v-model="s.smtp_secure"><option v-for="o in SECURE" :key="o.v" :value="o.v">{{ o.l }}</option></select></div>
            <div class="field"><label>Identifiant</label><input v-model="s.smtp_user" autocomplete="off" /></div>
            <div class="field span-2">
              <label>Mot de passe</label>
              <input v-model="password" type="password" autocomplete="new-password" :placeholder="s.has_password ? '•••••••• (enregistré : laisse vide pour le garder)' : ''" />
              <button v-if="s.has_password && auth.isAdmin" type="button" class="link danger small" style="padding: 4px 0" @click="clearPassword">Supprimer le mot de passe enregistré</button>
            </div>
          </div>
          <label class="check" style="margin: 14px 0 0"><input v-model="s.tls_reject_unauthorized" type="checkbox" :true-value="1" :false-value="0" />Vérifier le certificat du serveur (recommandé)</label>
          <p class="muted small" style="margin: 6px 0 0">Le mot de passe est chiffré dans la base et n'est jamais affiché à nouveau.</p>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h2>Expéditeur</h2></div>
        <div class="panel-body">
          <div class="grid">
            <div class="field"><label>Nom affiché</label><input v-model="s.from_name" placeholder="Dokatel Facturation" /></div>
            <div class="field"><label>Adresse d'expédition *</label><input v-model="s.from_email" type="email" placeholder="facturation@exemple.fr" /></div>
            <div class="field"><label>Adresse de réponse</label><input v-model="s.reply_to" type="email" placeholder="Si différente de l'expédition" /></div>
          </div>
          <label class="check" style="margin: 14px 0 0"><input v-model="s.bcc_self" type="checkbox" :true-value="1" :false-value="0" />Recevoir une copie cachée de chaque email envoyé</label>
          <div class="field" style="margin-top: 14px"><label>Signature (variable &#123;&#123;signature&#125;&#125; des emails types)</label>
            <textarea v-model="s.signature" placeholder="Prénom Nom&#10;Société, téléphone"></textarea></div>
          <p class="muted small" style="margin: 8px 0 0">Beaucoup de fournisseurs exigent que l'adresse d'expédition soit celle du compte SMTP.</p>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h2>Relances automatiques</h2></div>
        <div class="panel-body">
          <label class="check"><input v-model="s.reminders_enabled" type="checkbox" :true-value="1" :false-value="0" />Envoyer automatiquement les relances de factures impayées</label>
          <p class="muted small" style="margin: 0 0 14px">Désactivées par défaut. Chaque matin, les factures envoyées et échues dont le client a une adresse email reçoivent la relance suivante. Jamais deux relances à moins de 3 jours d'écart, et trois relances maximum par facture.</p>
          <div class="grid">
            <div class="field"><label>Relance n°1 après (jours de retard)</label><input v-model.number="s.reminder1_days" type="number" min="1" max="365" /></div>
            <div class="field"><label>Relance n°2 après</label><input v-model.number="s.reminder2_days" type="number" min="1" max="365" /></div>
            <div class="field"><label>Relance n°3 après</label><input v-model.number="s.reminder3_days" type="number" min="1" max="365" /></div>
          </div>
          <p class="small" style="margin: 12px 0 0"><router-link to="/settings/email-templates">Modifier le texte des relances</router-link></p>
        </div>
      </div>

      <div v-if="auth.isAdmin" class="panel">
        <div class="panel-head"><h2>Tester l'envoi</h2></div>
        <div class="panel-body">
          <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end">
            <div class="field" style="flex: 1; min-width: 240px"><label>Envoyer un email de test à</label><input v-model="testTo" type="email" /></div>
            <button :disabled="testing || saving" @click="sendTest"><Icon name="mail" />{{ testing ? 'Envoi…' : 'Enregistrer et tester' }}</button>
          </div>
          <div v-if="testResult" :class="testResult.ok ? 'note' : 'error'" style="margin: 14px 0 0">{{ testResult.text }}</div>
        </div>
      </div>
    </fieldset>
  </div>
</template>
