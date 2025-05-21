// pos_logic.js - Handles core Point of Sale operations, payments, and transaction finalization

// --- State ---
let currentSelectedCustomer = { name: "Walk-in", customer_name: "Walk-in", default_price_list: null };
let currentPOSProfile = null; // Will be loaded from IndexedDB after sync
let currentCompanySettings = { allow_negative_stock: 0 }; // Default to not allowing, will be loaded from IndexedDB
let currentAppliedPayments = []; // { mode_of_payment, amount, account (optional) }

// --- Initialization ---
async function initializePOSLogic() {
    // Load POS Profile (assuming only one is synced for now, or a selection mechanism exists)
    try {
        const profiles = await db.pos_profiles.toArray();
        if (profiles && profiles.length > 0) {
            currentPOSProfile = profiles[0]; // Use the first available profile
            console.log("Active POS Profile:", currentPOSProfile);
            // Set the default customer from POS profile if available and no customer selected
            if (currentPOSProfile.customer && currentSelectedCustomer.name === "Walk-in") {
                const defaultCust = await getCustomerByName(currentPOSProfile.customer); // from db.js
                if (defaultCust) {
                    setCurrentCustomer(defaultCust); // This calls window.cart.setCartCustomer
                    // Update UI (handled by main.js or direct ui calls if preferred)
                    if (document.getElementById('selectedCustomerName')) {
                         document.getElementById('selectedCustomerName').textContent = `${defaultCust.customer_name} (${defaultCust.name})`;
                         document.getElementById('selectedCustomer').value = defaultCust.name;
                    }
                }
            } else {
                 // Ensure cart customer is set even if no default customer or already selected
                 window.cart.setCartCustomer(currentSelectedCustomer);
            }
        } else {
            console.warn("No POS Profile found in local DB. Sync data first.");
        }
    } catch (e) {
        console.error("Error initializing POS Profile:", e);
    }
    
    try {
        const companies = await db.company_settings.toArray();
        if (companies && companies.length > 0) {
            currentCompanySettings = companies[0]; // Expecting only one company settings doc
            console.log("Active Company Settings:", currentCompanySettings);
            // Ensure allow_negative_stock is a boolean or number for checks
            currentCompanySettings.allow_negative_stock = !!parseInt(currentCompanySettings.allow_negative_stock || 0);
        } else {
            console.warn("No Company Settings found in local DB. Sync data first.");
            // Default already set: currentCompanySettings = { allow_negative_stock: 0 };
        }
    } catch (e) {
         console.error("Error initializing Company Settings:", e);
    }
    
    // These should be called after settings might have changed customer/pricing
    window.cart.recalculateCartPrices(); 
    window.ui.displayPaymentModes(); // Populate payment modes dropdown
    window.ui.displayCart(); // Refresh cart
}

// --- Customer Management ---
function setCurrentCustomer(customer) {
    currentSelectedCustomer = customer || { name: "Walk-in", customer_name: "Walk-in", default_price_list: null };
    window.cart.setCartCustomer(currentSelectedCustomer); // Update cart's customer context
    console.log("Customer set to:", currentSelectedCustomer.name);
}

function getCurrentCustomer() {
    return currentSelectedCustomer;
}

// --- Payment Handling ---
function addPayment(mode_of_payment, amount) {
    if (!mode_of_payment || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        alert("Please select a valid payment mode and enter a positive amount.");
        return false;
    }
    currentAppliedPayments.push({
        mode_of_payment: mode_of_payment,
        amount: parseFloat(amount)
        // TODO: Add account derivation logic if needed from payment_modes store for the transaction object
    });
    window.ui.displayAppliedPayments();
    return true;
}

function clearPayments() {
    currentAppliedPayments = [];
    window.ui.displayAppliedPayments();
}

function getCurrentPayments() {
    return [...currentAppliedPayments];
}

function getTotalPaidAmount() {
    return currentAppliedPayments.reduce((sum, p) => sum + p.amount, 0);
}


// --- Transaction Finalization (Offline Sale) ---
async function completeSale() {
    const cartItems = window.cart.getCartItems();
    if (cartItems.length === 0) {
        alert("Cart is empty. Add items to complete sale.");
        return;
    }

    if (!currentPOSProfile || !currentPOSProfile.name) {
        alert("POS Profile not loaded. Please sync data or check configuration.");
        return;
    }
    if (!currentCompanySettings || currentCompanySettings.name === undefined) { // Check if name exists, as it's a key field
        alert("Company Settings not loaded correctly. Please sync data or check configuration.");
        return;
    }

    const totals = window.cart.getCartTotals();
    const totalPaid = getTotalPaidAmount();

    if (totalPaid < totals.grandTotal) {
        alert(`Payment insufficient. Amount due: ${(totals.grandTotal - totalPaid).toFixed(2)}`);
        return;
    }
    
    const transactionDate = new Date().toISOString();
    const offlineTxId = `OFFLINE-${currentPOSProfile.name}-${Date.now()}`;

    // Prepare items for transaction
    const transactionItems = cartItems.map(item => ({
        item_code: item.item_code,
        item_name: item.item_name, 
        qty: item.qty,
        rate: item.rate,
        amount: item.amount,
        uom: item.uom || item.stock_uom, // Use specific UOM if set, else stock_uom
        conversion_factor: item.conversion_factor || 1,
        warehouse: item.warehouse || currentPOSProfile.warehouse, // Item specific warehouse or POS default
        serial_no: item.serial_no, // Assuming cart item might have these
        batch_no: item.batch_no,   // Assuming cart item might have these
        income_account: item.income_account || (await getItemByCode(item.item_code))?.income_account || currentPOSProfile.income_account || currentCompanySettings.default_income_account,
        cost_center: item.cost_center || (await getItemByCode(item.item_code))?.cost_center || currentPOSProfile.cost_center || currentCompanySettings.default_cost_center,
        // Ensure all relevant fields for backend are included
    }));

    // Prepare payments for transaction
    const transactionPayments = currentAppliedPayments.map(p => ({
        mode_of_payment: p.mode_of_payment,
        amount: p.amount,
        // TODO: Derive account from payment_modes store based on mode_of_payment and company
        // account: derived_account_for_mop
    }));


    const transactionData = {
        offline_id: offlineTxId,
        pos_profile: currentPOSProfile.name,
        company: currentCompanySettings.name, // Assuming company name is the key for company_settings
        customer: currentSelectedCustomer.name,
        posting_date: transactionDate.split('T')[0], // YYYY-MM-DD
        posting_time: transactionDate.split('T')[1].substring(0, 8), // HH:MM:SS
        
        items: transactionItems,
        payments: transactionPayments,
        
        // Totals (as calculated by cart, backend will recalculate but good for reference)
        subtotal: totals.subtotal,
        grand_total: totals.grandTotal,
        total_taxes_and_charges: totals.taxes, // Simplified tax
        paid_amount: totalPaid,
        change_amount: totalPaid - totals.grandTotal,

        // Other fields expected by backend POS Invoice / Sales Invoice
        currency: currentPOSProfile.currency || currentCompanySettings.default_currency,
        conversion_rate: 1.0, // Assuming base currency for now
        selling_price_list: currentPOSProfile.selling_price_list,
        // set_warehouse: currentPOSProfile.warehouse, // This is usually for items, already set per item if needed
        update_stock: currentPOSProfile.update_stock !== undefined ? currentPOSProfile.update_stock : 1, // Default to update stock
        // ignore_pricing_rule: 0, // Default
        // taxes_and_charges_template: null, // If a specific template is used

        sync_status: 'pending',
        transaction_date: transactionDate,
        // local_stock_issue: false, // Default this flag
    };

    // Flag transaction if local stock check indicates issues (and server doesn't allow negative stock)
    // This check is against the frontend's understanding of 'allow_negative_stock' from company_settings
    if (!currentCompanySettings.allow_negative_stock) {
        for (const cart_item of cartItems) {
            if (cart_item.is_stock_item) {
                const item_warehouse = cart_item.warehouse || currentPOSProfile.warehouse;
                const stock_level_doc = await getStockLevel(cart_item.item_code, item_warehouse); // from db.js
                const local_actual_qty = stock_level_doc ? stock_level_doc.actual_qty : 0;
                
                // Calculate quantity in stock UOM for comparison
                let requested_qty_in_stock_uom = cart_item.qty;
                if (cart_item.uom !== cart_item.stock_uom && cart_item.conversion_factor) {
                    requested_qty_in_stock_uom = flt(cart_item.qty) * flt(cart_item.conversion_factor);
                }

                if (flt(requested_qty_in_stock_uom) > flt(local_actual_qty)) {
                    transactionData.local_stock_issue = true;
                    console.warn(`Transaction ${offlineTxId} flagged for local stock issue on item ${cart_item.item_code}. Local Qty: ${local_actual_qty}, Requested (Stock UOM): ${requested_qty_in_stock_uom}`);
                    break; // One warning is enough
                }
            }
        }
    }


    try {
        const savedTxId = await saveOfflineTransaction(transactionData); // from db.js
        console.log("Sale completed offline. Transaction ID (Dexie):", savedTxId, "Offline Ref:", offlineTxId);
        alert(`Sale completed! Offline ID: ${offlineTxId}. This transaction is pending sync.${transactionData.local_stock_issue ? ' (Note: Potential local stock issue was detected)' : ''}`);

        // Clear cart and payments for new transaction
        window.cart.clearCart();
        clearPayments();
        // Reset customer to default or POS profile default?
        // For now, let's reset to POS profile default if available
        if (currentPOSProfile && currentPOSProfile.customer) {
            const defaultCust = await getCustomerByName(currentPOSProfile.customer);
            if (defaultCust) window.ui.selectCustomer(defaultCust);
            else window.ui.clearSelectedCustomer();
        } else {
            window.ui.clearSelectedCustomer();
        }
        
        window.ui.displayCart(); // Refresh UI

    } catch (error) {
        console.error("Error saving offline transaction:", error);
        alert(`Error saving transaction locally: ${error.message}`);
    }
}


// Expose functions globally
window.posLogic = {
    initializePOSLogic,
    setCurrentCustomer,
    getCurrentCustomer,
    addPayment,
    clearPayments,
    getCurrentPayments,
    getTotalPaidAmount,
    completeSale,
    // Getter for current POS Profile and Company Settings if needed by other modules
    getCurrentPOSProfile: () => currentPOSProfile,
    getCurrentCompanySettings: () => currentCompanySettings,
};
