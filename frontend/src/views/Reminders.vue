<script setup>
import { ref, onMounted } from 'vue';
import api, { errMsg } from '../api.js';
import { useAuth } from '../stores/auth.js';
import { money, dateFr } from '../utils/format.js';
import { toast } from '../utils/toast.js';
import EmailComposer from '../components/EmailComposer.vue';
import Icon from '../components/Icon.vue';

const auth = useAuth();
const data = ref(null);
const error = ref('');
const composer = ref(null);
const running = ref(false);

async function load() {
  try { data.value = (await api.get('/reminders')).data; } catch (e) { error.value = errMsg(e); }
}
onMounted(load);

const LEVELS = { 1: 'Rappel courtois', 2: 'Rappel ferme', 3: 'Dernier rappel' };
function status(i) {
  if (i.no_email) return { text: "Pas d'adresse email", cls: 'overdue' };
  if (i.next_level === null) return { text: 'Trois relances envoyées', cls: '' };
  if (i.due_now) return { text: `Relance n°${i.next_level} à envoyer`, cls: 'sent' };
  const wait = Math.max(i.days_late >= data.value.delays[i.next_level - 1] ? 0 : data.value.delays[i.next_level - 1] - i.days_late, 0);
  return { text: wait > 0 ? `Relance n°${i.next_level} dans ${wait} j` : `Relance n°${i.next_level} bientôt`, cls: '' };
}
const dueCount = () => data.value?.items.filter((i) => i.due_now).length || 0;

function open(i) { composer.value = { id: i.id, number: i.number, key: `reminder_${Math.min(i.next_level || 3, 3)}` }; }

async function runAll() {
  const n = dueCount();
  if (!confirm(`Envoyer maintenant ${n} relance(s) ? Chaque client reçoit un email avec la facture en pièce jointe.`)) return;
  running.value = true;
  try {
    const { data: r } = await api.post('/reminders/run');
    if (r.error) toast(r.error, 'err');
    else toast(`${r.sent} relance(s) envoyée(s)${r.failed ? `, ${r.failed} échec(s)` : ''}`, r.failed ? 'err' : 'ok');
    await load();
  } catch (e) { toast(errMsg(e), 'err'); } finally { running.value = false; }
}
</script>

<template>
  <div class="page-head">
    <h1>Relances</h1>
    <div class="actions">
      <router-link to="/settings/email-templates" class="btn">Textes des relances</router-link>
      <button v-if="auth.isAdmin && data" class="primary" :disabled="running || !dueCount() || !data.configured" @click="runAll">
        <Icon name="mail" />{{ running ? 'Envoi…' : `Envoyer les relances dues (${dueCount()})` }}
      </button>
    </div>
  </div>
  <div v-if="error" class="error">{{ error }}</div>

  <template v-if="data">
    <div v-if="!data.configured" class="note"><Icon name="mail" /><div>Le serveur d'envoi n'est pas configuré. <router-link to="/settings/email">Configurer l'email</router-link> pour envoyer des relances.</div></div>
    <div v-else class="note"><Icon name="bell" />
      <div>
        Relances automatiques <strong>{{ data.auto_enabled ? 'activées' : 'désactivées' }}</strong>
        (après {{ data.delays[0] }}, {{ data.delays[1] }} et {{ data.delays[2] }} jours de retard). <router-link to="/settings/email">Modifier</router-link>
      </div>
    </div>

    <div class="panel">
      <div v-if="!data.items.length" class="empty"><strong>Aucune facture à relancer</strong>Les factures envoyées et échues apparaîtront ici.</div>
      <div v-else class="table-wrap">
        <table>
          <thead><tr><th>Client</th><th>Facture</th><th>Échéance</th><th class="num">Reste dû</th><th>Dernière relance</th><th>Prochaine étape</th><th></th></tr></thead>
          <tbody>
            <tr v-for="i in data.items" :key="i.id">
              <td>
                <strong>{{ i.client_name }}</strong>
                <div class="muted small">{{ i.client_email || 'pas d\'email' }}</div>
              </td>
              <td class="nowrap"><router-link :to="`/invoices/${i.id}`">{{ i.number }}</router-link></td>
              <td><span>{{ dateFr(i.due_date) }}</span><div class="late small">{{ i.days_late }} jour(s) de retard</div></td>
              <td class="num">{{ money(i.balance_due, i.currency) }}</td>
              <td>
                <template v-if="i.last_reminder_level">{{ LEVELS[i.last_reminder_level] }}<div class="muted small">{{ dateFr((i.last_reminder_at || '').slice(0, 10)) }}</div></template>
                <span v-else class="muted">Aucune</span>
              </td>
              <td><span class="badge" :class="status(i).cls">{{ status(i).text }}</span></td>
              <td class="actions-cell"><button :disabled="!data.configured" @click="open(i)">Relancer</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </template>

  <EmailComposer v-if="composer" kind="invoice" :document-id="composer.id" :template-key="composer.key" :number="composer.number" @close="composer = null" @sent="load" />
</template>
