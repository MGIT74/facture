<script setup>
import { ref, computed, onMounted } from 'vue';
import api, { errMsg } from '../../api.js';
import { useAuth } from '../../stores/auth.js';
import { useCompany } from '../../stores/company.js';
import { EMAIL_TEMPLATES, dateFr, todayISO, addDaysISO, money } from '../../utils/format.js';
import { toast } from '../../utils/toast.js';

const auth = useAuth();
const company = useCompany();
const templates = ref([]);
const variables = ref([]);
const current = ref('invoice_send');
const subject = ref('');
const body = ref('');
const focused = ref('body');
const subjectEl = ref(null);
const bodyEl = ref(null);
const error = ref('');
const saving = ref(false);
const signature = ref('');

const active = computed(() => templates.value.find((t) => t.key === current.value));
const dirty = computed(() => active.value && (subject.value !== active.value.subject || body.value !== active.value.body));

function select(key) {
  const t = templates.value.find((x) => x.key === key);
  current.value = key; subject.value = t.subject; body.value = t.body; error.value = '';
}
async function load(keep) {
  const { data } = await api.get('/email/templates');
  templates.value = data.templates; variables.value = data.variables;
  select(keep || current.value);
}
onMounted(async () => {
  load();
  try { signature.value = (await api.get('/email/settings')).data.signature || ''; } catch { /* lecture seule */ }
});

// Insère la variable à l'endroit du curseur
function insert(v) {
  const el = focused.value === 'subject' ? subjectEl.value : bodyEl.value;
  const model = focused.value === 'subject' ? subject : body;
  const text = `{{${v}}}`;
  const a = el?.selectionStart ?? model.value.length, b = el?.selectionEnd ?? a;
  model.value = model.value.slice(0, a) + text + model.value.slice(b);
  requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(a + text.length, a + text.length); });
}

async function save() {
  error.value = '';
  saving.value = true;
  try {
    await api.put(`/email/templates/${current.value}`, { subject: subject.value, body: body.value });
    toast('Email type enregistré');
    await load(current.value);
  } catch (e) { error.value = errMsg(e); } finally { saving.value = false; }
}
async function reset() {
  if (!confirm("Rétablir le texte d'origine de cet email ?")) return;
  try { await api.delete(`/email/templates/${current.value}`); toast("Texte d'origine rétabli"); await load(current.value); }
  catch (e) { error.value = errMsg(e); }
}

// Aperçu avec des valeurs d'exemple
const sample = computed(() => {
  const cur = company.currency, t = todayISO();
  const isQuote = EMAIL_TEMPLATES[current.value]?.kind === 'quote';
  return {
    client: 'Acme SAS', number: isQuote ? 'DEV-2026-0001' : 'FAC-2026-0001', company: company.current?.company_name || 'Mon entreprise',
    total: money(1296, cur), balance: money(1296, cur), paid: money(0, cur), issue_date: dateFr(t), due_date: dateFr(addDaysISO(t, -12)),
    valid_until: dateFr(addDaysISO(t, 30)), days_late: '12', currency: cur, signature: signature.value || company.current?.company_name || '', sender: auth.user?.name || '',
  };
});
const fill = (str) => String(str).replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => sample.value[k] ?? '');
</script>

<template>
  <p class="muted" style="margin-top: 0; max-width: 64ch">
    Ces textes pré-remplissent les emails d'envoi et de relance. Tu peux toujours les modifier avant d'envoyer.
    Les variables entre doubles accolades sont remplacées par les vraies valeurs de la facture ou du devis.
  </p>
  <div class="editor-grid" style="grid-template-columns: 250px 1fr">
    <div class="panel" style="padding: 8px">
      <button v-for="t in templates" :key="t.key" class="nav-item" :class="{ active: t.key === current }" style="width: 100%; border-radius: 12px; justify-content: space-between"
        @click="select(t.key)">
        <span style="text-align: left">{{ EMAIL_TEMPLATES[t.key].label }}</span>
        <span v-if="t.customized" class="badge sent" title="Texte personnalisé" style="padding: 0 6px">modifié</span>
      </button>
    </div>

    <div v-if="active">
      <div class="panel"><div class="panel-body">
        <div v-if="error" class="error">{{ error }}</div>
        <p class="muted small" style="margin: 0 0 14px">{{ EMAIL_TEMPLATES[current].hint }}</p>
        <fieldset :disabled="!auth.isAdmin" style="border: 0; padding: 0; margin: 0">
          <div class="field"><label for="esubj">Objet</label><input id="esubj" ref="subjectEl" v-model="subject" @focus="focused = 'subject'" /></div>
          <div class="field" style="margin-top: 14px"><label for="ebody">Message</label>
            <textarea id="ebody" ref="bodyEl" v-model="body" rows="12" style="min-height: 250px" @focus="focused = 'body'"></textarea></div>
          <div v-if="auth.isAdmin" style="margin-top: 12px">
            <div class="muted small" style="margin-bottom: 6px">Insérer une variable :</div>
            <div class="chips"><button v-for="v in variables" :key="v" type="button" class="chip" @click="insert(v)">{{ v }}</button></div>
          </div>
        </fieldset>
        <div v-if="auth.isAdmin" class="actions" style="margin-top: 18px">
          <button class="primary" :disabled="saving || !dirty" @click="save">Enregistrer</button>
          <button v-if="active.customized" @click="reset">Rétablir le texte d'origine</button>
        </div>
      </div></div>

      <div class="panel">
        <div class="panel-head"><h2>Aperçu avec des valeurs d'exemple</h2></div>
        <div class="panel-body">
          <div class="muted small">Objet</div>
          <div style="font-weight: 600; margin-bottom: 12px">{{ fill(subject) }}</div>
          <div style="white-space: pre-line">{{ fill(body) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
