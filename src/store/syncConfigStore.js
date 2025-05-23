import { defineStore } from 'pinia';

export const useSyncConfigStore = defineStore('syncConfig', {
  state: () => ({
    erpNextUrl: localStorage.getItem('erpNextUrl') || null,
    posProfileForSync: localStorage.getItem('posProfileForSync') || null,
    companyForSync: localStorage.getItem('companyForSync') || null,
    syncStatusMessage: null,
  }),
  actions: {
    setSyncConfig(url, profile, company) {
      this.erpNextUrl = url;
      this.posProfileForSync = profile;
      this.companyForSync = company;
      localStorage.setItem('erpNextUrl', url);
      localStorage.setItem('posProfileForSync', profile);
      localStorage.setItem('companyForSync', company);
      this.syncStatusMessage = 'Sync configuration saved.';
    },
    loadSyncConfig() {
      this.erpNextUrl = localStorage.getItem('erpNextUrl') || null;
      this.posProfileForSync = localStorage.getItem('posProfileForSync') || null;
      this.companyForSync = localStorage.getItem('companyForSync') || null;
      if (this.erpNextUrl) {
        this.syncStatusMessage = 'Sync configuration loaded from local storage.';
      } else {
        this.syncStatusMessage = 'No sync configuration found in local storage.';
      }
    },
    setSyncStatusMessage(message) {
      this.syncStatusMessage = message;
    },
  },
});
