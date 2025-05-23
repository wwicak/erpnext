<template>
  <div class="cart-panel p-4 bg-gray-700 text-light-text rounded-lg shadow-lg h-full flex flex-col">
    <h3 class="text-2xl font-semibold mb-4 text-secondary-accent">Cart</h3>

    <div class="cart-actions mb-4 flex space-x-2">
      <button 
        @click="handleHoldCart"
        :disabled="cartStore.isCartEmpty || cartStore.isCompletingSale || heldCartsStore.isProcessing"
        class="flex-1 bg-action-pink hover:bg-opacity-90 text-light-text font-semibold py-2 px-3 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-700 focus:ring-action-pink transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed">
        Hold Cart
      </button>
      <button 
        @click="openHeldCartsModal"
        :disabled="cartStore.isCompletingSale || heldCartsStore.isProcessing"
        class="flex-1 bg-action-pink hover:bg-opacity-90 text-light-text font-semibold py-2 px-3 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-700 focus:ring-action-pink transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed">
        View/Resume Carts
      </button>
    </div>

    <div class="active-customer mb-4 p-3 bg-gray-600 rounded-md shadow-sm">
      <p class="text-sm text-gray-200">Customer: <span class="font-semibold text-gray-50">{{ cartStore.selectedCustomer.customer_name || 'Walk-in Customer' }}</span></p>
      <!-- TODO: Add button/modal to select customer -->
    </div>
    
    <div class="cart-items-list overflow-y-auto flex-grow mb-4 p-2 bg-gray-800 rounded-md min-h-[200px]">
      <div v-if="cartStore.isCartEmpty" class="text-center text-gray-400 py-10 italic">Cart is empty. Add items to begin.</div>
      <div 
        v-for="item in cartStore.cartItems" 
        :key="item.item_code" 
        class="p-3 mb-2 bg-gray-700 rounded-lg shadow-md flex items-center hover:bg-gray-600 transition-colors duration-150"
      >
        <div class="flex-grow pr-2 overflow-hidden"> <!-- Added overflow-hidden -->
          <h4 class="font-semibold text-md text-light-text truncate" :title="item.item_name">{{ item.item_name }}</h4>
          <p class="text-xs text-gray-300">Rate: {{ formatCurrency(item.rate) }}</p>
        </div>
        <div class="flex items-center mx-2 flex-shrink-0">
          <button @click="decrementQuantity(item)" class="bg-gray-500 hover:bg-gray-400 text-light-text font-semibold py-1 px-2.5 rounded-l-md text-sm focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-offset-gray-700 focus:ring-primary transition-colors duration-150">-</button>
          <input 
            type="number" 
            min="1"
            :value="item.qty"
            @change="updateQuantity(item, $event.target.value)"
            @blur="handleQuantityBlur(item, $event.target.value)"
            class="w-12 text-center bg-gray-100 text-gray-900 p-1.5 text-sm border-y border-gray-300 focus:ring-1 focus:ring-inset focus:ring-primary focus:border-primary"
          >
          <button @click="incrementQuantity(item)" class="bg-gray-500 hover:bg-gray-400 text-light-text font-semibold py-1 px-2.5 rounded-r-md text-sm focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-offset-gray-700 focus:ring-primary transition-colors duration-150">+</button>
        </div>
        <p class="w-20 text-right font-semibold text-light-text text-sm flex-shrink-0">{{ formatCurrency(item.amount) }}</p>
        <button 
          @click="cartStore.removeItemFromCart(item.item_code)"
          class="ml-2 bg-danger-red hover:bg-red-700 text-white font-semibold p-1.5 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-700 focus:ring-danger-red transition-colors duration-150 w-auto px-2.5 flex-shrink-0"
          aria-label="Remove item"
        >
          Remove <!-- Text instead of icon for clarity, or use an SVG icon -->
        </button>
      </div>
    </div>

    <TotalsSection />
    <PaymentSection />

    <div class="main-actions mt-auto pt-4 border-t border-gray-600">
      <button 
        @click="handleCompleteSale"
        :disabled="cartStore.isCompletingSale || cartStore.isCartEmpty"
        class="w-full bg-primary hover:bg-opacity-90 text-light-text font-semibold py-3 px-4 rounded-md text-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-700 focus:ring-primary transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span v-if="cartStore.isCompletingSale">Processing...</span>
        <span v-else>Complete Sale</span>
      </button>
      <button 
        @click="cartStore.clearCart()"
        :disabled="cartStore.isCompletingSale"
        class="w-full bg-warning-orange hover:bg-orange-500 text-white font-semibold py-2.5 px-4 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-700 focus:ring-warning-orange transition-colors duration-150 disabled:opacity-70 mt-2">
        Clear Cart
      </button>
    </div>
  </div>
</template>

<script setup>
import TotalsSection from './TotalsSection.vue';
import PaymentSection from './PaymentSection.vue';
import { useCartStore } from '../store/cartStore'; // Corrected path
import { useUiStore } from '../store/uiStore';   // Corrected path
import { formatCurrency } from '../utils/formatters'; // Corrected path

const cartStore = useCartStore();
const uiStore = useUiStore();

function updateQuantity(item, newQty) {
  let quantity = parseInt(newQty, 10);
  if (isNaN(quantity) || quantity < 1) {
    quantity = item.qty; 
  }
  cartStore.updateCartItemQuantity(item.item_code, quantity);
}

function handleQuantityBlur(item, currentValue) {
    const quantity = parseInt(currentValue, 10);
    if (isNaN(quantity) || quantity < 1) {
         cartStore.updateCartItemQuantity(item.item_code, item.qty); 
    }
}

function incrementQuantity(item) {
  cartStore.updateCartItemQuantity(item.item_code, item.qty + 1);
}

function decrementQuantity(item) {
  cartStore.updateCartItemQuantity(item.item_code, item.qty - 1);
}

function openHeldCartsModal() {
  uiStore.showHeldCartsModal();
}

async function handleCompleteSale() {
  // The cartStore.completeSale action already contains all logic including alerts.
  // This component just needs to call it and react to isCompletingSale for UI state.
  await cartStore.completeSale();
  // Any further UI specific feedback after completion (beyond alerts from store) could go here.
}
</script>

<style scoped>
/* Custom scrollbar for cart items */
.cart-items-list::-webkit-scrollbar {
  width: 8px;
}
.cart-items-list::-webkit-scrollbar-thumb {
  background-color: #4b5563; /* gray-600 */
  border-radius: 4px;
}
.cart-items-list::-webkit-scrollbar-track {
  background-color: #1f2937; /* gray-800 */
}

/* Improve number input appearance slightly for dark theme */
input[type="number"] {
  -moz-appearance: textfield; /* Firefox */
}
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>
