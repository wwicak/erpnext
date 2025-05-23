import * as sqliteDB from '../sqlite_db.js';

// pos_logic.js - Handles core Point of Sale operations, payments, and transaction finalization

// --- State ---
let currentSelectedCustomer = { name: "Walk-in", customer_name: "Walk-in", default_price_list: null }; // Default customer
let currentPOSProfile = null; 
let currentCompanySettings = { allow_negative_stock: 0, pos_walk_in_customer: "Walk-in" }; // Defaults
let currentAppliedPayments = []; 

// User session state
let currentUser = null; // { user_id, full_name, csrf_token }
let currentLoginPOSProfileName = null; // The POS Profile name used at login

// --- Initialization ---
async function initializePOSLogic(loggedInUser, loggedInPOSProfile) {
    if (!loggedInUser || !loggedInPOSProfile) {
        console.log("POS Logic: Not logged in, skipping full initialization.");
        // Clear any sensitive data if needed, or rely on UI to block operations
        currentUser = null;
        currentLoginPOSProfileName = null;
        currentPOSProfile = null; // Clear POS profile if not logged in
        // UI should reflect this (e.g., show login screen)
        return false;
    }

    currentUser = loggedInUser;
    currentLoginPOSProfileName = loggedInPOSProfile; // Store the POS Profile used for login
    
    // Update global sync variables based on login
    // Assumes the company is linked to the POS Profile.
    // For now, we'll rely on the user to also set company via sync config if it's different or needed.
    // Or, better, get_initial_pos_data should return the company of the POS Profile.
    // window.sync.configureSyncSettings(ERPNEXT_API_BASE_URL, currentLoginPOSProfileName, COMPANY_NAME_FOR_SYNC);


    console.log(`POS Logic Initializing for User: ${currentUser.full_name}, POS Profile: ${currentLoginPOSProfileName}`);

    try {
        // Fetch the specific POS Profile document used at login
        const profileDoc = await sqliteDB.getPOSProfile(currentLoginPOSProfileName);
        if (profileDoc) {
            currentPOSProfile = profileDoc;
            console.log("Active POS Profile data loaded:", currentPOSProfile);

            // Set default customer from this POS Profile, or global walk-in
            const globalWalkIn = currentCompanySettings?.pos_walk_in_customer; // Loaded below
            const profileDefaultCustomer = currentPOSProfile.customer;
            const customerToSet = profileDefaultCustomer || globalWalkIn || "Walk-in";
            
            if (customerToSet !== "Walk-in") {
                const custDetails = await sqliteDB.getCustomerByName(customerToSet);
                if (custDetails) {
                    setCurrentCustomer(custDetails);
                    if (document.getElementById('activeCustomerName')) document.getElementById('activeCustomerName').textContent = `${custDetails.customer_name} (${custDetails.name})`;
                } else {
                    setCurrentCustomer({ name: customerToSet, customer_name: customerToSet }); // Fallback if not in DB
                    if (document.getElementById('activeCustomerName')) document.getElementById('activeCustomerName').textContent = customerToSet;
                }
            } else {
                 setCurrentCustomer({ name: "Walk-in", customer_name: "Walk-in", default_price_list: null });
                 if (document.getElementById('activeCustomerName')) document.getElementById('activeCustomerName').textContent = "Walk-in Customer";
            }

        } else {
            console.warn(`POS Profile '${currentLoginPOSProfileName}' not found in local DB. Sync might be needed or config error.`);
            alert(`Error: POS Profile '${currentLoginPOSProfileName}' data not found locally. Please ensure initial sync is complete for this profile.`);
            // Potentially trigger logout or prevent further operations
            return false; 
        }
    } catch (e) {
        console.error("Error initializing POS Profile details:", e);
        return false;
    }
    
    try {
        // sqliteDB.getCompanySettings() is expected to return a single object or null
        // Assuming 'default_settings' is the key if multiple settings rows could exist,
        // or that it fetches the specific one needed.
        // If it always returns one company's settings, no parameter might be needed.
        const companySetting = await sqliteDB.getCompanySettings(); // Adjust if a key like "default_settings" is needed
        if (companySetting) {
            currentCompanySettings = companySetting;
            console.log("Active Company Settings:", currentCompanySettings);
            currentCompanySettings.allow_negative_stock = !!parseInt(currentCompanySettings.allow_negative_stock || 0);
            currentCompanySettings.pos_walk_in_customer = currentCompanySettings.pos_walk_in_customer || "Walk-in";
        } else {
            console.warn("No Company Settings found in local DB. Using defaults.");
        }
    } catch (e) {
         console.error("Error initializing Company Settings:", e);
         // Keep default settings
    }
    
    // Update UI elements that depend on these settings
    if (document.getElementById('activePOSProfile')) document.getElementById('activePOSProfile').textContent = currentLoginPOSProfileName;
    if (document.getElementById('loggedInUserName')) document.getElementById('loggedInUserName').textContent = currentUser.full_name;
    
    window.cart.recalculateCartPrices(); 
    window.ui.displayPaymentModes(); 
    window.ui.displayCart();
    return true;
}

function logout() {
    currentUser = null;
    currentLoginPOSProfileName = null;
    currentPOSProfile = null;
    currentCompanySettings = { allow_negative_stock: 0, pos_walk_in_customer: "Walk-in" }; // Reset
    
    // Clear sensitive stored data - for now, mostly in-memory state handled by reset above
    // localStorage.removeItem('userSession'); // If we were storing session token there
    
    window.cart.clearCart();
    window.posLogic.clearPayments();
    
    console.log("User logged out.");
    // UI transition handled by main.js
}


// --- Customer Management ---
function setCurrentCustomer(customer) {
    currentSelectedCustomer = customer || { name: currentCompanySettings.pos_walk_in_customer || "Walk-in", customer_name: "Walk-in Customer", default_price_list: null };
    window.cart.setCartCustomer(currentSelectedCustomer); 
    console.log("Customer set to:", currentSelectedCustomer.name);
    if(document.getElementById('activeCustomerName')) {
        document.getElementById('activeCustomerName').textContent = currentSelectedCustomer.customer_name || currentSelectedCustomer.name;
    }
}

function getCurrentCustomer() {
    // If currentSelectedCustomer is still the generic walk-in, try to get the ID from settings
    if (currentSelectedCustomer.name === "Walk-in" && currentCompanySettings.pos_walk_in_customer) {
        return { name: currentCompanySettings.pos_walk_in_customer, customer_name: "Walk-in Customer" };
    }
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
    if (!currentUser || !currentPOSProfile) {
        alert("User not logged in or POS Profile not loaded. Cannot complete sale.");
        return;
    }

    const cartItems = window.cart.getCartItems();
    if (cartItems.length === 0) {
        alert("Cart is empty. Add items to complete sale.");
        return;
    }

    if (!currentCompanySettings || currentCompanySettings.name === undefined) {
        alert("Company Settings not loaded correctly. Please sync data or check configuration.");
        return;
    }

    const totals = window.cart.getCartTotals();
    const totalPaid = getTotalPaidAmount();

    if (totalPaid < totals.grandTotal && totals.grandTotal > 0) { // Allow zero total for free items if any
        alert(`Payment insufficient. Amount due: ${(totals.grandTotal - totalPaid).toFixed(2)}`);
        return;
    }
    
    const transactionDate = new Date().toISOString();
    const offlineTxId = `OFFLINE-${currentLoginPOSProfileName.replace(/\s+/g, '-')}-${Date.now()}`;

    // Prepare items for transaction
    const transactionItems = await Promise.all(cartItems.map(async item => {
        const itemFullData = await sqliteDB.getItemByCode(item.item_code); // Fetch full item for defaults
        return {
            item_code: item.item_code,
            item_name: item.item_name, 
            qty: item.qty,
            rate: item.rate,
            amount: item.amount,
            uom: item.uom || itemFullData?.stock_uom,
            conversion_factor: item.conversion_factor || 1,
            warehouse: item.warehouse || currentPOSProfile.warehouse, 
            serial_no: item.serial_no, 
            batch_no: item.batch_no,   
            income_account: item.income_account || itemFullData?.income_account || currentPOSProfile.income_account || currentCompanySettings.default_income_account,
            cost_center: item.cost_center || itemFullData?.cost_center || currentPOSProfile.cost_center || currentCompanySettings.default_cost_center,
        };
    }));

    const transactionPayments = currentAppliedPayments.map(p => ({
        mode_of_payment: p.mode_of_payment,
        amount: p.amount,
    }));

    const finalCustomer = getCurrentCustomer(); // Get the potentially defaulted customer ID

    const transactionData = {
        name: offlineTxId, // Use this as the temporary name for referencing in results
        offline_id: offlineTxId,
        pos_profile: currentLoginPOSProfileName,
        company: currentCompanySettings.name, 
        customer: finalCustomer.name, // Use the ID
        posting_date: transactionDate.split('T')[0], 
        posting_time: transactionDate.split('T')[1].substring(0, 8), 
        items: transactionItems,
        payments: transactionPayments,
        subtotal: totals.subtotal,
        grand_total: totals.grandTotal,
        total_taxes_and_charges: totals.taxes,
        paid_amount: totalPaid,
        change_amount: Math.max(0, totalPaid - totals.grandTotal), // Ensure change is not negative
        currency: currentPOSProfile.currency || currentCompanySettings.default_currency,
        conversion_rate: 1.0, 
        selling_price_list: currentPOSProfile.selling_price_list,
        update_stock: currentPOSProfile.update_stock !== undefined ? currentPOSProfile.update_stock : 1, 
        offline_pos_name: offlineTxId,
        sync_status: 'pending',
        transaction_date: transactionDate,
        local_stock_issue: false, 
    };

    if (!currentCompanySettings.allow_negative_stock) {
        for (const cart_item of cartItems) {
            if (cart_item.is_stock_item) {
                const item_warehouse = cart_item.warehouse || currentPOSProfile.warehouse;
                const stock_level_doc = await sqliteDB.getStockLevel(cart_item.item_code, item_warehouse);
                const local_actual_qty = stock_level_doc ? stock_level_doc.actual_qty : 0;
                
                let requested_qty_in_stock_uom = cart_item.qty;
                if (cart_item.uom !== cart_item.stock_uom && cart_item.conversion_factor) {
                    requested_qty_in_stock_uom = parseFloat(cart_item.qty) * parseFloat(cart_item.conversion_factor);
                }

                if (parseFloat(requested_qty_in_stock_uom) > parseFloat(local_actual_qty)) {
                    transactionData.local_stock_issue = true;
                    console.warn(`Transaction ${offlineTxId} flagged for local stock issue on item ${cart_item.item_code}. Local Qty: ${local_actual_qty}, Requested (Stock UOM): ${requested_qty_in_stock_uom}`);
                    break; 
                }
            }
        }
    }

    try {
        const savedTxId = await sqliteDB.saveOfflineTransaction(transactionData); 
        console.log("Sale completed offline. Transaction ID (SQLite lastInsertId):", savedTxId, "Offline Ref:", offlineTxId);
        alert(`Sale completed! Offline ID: ${offlineTxId}. This transaction is pending sync.${transactionData.local_stock_issue ? ' (Note: Potential local stock issue was detected)' : ''}`);

        window.cart.clearCart();
        clearPayments();
        
        // Reset customer to default (Walk-in or POS profile default)
        const globalWalkInId = currentCompanySettings.pos_walk_in_customer;
        const profileDefaultId = currentPOSProfile.customer;
        const customerToSetAfterSale = profileDefaultId || globalWalkInId || "Walk-in";

        if (customerToSetAfterSale !== "Walk-in") {
            const custDetails = await sqliteDB.getCustomerByName(customerToSetAfterSale);
            if (custDetails) window.ui.selectCustomer(custDetails); // This will also update activeCustomerName
            else window.ui.clearSelectedCustomer(); // Fallback
        } else {
            window.ui.clearSelectedCustomer();
        }
        
        window.ui.displayCart(); 

    } catch (error) {
        console.error("Error saving offline transaction:", error);
        alert(`Error saving transaction locally: ${error.message}`);
    }
}


window.posLogic = {
    initializePOSLogic,
    logout,
    setCurrentCustomer,
    getCurrentCustomer,
    addPayment,
    clearPayments,
    getCurrentPayments,
    getTotalPaidAmount,
    completeSale,
    getCurrentPOSProfile: () => currentPOSProfile,
    getCurrentCompanySettings: () => currentCompanySettings,
    getCurrentUser: () => currentUser,
    getCurrentLoginPOSProfileName: () => currentLoginPOSProfileName,
    handleBarcodeScan, 
    fetchPriceCheckInfo,
    holdCurrentCart,    // Exposed for main.js
    resumeCart          // Exposed for main.js
};

// --- Hold & Resume Cart Logic ---
async function holdCurrentCart() {
    if (!currentUser) {
        alert("Please login to hold a cart.");
        return false;
    }
    const itemsToHold = window.cart.getCartItems();
    if (itemsToHold.length === 0) {
        alert("Cart is empty. Nothing to hold.");
        return false;
    }

    const cartTotals = window.cart.getCartTotals();
    const customer = getCurrentCustomer(); // Get current customer
    const payments = getCurrentPayments(); // Get current (likely empty if holding before payment) payments

    const cartDataToHold = {
        items: itemsToHold,
        customer: customer, // Store customer associated with the cart
        totals: cartTotals,
        payments: payments, // Store any partial payments
        // Add any other relevant cart state if needed
    };

    try {
        // Ask for an optional name for the held cart
        const holdName = prompt("Optional: Enter a name for this held cart (e.g., customer name, order number):");

        await sqliteDB.saveHeldCart(cartDataToHold, holdName || null);
        window.cart.clearCart();
        clearPayments(); // Also clear any applied payments from UI
        // Reset customer to default after holding
        const companySettings = getCurrentCompanySettings();
        const currentPOSProfile = getCurrentPOSProfile();
        const globalWalkInId = companySettings?.pos_walk_in_customer;
        const profileDefaultId = currentPOSProfile?.customer;
        const customerToSetAfterHold = profileDefaultId || globalWalkInId || "Walk-in";

        if (customerToSetAfterHold !== "Walk-in") {
            const custDetails = await sqliteDB.getCustomerByName(customerToSetAfterHold);
            if (custDetails) {
                setCurrentCustomer(custDetails); 
                window.ui.displayActiveCustomerName(custDetails); 
            } else {  window.ui.clearSelectedCustomer();  }
        } else {
            window.ui.clearSelectedCustomer();
        }

        alert("Cart has been put on hold.");
        window.ui.displayCart(); // Refresh cart display (should be empty)
        window.ui.displayAppliedPayments();
        return true;
    } catch (error) {
        console.error("Error holding cart:", error);
        alert("Failed to hold cart. See console for details.");
        return false;
    }
}

async function resumeCart(heldCartId) {
    if (!currentUser) {
        alert("Please login to resume a cart.");
        return false;
    }

    const currentCartItems = window.cart.getCartItems();
    if (currentCartItems.length > 0) {
        if (!confirm("Current cart is not empty. Discard it and resume selected cart?")) {
            return false;
        }
    }

    try {
        const heldCart = await sqliteDB.getHeldCart(heldCartId);
        if (!heldCart) {
            alert("Held cart not found.");
            return false;
        }

        window.cart.loadCart(heldCart.cart_data); // New function in cart.js
        // Restore customer
        if (heldCart.cart_data.customer) {
            setCurrentCustomer(heldCart.cart_data.customer); // This will update cart's customer context
            window.ui.displayActiveCustomerName(heldCart.cart_data.customer);
        } else {
            window.ui.clearSelectedCustomer();
        }
        // Restore payments (if any were held)
        clearPayments(); // Clear current payments first
        if (heldCart.cart_data.payments && heldCart.cart_data.payments.length > 0) {
            heldCart.cart_data.payments.forEach(p => addPayment(p.mode_of_payment, p.amount));
        } else {
            window.ui.displayAppliedPayments(); // Refresh payment display
        }


        await sqliteDB.deleteHeldCart(heldCartId);
        alert(`Cart "${heldCart.name}" resumed successfully.`);
        window.ui.displayCart(); // Refresh cart display
        window.ui.showHeldCartsModal(false); // Close the modal
        return true;
    } catch (error) {
        console.error("Error resuming cart:", error);
        alert("Failed to resume cart. See console for details.");
        return false;
    }
}


// --- Price Check Logic ---
async function fetchPriceCheckInfo(lookupValue) {
    if (!lookupValue || lookupValue.trim() === "") {
        return { success: false, message: "Please enter an item code, name, or scan a barcode." };
    }
    try {
        let item = await sqliteDB.getItemByBarcode(lookupValue.trim());
        if (!item) {
            // Try by item code
            item = await sqliteDB.getItemByCode(lookupValue.trim());
        }
        if (!item) {
            // Try by item name (might return multiple, take first for simplicity in price check)
            const itemsByName = await sqliteDB.searchItems(lookupValue.trim());
            if (itemsByName && itemsByName.length > 0) {
                item = itemsByName[0];
                 if (itemsByName.length > 1) {
                    console.warn(`Price Check: Multiple items found for name '${lookupValue}'. Displaying first: ${item.item_code}`);
                }
            }
        }

        if (!item) {
            return { success: false, item: null, message: `Item not found for: ${lookupValue}` };
        }

        // Determine price (similar to cart logic)
        let priceInfo = null;
        const customerForPriceCheck = getCurrentCustomer(); // Use current selected customer context for pricing
        const posProfileForPriceCheck = getCurrentPOSProfile();

        const targetPriceList = customerForPriceCheck?.default_price_list || posProfileForPriceCheck?.selling_price_list;

        if (targetPriceList) {
            priceInfo = await sqliteDB.getItemPrice(item.item_code, targetPriceList);
        }
        
        // If no specific price list rate, item.standard_rate (from item data itself) could be a fallback if populated
        // For price check, we primarily show the list price if available.

        return { success: true, item: item, priceInfo: priceInfo };

    } catch (error) {
        console.error("Error during price check:", error);
        return { success: false, message: "Error fetching item details." };
    }
}


// --- Barcode Scan Handler ---
async function handleBarcodeScan(barcode) {
    if (!currentUser) { // Ensure user is logged in
        console.warn("Barcode scan ignored: User not logged in.");
        return;
    }
    console.log("Barcode scanned:", barcode);
    try {
        const item = await sqliteDB.getItemByBarcode(barcode);
        if (item) {
            console.log("Item found by barcode:", item.item_code, item.item_name);
            // Add to cart or increment quantity
            // The cart.addItemToCart function should ideally handle incrementing if item exists.
            // For now, let's assume it does, or we can explicitly check.
            const existingCartItem = window.cart.getCartItems().find(ci => ci.item_code === item.item_code);
            if (existingCartItem) {
                await window.cart.updateCartItemQuantity(item.item_code, existingCartItem.qty + 1);
            } else {
                await window.cart.addItemToCart(item, 1);
            }
            // Optionally, provide feedback like highlighting the added/updated item in cart or item list
            // For example, clear search and redisplay items to show updated stock if that's a feature.
            if(document.getElementById('itemSearch')) document.getElementById('itemSearch').value = ''; // Clear search
            window.ui.displayCart(); // Ensure cart is re-rendered
            // Consider brief visual feedback, e.g., "Item added/updated via barcode"
            const syncStatusEl = document.getElementById('syncStatus');
            if(syncStatusEl) {
                syncStatusEl.textContent = `Item "${item.item_name}" added/updated via barcode.`;
                setTimeout(() => { syncStatusEl.textContent = ''; }, 3000);
            }

        } else {
            console.warn("Barcode not found in local DB:", barcode);
            // UI feedback
            const syncStatusEl = document.getElementById('syncStatus'); // Re-using syncStatus for general messages
            if(syncStatusEl) {
                syncStatusEl.textContent = `Barcode ${barcode} not found.`;
                setTimeout(() => { syncStatusEl.textContent = ''; }, 3000);
            }
            // Optionally, play a "not found" sound
        }
    } catch (error) {
        console.error("Error handling barcode scan:", error);
        const syncStatusEl = document.getElementById('syncStatus');
        if(syncStatusEl) {
            syncStatusEl.textContent = `Error processing barcode.`;
            setTimeout(() => { syncStatusEl.textContent = ''; }, 3000);
        }
    }
}
