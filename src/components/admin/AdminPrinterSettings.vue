<template>
  <div class="p-6 bg-gray-700 text-light-text rounded-lg shadow-md">
    <h2 class="text-3xl font-semibold text-primary mb-8">Printer Settings & Test</h2>

    <!-- Information Section -->
    <div class="bg-gray-800 p-6 rounded-lg shadow-sm mb-8 space-y-3">
      <h3 class="text-xl font-semibold mb-3 text-secondary-accent">Setup Information & Tips</h3>
      <p class="text-sm text-gray-300">
        Receipt printing uses the browser's standard print functionality (typically <kbd class="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-300 rounded-md">Ctrl+P</kbd> or <kbd class="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-300 rounded-md">Cmd+P</kbd>).
      </p>
      <ul class="list-disc list-inside space-y-2 text-sm text-gray-300 pl-4">
        <li>Ensure your receipt printer is set as the **default printer** in your operating system, or is easily selectable in the browser's print dialog.</li>
        <li>For optimal receipt format, adjust printer settings (e.g., paper size like '72mm width roll' or '80mm width roll', margins set to 'None' or minimal, scale to 100%) in your OS printer preferences AND/OR within the browser's print preview screen.</li>
        <li>Common issues like incorrect paper size, excessive margins, or cutoff text are usually resolved in these system/browser print settings.</li>
        <li>Disabling "Headers and Footers" in the browser's print settings is also recommended for a cleaner receipt.</li>
      </ul>
    </div>

    <!-- Test Print Section -->
    <div class="bg-gray-800 p-6 rounded-lg shadow-sm">
      <h3 class="text-xl font-semibold mb-4 text-secondary-accent">Test Your Printer</h3>
      <p class="text-sm text-gray-400 mb-4">
        Click the button below to print a sample receipt. This will open your browser's print dialog.
        Use the print preview to verify your printer settings.
      </p>
      <button 
        @click="triggerPrint"
        class="bg-action-pink hover:bg-opacity-90 text-light-text font-semibold py-2.5 px-6 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-action-pink transition-colors duration-150"
      >
        Test Print Sample Receipt
      </button>
    </div>

    <!-- Hidden div for the actual receipt to be printed -->
    <!-- This will be styled by print-specific CSS to be the only visible thing when printing -->
    <div class="printable-receipt-area hidden"> 
      <SampleReceipt ref="sampleReceiptToPrint" />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import SampleReceipt from '../receipts/SampleReceipt.vue'; // Corrected path

const sampleReceiptToPrint = ref(null); // Ref to the component if needed, though not strictly for window.print()

function triggerPrint() {
  // The @media print CSS in main.css (or a dedicated print.css)
  // will handle making only the .printable-receipt-area visible.
  window.print();
}
</script>

<style scoped>
/* Screen-only styles for AdminPrinterSettings.vue */
kbd { /* Basic styling for keyboard keys */
  font-family: monospace;
}

/* Print-specific styles are handled globally in main.css or a print.css file */
/* The .printable-receipt-area will be shown, and other elements hidden via @media print */
</style>
