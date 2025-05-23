import { defineStore } from 'pinia';

export const useUiStore = defineStore('ui', {
  state: () => ({
    isPriceCheckModalVisible: false,
    isHeldCartsModalVisible: false,
    globalLoadingMessage: null,
  }),
  actions: {
    showPriceCheckModal() {
      this.isPriceCheckModalVisible = true;
    },
    hidePriceCheckModal() {
      this.isPriceCheckModalVisible = false;
    },
    showHeldCartsModal() {
      this.isHeldCartsModalVisible = true;
    },
    hideHeldCartsModal() {
      this.isHeldCartsModalVisible = false;
    },
    setGlobalLoadingMessage(message) {
      this.globalLoadingMessage = message;
    },
    clearGlobalLoadingMessage() {
      this.globalLoadingMessage = null;
    },
  },
});
