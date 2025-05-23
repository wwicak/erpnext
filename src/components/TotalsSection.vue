<template>
  <div class="totals-section py-4 border-t border-b border-gray-600 my-4">
    <h4 class="text-lg font-semibold mb-3 text-light-text">Order Summary</h4>
    <div class="space-y-2">
      <div class="flex justify-between text-md">
        <span class="text-gray-300">Subtotal:</span>
        <span class="font-semibold text-light-text">{{ formatCurrency(cartStore.subtotal) }}</span>
      </div>
      <div class="flex justify-between text-md">
        <span class="text-gray-300">Taxes:</span>
        <span class="font-semibold text-light-text">{{ formatCurrency(cartStore.taxes) }}</span>
      </div>
      <div class="flex justify-between text-xl font-bold mt-2"> <!-- Changed mt-1 to mt-2 -->
        <span class="text-light-text">Grand Total:</span>
        <span class="text-primary">{{ formatCurrency(cartStore.grandTotal) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useCartStore } from '../store/cartStore'; // Corrected path
import { formatCurrency } from '../utils/formatters'; // Corrected path

const cartStore = useCartStore();
</script>

<style scoped>
/* Scoped styles for TotalsSection.vue if needed */
</style>
