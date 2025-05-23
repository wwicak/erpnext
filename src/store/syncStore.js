import { defineStore } from 'pinia';
import * as localDB from '../utils/localDB';
import * as api from '../services/api'; // api.submitPOSInvoice, api.getFrappeCsrfToken
import { useAuthStore } from './authStore';
import { useSyncConfigStore } from './syncConfigStore';

export const useSyncStore = defineStore('sync', {
  state: () => ({
    isSyncing: false,
    pendingTransactionsCount: 0,
    lastSyncTime: null,
    syncError: null,
    syncSuccessMessage: null,
  }),
  actions: {
    async loadPendingTransactionsCount() {
      try {
        const transactions = await localDB.getPendingTransactions();
        this.pendingTransactionsCount = transactions.length;
      } catch (error) {
        console.error("Error loading pending transactions count:", error);
        this.pendingTransactionsCount = 0; 
      }
    },

    async syncOfflineTransactions() {
      this.isSyncing = true;
      this.syncError = null;
      this.syncSuccessMessage = null;
      
      const authStore = useAuthStore();
      const syncConfigStore = useSyncConfigStore();

      if (!authStore.isLoggedIn) {
        this.syncError = "User not logged in. Please login to sync.";
        this.isSyncing = false;
        return;
      }

      const erpNextUrl = syncConfigStore.erpNextUrl;
      if (!erpNextUrl) {
        this.syncError = "ERPNext URL not configured. Please configure it in Sync Controls.";
        this.isSyncing = false;
        return;
      }
      
      let csrfToken = authStore.currentUser?.csrf_token;

      // Attempt to fetch CSRF token if not already available or if it might be stale
      // This is a simplified approach; a more robust solution would involve checking token expiry
      // or handling 401/403 errors that specifically indicate CSRF failure.
      if (!csrfToken) {
        try {
          console.log("Attempting to fetch CSRF token as it's not in authStore...");
          const fetchedToken = await api.getFrappeCsrfToken(erpNextUrl);
          if (fetchedToken && !fetchedToken.startsWith('dummy_')) { // Check if it's a real token
            authStore.setCurrentUserCSRFToken(fetchedToken); // New action needed in authStore
            csrfToken = fetchedToken;
            console.log("CSRF token fetched and stored in authStore.");
          } else {
            throw new Error("Failed to retrieve a valid CSRF token.");
          }
        } catch (tokenError) {
          console.error("Failed to fetch CSRF token:", tokenError);
          this.syncError = `Failed to fetch CSRF token: ${tokenError.message}. Cannot sync.`;
          this.isSyncing = false;
          return;
        }
      }


      let pendingTransactions = [];
      try {
        pendingTransactions = await localDB.getPendingTransactions();
      } catch (dbError) {
        this.syncError = `Error fetching transactions from local DB: ${dbError.message}`;
        this.isSyncing = false;
        return;
      }

      if (pendingTransactions.length === 0) {
        this.syncSuccessMessage = "No pending transactions to sync.";
        this.lastSyncTime = new Date().toISOString();
        this.isSyncing = false;
        await this.loadPendingTransactionsCount(); // Should be 0
        return;
      }

      let successCount = 0;
      let failureCount = 0;

      for (const tx of pendingTransactions) {
        try {
          // The transaction (tx) object from localDB includes items and payments already parsed from JSON.
          // api.submitPOSInvoice expects these to be arrays.
          const response = await api.submitPOSInvoice(erpNextUrl, tx, csrfToken);
          // Assuming success if no error is thrown
          await localDB.updateTransactionStatus(tx.offline_id, 'synced');
          successCount++;
        } catch (error) {
          failureCount++;
          const errorMessage = error.message || 'Unknown error during submission.';
          console.error(`Failed to sync transaction ${tx.offline_id}:`, error);
          await localDB.updateTransactionStatus(tx.offline_id, 'failed', errorMessage);
          
          // If it's an auth error (e.g. CSRF, session expired), stop further sync attempts.
          if (error.statusCode === 401 || error.statusCode === 403 || error.message.toLowerCase().includes('csrf')) {
            this.syncError = `Sync stopped due to authentication/authorization error on transaction ${tx.offline_id}: ${errorMessage}`;
            // Optionally, clear the potentially invalid CSRF token from authStore
            if (error.message.toLowerCase().includes('csrf')) authStore.clearCurrentUserCSRFToken(); // New action in authStore
            break; 
          }
          // For other errors, record the first one and continue (or break based on preference)
          if (!this.syncError) { // Store only the first error encountered for general feedback
            this.syncError = `Error syncing transaction ${tx.offline_id}: ${errorMessage}`;
          }
          // For this implementation, we'll stop on the first error to alert the user.
          // To continue syncing other transactions, remove the 'break;'
          break; 
        }
      }

      this.lastSyncTime = new Date().toISOString();
      await this.loadPendingTransactionsCount(); // Refresh count

      if (failureCount > 0) {
        // syncError would already be set if we break on first error
        if (!this.syncError) { // If we didn't break and had multiple failures
             this.syncError = `${failureCount} transaction(s) failed to sync. ${successCount} synced.`;
        }
      } else if (successCount > 0) {
        this.syncSuccessMessage = `${successCount} transaction(s) synced successfully.`;
      } else if (pendingTransactions.length > 0 && successCount === 0 && failureCount === 0) {
        // This case should ideally not be reached if loop runs and error handling is correct.
        this.syncError = "Sync process completed, but no transactions were processed. Check logs.";
      }


      this.isSyncing = false;
    },
  },
});
