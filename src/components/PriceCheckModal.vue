<template>
  <div v-if="uiStore.isPriceCheckModalVisible" 
       class="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-in-out"
       @click.self="closeModal">
    <div class="bg-gray-800 text-light-text p-6 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-semibold text-primary">Price Check</h2>
        <button @click="closeModal" class="text-gray-400 hover:text-light-text text-3xl font-light leading-none">&times;</button>
      </div>

      <div class="mb-4">
        <label for="priceLookupInput" class="block text-sm font-medium text-gray-300 mb-1">Enter Item Code, Name, or Scan Barcode:</label>
        <div class="flex space-x-2">
          <input 
            type="text" 
            id="priceLookupInput"
            ref="lookupInputRef" 
            v-model="lookupValue" 
            @keyup.enter="handleLookup"
            placeholder="e.g., ITEM001 or 'Sample Item'"
            class="flex-grow p-2.5 rounded-md bg-gray-100 text-gray-900 text-sm focus:ring-2 focus:ring-inset focus:ring-primary border border-gray-300 focus:border-primary"
          >
          <button 
            @click="handleLookup" 
            :disabled="isLoading"
            class="bg-secondary-accent hover:bg-opacity-90 text-dark-background font-semibold py-2.5 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-secondary-accent transition-colors duration-150 disabled:opacity-50"
          >
            <span v-if="isLoading">Loading...</span>
            <span v-else>Lookup</span>
          </button>
        </div>
      </div>

      <div class="results-area min-h-[150px] bg-gray-700 p-4 rounded-lg shadow-inner overflow-y-auto">
        <div v-if="isLoading" class="text-center text-gray-400 py-5">
          <svg class="animate-spin h-6 w-6 text-primary mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p>Looking up item...</p>
        </div>
        <div v-else-if="errorMessage" class="text-center text-danger-red bg-red-500 bg-opacity-10 border border-danger-red p-3 rounded-md">
          {{ errorMessage }}
        </div>
        <div v-else-if="searchResult" class="space-y-2">
          <h3 class="text-xl font-semibold text-primary">{{ searchResult.name }}</h3>
          <p><strong class="text-gray-300">Code:</strong> <span class="text-gray-100">{{ searchResult.code }}</span></p>
          <p><strong class="text-gray-300">Price:</strong> <span class="text-2xl font-bold text-secondary-accent">{{ searchResult.price }}</span></p>
          <p><strong class="text-gray-300">UOM:</strong> <span class="text-gray-100">{{ searchResult.uom || 'N/A' }}</span></p>
          <p><strong class="text-gray-300">Barcode:</strong> <span class="text-gray-100">{{ searchResult.barcode || 'N/A' }}</span></p>
        </div>
        <div v-else class="text-center text-gray-500 italic py-5">
          Enter a search term and click "Lookup" to see item price.
        </div>
      </div>

      <div class="mt-6 pt-4 text-right border-t border-gray-700">
        <button @click="closeModal"
                class="bg-gray-600 hover:bg-gray-500 text-light-text font-semibold py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-500 transition-colors duration-150">
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';
import { useUiStore } from '../store/uiStore';
import { useDataStore } from '../store/dataStore';
import { formatCurrency } from '../utils/formatters';

const uiStore = useUiStore();
const dataStore = useDataStore();

const lookupValue = ref('');
const searchResult = ref(null);
const errorMessage = ref('');
const isLoading = ref(false);
const lookupInputRef = ref(null); 

watch(() => uiStore.isPriceCheckModalVisible, (isVisible) => {
  if (isVisible) {
    nextTick(() => {
        lookupInputRef.value?.focus();
    });
  } else {
    lookupValue.value = '';
    searchResult.value = null;
    errorMessage.value = '';
    isLoading.value = false;
  }
});

async function handleLookup() {
  isLoading.value = true;
  searchResult.value = null;
  errorMessage.value = '';
  const searchTerm = lookupValue.value.trim();

  if (!searchTerm) {
    errorMessage.value = 'Please enter an item code, name, or barcode to lookup.';
    isLoading.value = false;
    return;
  }
  
  // Simulate a brief delay for better UX if search is too fast
  // await new Promise(resolve => setTimeout(resolve, 200)); 

  let itemFound = null;
  if (dataStore.items && dataStore.items.length > 0) {
      itemFound = dataStore.items.find(i => 
        (i.barcode === searchTerm || (i.barcodes && i.barcodes.some(b => b && b.barcode === searchTerm))) ||
        i.item_code === searchTerm ||
        i.item_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }

  if (itemFound) {
    const displayPrice = itemFound.rate !== undefined ? itemFound.rate : itemFound.standard_rate; 
    searchResult.value = { 
      name: itemFound.item_name,
      code: itemFound.item_code,
      price: formatCurrency(displayPrice), 
      uom: itemFound.stock_uom,
      barcode: itemFound.barcode || (itemFound.barcodes && itemFound.barcodes.length > 0 ? itemFound.barcodes[0].barcode : 'N/A') 
    };
  } else {
    errorMessage.value = `Item not found for: "${searchTerm}"`;
  }
  isLoading.value = false;
}

function closeModal() {
  uiStore.hidePriceCheckModal();
}
</script>

<style scoped>
.results-area::-webkit-scrollbar {
  width: 8px;
}
.results-area::-webkit-scrollbar-thumb {
  background-color: #4b5563; /* gray-600 */
  border-radius: 4px;
}
.results-area::-webkit-scrollbar-track {
  background-color: #374151; /* gray-800 */
}
</style>
