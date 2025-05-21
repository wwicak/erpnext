// --- Initial Data Synchronization ---
// Assumes db.js (and Dexie instance 'db', replaceAllData, replaceAllItems) is loaded

// Configuration
let ERPNEXT_API_BASE_URL = ""; 
let POS_PROFILE_NAME_FOR_SYNC = ""; // Used by fetchInitialData & getUpdatedMasterData
let COMPANY_NAME_FOR_SYNC = "";     // Used by fetchInitialData & getUpdatedMasterData
let CURRENT_LOGGED_IN_USER = null; // To store attendant_user_id for syncOfflineTransactions
let CURRENT_CSRF_TOKEN = null; // To store CSRF token if needed for future calls


// Function to set configuration (called from main.js or UI interaction)
function configureSyncSettings(baseUrl, profileName, companyName) {
    ERPNEXT_API_BASE_URL = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    POS_PROFILE_NAME_FOR_SYNC = profileName; // This is the POS Profile used for data fetching rules
    COMPANY_NAME_FOR_SYNC = companyName;
    console.log("Sync settings configured:", ERPNEXT_API_BASE_URL, POS_PROFILE_NAME_FOR_SYNC, COMPANY_NAME_FOR_SYNC);
    localStorage.setItem("syncConfig", JSON.stringify({baseUrl, profileName, companyName}));
}

// Load config from localStorage if available
function loadSyncConfig() {
    const savedConfig = localStorage.getItem("syncConfig");
    if (savedConfig) {
        const { baseUrl, profileName, companyName } = JSON.parse(savedConfig);
        // Note: These are general sync settings, not necessarily tied to the POS Profile used at login for data fetching.
        // The login POS Profile is passed directly to loginToERPNext.
        // POS_PROFILE_NAME_FOR_SYNC will be set by main.js after login if needed.
        ERPNEXT_API_BASE_URL = baseUrl || "";
        POS_PROFILE_NAME_FOR_SYNC = profileName || ""; // This might be redundant if login POS profile is the master
        COMPANY_NAME_FOR_SYNC = companyName || "";
        
        // Update UI fields if they exist
        if(document.getElementById('erpnextUrl')) document.getElementById('erpnextUrl').value = ERPNEXT_API_BASE_URL;
        if(document.getElementById('posProfileName')) document.getElementById('posProfileName').value = POS_PROFILE_NAME_FOR_SYNC;
        if(document.getElementById('companyName')) document.getElementById('companyName').value = COMPANY_NAME_FOR_SYNC;
    }
}

// --- Login Function ---
async function loginToERPNext(username, password, loginPosProfile) {
    if (!ERPNEXT_API_BASE_URL) {
        console.error("ERPNext API Base URL is not set.");
        return { success: false, message: "ERPNext API Base URL is not set." };
    }
    try {
        const response = await fetch(`${ERPNEXT_API_BASE_URL}/api/method/erpnext.pos_custom_api.pos_login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                usr: username, 
                pwd: password,
                pos_profile_name: loginPosProfile // Pass the POS Profile used for this login session
            })
        });

        const data = await response.json();

        if (!response.ok) {
            // data.error and data.error_title are expected from the backend on error
            return { success: false, message: data.error || `HTTP error ${response.status}`, title: data.error_title || "Login Failed" };
        }
        
        // On success, backend returns: user_id, full_name, session_csrf_token
        CURRENT_LOGGED_IN_USER = data.user_id; // Store for syncOfflineTransactions
        CURRENT_CSRF_TOKEN = data.session_csrf_token; // Store for future API calls if needed
        
        // Set the POS Profile and Company for data sync operations based on this successful login
        // This assumes the POS Profile used for login is the one we sync data FOR.
        // And that the Company can be derived or is known. For now, using the one from login form.
        // The company needs to be configured via configureSyncSettings or known.
        // For simplicity, fetchInitialData will use POS_PROFILE_NAME_FOR_SYNC and COMPANY_NAME_FOR_SYNC
        // which should be set based on the login POS profile and its company.
        console.log("Login successful:", data);
        return { success: true, user_id: data.user_id, full_name: data.full_name, csrf_token: data.session_csrf_token, message: data.message };

    } catch (error) {
        console.error("Error during login:", error);
        return { success: false, message: error.message || "Network error or server unreachable." , title: "Login Error"};
    }
}


async function fetchInitialData(profileToSync, companyToSync) {
    if (!ERPNEXT_API_BASE_URL || !profileToSync || !companyToSync) {
        const errorMsg = "Sync configuration (URL, Profile, Company for Sync) is not fully set.";
        console.error(errorMsg);
        alert(errorMsg);
        return false;
    }
    // Update global sync vars if different from login ones, or ensure they are set
    POS_PROFILE_NAME_FOR_SYNC = profileToSync;
    COMPANY_NAME_FOR_SYNC = companyToSync;


    const syncStatusElement = document.getElementById('syncStatus');
    if (syncStatusElement) syncStatusElement.textContent = "Syncing initial data...";
    console.log(`Starting initial data sync for POS Profile: ${POS_PROFILE_NAME_FOR_SYNC}, Company: ${COMPANY_NAME_FOR_SYNC}`);

    try {
        const response = await fetch(`${ERPNEXT_API_BASE_URL}/api/method/erpnext.pos_custom_api.get_initial_pos_data`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pos_profile_name: POS_PROFILE_NAME_FOR_SYNC,
                company: COMPANY_NAME_FOR_SYNC
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ _server_messages: JSON.stringify([{ message: response.statusText }]) }));
            let serverMessage = "Unknown server error";
            if (errorData._server_messages) { // Frappe often wraps errors here
                 try { serverMessage = JSON.parse(errorData._server_messages)[0].message; } catch(e){ serverMessage = errorData._server_messages; }
            } else if (errorData.message) {
                serverMessage = errorData.message;
            }
            throw new Error(`HTTP error! status: ${response.status}, message: ${serverMessage}`);
        }

        const data = await response.json();
        const message = data.message; 

        if (!message) {
            console.error("Received empty message from server.", data);
            throw new Error("Received empty or invalid data structure from server.");
        }
        
        console.log("Received data from server:", message);

        await window.replaceAllData('pos_profiles', message.pos_profile_settings ? [message.pos_profile_settings] : []);
        if (window.replaceAllItems) { await window.replaceAllItems(message.items || []); } 
        else { await window.replaceAllData('items', message.items || []); }
        await window.replaceAllData('item_prices', message.item_prices || []);
        await window.replaceAllData('warehouses', message.warehouses || []);
        await window.replaceAllData('stock_levels', message.stock_levels || []);
        await window.replaceAllData('customers', message.customers || []);
        await window.replaceAllData('payment_modes', message.payment_modes || []);
        await window.replaceAllData('tax_templates', message.tax_templates || []);
        await window.replaceAllData('company_settings', message.company_settings ? [message.company_settings] : []);

        if (syncStatusElement) syncStatusElement.textContent = "Sync complete!";
        console.log("Initial data sync successful.");
        alert("Initial data sync successful!");
        return true;

    } catch (error) {
        console.error("Error during initial data sync:", error);
        if (syncStatusElement) syncStatusElement.textContent = `Sync failed: ${error.message}`;
        alert(`Sync failed: ${error.message}`);
        return false;
    }
}

// Modify syncOfflineTransactions to include attendant_user_id
async function syncOfflineTransactions(transactionsToSync) {
    if (!ERPNEXT_API_BASE_URL || !POS_PROFILE_NAME_FOR_SYNC || !COMPANY_NAME_FOR_SYNC) {
        alert("Cannot sync transactions: API configuration is missing.");
        return { success: false, message: "API configuration missing." };
    }
    if (!CURRENT_LOGGED_IN_USER) {
        alert("Cannot sync transactions: No user logged in or attendant ID missing.");
        return { success: false, message: "Attendant user ID missing." };
    }

    console.log(`Syncing ${transactionsToSync.length} offline transactions...`);
    const syncResults = [];

    try {
        const response = await fetch(`${ERPNEXT_API_BASE_URL}/api/method/erpnext.pos_custom_api.sync_offline_transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                transactions_list: transactionsToSync,
                pos_profile_name: POS_PROFILE_NAME_FOR_SYNC, 
                company: COMPANY_NAME_FOR_SYNC,
                attendant_user_id: CURRENT_LOGGED_IN_USER // Pass the logged-in user as attendant
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || `HTTP error ${response.status}`);
        }
        
        // data.message should be the list of results from the backend
        console.log("Sync response:", data.message);
        return { success: true, results: data.message };

    } catch (error) {
        console.error("Error syncing offline transactions:", error);
        alert(`Error syncing transactions: ${error.message}`);
        return { success: false, message: error.message, results: [] };
    }
}


window.sync = {
    configureSyncSettings,
    loadSyncConfig,
    loginToERPNext,
    fetchInitialData,
    syncOfflineTransactions,
    // Getter for current user if needed by other modules, e.g. pos_logic for display
    getCurrentLoggedInUser: () => CURRENT_LOGGED_IN_USER 
};
