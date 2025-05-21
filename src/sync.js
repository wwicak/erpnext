// --- Initial Data Synchronization ---
// Assumes db.js (and Dexie instance 'db', replaceAllData, replaceAllItems) is loaded
// Assumes tauri API (if needed for HTTP requests) is available, or uses browser fetch

// Configuration (Hardcoded for now, TODO: Make configurable)
let ERPNEXT_API_BASE_URL = ""; // Will be configured by user input or settings
let POS_PROFILE_NAME = "";
let COMPANY_NAME = "";

// Function to set configuration
// This should be called from main.js or UI interaction
function configureSync(baseUrl, profileName, companyName) {
    ERPNEXT_API_BASE_URL = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl; // Ensure no trailing slash
    POS_PROFILE_NAME = profileName;
    COMPANY_NAME = companyName;
    console.log("Sync configured:", ERPNEXT_API_BASE_URL, POS_PROFILE_NAME, COMPANY_NAME);
    // Store in localStorage for persistence?
    localStorage.setItem("syncConfig", JSON.stringify({baseUrl, profileName, companyName}));
}

// Load config from localStorage if available
function loadSyncConfig() {
    const savedConfig = localStorage.getItem("syncConfig");
    if (savedConfig) {
        const { baseUrl, profileName, companyName } = JSON.parse(savedConfig);
        configureSync(baseUrl, profileName, companyName);
    }
}


async function fetchInitialData() {
    if (!ERPNEXT_API_BASE_URL || !POS_PROFILE_NAME || !COMPANY_NAME) {
        console.error("Sync configuration is not set. Please configure API Base URL, POS Profile, and Company.");
        alert("Sync configuration is not set. Please configure API Base URL, POS Profile, and Company in settings.");
        // Optionally, trigger UI to show config input
        // showConfigModal(); 
        return false;
    }

    const syncStatusElement = document.getElementById('syncStatus'); // Assuming an element to show status
    if (syncStatusElement) syncStatusElement.textContent = "Syncing initial data...";
    console.log("Starting initial data sync...");

    try {
        // Using browser fetch. For Tauri, can use tauri.http.fetch if preferred or for advanced capabilities.
        const response = await fetch(`${ERPNEXT_API_BASE_URL}/api/method/erpnext.pos_custom_api.get_initial_pos_data`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // 'Authorization': `token ${api_key}:${api_secret}` // If using token-based auth
                // For cookie based auth, ensure Frappe session cookie is sent. fetch usually does this.
            },
            body: JSON.stringify({
                pos_profile_name: POS_PROFILE_NAME,
                company: COMPANY_NAME
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.message || 'Unknown error'}`);
        }

        const data = await response.json();
        const message = data.message; // ERPNext wraps response in `message`

        if (!message) {
            console.error("Received empty message from server.", data);
            throw new Error("Received empty or invalid data structure from server.");
        }
        
        console.log("Received data from server:", message);

        // Clear existing data and populate stores
        // Order matters if there are foreign key like relations, but Dexie doesn't enforce them.
        // It's good practice to load independent data first.

        await window.replaceAllData('pos_profiles', message.pos_profile_settings ? [message.pos_profile_settings] : []); // POS Profile is an object, wrap in array
        
        // Use replaceAllItems for specific item processing if defined and needed
        if (window.replaceAllItems) {
            await window.replaceAllItems(message.items || []);
        } else {
            await window.replaceAllData('items', message.items || []);
        }
        
        await window.replaceAllData('item_prices', message.item_prices || []);
        await window.replaceAllData('warehouses', message.warehouses || []);
        await window.replaceAllData('stock_levels', message.stock_levels || []);
        await window.replaceAllData('customers', message.customers || []);
        await window.replaceAllData('payment_modes', message.payment_modes || []);
        await window.replaceAllData('tax_templates', message.tax_templates || []);
        await window.replaceAllData('company_settings', message.company_settings ? [message.company_settings] : []); // Company Settings is an object

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

// Expose functions to global scope for access from HTML or other scripts if not using modules
window.configureSync = configureSync;
window.fetchInitialData = fetchInitialData;
window.loadSyncConfig = loadSyncConfig;
