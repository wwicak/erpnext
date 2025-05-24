<template>
  <div class="min-h-screen flex flex-col bg-dark-background text-light-text">
    <!-- Header -->
    <header class="bg-gray-800 shadow-md p-4">
      <div class="container mx-auto flex justify-between items-center">
        <UserInfoHeader />
        <SyncControls />
      </div>
    </header>

    <!-- Loading State / Error State -->
    <div v-if="isLoadingInitialData || isFetchingInitialData" class="flex-grow flex items-center justify-center">
      <div class="text-center">
        <svg class="animate-spin h-10 w-10 text-primary mx-auto mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p class="text-xl font-semibold text-light-text">Loading POS Data...</p>
        <p v-if="dataStore.globalLoadingMessage" class="text-sm text-gray-400">{{ dataStore.globalLoadingMessage }}</p>
      </div>
    </div>

    <div v-else-if="initialDataError" class="flex-grow flex flex-col items-center justify-center p-4">
      <div class="bg-danger-red bg-opacity-20 border border-danger-red text-danger-red p-6 rounded-lg shadow-xl max-w-md text-center">
        <h3 class="text-2xl font-bold mb-3">Error Fetching Data</h3>
        <p class="mb-4">{{ initialDataError }}</p>
        <button @click="refetchInitialData" 
                class="bg-primary hover:bg-opacity-90 text-light-text font-semibold py-2.5 px-6 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-primary transition-colors duration-150">
          Retry
        </button>
      </div>
    </div>

    <!-- Main Content Area - Shown only if data loaded successfully -->
    <main v-else class="flex-grow container mx-auto p-4 grid grid-cols-1 md:grid-cols-3 gap-6"> <!-- Increased gap -->
      <!-- Left Panel: Item Selection -->
      <div class="md:col-span-2 bg-gray-800 p-6 rounded-lg shadow-lg"> <!-- Increased padding, larger shadow -->
        <ItemSelectionPanel />
      </div>

      <!-- Right Panel: Transaction/Cart -->
      <div class="md:col-span-1 bg-gray-800 p-6 rounded-lg shadow-lg"> <!-- Increased padding, larger shadow -->
        <CartPanel />
      </div>
    </main>

    <footer class="bg-gray-900 text-center p-3 text-xs text-gray-400 border-t border-gray-700"> <!-- Adjusted footer style -->
      Point of Sale System v1.0
    </footer>
  </div>
</template>

<script setup>
import { computed, watch, onMounted, onUnmounted, ref } from 'vue'; // Added ref
import { useQuery } from '@tanstack/vue-query';
import { fetchInitialPOSData } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useSyncConfigStore } from '../store/syncConfigStore';
import { useDataStore } from '../store/dataStore';
import { useUiStore } from '../store/uiStore'; 
import { useSyncStore } from '../store/syncStore'; 
import { useBarcodeScanner } from '../composables/useBarcodeScanner'; 
import { useIdleTimer } from '../composables/useIdleTimer'; // Import Idle Timer

import UserInfoHeader from './UserInfoHeader.vue';
import SyncControls from './SyncControls.vue';
import ItemSelectionPanel from './ItemSelectionPanel.vue';
import CartPanel from './CartPanel.vue';

const authStore = useAuthStore();
const syncConfigStore = useSyncConfigStore();
const dataStore = useDataStore();
const uiStore = useUiStore(); 
const syncStore = useSyncStore(); // Initialize sync store

// Initialize barcode scanner
const { startBarcodeListener, stopBarcodeListener } = useBarcodeScanner();

// Ensure sync config is loaded if not already (e.g., on page refresh direct to POSInterface)
onMounted(() => {
  if (!syncConfigStore.erpNextUrl || !syncConfigStore.companyForSync) {
    syncConfigStore.loadSyncConfig();
  }
  // Start barcode listener when POS interface is mounted
  startBarcodeListener();
  // Load pending transactions count on mount
  syncStore.loadPendingTransactionsCount(); 
});

// Stop barcode listener when POS interface is unmounted
onUnmounted(() => {
  stopBarcodeListener();
});

const queryParams = computed(() => ({
  erpNextUrl: syncConfigStore.erpNextUrl,
  posProfileForSync: authStore.loginPOSProfileName,
  companyForSyncFallback: syncConfigStore.companyForSync,
  // csrfToken: authStore.csrfToken, // Pass if needed by your API setup
}));

const isQueryEnabled = computed(() => {
  return authStore.isLoggedIn &&
         !!queryParams.value.erpNextUrl &&
         !!queryParams.value.posProfileForSync &&
         !!queryParams.value.companyForSyncFallback;
});

const { 
  data: initialData, 
  error: initialDataErrorQuery, // Renamed to avoid conflict if error is defined elsewhere
  isFetching: isFetchingInitialData, 
  isLoading: isLoadingQuery, 
  refetch: refetchInitialData 
} = useQuery({
  queryKey: ['initialPOSData', queryParams], 
  queryFn: async () => {
    dataStore.setLoading(true); 
    uiStore.setGlobalLoadingMessage("Fetching core POS profile and company settings...");
    return fetchInitialPOSData(
      queryParams.value.erpNextUrl,
      queryParams.value.posProfileForSync,
      queryParams.value.companyForSyncFallback
    );
  },
  enabled: isQueryEnabled,
  staleTime: 30 * 60 * 1000, 
  cacheTime: 60 * 60 * 1000, 
  retry: 1, 
});

watch(initialData, (newData) => {
  if (newData) {
    dataStore.setAllInitialData(newData);
    uiStore.clearGlobalLoadingMessage();
  }
}, { immediate: false }); 

watch(initialDataErrorQuery, (newError) => {
  if (newError) {
    dataStore.setFetchError(newError.message || 'An unknown error occurred while fetching initial data.');
    uiStore.clearGlobalLoadingMessage();
  }
});

const isLoadingInitialData = computed(() => dataStore.isLoading || isLoadingQuery.value);

// Use dataStore.initialDataError for template display after processing by store
const initialDataError = computed(() => dataStore.initialDataError);

</script>

<style scoped>
/* Scoped styles for POSInterface.vue if needed */
</style>
