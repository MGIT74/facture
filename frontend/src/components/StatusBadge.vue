<script setup>
import { STATUS } from '../utils/format.js';
defineProps({ type: { type: String, default: 'invoice' }, status: String });
</script>

<template>
  <span class="badge" :class="status">{{ STATUS[type][status] || status }}</span>
</template>
