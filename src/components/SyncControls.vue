<template>
  <div class="sync-controls bg-gray-700 p-4 rounded-lg shadow-md text-light-text">
    <h3 class="text-lg font-semibold mb-3 text-secondary-accent">Sync Configuration & Status</h3>
    
    <!-- Configuration Inputs -->
    <div class="space-y-3 mb-4">
      <div>
        <label for="erpnext_url_sync" class="block text-sm font-medium text-gray-300">ERPNext URL</label>
        <input type="text" id="erpnext_url_sync" v-model="erpNextUrlInput"
               class="w-full p-2.5 mt-1 rounded-md bg-gray-100 text-gray-900 text-sm focus:ring-2 focus:ring-inset focus:ring-primary border border-gray-300 focus:border-primary"
               placeholder="https://your-erpnext-site.com">
      </div>
      <div>
        <label for="pos_profile_name_sync" class="block text-sm font-medium text-gray-300">POS Profile (for initial data)</label>
        <input type="text" id="pos_profile_name_sync" v-model="posProfileForSyncInput"
               class="w-full p-2.5 mt-1 rounded-md bg-gray-100 text-gray-900 text-sm focus:ring-2 focus:ring-inset focus:ring-primary border border-gray-300 focus:border-primary"
               placeholder="Main Retail Profile">
      </div>
      <div>
        <label for="company_name_sync" class="block text-sm font-medium text-gray-300">Company (for initial data)</label>
        <input type="text" id="company_name_sync" v-model="companyForSyncInput"
               class="w-full p-2.5 mt-1 rounded-md bg-gray-100 text-gray-900 text-sm focus:ring-2 focus:ring-inset focus:ring-primary border border-gray-300 focus:border-primary"
               placeholder="Your Company Ltd.">
      </div>
      <button @click="handleSaveConfig" class="w-full bg-action-pink hover:bg-opacity-90 text-light-text font-semibold py-2.5 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-700 focus:ring-action-pink transition-colors duration-150">
        Save Configuration
      </button>
      <div v-if="syncConfigStore.syncStatusMessage" class="text-xs mt-2 p-2 rounded-md" 
           :class="syncConfigStore.syncStatusMessage.includes('Error') || syncConfigStore.syncStatusMessage.includes('Failed') ? 'text-danger-red bg-red-500 bg-opacity-10 border border-danger-red' : 'text-green-300 bg-green-500 bg-opacity-10 border border-green-500'">
        {{ syncConfigStore.syncStatusMessage }}
      </div>
    </div>

    <hr class="border-gray-600 my-4">

    <!-- Sync Actions & Status -->
    <div>
      <h4 class="text-md font-semibold mb-2 text-gray-200">Offline Sales Sync</h4>
      <button @click="handleSyncOfflineSales" 
              :disabled="syncStore.isSyncing"
              class="w-full bg-primary hover:bg-opacity-90 text-light-text font-semibold py-2.5 px-4 rounded-md text-sm mb-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-700 focus:ring-primary">
        <span v-if="syncStore.isSyncing">Syncing... ({{ syncStore.pendingTransactionsCount }} left)</span>
        <span v-else>Sync Offline Sales ({{ syncStore.pendingTransactionsCount }} pending)</span>
      </button>
      
      <div class="text-xs space-y-1 mt-3">
        <p v-if="syncStore.lastSyncTime" class="text-gray-400">
          Last Sync: {{ new Date(syncStore.lastSyncTime).toLocaleString() }}
        </p>
        <p v-if="syncStore.syncSuccessMessage" class="text-green-300 p-2 bg-green-500 bg-opacity-10 border border-green-500 rounded-md">
          {{ syncStore.syncSuccessMessage }}
        </p>
        <p v-if="syncStore.syncError" class="text-danger-red p-2 bg-red-500 bg-opacity-10 border border-danger-red rounded-md">
          Error: {{ syncStore.syncError }}
        </p>
      </div>
    </div>
    <!-- "Re-Sync All Master Data" button removed as per earlier decision to simplify -->
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useSyncConfigStore } from '../store/syncConfigStore';
import { useSyncStore } from '../store/syncStore';

const syncConfigStore = useSyncConfigStore();
const syncStore = useSyncStore();

const erpNextUrlInput = ref('');
const posProfileForSyncInput = ref('');
const companyForSyncInput = ref('');

onMounted(() => {
  syncConfigStore.loadSyncConfig(); 
  erpNextUrlInput.value = syncConfigStore.erpNextUrl || '';
  posProfileForSyncInput.value = syncConfigStore.posProfileForSync || '';
  companyForSyncInput.value = syncConfigStore.companyForSync || '';
});

watch(() => syncConfigStore.erpNextUrl, (newVal) => erpNextUrlInput.value = newVal || '');
watch(() => syncConfigStore.posProfileForSync, (newVal) => posProfileForSyncInput.value = newVal || '');
watch(() => syncConfigStore.companyForSync, (newVal) => companyForSyncInput.value = newVal || '');

function handleSaveConfig() {
  if (!erpNextUrlInput.value) {
      syncConfigStore.setSyncStatusMessage("Error: ERPNext URL is required.");
      return;
  }
  syncConfigStore.setSyncConfig(
    erpNextUrlInput.value, 
    posProfileForSyncInput.value, 
    companyForSyncInput.value
  );
}

async function handleSyncOfflineSales() {
  syncStore.syncError = null; 
  syncStore.syncSuccessMessage = null;
  await syncStore.syncOfflineTransactions();
}
</script>

<style scoped>
/* Scoped styles for SyncControls.vue if needed */
</style>
