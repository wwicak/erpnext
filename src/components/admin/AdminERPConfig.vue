<template>
  <div class="p-6 bg-gray-700 text-light-text rounded-lg shadow-md">
    <h2 class="text-3xl font-semibold text-primary mb-8">ERPNext Configuration</h2>

    <div class="max-w-xl space-y-6">
      <!-- ERPNext URL Input -->
      <div>
        <label for="erpNextUrl" class="block text-sm font-medium text-gray-300 mb-1">ERPNext URL</label>
        <input 
          type="url" 
          id="erpNextUrl" 
          v-model="editableErpNextUrl"
          placeholder="https://your-erpnext-instance.com"
          class="w-full p-2.5 rounded-md bg-gray-100 text-gray-900 text-sm focus:ring-2 focus:ring-inset focus:ring-primary border border-gray-300 focus:border-primary"
        >
      </div>

      <!-- Save and Test Button -->
      <div>
        <button 
          @click="handleSaveAndTestConnection"
          :disabled="isTestingConnection"
          class="w-full sm:w-auto bg-action-pink hover:bg-opacity-90 text-light-text font-semibold py-2.5 px-6 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-700 focus:ring-action-pink transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="isTestingConnection">Saving & Testing...</span>
          <span v-else>Save & Test Connection</span>
        </button>
      </div>

      <!-- Connection Test Results -->
      <div v-if="testStatusMessage" 
           class="p-3 rounded-md text-sm"
           :class="{
             'bg-green-500 bg-opacity-10 border border-green-500 text-green-300': testStatusMessage.startsWith('Successfully'),
             'bg-red-500 bg-opacity-10 border border-danger-red text-danger-red': testStatusMessage.startsWith('Failed')
           }"
      >
        <p v-html="testStatusMessage.replace(/\n/g, '<br>')"></p>
      </div>
      
      <hr class="border-gray-600 my-8">

      <!-- Read-only POS Sync Config -->
      <div>
        <h3 class="text-xl font-semibold text-gray-200 mb-3">Current POS Sync Details</h3>
        <div class="space-y-2 text-sm">
          <p><strong class="text-gray-400">POS Profile for Sync:</strong> 
            <span class="text-gray-100 ml-2">{{ syncConfigStore.posProfileForSync || 'Not Set' }}</span>
          </p>
          <p><strong class="text-gray-400">Company for Sync:</strong> 
            <span class="text-gray-100 ml-2">{{ syncConfigStore.companyForSync || 'Not Set' }}</span>
          </p>
          <p class="text-xs text-gray-500 mt-2">
            These values are typically configured by the POS clerk during their initial setup or data sync from the POS interface's Sync Controls.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useSyncConfigStore } from '../../store/syncConfigStore'; // Adjusted path
import * as api from '../../services/api'; // Adjusted path

const syncConfigStore = useSyncConfigStore();

const editableErpNextUrl = ref('');
const testStatusMessage = ref('');
const isTestingConnection = ref(false);

onMounted(() => {
  // Initialize editableErpNextUrl from store when component mounts
  syncConfigStore.loadSyncConfig(); // Ensure latest from localStorage is loaded
  editableErpNextUrl.value = syncConfigStore.erpNextUrl || '';
});

// Watch for changes in store's erpNextUrl (e.g., if updated elsewhere or by initial load)
watch(() => syncConfigStore.erpNextUrl, (newUrl) => {
  editableErpNextUrl.value = newUrl || '';
});

async function handleSaveAndTestConnection() {
  isTestingConnection.value = true;
  testStatusMessage.value = '';

  if (!editableErpNextUrl.value) {
    testStatusMessage.value = 'Failed: ERPNext URL cannot be empty.';
    isTestingConnection.value = false;
    return;
  }
  
  // Save the URL first (this updates localStorage via store action)
  // Keep existing profile and company names from the store
  syncConfigStore.setSyncConfig(
    editableErpNextUrl.value, 
    syncConfigStore.posProfileForSync, 
    syncConfigStore.companyForSync
  );
  // The store message from setSyncConfig might appear briefly, then overwritten by test status.
  // Consider a small delay or a more integrated message system if this is an issue.
  
  try {
    const result = await api.testERPNextConnection(editableErpNextUrl.value);
    if (result.success) {
      testStatusMessage.value = `Successfully connected to ERPNext.\nVersion: ${result.version || 'Unknown'}`;
    } else {
      testStatusMessage.value = `Failed to connect: ${result.message || 'Unknown error'}`;
    }
  } catch (error) {
    testStatusMessage.value = `Failed to connect: ${error.message || 'Network error or server unreachable'}`;
  } finally {
    isTestingConnection.value = false;
  }
}
</script>

<style scoped>
/* Styles specific to AdminERPConfig if needed */
</style>
