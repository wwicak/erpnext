import { defineStore } from 'pinia';
import * as localDB from '../utils/localDB'; // localDB.logApiSyncAttempt
import * as api from '../services/api'; 
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

      if (!csrfToken) {
        try {
          console.log("Attempting to fetch CSRF token as it's not in authStore for sync...");
          const fetchedToken = await api.getFrappeCsrfToken(erpNextUrl);
          if (fetchedToken && !fetchedToken.startsWith('dummy_')) { 
            authStore.setCurrentUserCSRFToken(fetchedToken); 
            csrfToken = fetchedToken;
            console.log("CSRF token fetched and stored in authStore for sync.");
          } else {
            throw new Error("Failed to retrieve a valid CSRF token for sync.");
          }
        } catch (tokenError) {
          console.error("Failed to fetch CSRF token for sync:", tokenError);
          this.syncError = `Failed to fetch CSRF token: ${tokenError.message}. Sync aborted.`;
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
        await this.loadPendingTransactionsCount(); 
        return;
      }

      let successCount = 0;
      let failureCount = 0;

      for (const tx of pendingTransactions) {
        // Log attempt - request_payload_json is the tx data itself before mapping for submitPOSInvoice
        // The actual payload sent by submitPOSInvoice might be slightly different.
        // For simplicity, logging the raw `tx` which includes items and payments.
        // `api.submitPOSInvoice` itself creates the `salesInvoiceData` payload.
        // To log the exact payload, `submitPOSInvoice` would need to return it or log it.
        // For now, logging `tx` is a good approximation of what's being sent.
        await localDB.logApiSyncAttempt({
          offline_transaction_id: tx.offline_id,
          status: 'ATTEMPTING',
          request_payload_json: JSON.stringify(tx) // Log the raw transaction data being attempted
        });

        try {
          const response = await api.submitPOSInvoice(erpNextUrl, tx, csrfToken);
          
          await localDB.updateTransactionStatus(tx.offline_id, 'synced');
          await localDB.logApiSyncAttempt({
            offline_transaction_id: tx.offline_id,
            erpnext_invoice_id: response.data?.name, // Assuming ERPNext returns { data: { name: 'INV-ID' } }
            status: 'SUCCESS',
            http_status_code: 200, // Assuming success implies 200 or similar
            response_body_json: JSON.stringify(response)
          });
          successCount++;
        } catch (error) {
          failureCount++;
          const errorMessage = error.message || 'Unknown error during submission.';
          const httpStatusCode = error.statusCode || null;
          const responseBody = error.requestBody ? JSON.stringify(error.requestBody) : (error.response ? JSON.stringify(error.response) : null);


          await localDB.updateTransactionStatus(tx.offline_id, 'failed', errorMessage);
          await localDB.logApiSyncAttempt({
            offline_transaction_id: tx.offline_id,
            status: 'FAILED',
            http_status_code: httpStatusCode,
            error_message: errorMessage,
            response_body_json: responseBody, // Log error response if available
            request_payload_json: JSON.stringify(tx) // Log the request that failed
          });
          
          console.error(`Failed to sync transaction ${tx.offline_id}:`, error);
          
          if (httpStatusCode === 401 || httpStatusCode === 403 || errorMessage.toLowerCase().includes('csrf')) {
            this.syncError = `Sync stopped due to authentication/authorization error on transaction ${tx.offline_id}: ${errorMessage}`;
            if (errorMessage.toLowerCase().includes('csrf')) authStore.clearCurrentUserCSRFToken();
            break; 
          }
          if (!this.syncError) {
            this.syncError = `Error syncing transaction ${tx.offline_id}: ${errorMessage}`;
          }
          break; 
        }
      }

      this.lastSyncTime = new Date().toISOString();
      await this.loadPendingTransactionsCount(); 

      if (failureCount > 0) {
        if (!this.syncError) { 
             this.syncError = `${failureCount} transaction(s) failed to sync. ${successCount} successfully synced.`;
        }
      } else if (successCount > 0) {
        this.syncSuccessMessage = `${successCount} transaction(s) synced successfully.`;
      } else if (pendingTransactions.length > 0 && successCount === 0 && failureCount === 0) {
        this.syncError = "Sync process completed, but no transactions were processed. Check logs.";
      }
      this.isSyncing = false;
    },
  },
});
