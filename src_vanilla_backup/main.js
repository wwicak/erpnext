// main.js - Main application entry point, event listeners, and coordination

// --- Global State & Initial Setup ---
// currentPOSProfileName, currentUser are managed in pos_logic.js
// ERPNEXT_API_BASE_URL, POS_PROFILE_NAME_FOR_SYNC, COMPANY_NAME_FOR_SYNC are in sync.js

document.addEventListener('DOMContentLoaded', async () => {
    console.log("POS Application Initializing...");

    // Load any saved sync configurations (URL, last used company/profile for sync config UI)
    window.sync.loadSyncConfig(); 

    // Attempt to load any existing user session (e.g., from localStorage)
    // For now, we assume no persistent session across app restarts; user must always log in.
    // If persistent sessions were desired, this is where you'd check and potentially bypass login.
    
    setupLoginScreenListeners();
    setupMainPOSInterfaceListeners(); // Setup listeners for the main interface but it's hidden

    // Determine initial UI state
    // If we had a way to check for a valid, non-expired session token:
    // const validSession = await window.posLogic.checkUserSession(); 
    // if (validSession) {
    //     await window.posLogic.initializePOSLogic(validSession.user, validSession.posProfile);
    //     window.ui.showMainPOSInterface();
    //     window.ui.updateUserInfoDisplay(validSession.user.full_name, validSession.posProfile);
    //     // Potentially trigger background data updates if needed
    // } else {
    //     window.ui.showLoginScreen();
    // }
    // For now, always start with login screen:
    window.ui.showLoginScreen();

    console.log("POS Application Initialized. Please login.");
});


function setupLoginScreenListeners() {
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', handleLoginAttempt);
    }
    // Allow Enter key submission for password field
    const passwordInput = document.getElementById('password');
    if(passwordInput) {
        passwordInput.addEventListener('keypress', function(event) {
            if (event.key === "Enter") {
                event.preventDefault(); // Prevent default form submission if it were a form
                handleLoginAttempt();
            }
        });
    }
    const loginPosProfileInput = document.getElementById('loginPosProfile');
    if(loginPosProfileInput) {
        loginPosProfileInput.addEventListener('keypress', function(event) {
            if (event.key === "Enter") {
                event.preventDefault();
                handleLoginAttempt();
            }
        });
    }
}

async function handleLoginAttempt() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value; // No trim on password
    const loginPosProfile = document.getElementById('loginPosProfile').value.trim();

    if (!username || !password || !loginPosProfile) {
        window.ui.displayLoginError("Username, Password, and POS Profile are required.");
        return;
    }
    window.ui.displayLoginError(""); // Clear previous errors

    // Show some loading indicator if desired
    const loginBtn = document.getElementById('loginBtn');
    if(loginBtn) loginBtn.disabled = true; loginBtn.textContent = "Logging in...";

    const loginResult = await window.sync.loginToERPNext(username, password, loginPosProfile);

    if (loginBtn) loginBtn.disabled = false; loginBtn.textContent = "Login";

    if (loginResult.success) {
        console.log("Login successful for user:", loginResult.full_name);
        
        // Initialize POS logic with user and selected POS Profile
        const initSuccess = await window.posLogic.initializePOSLogic(
            { user_id: loginResult.user_id, full_name: loginResult.full_name, csrf_token: loginResult.csrf_token },
            loginPosProfile
        );

        if (!initSuccess) {
            // This might happen if the POS Profile data isn't found after sync (edge case)
            window.ui.displayLoginError("Login succeeded, but POS initialization failed. POS Profile data might be missing or corrupt. Try syncing initial data.");
            // Optionally, log out the user here or guide them
            return;
        }

        window.ui.showMainPOSInterface();
        window.ui.updateUserInfoDisplay(loginResult.full_name, loginPosProfile);

        // Automatically trigger initial data sync after login
        // The company name for sync needs to be derived or configured.
        // Assuming POS Profile doc (now in currentPOSProfile) has the company.
        const activePOSProfileData = window.posLogic.getCurrentPOSProfile();
        if (activePOSProfileData && activePOSProfileData.company) {
            // Configure sync settings based on successful login and POS Profile data
            const erpNextUrl = document.getElementById('erpnextUrl').value.trim() || localStorage.getItem("syncConfig")?.baseUrl; // Use existing if available
            window.sync.configureSyncSettings(erpNextUrl, loginPosProfile, activePOSProfileData.company);
            
            // Update UI fields for sync config to reflect what's being used
            if(document.getElementById('posProfileName')) document.getElementById('posProfileName').value = loginPosProfile;
            if(document.getElementById('companyName')) document.getElementById('companyName').value = activePOSProfileData.company;

            console.log("Triggering initial data sync for profile:", loginPosProfile, "Company:", activePOSProfileData.company);
            const syncSuccess = await window.sync.fetchInitialData(loginPosProfile, activePOSProfileData.company);
            if (syncSuccess) {
                await window.posLogic.initializePOSLogic( // Re-initialize to load fresh data like default customer
                     { user_id: loginResult.user_id, full_name: loginResult.full_name, csrf_token: loginResult.csrf_token },
                     loginPosProfile
                );
                await window.ui.displayItems();
                await window.ui.displayPaymentModes();
            } else {
                alert("Initial data sync failed after login. Some features might not work correctly. Please try syncing manually.");
            }
        } else {
            alert("POS Profile company information is missing. Cannot automatically configure and run initial sync. Please configure sync settings manually and sync data.");
            console.error("POS Profile company not found after login, cannot auto-sync.", activePOSProfileData);
        }

    } else {
        window.ui.displayLoginError(loginResult.message || "Login failed. Please check credentials and POS Profile.");
    }
}


function setupMainPOSInterfaceListeners() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            window.posLogic.logout(); // Clears user session state in pos_logic
            window.ui.showLoginScreen();
            window.ui.updateUserInfoDisplay(null, null); // Clear user display
            // Clear login form fields
            if(document.getElementById('username')) document.getElementById('username').value = '';
            if(document.getElementById('password')) document.getElementById('password').value = '';
            if(document.getElementById('loginPosProfile')) document.getElementById('loginPosProfile').value = '';
            console.log("User logged out, showing login screen.");
        });
    }

    // --- Sync Controls (within main POS interface) ---
    const configureSyncBtn = document.getElementById('configureSyncBtn');
    const syncDataBtn = document.getElementById('syncDataBtn');

    if (configureSyncBtn) {
        configureSyncBtn.addEventListener('click', () => {
            const baseUrl = document.getElementById('erpnextUrl').value.trim();
            const profileName = document.getElementById('posProfileName').value.trim(); // This is POS_PROFILE_NAME_FOR_SYNC
            const companyName = document.getElementById('companyName').value.trim();   // This is COMPANY_NAME_FOR_SYNC
            
            if (baseUrl && profileName && companyName) {
                window.sync.configureSyncSettings(baseUrl, profileName, companyName);
                alert("Sync configuration saved! This will be used for manual 'Sync Initial Data'.");
            } else {
                alert("Please fill in all sync configuration fields (URL, Profile for Sync, Company for Sync).");
            }
        });
    }

    if (syncDataBtn) {
        syncDataBtn.addEventListener('click', async () => {
            const profileToSync = document.getElementById('posProfileName').value.trim();
            const companyToSync = document.getElementById('companyName').value.trim();
            const erpNextUrl = document.getElementById('erpnextUrl').value.trim();

            if (!erpNextUrl || !profileToSync || !companyToSync) {
                 alert("ERPNext URL, POS Profile Name (for sync), and Company Name (for sync) must be set in the sync config area.");
                 return;
            }
            // Ensure global sync.js vars are set with these values before calling
            window.sync.configureSyncSettings(erpNextUrl, profileToSync, companyToSync);

            const success = await window.sync.fetchInitialData(profileToSync, companyToSync);
            if (success) {
                // Re-initialize POS logic if the synced profile is the one currently logged in with
                const loggedInProfile = window.posLogic.getCurrentLoginPOSProfileName();
                const currentUser = window.posLogic.getCurrentUser();
                if (loggedInProfile === profileToSync && currentUser) {
                    await window.posLogic.initializePOSLogic(currentUser, loggedInProfile);
                }
                await window.ui.displayItems();
                await window.ui.displayPaymentModes();
            }
        });
    }

    // --- Item Search ---
    const itemSearchInput = document.getElementById('itemSearch');
    if (itemSearchInput) {
        itemSearchInput.addEventListener('input', (e) => {
            window.ui.displayItems(e.target.value); // Live search
        });
        // Barcode handling will be separate
    }
    
    // --- Customer Search (Currently hidden/defaulted) ---
    // const customerSearchInput = document.getElementById('customerSearch');
    // if (customerSearchInput) { ... }

    // --- Cart Controls (event delegation for dynamically added items handled in ui.js/displayCart) ---
    
    // --- Payment Controls ---
    const addPaymentBtn = document.getElementById('addPaymentBtn');
    if (addPaymentBtn) {
        addPaymentBtn.addEventListener('click', () => {
            const mode = document.getElementById('paymentMode').value;
            const amount = parseFloat(document.getElementById('paymentAmount').value);
            if (window.posLogic.addPayment(mode, amount)) {
                document.getElementById('paymentAmount').value = ''; 
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
        clearCartBtn.addEventListener('click', async () => {
            window.cart.clearCart();
            window.posLogic.clearPayments(); 
            
            // Reset customer to default (Walk-in or POS profile default)
            const companySettings = window.posLogic.getCurrentCompanySettings();
            const currentPOSProfile = window.posLogic.getCurrentPOSProfile();
            const globalWalkInId = companySettings?.pos_walk_in_customer;
            const profileDefaultId = currentPOSProfile?.customer;
            const customerToSetAfterClear = profileDefaultId || globalWalkInId || "Walk-in";

            if (customerToSetAfterClear !== "Walk-in") {
                const custDetails = await db.customers.get(customerToSetAfterClear);
                if (custDetails) {
                    window.posLogic.setCurrentCustomer(custDetails); // This updates cart and pos_logic state
                    window.ui.displayActiveCustomerName(custDetails); // Update UI
                } else {
                    // Fallback if the ID isn't found in local DB (should be rare if synced)
                    const tempCust = {name: customerToSetAfterClear, customer_name: customerToSetAfterClear};
                    window.posLogic.setCurrentCustomer(tempCust);
                    window.ui.displayActiveCustomerName(tempCust);
                }
            } else {
                const walkIn = { name: "Walk-in", customer_name: "Walk-in Customer", default_price_list: null };
                window.posLogic.setCurrentCustomer(walkIn);
                window.ui.displayActiveCustomerName(walkIn);
            }
        });
    }

    // Placeholder for Price Check button listener (Phase 5)
    // Placeholder for Hold/Resume Cart button listeners (Phase 6)
    
    setupBarcodeListener(); // Initialize barcode listener
    setupPriceCheckListeners(); // Initialize Price Check listeners
    setupHoldResumeCartListeners(); // Initialize Hold/Resume Cart listeners
}

// --- Hold & Resume Cart Event Listeners ---
function setupHoldResumeCartListeners() {
    const holdCartBtn = document.getElementById('holdCartBtn');
    const viewResumeCartBtn = document.getElementById('viewResumeCartBtn');
    const closeHeldCartsModalBtn = document.getElementById('closeHeldCartsModal');

    if (holdCartBtn) {
        holdCartBtn.addEventListener('click', async () => {
            if (!window.posLogic.getCurrentUser()) { alert("Please login first."); return; }
            await window.posLogic.holdCurrentCart();
        });
    }

    if (viewResumeCartBtn) {
        viewResumeCartBtn.addEventListener('click', () => {
            if (!window.posLogic.getCurrentUser()) { alert("Please login first."); return; }
            window.ui.showHeldCartsModal(true); // This will call displayHeldCartsList from ui.js
        });
    }

    if (closeHeldCartsModalBtn) {
        closeHeldCartsModalBtn.addEventListener('click', () => window.ui.showHeldCartsModal(false));
    }
    // Event listeners for buttons inside the modal (resume, delete) will be set up by ui.js/displayHeldCartsList
}

// These handlers are called by event listeners set up in ui.js/displayHeldCartsList
async function handleResumeHeldCart(heldCartId) {
    if (!window.posLogic.getCurrentUser()) { alert("Please login first."); return; }
    console.log("Attempting to resume cart ID:", heldCartId);
    await window.posLogic.resumeCart(heldCartId);
}

async function handleDeleteHeldCart(heldCartId) {
    if (!window.posLogic.getCurrentUser()) { alert("Please login first."); return; }
    console.log("Attempting to delete held cart ID:", heldCartId);
    if (confirm("Are you sure you want to delete this held cart? This cannot be undone.")) {
        try {
            await deleteHeldCart(heldCartId); // from db.js
            alert("Held cart deleted successfully.");
            window.ui.displayHeldCartsList(); // Refresh the list in the modal
        } catch (error) {
            console.error("Error deleting held cart:", error);
            alert("Failed to delete held cart.");
        }
    }
}


// --- Price Check Event Listeners ---
function setupPriceCheckListeners() {
    const priceCheckBtn = document.getElementById('priceCheckBtn');
    const closePriceCheckModalBtn = document.getElementById('closePriceCheckModal');
    const priceCheckLookupBtn = document.getElementById('priceCheckLookupBtn');
    const priceCheckItemInput = document.getElementById('priceCheckItemInput');

    if (priceCheckBtn) {
        priceCheckBtn.addEventListener('click', () => window.ui.showPriceCheckModal(true));
    }
    if (closePriceCheckModalBtn) {
        closePriceCheckModalBtn.addEventListener('click', () => window.ui.showPriceCheckModal(false));
    }
    if (priceCheckLookupBtn) {
        priceCheckLookupBtn.addEventListener('click', doPriceCheck);
    }
    if (priceCheckItemInput) {
        priceCheckItemInput.addEventListener('keypress', (e) => {
            if (e.key === "Enter") {
                doPriceCheck();
            }
        });
        // Listen for barcode scans directly into this input if modal is open
        priceCheckItemInput.addEventListener('paste', (e) => { // Some scanners paste
            e.preventDefault();
            const pastedText = (e.clipboardData || window.clipboardData).getData('text');
            priceCheckItemInput.value = pastedText;
            doPriceCheck();
        });
    }
}

async function doPriceCheck() {
    const lookupValue = document.getElementById('priceCheckItemInput').value.trim();
    if (!lookupValue) {
        window.ui.displayPriceCheckResult(null, null, "Please enter an item code, name, or scan a barcode.");
        return;
    }
    const result = await window.posLogic.fetchPriceCheckInfo(lookupValue);
    window.ui.displayPriceCheckResult(result.item, result.priceInfo, result.message);
    document.getElementById('priceCheckItemInput').value = ''; // Clear input after search
    document.getElementById('priceCheckItemInput').focus(); // Keep focus for next scan/entry
}


// --- Barcode Scanner Input Handling ---
let barcodeBuffer = '';
let barcodeTimeout = null;
const BARCODE_TIMEOUT_DURATION = 200; // ms - adjust as needed. Time between keystrokes for them to be considered part of the same scan.

function setupBarcodeListener() {
    document.addEventListener('keydown', async (event) => {
        // Ignore keypresses if a modal is open, or if focus is on an input field where typing is expected
        if (document.querySelector('.modal[style*="display: block"]') || 
            (event.target.tagName === 'INPUT' && event.target.id !== 'itemSearch') || // Allow barcode scan into itemSearch
            event.target.tagName === 'TEXTAREA' || 
            event.target.isContentEditable) {
            // If focused on an input where we don't want global barcode scanning, reset buffer
            if (event.target.id !== 'itemSearch') { // Unless it's the item search, which can also take barcodes
                 barcodeBuffer = ''; 
            }
            return;
        }

        // Reset timeout on any keydown
        if (barcodeTimeout) {
            clearTimeout(barcodeTimeout);
        }
        barcodeTimeout = setTimeout(() => {
            barcodeBuffer = ''; // Clear buffer if no new input for a while
        }, BARCODE_TIMEOUT_DURATION);

        if (event.key === "Enter") {
            if (barcodeBuffer.trim().length > 0) {
                event.preventDefault(); // Prevent default Enter behavior if it was a barcode scan
                console.log("Enter detected, processing barcode buffer:", barcodeBuffer);
                await window.posLogic.handleBarcodeScan(barcodeBuffer.trim());
                barcodeBuffer = ''; // Clear buffer after processing
                clearTimeout(barcodeTimeout); // Clear timeout as well
            }
        } else if (event.key.length === 1) { // Append printable characters
            barcodeBuffer += event.key;
        }
        // console.log("Current barcode buffer:", barcodeBuffer); // For debugging
    });
    console.log("Global barcode listener initialized.");
}


// --- Global Item Selection Handler (called from ui.js) ---
async function handleItemSelection(itemData) { // itemData is the full item object from DB
    if (!window.posLogic.getCurrentUser()) {
        alert("Please login first.");
        return;
    }
    console.log("Item selected in main:", itemData.item_code);
    
    // Stock check (informational, as per previous implementation in main.js)
    if (itemData.is_stock_item) {
        const currentPOS = window.posLogic.getCurrentPOSProfile();
        const companySettings = window.posLogic.getCurrentCompanySettings();
        if (currentPOS && currentPOS.warehouse) {
            const stockInfo = await db.stock_levels.get({item_code: itemData.item_code, warehouse: currentPOS.warehouse});
            if (stockInfo) {
                console.log(`Local stock for ${itemData.item_code} in ${currentPOS.warehouse}: ${stockInfo.actual_qty}`);
                if (stockInfo.actual_qty <= 0 && !companySettings.allow_negative_stock) {
                    alert(`Warning: Item ${itemData.item_name} has zero or negative local stock (${stockInfo.actual_qty}). Adding to cart might fail during sync if server also disallows negative stock.`);
                }
            } else {
                console.warn(`Local stock info not found for ${itemData.item_code} in ${currentPOS.warehouse}. This might be okay if 'pos_show_stock_availability' is off or item is new.`);
            }
        }
    }
    window.cart.addItemToCart(itemData, 1); 
}

// --- Global Cart Item Quantity Update Handler ---
async function handleUpdateCartItemQuantity(itemCode, newQuantity) {
    if (!window.posLogic.getCurrentUser()) return;
    await window.cart.updateCartItemQuantity(itemCode, newQuantity); // Made async to await stock checks in cart.js
}

// --- Global Remove Item From Cart Handler ---
function handleRemoveItemFromCart(itemCode) {
    if (!window.posLogic.getCurrentUser()) return;
    window.cart.removeItemFromCart(itemCode);
}

// Other global handlers or initializers can go here.
// Barcode scanner listener will be added later.
