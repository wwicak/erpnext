import { defineStore } from 'pinia';

export const useDataStore = defineStore('data', {
  state: () => ({
    items: [],
    // posProfiles: [], // This seems to be for listing multiple profiles, not used in current flow
    companySettings: {},
    paymentModes: [],
    customers: [],
    activePOSProfileDetails: {}, // Stores details of the currently logged-in POS Profile
    isLoading: false, // General loading state, can be used for initial data fetch
    initialDataError: null, // Stores error message if initial data fetch fails
  }),
  actions: {
    // Internal setters, can be kept if direct setting is needed elsewhere,
    // but setAllInitialData is preferred for the initial load.
    _setItems(itemsData) {
      this.items = itemsData;
    },
    _setCompanySettings(settingsData) {
      this.companySettings = settingsData;
    },
    _setPaymentModes(modesData) {
      this.paymentModes = modesData;
    },
    _setCustomers(customersData) {
      this.customers = customersData;
    },
    _setActivePOSProfileDetails(profileDetails) {
      this.activePOSProfileDetails = profileDetails;
    },

    // Action to be called by POSInterface.vue after useQuery successfully fetches data
    setAllInitialData(data) {
      this._setItems(data.items || []);
      this._setActivePOSProfileDetails(data.activePOSProfileDetails || {});
      this._setCompanySettings(data.companySettings || {});
      this._setPaymentModes(data.paymentModes || []);
      if (data.customers) this._setCustomers(data.customers);
      
      this.isLoading = false;
      this.initialDataError = null;
      console.log('Initial POS data set in store:', data);
    },

    // Action to be called by POSInterface.vue if useQuery encounters an error
    setFetchError(errorMessage) {
      this.initialDataError = errorMessage;
      this.items = []; // Clear data on error
      this.activePOSProfileDetails = {};
      this.companySettings = {};
      this.paymentModes = [];
      this.customers = [];
      this.isLoading = false;
      console.error('Error setting initial POS data in store:', errorMessage);
    },

    // General loading state setter
    setLoading(status) {
      this.isLoading = status;
    },

    // Clearer for initial data error specifically
    clearInitialDataError() {
        this.initialDataError = null;
    }
    
    // The old fetchAllInitialData is removed as per revised instructions.
    // The component POSInterface.vue will manage the useQuery hook.
  },
});
