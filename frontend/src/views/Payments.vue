<script setup>
import { ref, onMounted } from 'vue';
import api, { errMsg } from '../api.js';
import { eur, dateFr, METHODS } from '../utils/format.js';
import { toast } from '../utils/toast.js';

const rows = ref([]);
async function load() { rows.value = (await api.get('/payments')).data; }
onMounted(load);

async function remove(p) {
  if (!confirm(`Supprimer ce paiement de ${eur(p.amount)} ? La facture sera recalculée.`)) return;
  try { await api.delete(`/payments/${p.id}`); toast('Paiement supprimé'); await load(); }
  catch (e) { toast(errMsg(e), 'err'); }
}
</script>

<template>
  <div class="page-head">
    <h1>Paiements</h1>
    <span class="muted small">Pour enregistrer un paiement, ouvre la facture concernée.</span>
  </div>
  <div class="panel">
    <div v-if="!rows.length" class="empty"><strong>Aucun paiement enregistré</strong>Ils apparaîtront ici dès que tu en saisiras sur une facture.</div>
    <div v-else class="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Facture</th><th>Client</th><th>Mode</th><th>Référence</th><th class="num">Montant</th><th></th></tr></thead>
        <tbody>
          <tr v-for="p in rows" :key="p.id">
            <td>{{ dateFr(p.payment_date) }}</td>
            <td><router-link :to="`/invoices/${p.invoice_id}`">{{ p.invoice_number }}</router-link></td>
            <td>{{ p.client_name }}</td>
            <td>{{ METHODS[p.payment_method] }}</td>
            <td class="muted">{{ p.reference }}</td>
            <td class="num">{{ eur(p.amount) }}</td>
            <td class="actions-cell"><button class="link danger" @click="remove(p)">Supprimer</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
