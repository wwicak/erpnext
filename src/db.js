// Dexie.js - Minimalistic IndexedDB Wrapper
// Assuming dexie.js is loaded globally or imported via a module system if set up

// Initialize Dexie Database
const db = new Dexie("OfflinePOSDB");

db.version(1).stores({
    pos_profiles: "name, company, warehouse, currency, selling_price_list, income_account, expense_account, cost_center", // &name is primary key
    items: "&item_code, item_name, item_group, brand, stock_uom, is_stock_item, disabled, *barcodes_searchable, *uoms_searchable", // item_code is primary key. barcodes_searchable and uoms_searchable for multiEntry indexes
    item_prices: "++id, &[item_code+price_list], item_code, price_list, price_list_rate, currency, uom", // Auto-incrementing ID, compound index for item+price_list
    customers: "&name, customer_name, customer_group, default_price_list, disabled", // name is primary key
    warehouses: "&name, warehouse_name, company", // name is primary key
    stock_levels: "++id, &[item_code+warehouse], item_code, warehouse, actual_qty", // Auto-incrementing ID, compound index for item+warehouse
    payment_modes: "&name, mode_of_payment, type", // name is primary key
    tax_templates: "&name, title, company", // name is primary key
    company_settings: "&name, default_currency", // name is primary key (e.g., company name)
    offline_transactions: "++id, offline_id, customer, transaction_date, sync_status, pos_profile, company", // Auto-incrementing ID, offline_id for local reference
    // Add more indexes as needed for searching/filtering common fields.
    // Example: items: "&item_code, item_name, item_group, brand, *tags"
    // Example: customers: "&name, customer_name, customer_group, *tags"
    held_carts: "++id, held_at, name" // Auto-incrementing ID, timestamp, optional name for cart
});

// --- Database Interaction Functions ---

// Generic function to clear and bulk add data to a store
async function replaceAllData(storeName, data) {
    const store = db[storeName];
    await store.clear();
    if (data && data.length > 0) {
        await store.bulkPut(data).catch(Dexie.BulkError, function (e) {
            console.error(`Failed to bulkPut ${data.length} records into ${storeName}: ${e.failures.length} failures.`);
            console.error("First failure:", e.failures[0]);
        });
        console.log(`Successfully populated ${storeName} with ${data.length} records.`);
    } else {
        console.log(`No data provided for ${storeName}, store cleared.`);
    }
}

// Specific function for items to handle barcodes and UOMs for indexing if needed
async function replaceAllItems(itemsData) {
    const store = db.items;
    await store.clear();
    if (itemsData && itemsData.length > 0) {
        const processedItems = itemsData.map(item => {
            // For multi-entry index on barcodes: store barcodes as an array of strings
            // Assuming item.barcodes is like [{barcode: '123'}, {barcode: '456'}]
            // item.barcodes_searchable = item.barcodes ? item.barcodes.map(b => b.barcode) : [];
            // item.uoms_searchable = item.uoms ? item.uoms.map(u => u.uom) : []; // If uoms is array of objects
            return item; // Return item as is if structure is already good for as_dict() from backend
        });
        await store.bulkPut(processedItems).catch(Dexie.BulkError, function (e) {
            console.error(`Failed to bulkPut ${processedItems.length} items: ${e.failures.length} failures.`);
            console.error("First item failure:", e.failures[0]);
        });
        console.log(`Successfully populated items with ${processedItems.length} records.`);
    } else {
        console.log("No data provided for items, store cleared.");
    }
}


// --- POS Profile ---
async function savePOSProfile(profile) {
    return await db.pos_profiles.put(profile);
}
async function getPOSProfile(name) {
    return await db.pos_profiles.get(name);
}

// --- Items ---
async function searchItems(searchTerm) {
    if (!searchTerm) {
        return await db.items.limit(100).toArray(); // Return first 100 if no term
    }
    // Simple search: item_name or item_code. Adjust as needed.
    // For more complex search, consider full-text search capabilities or more specific indexes.
    return await db.items
        .where('item_name').startsWithIgnoreCase(searchTerm)
        .or('item_code').startsWithIgnoreCase(searchTerm)
        // .or('barcodes_searchable').equals(searchTerm) // If using barcode index
        .limit(50)
        .toArray();
}
async function getItemByCode(itemCode) {
    return await db.items.get(itemCode);
}

async function getItemByBarcode(barcode) {
    // Assumes 'barcodes_searchable' is an array of barcode strings on the item object
    // or 'barcode' is a single string field if items have only one primary barcode.
    // If items have a child table like structure e.g. item.barcodes = [{barcode: '123'}, {barcode: '456'}]
    // then the 'barcodes_searchable' field should be created during data processing in sync.js
    // For now, let's assume 'barcodes_searchable' is correctly populated as an array.
    const items = await db.items.where('barcodes_searchable').equals(barcode).toArray();
    if (items && items.length > 0) {
        if (items.length > 1) {
            console.warn(`Multiple items found for barcode ${barcode}. Returning the first one.`, items);
        }
        return items[0];
    }
    return null; 
}


// --- Item Prices ---
async function getItemPrice(itemCode, priceList) {
    return await db.item_prices
        .where({ item_code: itemCode, price_list: priceList })
        .first();
}

// --- Customers ---
async function searchCustomers(searchTerm) {
    if (!searchTerm) {
        return await db.customers.limit(100).toArray();
    }
    return await db.customers
        .where('customer_name').startsWithIgnoreCase(searchTerm)
        .or('name').startsWithIgnoreCase(searchTerm)
        .limit(50)
        .toArray();
}
async function getCustomerByName(name) {
    return await db.customers.get(name);
}


// --- Stock Levels ---
async function getStockLevel(itemCode, warehouse) {
    return await db.stock_levels
        .where({ item_code: itemCode, warehouse: warehouse })
        .first();
}

// --- Payment Modes ---
async function getAllPaymentModes() {
    return await db.payment_modes.toArray();
}


// --- Offline Transactions ---
async function saveOfflineTransaction(transaction) {
    transaction.offline_id = transaction.offline_id || `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    transaction.transaction_date = transaction.transaction_date || new Date().toISOString();
    transaction.sync_status = 'pending';
    return await db.offline_transactions.add(transaction);
}

async function getPendingTransactions() {
    return await db.offline_transactions.where('sync_status').equals('pending').toArray();
}

async function updateTransactionStatus(id, sync_status, error_message = null) {
    let updateData = { sync_status: sync_status };
    if (error_message) updateData.error_message = error_message;
    // Dexie's update uses primary key. If 'id' is the Dexie auto-incremented primary key for offline_transactions, this is fine.
    // If 'id' refers to 'offline_id', then it should be:
    // return await db.offline_transactions.where('offline_id').equals(id).modify(updateData);
    // Assuming 'id' is the primary key from `++id` for now.
    return await db.offline_transactions.update(id, updateData);
}


// --- Held Carts ---
async function saveHeldCart(cartData, name = null) {
    const now = new Date().toISOString();
    const cartNameToSave = name || `Cart held at ${new Date(now).toLocaleTimeString()}`;
    return await db.held_carts.add({
        name: cartNameToSave,
        held_at: now,
        cart_data: cartData // cartData should include items, customer, totals, etc.
    });
}

async function getAllHeldCarts() {
    return await db.held_carts.orderBy('held_at').reverse().toArray(); // Show newest first
}

async function getHeldCart(id) {
    return await db.held_carts.get(parseInt(id)); // Ensure ID is number if from data-attribute
}

async function deleteHeldCart(id) {
    return await db.held_carts.delete(parseInt(id)); // Ensure ID is number
}


// Make db instance available, e.g. by exporting or attaching to window for simple scripts
window.db = db; // Exposing Dexie instance
// Exposing specific functions for easier access from other scripts
window.replaceAllData = replaceAllData;
window.replaceAllItems = replaceAllItems; 
window.searchItems = searchItems;
window.getItemByCode = getItemByCode;
window.getItemByBarcode = getItemByBarcode; // Exposed
window.getItemPrice = getItemPrice;
window.searchCustomers = searchCustomers;
window.getCustomerByName = getCustomerByName;
window.getStockLevel = getStockLevel;
window.getAllPaymentModes = getAllPaymentModes;
window.saveOfflineTransaction = saveOfflineTransaction;
window.getPendingTransactions = getPendingTransactions;
window.updateTransactionStatus = updateTransactionStatus;
// Held Cart functions
window.saveHeldCart = saveHeldCart;
window.getAllHeldCarts = getAllHeldCarts;
window.getHeldCart = getHeldCart;
window.deleteHeldCart = deleteHeldCart;


console.log("OfflinePOSDB Initialized with Dexie.js and helper functions exposed.");
