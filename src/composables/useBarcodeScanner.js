import { ref } from 'vue';
import { useDataStore } from '../store/dataStore'; // Adjusted path
import { useCartStore } from '../store/cartStore'; // Adjusted path

const BARCODE_TIMEOUT_DURATION = 300; // ms

export function useBarcodeScanner() {
  const barcodeBuffer = ref('');
  const barcodeTimeout = ref(null);
  
  // Get store instances. These will be resolved when the composable is actually used within a component's setup context.
  let dataStore;
  let cartStore;

  // Internal function to ensure stores are available.
  // This is because Pinia stores need to be accessed within an active Pinia instance,
  // typically available during component setup.
  function _ensureStores() {
    if (!dataStore) dataStore = useDataStore();
    if (!cartStore) cartStore = useCartStore();
  }

  async function processBarcodeScan() {
    _ensureStores(); // Make sure stores are initialized

    const scannedBarcode = barcodeBuffer.value.trim();
    if (!scannedBarcode) return;

    console.log("Processing barcode:", scannedBarcode);

    let itemFound = null;
    if (dataStore.items && dataStore.items.length > 0) {
        itemFound = dataStore.items.find(item => {
            // Check against a single 'barcode' field if it exists (legacy or simple cases)
            if (item.barcode && item.barcode === scannedBarcode) return true;
            // Check against 'item_code' as a fallback if it can be scanned
            if (item.item_code && item.item_code === scannedBarcode) return true;
            // Check against an array 'barcodes' which contains objects like { barcode: 'value' }
            if (item.barcodes && Array.isArray(item.barcodes)) {
                return item.barcodes.some(b => b && b.barcode === scannedBarcode);
            }
            return false;
        });
    }
    
    if (itemFound) {
      console.log("Item found by barcode:", itemFound.item_name, itemFound);
      // Ensure 'rate' is correctly sourced (it should be the selling price from dataStore)
      const itemToAdd = { 
        ...itemFound, 
        rate: parseFloat(itemFound.rate || 0), // Ensure rate is a number
      };
      cartStore.addItemToCart(itemToAdd, 1);
      // Optional: Clear search input in ItemSelectionPanel.vue (this is complex from here, consider Pinia state or event)
    } else {
      console.warn("Barcode not found in local DB:", scannedBarcode);
      // Optional: provide user feedback via a toast or a message in a UI store
    }
    barcodeBuffer.value = ''; // Clear buffer after processing
  }

  function handleKeyDown(event) {
    _ensureStores(); // Ensure stores are available for any potential immediate action
    
    const targetTagName = event.target.tagName.toLowerCase();
    const isInputFocused = targetTagName === 'input' || targetTagName === 'textarea' || event.target.isContentEditable;

    // If a designated barcode input field exists and is focused, this global listener might interfere or be redundant.
    // For now, we assume this is a global listener that should NOT run when typical inputs are focused.
    // Exception: if the focused input is specifically for barcode scanning (e.g. has a class 'allow-barcode-scanner')
    // const isBarcodeSpecificInput = event.target.classList && event.target.classList.contains('allow-barcode-scanner');
    // if (isInputFocused && !isBarcodeSpecificInput) {
    if (isInputFocused) {
        // console.log('Input focused, global barcode scan ignored.');
        return; 
    }

    if (barcodeTimeout.value) {
      clearTimeout(barcodeTimeout.value);
      barcodeTimeout.value = null;
    }

    if (event.key === "Enter") {
      if (barcodeBuffer.value.trim().length > 0) {
        event.preventDefault(); // Prevent form submission or other default Enter behavior
        processBarcodeScan(); // Process the buffer
        // Timeout is already cleared or will be by this path, no need to set new one here
      }
      // If buffer is empty, Enter key might be for other purposes, so don't interfere.
      return; // Explicitly return after handling Enter
    } 
    
    // For other keys, if they are single characters, add to buffer
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      barcodeBuffer.value += event.key;
    }
    
    // Set a new timeout after each relevant key press (not Enter)
    // This timeout is for auto-submitting or clearing the buffer if typing pauses.
    if (barcodeBuffer.value.length > 0) {
        barcodeTimeout.value = setTimeout(() => {
            // If buffer has content and timeout triggers, process it as a scan
            // This handles scanners that don't send "Enter"
            if (barcodeBuffer.value.trim().length > 0) {
                console.log("Barcode scan timeout, processing buffer:", barcodeBuffer.value);
                processBarcodeScan();
            }
            // Buffer is cleared by processBarcodeScan or if it was empty initially
        }, BARCODE_TIMEOUT_DURATION);
    }
  }

  function startBarcodeListener() {
    // _ensureStores(); // Stores will be ensured on first event or process call.
    document.addEventListener('keydown', handleKeyDown, true); // Use capture phase if needed, but usually not.
    console.log("Global barcode listener initialized.");
  }

  function stopBarcodeListener() {
    document.removeEventListener('keydown', handleKeyDown, true);
    if (barcodeTimeout.value) {
      clearTimeout(barcodeTimeout.value);
      barcodeTimeout.value = null;
    }
    barcodeBuffer.value = ''; // Clear buffer on stop
    console.log("Global barcode listener stopped.");
  }
  
  return {
    startBarcodeListener,
    stopBarcodeListener,
    // barcodeBuffer, // For debugging
  };
}
