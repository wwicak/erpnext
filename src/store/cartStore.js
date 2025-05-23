import { defineStore } from 'pinia';
import { useAuthStore } from './authStore';
import { useDataStore } from './dataStore';
import { useSyncStore } from './syncStore'; // Import syncStore
import { saveOfflineTransaction } from '../utils/localDB'; // Corrected path

export const useCartStore = defineStore('cart', {
  state: () => ({
    cartItems: [], 
    selectedCustomer: { name: 'Walk-in', customer_name: 'Walk-in Customer', default_price_list: null },
    appliedPayments: [], 
    isCompletingSale: false, 
  }),
  getters: {
    subtotal: (state) => {
      return state.cartItems.reduce((total, item) => total + parseFloat(item.amount || 0), 0);
    },
    taxes: (state) => {
      return 0; // Placeholder
    },
    grandTotal(state) { 
      return this.subtotal + this.taxes; 
    },
    totalPaid: (state) => {
      return state.appliedPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    },
    outstandingAmount(state) {
      const balance = parseFloat(this.grandTotal || 0) - parseFloat(this.totalPaid || 0);
      return Math.max(0, balance);
    },
    changeToGive(state) {
      const change = parseFloat(this.totalPaid || 0) - parseFloat(this.grandTotal || 0);
      return Math.max(0, change);
    },
    isCartEmpty: (state) => state.cartItems.length === 0,
  },
  actions: {
    addItemToCart(itemData, quantity) {
      const existingItem = this.cartItems.find(cartItem => cartItem.item_code === itemData.item_code);
      const itemRate = parseFloat(itemData.rate || 0);

      if (existingItem) {
        existingItem.qty += quantity;
        existingItem.amount = existingItem.qty * existingItem.rate;
      } else {
        this.cartItems.push({
          item_code: itemData.item_code,
          item_name: itemData.item_name,
          qty: quantity,
          rate: itemRate,
          amount: itemRate * quantity,
          uom: itemData.stock_uom, 
          stock_uom: itemData.stock_uom,
          conversion_factor: itemData.conversion_factor || 1, 
          is_stock_item: itemData.is_stock_item,
          income_account: itemData.income_account, 
          cost_center: itemData.cost_center,
        });
      }
    },
    updateCartItemQuantity(itemCode, newQuantity) {
      const item = this.cartItems.find(cartItem => cartItem.item_code === itemCode);
      if (item) {
        let nQty = parseFloat(newQuantity);
        if (isNaN(nQty) || nQty < 1) {
          nQty = 1; 
        }
        item.qty = nQty;
        item.amount = item.qty * item.rate;
      }
    },
    removeItemFromCart(itemCode) {
      this.cartItems = this.cartItems.filter(item => item.item_code !== itemCode);
    },
    clearCart() {
      this.cartItems = [];
      this.clearPayments();
      this.resetSelectedCustomerToDefault(); // Ensure customer is reset
      console.log('Cart cleared and customer reset to default.');
    },
    resetSelectedCustomerToDefault() {
        const dataStore = useDataStore(); // Get instance inside action
        let defaultCustomerName = 'Walk-in'; 
        if (dataStore.activePOSProfileDetails && dataStore.activePOSProfileDetails.default_customer) {
            defaultCustomerName = dataStore.activePOSProfileDetails.default_customer;
        } else if (dataStore.companySettings && dataStore.companySettings.pos_walk_in_customer) {
            defaultCustomerName = dataStore.companySettings.pos_walk_in_customer;
        }
        
        const defaultCustomer = dataStore.customers.find(c => c.name === defaultCustomerName);
        if (defaultCustomer) {
            this.selectedCustomer = JSON.parse(JSON.stringify(defaultCustomer)); // Deep copy
        } else {
            this.selectedCustomer = { name: 'Walk-in', customer_name: 'Walk-in Customer', default_price_list: null };
        }
    },
    setCartCustomer(customerData) {
      if (customerData && typeof customerData === 'object') {
        this.selectedCustomer = JSON.parse(JSON.stringify(customerData)); // Deep copy
      } else {
        this.resetSelectedCustomerToDefault();
        console.warn('Invalid customer data passed to setCartCustomer. Reset to default.');
      }
    },
    addPayment(paymentData) { 
      const amount = parseFloat(paymentData.amount || 0);
      if (paymentData.mode_of_payment && amount > 0) {
        this.appliedPayments.push({
          mode_of_payment: paymentData.mode_of_payment,
          amount: amount,
        });
      } else {
        console.warn('Invalid payment data:', paymentData);
      }
    },
    clearPayments() {
      this.appliedPayments = [];
    },
    recalculateCartPrices() {
      this.cartItems.forEach(item => {
        item.amount = item.qty * item.rate;
      });
    },
    loadCartFromHold(heldCartData) {
      if (!heldCartData) {
        console.error("loadCartFromHold: No data provided.");
        return;
      }
      this.cartItems = heldCartData.items || [];
      this.appliedPayments = heldCartData.payments || [];
      
      if (heldCartData.customer) {
          this.setCartCustomer(heldCartData.customer);
      } else {
          this.resetSelectedCustomerToDefault();
      }
      console.log("Cart loaded from held state.");
    },
    async completeSale() {
      this.isCompletingSale = true;
      const authStore = useAuthStore();
      const dataStore = useDataStore();

      try {
        if (!authStore.isLoggedIn) {
          alert('Error: User not logged in. Please login again.');
          return; // Early return
        }
        if (!dataStore.activePOSProfileDetails.name || !dataStore.companySettings.name) {
          alert('Error: Critical POS profile or company settings are not loaded. Please try syncing configuration or re-login.');
          return;
        }
        if (this.isCartEmpty) {
          alert('Error: Cart is empty. Add items to complete sale.');
          return;
        }
        if (this.outstandingAmount > 0) {
          alert('Error: Payment is insufficient. Please collect full payment before completing sale.');
          return;
        }

        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        
        const profileNameForId = (authStore.loginPOSProfileName || 'UNKNOWNPROFILE').replace(/\s+/g, '-');
        const offlineTxId = `OFFLINE-${profileNameForId}-${now.getTime()}`;

        const transactionData = {
          offline_id: offlineTxId,
          pos_profile: authStore.loginPOSProfileName,
          company: dataStore.activePOSProfileDetails.company || dataStore.companySettings.name,
          customer: this.selectedCustomer.name || 'Walk-in',
          posting_date: dateStr,
          posting_time: timeStr,
          transaction_date: dateStr,
          items: JSON.parse(JSON.stringify(this.cartItems)).map(item => ({
            ...item,
            warehouse: dataStore.activePOSProfileDetails.warehouse || '', 
          })),
          payments: JSON.parse(JSON.stringify(this.appliedPayments)),
          subtotal: this.subtotal,
          grand_total: this.grandTotal,
          total_taxes_and_charges: this.taxes,
          paid_amount: this.totalPaid,
          change_amount: this.changeToGive,
          currency: dataStore.activePOSProfileDetails.currency || dataStore.companySettings.default_currency,
          conversion_rate: 1.0, 
          selling_price_list: dataStore.activePOSProfileDetails.selling_price_list || '',
          update_stock: (dataStore.activePOSProfileDetails.update_stock === false || dataStore.activePOSProfileDetails.update_stock === 0) ? 0 : 1,
          sync_status: 'pending',
          local_stock_issue: 0, 
        };
        
        await saveOfflineTransaction(transactionData);
        alert(`Sale completed successfully! Offline ID: ${offlineTxId}\nChange to give: ${transactionData.change_amount.toFixed(2)}`);
        
        this.clearCart(); // This also clears payments and resets customer by calling resetSelectedCustomerToDefault
        // The resetSelectedCustomerToDefault is already called within clearCart.
        // If it wasn't, we would call it here: this.resetSelectedCustomerToDefault();

      } catch (error) {
        console.error('Failed to complete sale:', error);
        alert(`Error completing sale: ${error.message || 'Unknown error'}. Please check console for details.`);
      } finally {
        this.isCompletingSale = false;
      }
    }
  },
});
