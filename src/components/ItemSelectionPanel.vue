<template>
  <section class="item-selection-panel p-4 bg-gray-700 text-light-text rounded-lg shadow-lg h-full flex flex-col">
    <h2 class="text-2xl font-semibold mb-4 text-secondary-accent">Items</h2>
    <div class="mb-4 flex">
      <input 
        type="text" 
        v-model="searchTerm" 
        id="itemSearch"
        placeholder="Search items (name, code, barcode)..." 
        class="p-2.5 rounded-l-md flex-grow bg-gray-100 text-gray-900 text-sm focus:ring-2 focus:ring-inset focus:ring-primary border border-gray-300 focus:border-primary"
      >
      <button 
        @click="openPriceCheckModal" 
        id="priceCheckBtn"
        class="bg-action-pink hover:bg-opacity-90 text-light-text font-semibold py-2.5 px-3 rounded-r-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-700 focus:ring-action-pink transition-colors duration-150"
      >
        Price Check
      </button>
    </div>
    <div class="item-list overflow-y-auto flex-grow pr-1"> <!-- Added pr-1 for scrollbar spacing -->
      <div v-if="isLoadingItems" class="text-center p-4 text-gray-400">Loading items...</div>
      <div v-else-if="filteredItems.length === 0 && !isLoadingItems" class="text-center p-4 text-gray-400">
        No items found matching your search.
      </div>
      
      <div 
        v-for="item in filteredItems" 
        :key="item.item_code" 
        class="p-3 mb-2 bg-gray-600 rounded-lg shadow-md flex justify-between items-center hover:bg-gray-500 transition-colors duration-150"
      >
        <div class="flex-grow mr-3 overflow-hidden"> <!-- Added overflow-hidden for better truncation -->
          <h3 class="font-semibold text-md text-light-text truncate" :title="item.item_name">{{ item.item_name }}</h3>
          <p class="text-xs text-gray-300">Code: {{ item.item_code }}</p>
          <p class="text-sm text-gray-200">Price: <span class="font-bold">{{ formatCurrency(item.rate) }}</span></p> 
          <p v-if="item.stock_uom" class="text-xs text-gray-400">UOM: {{ item.stock_uom }}</p>
          <!-- Display barcodes if available -->
          <div v-if="item.barcodes && item.barcodes.length > 0" class="mt-1">
            <span v-for="bc in item.barcodes" :key="bc.barcode" class="text-xs text-gray-400 mr-2 bg-gray-500 px-1.5 py-0.5 rounded-sm">
              {{ bc.barcode }}
            </span>
          </div>
        </div>
        <button 
          @click="handleAddItemToCart(item)"
          class="bg-primary hover:bg-opacity-90 text-light-text font-semibold py-1.5 px-3 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-600 focus:ring-primary transition-colors duration-150 whitespace-nowrap flex-shrink-0"
        >
          Add to Cart
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useDataStore } from '../store/dataStore'; // Corrected path
import { useCartStore } from '../store/cartStore'; // Corrected path
import { useUiStore } from '../store/uiStore';   // Corrected path

const dataStore = useDataStore();
const cartStore = useCartStore();
const uiStore = useUiStore();

const searchTerm = ref('');

const filteredItems = computed(() => {
  if (!dataStore.items) return [];
  const lowerSearchTerm = searchTerm.value.toLowerCase().trim();
  if (!lowerSearchTerm) return dataStore.items;

  return dataStore.items.filter(item => {
    const nameMatch = item.item_name?.toLowerCase().includes(lowerSearchTerm);
    const codeMatch = item.item_code?.toLowerCase().includes(lowerSearchTerm);
    // Assuming item.barcodes is an array of objects like { barcode: 'value', barcode_type: 'type' }
    const barcodesArrayMatch = item.barcodes?.some(b => b.barcode?.toLowerCase().includes(lowerSearchTerm));
    return nameMatch || codeMatch || barcodesArrayMatch;
  });
});

const isLoadingItems = computed(() => dataStore.isLoading);

function handleAddItemToCart(item) {
  // The 'rate' on the item should already be the correct selling price from fetchInitialPOSData
  const itemToAdd = {
    ...item, 
    rate: parseFloat(item.rate || 0), 
  };
  cartStore.addItemToCart(itemToAdd, 1);
}

function openPriceCheckModal() {
  uiStore.showPriceCheckModal();
}

// Helper to format currency, can be moved to a utils file later
function formatCurrency(value) {
  const numericValue = Number(value);
  if (isNaN(numericValue)) return 'N/A';
  // This can be enhanced with currency symbol from store if needed
  return `$${numericValue.toFixed(2)}`; 
}
</script>

<style scoped>
/* Tailwind covers most, but custom scrollbar might be nice */
.item-list::-webkit-scrollbar {
  width: 8px;
}
.item-list::-webkit-scrollbar-thumb {
  background-color: #4b5563; /* gray-600 */
  border-radius: 4px;
}
.item-list::-webkit-scrollbar-track {
  background-color: #374151; /* gray-700 or 800 */
}
</style>
