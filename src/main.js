// main.js - Main application entry point, event listeners, and coordination

// --- Global State (simple version) ---
// More complex state management could be used for larger apps (e.g., Redux, Zustand)
// window.currentPOSProfile is set in ui.js after loading from DB or pos_logic.js
// window.currentCompanySettings is set in ui.js after loading from DB or pos_logic.js

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("POS Application Started");

    // Load sync configuration from localStorage (if any)
    window.loadSyncConfig(); // from sync.js
    const savedConfig = JSON.parse(localStorage.getItem("syncConfig") || "{}");
    document.getElementById('erpnextUrl').value = savedConfig.baseUrl || '';
    document.getElementById('posProfileName').value = savedConfig.profileName || '';
    document.getElementById('companyName').value = savedConfig.companyName || '';


    // --- Sync Controls ---
    const configureSyncBtn = document.getElementById('configureSyncBtn');
    const syncDataBtn = document.getElementById('syncDataBtn');

    if (configureSyncBtn) {
        configureSyncBtn.addEventListener('click', () => {
            const baseUrl = document.getElementById('erpnextUrl').value.trim();
            const profileName = document.getElementById('posProfileName').value.trim();
            const companyName = document.getElementById('companyName').value.trim();
            if (baseUrl && profileName && companyName) {
                window.configureSync(baseUrl, profileName, companyName); // from sync.js
                alert("Configuration saved! You can now sync initial data.");
            } else {
                alert("Please fill in all configuration fields.");
            }
        });
    }

    if (syncDataBtn) {
        syncDataBtn.addEventListener('click', async () => {
            const success = await window.fetchInitialData(); // from sync.js
            if (success) {
                // After successful sync, initialize POS logic which loads profile etc.
                await window.posLogic.initializePOSLogic();
                // And refresh relevant UI parts
                await window.ui.displayItems();
                await window.ui.displayPaymentModes();
                // Potentially load default customer from POS profile into UI
                const currentPOS = window.posLogic.getCurrentPOSProfile();
                if (currentPOS && currentPOS.customer) {
                    const cust = await getCustomerByName(currentPOS.customer); // from db.js
                    if (cust) window.ui.selectCustomer(cust);
                }
            }
        });
    }

    // --- Item Search ---
    const itemSearchInput = document.getElementById('itemSearch');
    if (itemSearchInput) {
        itemSearchInput.addEventListener('input', (e) => {
            window.ui.displayItems(e.target.value);
        });
    }

    // --- Customer Search ---
    const customerSearchInput = document.getElementById('customerSearch');
    if (customerSearchInput) {
        customerSearchInput.addEventListener('input', (e) => {
            window.ui.displayCustomerSuggestions(e.target.value);
        });
        // Add a blur event to hide suggestions if nothing is clicked, with a small delay
        customerSearchInput.addEventListener('blur', () => {
            setTimeout(() => {
                const customerListDiv = document.getElementById('customerList');
                if (customerListDiv && !customerListDiv.matches(':hover')) { // Hide if not hovering over suggestions
                    customerListDiv.style.display = 'none';
                }
            }, 200);
        });
    }
    
    // --- Cart Controls (event delegation for dynamically added items handled in displayCart) ---
    // Event listeners for qty change and remove buttons are added in ui.js/displayCart

    // --- Payment Controls ---
    const addPaymentBtn = document.getElementById('addPaymentBtn');
    if (addPaymentBtn) {
        addPaymentBtn.addEventListener('click', () => {
            const mode = document.getElementById('paymentMode').value;
            const amount = parseFloat(document.getElementById('paymentAmount').value);
            if (window.posLogic.addPayment(mode, amount)) {
                document.getElementById('paymentAmount').value = ''; // Clear amount after adding
            }
        });
    }

    // --- Sale Finalization ---
    const completeSaleBtn = document.getElementById('completeSaleBtn');
    if (completeSaleBtn) {
        completeSaleBtn.addEventListener('click', async () => {
            await window.posLogic.completeSale();
        });
    }

    const clearCartBtn = document.getElementById('clearCartBtn');
    if(clearCartBtn) {
        clearCartBtn.addEventListener('click', () => {
            window.cart.clearCart();
            window.posLogic.clearPayments(); // Also clear payments
            window.ui.clearSelectedCustomer(); // Reset customer to default
        });
    }


    // --- Initial Load ---
    // Try to initialize POS logic which loads profile, company settings, etc. from local DB
    // This allows app to function offline if data exists
    await window.posLogic.initializePOSLogic(); 
    await window.ui.displayItems(); // Display initial set of items (e.g., first 100 or based on empty search)
    // window.ui.displayCart(); // Cart is initially empty, displayCart is called by cart functions
    window.ui.displayPaymentModes(); // Load payment modes into dropdown

    console.log("POS UI Initialized and event listeners attached.");
});

// --- Global handlers (if any) ---
// Example: Click outside customer dropdown to close it
document.addEventListener('click', function(event) {
    const customerListDiv = document.getElementById('customerList');
    const customerSearchInput = document.getElementById('customerSearch');
    if (customerListDiv && customerSearchInput) {
        const isClickInsideSearch = customerSearchInput.contains(event.target);
        const isClickInsideList = customerListDiv.contains(event.target);
        if (!isClickInsideSearch && !isClickInsideList) {
            customerListDiv.style.display = 'none';
        }
    }
});


// --- Item Selection Handler (called from ui.js) ---
// This function is called when an item card is clicked in ui.js
async function handleItemSelection(item) {
    console.log("Item selected:", item.item_code);
    // Check stock (informational for now)
    if (item.is_stock_item) {
        const currentPOS = window.posLogic.getCurrentPOSProfile();
        if (currentPOS && currentPOS.warehouse) {
            const stockInfo = await getStockLevel(item.item_code, currentPOS.warehouse); // from db.js
            if (stockInfo) {
                console.log(`Stock for ${item.item_code} in ${currentPOS.warehouse}: ${stockInfo.actual_qty}`);
                if (stockInfo.actual_qty <= 0) {
                    // Could show a more prominent warning or prevent adding if strict
                    alert(`Warning: Item ${item.item_name} has low/no stock (${stockInfo.actual_qty}).`);
                }
            } else {
                console.warn(`Stock info not found for ${item.item_code} in ${currentPOS.warehouse}.`);
            }
        } else {
            console.warn("POS Profile warehouse not set, cannot check stock.");
        }
    }
    window.cart.addItemToCart(item, 1); // Add 1 unit by default
}

// --- Cart Item Quantity Update Handler ---
function handleUpdateCartItemQuantity(itemCode, newQuantity) {
    window.cart.updateCartItemQuantity(itemCode, newQuantity);
}

// --- Remove Item From Cart Handler ---
function handleRemoveItemFromCart(itemCode) {
    window.cart.removeItemFromCart(itemCode);
}

// Make these handlers globally accessible if called directly from HTML attributes (not recommended)
// or ensure ui.js calls them appropriately.
// For this setup, ui.js will attach event listeners that call these.
