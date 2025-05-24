<template>
  <div class="sample-receipt p-2 text-xs font-mono bg-white text-black max-w-xs mx-auto">
    <!-- Max-width-xs and mx-auto are for screen preview, print styles will override -->
    <header class="text-center mb-2">
      <h3 class="font-bold text-sm">Your Mini Mart</h3>
      <p class="text-xs">123 Main Street, Anytown, ST 12345</p>
      <p class="text-xs">Tel: (555) 123-4567</p>
    </header>
    
    <hr class="my-1 border-t border-dashed border-black">
    
    <section class="text-xs mb-1">
      <p>Date: {{ currentDate }}</p>
      <p>Time: {{ currentTime }}</p>
      <p>Receipt #: TEST-001</p>
      <p>Cashier: Admin</p>
    </section>
    
    <hr class="my-1 border-t border-dashed border-black">
    
    <section class="my-1 item-lines">
      <div v-for="item in sampleItems" :key="item.name" class="flex justify-between">
        <div class="flex-1 break-words"> <!-- Allow item name to wrap -->
          <span>{{ item.qty }}x {{ item.name }}</span>
          <span class="block ml-2 text-gray-700 text-[10px]"> @ ${{ item.price.toFixed(2) }}</span> <!-- Price per unit if needed -->
        </div>
        <span class="ml-2">${{ (item.price * item.qty).toFixed(2) }}</span>
      </div>
    </section>
    
    <hr class="my-1 border-t border-dashed border-black">
    
    <section class="text-xs space-y-0.5 totals-section">
      <div class="flex justify-between">
        <span>Subtotal:</span>
        <span>${{ sampleSubtotal.toFixed(2) }}</span>
      </div>
      <div class="flex justify-between">
        <span>Tax (0%):</span>
        <span>$0.00</span>
      </div>
      <hr class="my-0.5 border-t border-dashed border-black">
      <div class="flex justify-between font-bold text-sm">
        <span>TOTAL:</span>
        <span>${{ sampleGrandTotal.toFixed(2) }}</span>
      </div>
    </section>
    
    <hr class="my-1 border-t border-dashed border-black">
    
    <footer class="text-center text-xs mt-1">
      <p>Thank You! Please Come Again!</p>
      <p class="mt-0.5">www.yourminimart.com</p>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatTime = (date) => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

const now = new Date();
const currentDate = ref(formatDate(now));
const currentTime = ref(formatTime(now));

const sampleItems = ref([
  { name: 'Sample Item A (Long name to test wrapping capability)', qty: 1, price: 10.50 },
  { name: 'Item B', qty: 2, price: 5.25 },
  { name: 'Another Item C', qty: 1, price: 7.00 },
]);

const sampleSubtotal = computed(() => {
  return sampleItems.value.reduce((sum, item) => sum + (item.qty * item.price), 0);
});

const sampleTaxes = ref(0.00); // Assuming 0 tax for sample

const sampleGrandTotal = computed(() => {
  return sampleSubtotal.value + sampleTaxes.value;
});
</script>

<style scoped>
/* Styles specific to SampleReceipt.vue for thermal printing */
.sample-receipt {
  /* For screen preview, constrain width. Print styles will override. */
  /* max-width: 302px; /* Approx 80mm thermal paper width at 96dpi (3.15 inches) */
  /* max-width: 270px; /* Approx 72mm thermal paper width */
  /* Use a common width that fits most receipt printers or rely on print CSS */
  box-shadow: 0 0 5px rgba(0,0,0,0.1); /* Optional shadow for screen preview */
}

/* For actual printing, these styles might be better in a global print stylesheet */
/* However, for self-contained component, basic print-friendly styles here are okay */
/* More specific print styles will be in main.css or print.css using @media print */

.item-lines div span:first-child { /* Item name and quantity */
  /* Potentially add word-break if long names are an issue, though flex-1 and break-words should handle it */
}
.item-lines div span:last-child { /* Item total price */
  white-space: nowrap; /* Prevent total price from wrapping */
}

.totals-section div span:last-child {
  white-space: nowrap;
}

/* When printing, we typically want white background and black text explicitly */
@media print {
  .sample-receipt {
    background-color: #ffffff !important;
    color: #000000 !important;
    box-shadow: none !important; /* Remove shadow for print */
    margin: 0; /* Remove margin for print */
    padding: 0; /* Minimal padding for print or controlled by @page */
    /* width: 100% !important; /* Let it fill the printable area defined by @page or printer settings */
  }
  /* Ensure all text elements inherit black color for print */
  .sample-receipt * {
    color: #000000 !important; 
  }
  /* Hide any screen-only elements if they were part of this component */
  .screen-only {
    display: none !important;
  }
}
</style>
