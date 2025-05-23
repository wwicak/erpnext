<template>
  <div v-if="uiStore.isHeldCartsModalVisible" 
       class="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-in-out"
       @click.self="closeModal">
    <div class="bg-gray-800 text-light-text p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-semibold text-secondary-accent">Held Carts</h2>
        <button @click="closeModal" class="text-gray-400 hover:text-light-text text-3xl font-light leading-none">&times;</button>
      </div>

      <div v-if="heldCartsStore.isProcessing && heldCartsStore.heldCartsList.length === 0" class="text-center py-10">
        <svg class="animate-spin h-8 w-8 text-primary mx-auto mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p class="text-lg text-gray-400">Loading held carts...</p>
      </div>

      <div v-else-if="!heldCartsStore.heldCartsList || heldCartsStore.heldCartsList.length === 0" class="text-center py-10 text-gray-500">
        <p class="text-lg">No carts are currently on hold.</p>
      </div>

      <div v-else class="held-carts-list overflow-y-auto flex-grow space-y-3 pr-2">
        <div v-for="cart in heldCartsStore.heldCartsList" :key="cart.id"
             class="p-4 bg-gray-700 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-150">
          <div class="flex justify-between items-start">
            <div class="flex-grow mr-3 overflow-hidden">
              <h3 class="font-semibold text-gray-100 text-lg truncate" :title="cart.name || `Held Cart ID: ${cart.id}`">{{ cart.name || `Held Cart ID: ${cart.id}` }}</h3>
              <p class="text-xs text-gray-400">Held on: {{ new Date(cart.created_at).toLocaleString() }}</p>
              <p class="text-sm text-gray-300 mt-1">
                Items: <span class="font-medium">{{ cart.cart_data.items ? cart.cart_data.items.length : 0 }}</span> | 
                Total: <span class="font-medium">{{ formatCurrency(cart.cart_data.grandTotal || 0) }}</span>
              </p>
            </div>
            <div class="flex space-x-2 mt-1 flex-shrink-0">
              <button 
                @click="handleResumeCart(cart.id)"
                :disabled="heldCartsStore.isProcessing"
                class="bg-secondary-accent hover:bg-opacity-90 text-dark-background font-semibold py-1.5 px-3 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-secondary-accent transition-colors duration-150 disabled:opacity-50">
                Resume
              </button>
              <button 
                @click="handleDeleteCart(cart.id)"
                :disabled="heldCartsStore.isProcessing"
                class="bg-danger-red hover:bg-red-700 text-white font-semibold py-1.5 px-3 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-danger-red transition-colors duration-150 disabled:opacity-50">
                Delete
              </button>
            </div>
          </div>
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
import { watch, onMounted } from 'vue';
import { useHeldCartsStore } from '../store/heldCartsStore';
import { useUiStore } from '../store/uiStore';
import { formatCurrency } from '../utils/formatters';

const heldCartsStore = useHeldCartsStore();
const uiStore = useUiStore();

watch(() => uiStore.isHeldCartsModalVisible, (isVisible) => {
  if (isVisible) { 
    heldCartsStore.loadHeldCartsFromDB();
  }
}, { immediate: true }); // immediate: true to load on initial mount if modal is already set to visible by chance

async function handleResumeCart(cartId) {
  if (heldCartsStore.isProcessing) return;
  await heldCartsStore.resumeCart(cartId);
  // Close modal only if resume was successful (cart no longer in list or error flag not set)
  // isProcessing should be false after resumeCart regardless of success/failure
  if (!heldCartsStore.isProcessing && !heldCartsStore.heldCartsList.find(c => c.id === cartId)) { 
    closeModal(); 
  }
}

async function handleDeleteCart(cartId) {
  if (heldCartsStore.isProcessing) return;
  // Consider adding a confirmation dialog here for better UX
  // if (confirm('Are you sure you want to delete this held cart?')) {
    await heldCartsStore.deleteCartFromHold(cartId);
  // }
}

function closeModal() {
  uiStore.hideHeldCartsModal();
}
</script>

<style scoped>
.held-carts-list::-webkit-scrollbar {
  width: 8px;
}
.held-carts-list::-webkit-scrollbar-thumb {
  background-color: #4b5563; /* gray-600 */
  border-radius: 4px;
}
.held-carts-list::-webkit-scrollbar-track {
  background-color: #374151; /* gray-700 or 800 */
}
</style>
