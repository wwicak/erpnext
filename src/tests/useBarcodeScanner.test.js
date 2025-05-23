import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useBarcodeScanner } from '../composables/useBarcodeScanner';
import { useDataStore } from '../store/dataStore';
import { useCartStore } from '../store/cartStore';

// Mock the stores
const mockCartStoreActions = {
  addItemToCart: vi.fn(),
};
const mockDataStoreState = {
  items: [], 
};

vi.mock('../store/dataStore', () => ({
  useDataStore: vi.fn(() => mockDataStoreState),
}));
vi.mock('../store/cartStore', () => ({
  useCartStore: vi.fn(() => mockCartStoreActions),
}));

describe('useBarcodeScanner Composable (Integration with Global Listener)', () => {
  let startBarcodeListener;
  let stopBarcodeListener;
  // To hold the functions returned by useBarcodeScanner
  let scannerControls;


  beforeEach(() => {
    setActivePinia(createPinia());
    mockCartStoreActions.addItemToCart.mockClear();
    mockDataStoreState.items = [];

    // Get a fresh scanner instance for each test
    // We need to call useBarcodeScanner to get the functions
    // but the event listener setup is global.
    scannerControls = useBarcodeScanner();
    startBarcodeListener = scannerControls.startBarcodeListener;
    stopBarcodeListener = scannerControls.stopBarcodeListener;

    // Start listener for each test that needs it
    // Tests that don't want it active can choose not to call it
    // or call stopBarcodeListener if it was started in a global beforeEach.
  });

  afterEach(() => {
    // Crucial: Stop the global listener after each test to prevent interference
    if (stopBarcodeListener) {
        stopBarcodeListener();
    }
    vi.useRealTimers(); // Restore real timers if fake ones were used
  });

  const sampleItems = [
    { item_code: 'ITEM001', item_name: 'Test Item 1', rate: 10, barcodes: [{ barcode: '12345' }] },
    { item_code: 'ITEM002', item_name: 'Test Item 2', rate: 20, barcodes: [{ barcode: '67890' }] },
    { item_code: 'ITEM003', item_name: 'Item With Code Only', rate: 30 },
  ];

  function dispatchKeyEvent(key, targetTagName = 'body') {
    const event = new KeyboardEvent('keydown', { key: key, bubbles: true, cancelable: true });
    // Mock event.target; happy-dom might not fully support dispatching events on document
    // with specific targets unless the element exists and is focused.
    // For simplicity, we assume the listener checks event.target.tagName.
    // This might need refinement if happy-dom's event dispatching is limited.
    let targetElement;
    if (targetTagName === 'input') {
        targetElement = document.createElement('input');
        document.body.appendChild(targetElement);
        targetElement.focus(); // Focus to simulate user typing in input
    } else {
        targetElement = document.body; // Default target
    }
    // console.log('Dispatching key:', key, 'on target:', targetElement, 'activeElement:', document.activeElement?.tagName);
    targetElement.dispatchEvent(event);
    if (targetTagName === 'input') {
        targetElement.remove();
    }
  }
  
  it('processes barcode on Enter key press and adds item to cart', () => {
    startBarcodeListener(); // Start listening for events
    mockDataStoreState.items = [...sampleItems];

    '12345'.split('').forEach(char => dispatchKeyEvent(char));
    dispatchKeyEvent('Enter');

    expect(mockCartStoreActions.addItemToCart).toHaveBeenCalledTimes(1);
    expect(mockCartStoreActions.addItemToCart).toHaveBeenCalledWith(
      expect.objectContaining({ item_code: 'ITEM001', rate: 10 }), 
      1
    );
  });

  it('processes barcode via item_code on Enter key press', () => {
    startBarcodeListener();
    mockDataStoreState.items = [...sampleItems];

    'ITEM003'.split('').forEach(char => dispatchKeyEvent(char));
    dispatchKeyEvent('Enter');

    expect(mockCartStoreActions.addItemToCart).toHaveBeenCalledTimes(1);
    expect(mockCartStoreActions.addItemToCart).toHaveBeenCalledWith(
      expect.objectContaining({ item_code: 'ITEM003', rate: 30 }), 
      1
    );
  });

  it('does not add item if barcode is not found', () => {
    startBarcodeListener();
    mockDataStoreState.items = [...sampleItems];
    
    'XYZ789'.split('').forEach(char => dispatchKeyEvent(char));
    dispatchKeyEvent('Enter');

    expect(mockCartStoreActions.addItemToCart).not.toHaveBeenCalled();
  });

  it('ignores keydown events if an input field is focused', () => {
    startBarcodeListener();
    mockDataStoreState.items = [...sampleItems];
    
    '12345'.split('').forEach(char => dispatchKeyEvent(char, 'input')); // Simulate focus on input
    dispatchKeyEvent('Enter', 'input');
    
    expect(mockCartStoreActions.addItemToCart).not.toHaveBeenCalled();
  });

  it('processes barcode after timeout if Enter is not pressed', async () => {
    vi.useFakeTimers();
    startBarcodeListener();
    mockDataStoreState.items = [...sampleItems];

    '67890'.split('').forEach(char => dispatchKeyEvent(char));

    await vi.advanceTimersByTimeAsync(350); // BARCODE_TIMEOUT_DURATION is 300ms

    expect(mockCartStoreActions.addItemToCart).toHaveBeenCalledTimes(1);
    expect(mockCartStoreActions.addItemToCart).toHaveBeenCalledWith(
      expect.objectContaining({ item_code: 'ITEM002', rate: 20 }),
      1
    );
    // No need to call stopBarcodeListener here, afterEach handles it.
  });
});
