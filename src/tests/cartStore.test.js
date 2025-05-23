import { setActivePinia, createPinia } from 'pinia';
import { describe, it, expect, beforeEach, vi } from 'vitest'; // Added vi
import { useCartStore } from '../store/cartStore';
import { useDataStore } from '../store/dataStore'; // For default customer reset
import { useSyncStore } from '../store/syncStore'; // For loadPendingTransactionsCount

// Mock dataStore for default customer part
vi.mock('../store/dataStore', () => ({
  useDataStore: vi.fn(() => ({
    activePOSProfileDetails: { default_customer: 'Walk-in' },
    companySettings: { pos_walk_in_customer: 'Walk-in' },
    customers: [{ name: 'Walk-in', customer_name: 'Walk-in Customer' }],
  })),
}));

// Mock localDB.js as its actual WASM/SQLite parts are problematic in unit tests
vi.mock('../utils/localDB.js', () => ({
  saveOfflineTransaction: vi.fn().mockResolvedValue(12345), // Mock successful save, return an ID
  getPendingTransactions: vi.fn().mockResolvedValue([]),
  updateTransactionStatus: vi.fn().mockResolvedValue(undefined),
  // Add other functions if they get called by cartStore and need mocking
}));

// Mock syncStore for loadPendingTransactionsCount
vi.mock('../store/syncStore', () => ({
  useSyncStore: vi.fn(() => ({
    loadPendingTransactionsCount: vi.fn().mockResolvedValue(undefined),
  })),
}));


describe('Cart Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    // Reset cart store state before each test
    const cartStore = useCartStore();
    cartStore.$reset(); // This is a built-in Pinia way to reset state if $reset is enabled or you define it.
                        // If not, manually reset state:
    // cartStore.cartItems = [];
    // cartStore.selectedCustomer = { name: 'Walk-in', customer_name: 'Walk-in Customer', default_price_list: null };
    // cartStore.appliedPayments = [];
    // cartStore.isCompletingSale = false;

    // Ensure dataStore mock is fresh or its relevant parts are reset if it had state
    // For this mock, it's stateless, so it's fine.
  });

  const sampleItem1 = { item_code: 'ITEM001', item_name: 'Test Item 1', rate: 10, stock_uom: 'Nos', is_stock_item: 1 };
  const sampleItem2 = { item_code: 'ITEM002', item_name: 'Test Item 2', rate: 25, stock_uom: 'Kg', is_stock_item: 1 };

  it('adds a new item to the cart', () => {
    const cartStore = useCartStore();
    cartStore.addItemToCart(sampleItem1, 2);
    expect(cartStore.cartItems.length).toBe(1);
    expect(cartStore.cartItems[0].item_code).toBe('ITEM001');
    expect(cartStore.cartItems[0].qty).toBe(2);
    expect(cartStore.cartItems[0].amount).toBe(20);
  });

  it('increments quantity for an existing item', () => {
    const cartStore = useCartStore();
    cartStore.addItemToCart(sampleItem1, 1);
    cartStore.addItemToCart(sampleItem1, 2);
    expect(cartStore.cartItems.length).toBe(1);
    expect(cartStore.cartItems[0].qty).toBe(3);
    expect(cartStore.cartItems[0].amount).toBe(30);
  });

  it('updates item quantity', () => {
    const cartStore = useCartStore();
    cartStore.addItemToCart(sampleItem1, 1);
    cartStore.updateCartItemQuantity('ITEM001', 5);
    expect(cartStore.cartItems[0].qty).toBe(5);
    expect(cartStore.cartItems[0].amount).toBe(50);
  });

  it('ensures quantity is at least 1 when updating', () => {
    const cartStore = useCartStore();
    cartStore.addItemToCart(sampleItem1, 1);
    cartStore.updateCartItemQuantity('ITEM001', 0);
    expect(cartStore.cartItems[0].qty).toBe(1); // Should default to 1
    cartStore.updateCartItemQuantity('ITEM001', -5);
    expect(cartStore.cartItems[0].qty).toBe(1); // Should default to 1
  });

  it('removes an item from the cart', () => {
    const cartStore = useCartStore();
    cartStore.addItemToCart(sampleItem1, 1);
    cartStore.addItemToCart(sampleItem2, 1);
    cartStore.removeItemFromCart('ITEM001');
    expect(cartStore.cartItems.length).toBe(1);
    expect(cartStore.cartItems[0].item_code).toBe('ITEM002');
  });

  it('clears the cart (items, payments, and customer)', () => {
    const cartStore = useCartStore();
    const dataStore = useDataStore(); // To check default customer reset
    
    cartStore.addItemToCart(sampleItem1, 1);
    cartStore.addPayment({ mode_of_payment: 'Cash', amount: 10 });
    cartStore.setCartCustomer({ name: 'Test Cust', customer_name: 'Test Customer' });

    cartStore.clearCart();
    
    expect(cartStore.cartItems.length).toBe(0);
    expect(cartStore.appliedPayments.length).toBe(0);
    // Check if customer is reset to default from (mocked) dataStore
    expect(cartStore.selectedCustomer.name).toBe(dataStore.customers[0].name);
  });

  describe('Getters', () => {
    it('calculates subtotal correctly', () => {
      const cartStore = useCartStore();
      cartStore.addItemToCart(sampleItem1, 2); // 2 * 10 = 20
      cartStore.addItemToCart(sampleItem2, 1); // 1 * 25 = 25
      expect(cartStore.subtotal).toBe(45);
    });

    it('calculates grandTotal correctly (with 0 tax for now)', () => {
      const cartStore = useCartStore();
      cartStore.addItemToCart(sampleItem1, 1); // 10
      expect(cartStore.grandTotal).toBe(10); // subtotal + 0 tax
    });

    it('calculates totalPaid correctly', () => {
      const cartStore = useCartStore();
      cartStore.addPayment({ mode_of_payment: 'Cash', amount: 10 });
      cartStore.addPayment({ mode_of_payment: 'Card', amount: 5.50 });
      expect(cartStore.totalPaid).toBe(15.50);
    });

    it('calculates outstandingAmount correctly', () => {
      const cartStore = useCartStore();
      cartStore.addItemToCart(sampleItem1, 3); // Grand total = 30
      cartStore.addPayment({ mode_of_payment: 'Cash', amount: 20 });
      expect(cartStore.outstandingAmount).toBe(10);
      cartStore.addPayment({ mode_of_payment: 'Card', amount: 15 }); // Total paid = 35
      expect(cartStore.outstandingAmount).toBe(0); // Should not be negative
    });

    it('calculates changeToGive correctly', () => {
      const cartStore = useCartStore();
      cartStore.addItemToCart(sampleItem1, 2); // Grand total = 20
      cartStore.addPayment({ mode_of_payment: 'Cash', amount: 15 });
      expect(cartStore.changeToGive).toBe(0);
      cartStore.addPayment({ mode_of_payment: 'Card', amount: 10 }); // Total paid = 25
      expect(cartStore.changeToGive).toBe(5);
    });
  });
});
