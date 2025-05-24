<template>
  <div class="p-6 bg-gray-700 text-light-text rounded-lg shadow-md">
    <h2 class="text-3xl font-semibold text-primary mb-8">Barcode Scanner Settings & Test</h2>

    <!-- Information Section -->
    <div class="bg-gray-800 p-6 rounded-lg shadow-sm mb-8">
      <h3 class="text-xl font-semibold mb-3 text-secondary-accent">Setup Information</h3>
      <ul class="list-disc list-inside space-y-2 text-sm text-gray-300">
        <li>Most USB barcode scanners function as keyboard emulators (HID devices) and are typically plug-and-play. No special drivers are usually needed.</li>
        <li>For optimal performance with this POS application, ensure your scanner is configured to send an **'Enter' (carriage return/newline) suffix** after each scan. This helps the application quickly recognize the end of a scan when using the global scanner in the POS interface.</li>
        <li>If your scanner isn't typing into applications (like a text editor or this test field below), consult its manual for troubleshooting steps, setup instructions (often involving scanning configuration barcodes from the manual), or reset procedures.</li>
        <li>Ensure the scanner's output language matches your keyboard layout to avoid character mismatches.</li>
      </ul>
    </div>

    <!-- Test Area -->
    <div class="bg-gray-800 p-6 rounded-lg shadow-sm">
      <h3 class="text-xl font-semibold mb-3 text-secondary-accent">Test Your Scanner</h3>
      <p class="text-sm text-gray-400 mb-4">
        Click into the input field below, then scan a barcode with your scanner. 
        The scanned value should appear in the field, followed by an automatic "Enter" key press if your scanner is configured with an Enter suffix.
      </p>
      <div class="flex items-center space-x-3 mb-3">
        <input 
          type="text" 
          v-model="testBarcodeValue" 
          ref="testInputRef"
          @keyup.enter="handleTestEnterKey"
          placeholder="Click here and scan a barcode..."
          class="p-2.5 rounded-md bg-gray-100 text-gray-900 text-sm focus:ring-2 focus:ring-inset focus:ring-primary border border-gray-300 focus:border-primary flex-grow"
        />
        <button 
          @click="clearTestInput"
          class="bg-action-pink hover:bg-opacity-90 text-light-text font-semibold py-2.5 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-action-pink transition-colors duration-150"
        >
          Clear
        </button>
      </div>
      <div v-if="lastScannedValueForDisplay" class="mt-4 p-3 bg-gray-600 rounded-md text-sm">
        <p class="text-gray-300">Last value entered/scanned in test field: 
          <span class="font-semibold text-light-text break-all">{{ lastScannedValueForDisplay }}</span>
        </p>
      </div>
       <div v-if="enterKeyDetected" class="mt-2 p-2 bg-green-500 bg-opacity-10 border border-green-500 rounded-md text-green-300 text-xs">
        "Enter" key suffix was detected after the last input.
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';

const testBarcodeValue = ref('');
const lastScannedValueForDisplay = ref('');
const enterKeyDetected = ref(false);
const testInputRef = ref(null); // To focus the input field

watch(testBarcodeValue, (newValue) => {
  // If the input changes, it means something was scanned/typed.
  // We don't immediately confirm it as "scanned" here, just reflect the input.
  // The handleTestEnterKey confirms if an Enter suffix was part of the scan.
  if (newValue) {
    lastScannedValueForDisplay.value = newValue;
    // enterKeyDetected.value = false; // Reset this until Enter is detected
  }
});

function clearTestInput() {
  testBarcodeValue.value = '';
  lastScannedValueForDisplay.value = '';
  enterKeyDetected.value = false;
  // Focus the input again after clearing
  nextTick(() => {
    testInputRef.value?.focus();
  });
}

function handleTestEnterKey() {
    // This function is called if an "Enter" key is pressed while the input is focused.
    // If testBarcodeValue has content, it implies the scanner sent "Enter" after the barcode.
    if(testBarcodeValue.value.trim() !== '') {
        enterKeyDetected.value = true;
        // We can choose to clear the input for the next scan, or keep it.
        // For now, let's keep it so user sees the value and the confirmation.
        // User can use "Clear" button.
        // To auto-clear for next scan:
        // testBarcodeValue.value = ''; 
    }
}

// Auto-focus the input field when the component is mounted and visible
// (This is a basic example, more robust focus management might be needed if part of complex tab flows)
onMounted(() => {
    nextTick(() => {
        testInputRef.value?.focus();
    });
});
</script>

<style scoped>
/* Styles specific to AdminBarcodeSettings if needed */
</style>
