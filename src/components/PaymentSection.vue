<template>
  <section class="payment-section mt-4 py-4 border-t border-gray-600">
    <h3 class="text-lg font-semibold mb-3 text-light-text">Payment</h3>
    <div class="flex gap-3 mb-3 items-end">
      <div class="flex-auto w-2/5">
        <label for="paymentMode" class="block text-xs font-medium text-gray-300 mb-1">Payment Mode:</label>
        <select 
          id="paymentMode" 
          v-model="selectedPaymentMode"
          class="w-full p-2.5 rounded-md bg-gray-100 text-gray-900 text-sm focus:ring-2 focus:ring-inset focus:ring-primary border border-gray-300 focus:border-primary"
        >
          <option disabled value="">Select mode</option>
          <option v-for="mode in dataStore.paymentModes" :key="mode.mode_of_payment || mode" :value="mode.mode_of_payment || mode">
            {{ mode.mode_of_payment || mode }}
          </option>
        </select>
      </div>
      <div class="flex-auto w-2/5">
        <label for="paymentAmount" class="block text-xs font-medium text-gray-300 mb-1">Amount:</label>
        <input 
          type="number" 
          id="paymentAmount" 
          v-model.number="paymentAmountInput" 
          placeholder="0.00"
          @keyup.enter="handleAddPayment"
          class="w-full p-2.5 rounded-md bg-gray-100 text-gray-900 text-sm focus:ring-2 focus:ring-inset focus:ring-primary border border-gray-300 focus:border-primary"
          step="0.01"
        >
      </div>
      <button 
        @click="handleAddPayment"
        class="bg-primary hover:bg-opacity-90 text-light-text font-semibold py-2.5 px-4 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-700 focus:ring-primary transition-colors duration-150 h-[calc(theme(spacing[10])+2px)] flex-none" 
        style="height: calc(2.5rem + 2px);" /* Explicit height for p-2.5 + 1px border * 2 */
      >
        Add Payment
      </button>
    </div>

    <div v-if="cartStore.appliedPayments.length > 0" class="mb-3 applied-payments-list bg-gray-600 p-3 rounded-lg shadow-sm"> <!-- Increased padding and rounded -->
      <h4 class="text-sm font-semibold text-gray-200 mb-2">Applied Payments:</h4> <!-- Adjusted text color -->
      <ul class="space-y-1.5 text-xs"> <!-- Increased spacing -->
        <li v-for="(payment, index) in cartStore.appliedPayments" :key="index" 
            class="text-gray-100 flex justify-between items-center p-1.5 bg-gray-500 rounded-md"> <!-- Adjusted text color, padding, rounded -->
          <span>{{ payment.mode_of_payment }}: {{ formatCurrency(payment.amount) }}</span>
          <!-- Optional: Remove payment button -->
          <!-- <button @click="removeAppliedPayment(index)" class="text-danger-red text-xs hover:underline">Remove</button> -->
        </li>
      </ul>
    </div>

    <div class="totals-summary text-right space-y-1 text-sm">
      <p class="text-gray-200">Total Paid: <span class="font-semibold text-md">{{ formatCurrency(cartStore.totalPaid) }}</span></p>
      <p v-if="cartStore.outstandingAmount > 0" class="text-warning-orange">
        Balance Due: <span class="font-semibold text-md">{{ formatCurrency(cartStore.outstandingAmount) }}</span>
      </p>
      <p v-if="cartStore.changeToGive > 0" class="text-secondary-accent">
        Change: <span class="font-semibold text-md">{{ formatCurrency(cartStore.changeToGive) }}</span>
      </p>
    </div>
  </section>
</template>

<script setup>
import { ref, watch, onMounted, nextTick } from 'vue';
import { useDataStore } from '../store/dataStore'; // Corrected path
import { useCartStore } from '../store/cartStore'; // Corrected path
import { formatCurrency } from '../utils/formatters'; // Corrected path

const dataStore = useDataStore();
const cartStore = useCartStore();

const selectedPaymentMode = ref('');
const paymentAmountInput = ref(null); // Using null for number input to allow placeholder

function initializePaymentMode() {
  if (dataStore.paymentModes && dataStore.paymentModes.length > 0) {
    const defaultMode = dataStore.paymentModes[0];
    selectedPaymentMode.value = defaultMode.mode_of_payment || defaultMode; // Handles if modes are strings or objects
  } else {
    selectedPaymentMode.value = '';
  }
}

onMounted(() => {
  initializePaymentMode();
  // Pre-fill payment amount with outstanding amount if cart is not empty
  if (!cartStore.isCartEmpty && cartStore.outstandingAmount > 0) {
    paymentAmountInput.value = parseFloat(cartStore.outstandingAmount.toFixed(2));
  }
});

watch(() => dataStore.paymentModes, (newModes) => {
  if (newModes && newModes.length > 0) {
    const currentSelectionIsValid = newModes.some(mode => (mode.mode_of_payment || mode) === selectedPaymentMode.value);
    if (!currentSelectionIsValid || !selectedPaymentMode.value) {
      selectedPaymentMode.value = newModes[0].mode_of_payment || newModes[0];
    }
  } else {
    selectedPaymentMode.value = '';
  }
}, { deep: true }); // deep might be needed if paymentModes is an array of objects and objects change

watch(() => cartStore.outstandingAmount, (newOutstanding) => {
    // Automatically update paymentAmountInput to the new outstanding amount
    // if it's positive, otherwise clear or set to null.
    if (newOutstanding > 0) {
        paymentAmountInput.value = parseFloat(newOutstanding.toFixed(2));
    } else if (paymentAmountInput.value !== null && paymentAmountInput.value > 0 && cartStore.changeToGive > 0) {
        // If there's change to give, it means payment exceeded grand total.
        // We might want to clear the input or leave it as is, depending on desired UX.
        // For now, let's clear it if a payment just resulted in change.
        // This specific logic might need refinement based on full UX flow.
         paymentAmountInput.value = null;
    }
     // If outstanding is 0 and no change, it implies exact payment, so clear.
    else if (newOutstanding === 0 && cartStore.changeToGive === 0) {
        paymentAmountInput.value = null;
    }
}, { immediate: true }); // immediate to set on component load if cart has items


function handleAddPayment() {
  if (!selectedPaymentMode.value) {
    // TODO: Replace alert with a more integrated UI notification
    alert('Please select a payment mode.');
    return;
  }
  const amount = parseFloat(paymentAmountInput.value);
  if (isNaN(amount) || amount <= 0) {
    // TODO: Replace alert with a more integrated UI notification
    alert('Please enter a valid payment amount.');
    return;
  }
  
  cartStore.addPayment({ 
    mode_of_payment: selectedPaymentMode.value, 
    amount: amount 
  });
  
  // After adding payment, Vue reactivity will update cartStore.outstandingAmount.
  // The watcher on cartStore.outstandingAmount will then update paymentAmountInput.
  // So, no need to manually set paymentAmountInput.value here to outstandingAmount.
  // If outstandingAmount becomes 0 or less (i.e. change is due), the watcher sets it to null.
  // If it's still positive, watcher sets it to new outstanding.
  // This ensures input field is ready for next payment or shows null if fully paid/overpaid.
}
</script>
