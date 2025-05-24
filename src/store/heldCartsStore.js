import { defineStore } from 'pinia';
import { useCartStore } from './cartStore';
import { useDataStore } from './dataStore'; // For default customer info
import { useAuthStore } from './authStore'; // For clerk info
import * as localDB from '../utils/localDB'; // Corrected path, includes logClerkActivity

export const useHeldCartsStore = defineStore('heldCarts', {
  state: () => ({
    heldCartsList: [], // Array of { id, name, cart_data, created_at }
    isProcessing: false,
  }),
  actions: {
    async holdCurrentCart(optionalName = null) {
      this.isProcessing = true;
      const cartStore = useCartStore(); 
      const dataStore = useDataStore(); 
      const authStore = useAuthStore();

      if (cartStore.isCartEmpty) {
        alert("Cannot hold an empty cart.");
        this.isProcessing = false;
        return;
      }

      const cartDataToHold = {
        items: JSON.parse(JSON.stringify(cartStore.cartItems)), 
        customer: JSON.parse(JSON.stringify(cartStore.selectedCustomer)),
        payments: JSON.parse(JSON.stringify(cartStore.appliedPayments)),
        subtotal: cartStore.subtotal,
        taxes: cartStore.taxes,
        grandTotal: cartStore.grandTotal,
      };

      let savedHeldCartId = null; // To store the ID for logging
      const cartNameForLog = optionalName || `Cart held at ${new Date().toLocaleTimeString()}`;

      try {
        savedHeldCartId = await localDB.saveHeldCart(cartDataToHold, cartNameForLog);
        
        // Log activity
        if (authStore.isLoggedIn && authStore.currentUser && savedHeldCartId) {
          try {
            await localDB.logClerkActivity(
              authStore.currentUser.user_id,
              authStore.currentUser.full_name,
              'CART_HELD',
              { heldCartId: savedHeldCartId, heldCartName: cartNameForLog, itemCount: cartDataToHold.items.length }
            );
          } catch (logError) {
            console.error("Failed to log cart held activity:", logError);
          }
        }
        
        await this.loadHeldCartsFromDB(); 
        
        await cartStore.clearCart(); // Ensure this is awaited if it becomes async due to logging
        
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
        this.heldCartsList = []; 
      } finally {
        this.isProcessing = false;
      }
    },

    async resumeCart(heldCartId) {
      this.isProcessing = true;
      const cartStore = useCartStore(); 
      const authStore = useAuthStore();
      
      const heldCart = this.heldCartsList.find(cart => cart.id === heldCartId);
      if (!heldCart) {
        alert('Error: Held cart not found.');
        this.isProcessing = false;
        return;
      }

      try {
        if (typeof cartStore.loadCartFromHold !== 'function') {
            throw new Error("cartStore.loadCartFromHold action is not defined.");
        }
        cartStore.loadCartFromHold(heldCart.cart_data);
        
        await localDB.deleteHeldCart(heldCartId);

        // Log activity
        if (authStore.isLoggedIn && authStore.currentUser) {
          try {
            await localDB.logClerkActivity(
              authStore.currentUser.user_id,
              authStore.currentUser.full_name,
              'CART_RESUMED',
              { heldCartId: heldCartId, heldCartName: heldCart.name }
            );
          } catch (logError) {
            console.error("Failed to log cart resumed activity:", logError);
          }
        }

        await this.loadHeldCartsFromDB(); 

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
      const authStore = useAuthStore();
      const cartToDelete = this.heldCartsList.find(cart => cart.id === heldCartId); // For logging name

      try {
        await localDB.deleteHeldCart(heldCartId);

        // Log activity
        if (authStore.isLoggedIn && authStore.currentUser) {
          try {
            await localDB.logClerkActivity(
              authStore.currentUser.user_id,
              authStore.currentUser.full_name,
              'CART_DELETED_FROM_HOLD',
              { heldCartId: heldCartId, heldCartName: cartToDelete?.name || 'Unknown' }
            );
          } catch (logError) {
            console.error("Failed to log cart deleted from hold activity:", logError);
          }
        }
        
        await this.loadHeldCartsFromDB(); 
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
