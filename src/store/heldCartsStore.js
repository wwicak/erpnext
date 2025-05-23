import { defineStore } from 'pinia';
import { useCartStore } from './cartStore';
import { useDataStore } from './dataStore'; // For default customer info
import * as localDB from '../utils/localDB'; // Corrected path

export const useHeldCartsStore = defineStore('heldCarts', {
  state: () => ({
    heldCartsList: [], // Array of { id, name, cart_data, created_at }
    isProcessing: false,
  }),
  actions: {
    async holdCurrentCart(optionalName = null) {
      this.isProcessing = true;
      const cartStore = useCartStore(); // Get instance inside action
      const dataStore = useDataStore(); // Get instance for default customer

      if (cartStore.isCartEmpty) {
        alert("Cannot hold an empty cart.");
        this.isProcessing = false;
        return;
      }

      // Construct cartData from current cartStore state
      const cartDataToHold = {
        items: JSON.parse(JSON.stringify(cartStore.cartItems)), // Deep copy
        customer: JSON.parse(JSON.stringify(cartStore.selectedCustomer)),
        payments: JSON.parse(JSON.stringify(cartStore.appliedPayments)),
        // Include relevant totals from getters
        subtotal: cartStore.subtotal,
        taxes: cartStore.taxes,
        grandTotal: cartStore.grandTotal,
        // any other relevant cart-specific info like discounts if they existed
      };

      try {
        const defaultCartName = `Cart held at ${new Date().toLocaleTimeString()}`;
        await localDB.saveHeldCart(cartDataToHold, optionalName || defaultCartName);
        
        await this.loadHeldCartsFromDB(); // Refresh the list of held carts
        
        // Clear the main cart and reset customer
        cartStore.clearCart(); // This already clears items and payments
        
        // Reset selected customer to default after holding cart
        let defaultCustomerName = 'Walk-in';
        if (dataStore.activePOSProfileDetails && dataStore.activePOSProfileDetails.default_customer) {
            defaultCustomerName = dataStore.activePOSProfileDetails.default_customer;
        } else if (dataStore.companySettings && dataStore.companySettings.pos_walk_in_customer) {
            defaultCustomerName = dataStore.companySettings.pos_walk_in_customer;
        }
        const defaultCustomer = dataStore.customers.find(c => c.name === defaultCustomerName);
        if (defaultCustomer) {
            cartStore.setCartCustomer(defaultCustomer);
        } else {
            cartStore.setCartCustomer({ name: 'Walk-in', customer_name: 'Walk-in Customer', default_price_list: null });
        }

        alert('Cart held successfully!');
      } catch (error) {
        console.error('Error holding cart:', error);
        alert(`Failed to hold cart: ${error.message}`);
      } finally {
        this.isProcessing = false;
      }
    },

    async loadHeldCartsFromDB() {
      this.isProcessing = true;
      try {
        const carts = await localDB.getHeldCarts();
        this.heldCartsList = carts;
      } catch (error) {
        console.error('Error loading held carts from DB:', error);
        alert(`Failed to load held carts: ${error.message}`);
        this.heldCartsList = []; // Reset on error
      } finally {
        this.isProcessing = false;
      }
    },

    async resumeCart(heldCartId) {
      this.isProcessing = true;
      const cartStore = useCartStore(); // Get instance inside action
      
      const heldCart = this.heldCartsList.find(cart => cart.id === heldCartId);
      if (!heldCart) {
        alert('Error: Held cart not found.');
        this.isProcessing = false;
        return;
      }

      try {
        // Ensure cartStore has the action to load the state
        if (typeof cartStore.loadCartFromHold !== 'function') {
            throw new Error("cartStore.loadCartFromHold action is not defined.");
        }
        cartStore.loadCartFromHold(heldCart.cart_data);
        
        await localDB.deleteHeldCart(heldCartId);
        await this.loadHeldCartsFromDB(); // Refresh list

        alert('Cart resumed successfully.');
      } catch (error) {
        console.error('Error resuming cart:', error);
        alert(`Failed to resume cart: ${error.message}`);
      } finally {
        this.isProcessing = false;
      }
    },

    async deleteCartFromHold(heldCartId) {
      this.isProcessing = true;
      try {
        await localDB.deleteHeldCart(heldCartId);
        await this.loadHeldCartsFromDB(); // Refresh list
        alert('Held cart deleted successfully.');
      } catch (error) {
        console.error('Error deleting held cart:', error);
        alert(`Failed to delete held cart: ${error.message}`);
      } finally {
        this.isProcessing = false;
      }
    },
  },
});
