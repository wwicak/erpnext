// cart.js - Manages the state of the current shopping cart

// Cart state (in-memory)
let currentCartItems = []; // Array of item objects: { item_code, item_name, qty, rate, amount, stock_uom, conversion_factor, etc. }
let currentCustomer = { name: "Walk-in", customer_name: "Walk-in", default_price_list: null }; // Default customer

// Function to set the current customer (called from ui.js or main.js)
function setCartCustomer(customer) {
    currentCustomer = customer || { name: "Walk-in", customer_name: "Walk-in", default_price_list: null };
    // Potentially re-price items in cart if customer changes
    recalculateCartPrices(); 
}

// Function to add an item to the cart or update its quantity
async function addItemToCart(itemData, quantity = 1) {
    if (!itemData || !itemData.item_code) {
        console.error("Invalid item data provided to cart.");
        return;
    }

    const posProfile = window.posLogic.getCurrentPOSProfile();
    const companySettings = window.posLogic.getCurrentCompanySettings(); // Has allow_negative_stock (frontend's copy)

    // --- Local Stock Check ---
    if (itemData.is_stock_item && posProfile && posProfile.warehouse) {
        const existingItemInCart = currentCartItems.find(cartItem => cartItem.item_code === itemData.item_code);
        const currentQtyInCart = existingItemInCart ? existingItemInCart.qty : 0;
        const requestedTotalQty = currentQtyInCart + quantity;
        
        // Assuming itemData.stock_uom and itemData.uoms (with conversion_factor) are available
        // For simplicity, assuming 'quantity' is in the item's sales UOM, and we need to convert to stock UOM for check
        // This needs to be robust: find correct conversion factor if itemData.default_uom !== itemData.stock_uom
        let requestedQtyInStockUOM = requestedTotalQty; 
        const salesUOM = itemData.uom || itemData.stock_uom; // itemData.uom should be sales uom
        if (salesUOM !== itemData.stock_uom) {
            const uomEntry = itemData.uoms?.find(u => u.uom === salesUOM);
            if (uomEntry && uomEntry.conversion_factor) {
                requestedQtyInStockUOM = requestedTotalQty * uomEntry.conversion_factor;
            } else {
                console.warn(`Conversion factor not found for ${itemData.item_code} from ${salesUOM} to ${itemData.stock_uom}. Assuming 1:1.`);
            }
        }

        const stockLevelDoc = await getStockLevel(itemData.item_code, posProfile.warehouse); // from db.js
        const localActualQty = stockLevelDoc ? stockLevelDoc.actual_qty : 0;

        if (requestedQtyInStockUOM > localActualQty && !companySettings.allow_negative_stock) {
            alert(`Warning: Local stock for ${itemData.item_name} indicates only ${localActualQty} ${itemData.stock_uom} available in ${posProfile.warehouse}. Requested: ${requestedQtyInStockUOM} ${itemData.stock_uom}. Proceeding may lead to sync failure.`);
            // Operation is allowed to proceed as per requirements.
        } else if (requestedQtyInStockUOM > localActualQty && companySettings.allow_negative_stock) {
            console.warn(`Item ${itemData.item_name} quantity (${requestedQtyInStockUOM} ${itemData.stock_uom}) exceeds local stock (${localActualQty} ${itemData.stock_uom}). Negative stock allowed.`);
            // Optional: Add visual indicator here or in displayCart by adding a flag to cart item.
        }
    }
    // --- End Local Stock Check ---


    const existingItem = currentCartItems.find(cartItem => cartItem.item_code === itemData.item_code);

    // Determine price
    let itemRate = itemData.standard_rate || 0; 
    let priceSource = "item_default";
    const targetPriceList = currentCustomer?.default_price_list || posProfile?.selling_price_list;

    if (targetPriceList) {
        try {
            const priceDoc = await getItemPrice(itemData.item_code, targetPriceList); // from db.js
            if (priceDoc && priceDoc.price_list_rate) {
                itemRate = priceDoc.price_list_rate;
                priceSource = targetPriceList;
            }
        } catch (e) {
            console.warn(`Could not fetch price for ${itemData.item_code} from ${targetPriceList}. Falling back.`, e);
        }
    }
    console.log(`Price for ${itemData.item_code}: ${itemRate} (Source: ${priceSource})`);


    if (existingItem) {
        existingItem.qty += quantity;
        existingItem.rate = itemRate; // Update rate in case customer/price list changed
        existingItem.amount = existingItem.qty * existingItem.rate;
    } else {
        currentCartItems.push({
            item_code: itemData.item_code,
            item_name: itemData.item_name,
            qty: quantity,
            rate: itemRate,
            amount: quantity * itemRate,
            uom: itemData.uom || itemData.stock_uom, // Sales UOM
            stock_uom: itemData.stock_uom,
            conversion_factor: itemData.uoms?.find(u => u.uom === (itemData.uom || itemData.stock_uom))?.conversion_factor || 1,
            is_stock_item: itemData.is_stock_item,
            warehouse: posProfile?.warehouse, // Store warehouse context for later stock checks/transaction
            // Other fields for transaction:
            income_account: itemData.income_account, 
            cost_center: itemData.cost_center,
        });
    }
    window.ui.displayCart(); // Update UI
}

// Function to update an item's quantity in the cart
async function updateCartItemQuantity(itemCode, newQuantityStr) {
    const newQuantity = parseFloat(newQuantityStr);
    const item = currentCartItems.find(cartItem => cartItem.item_code === itemCode);
    if (!item) return;

    if (newQuantity <= 0) {
        removeItemFromCart(itemCode);
        window.ui.displayCart();
        return;
    }
    
    const posProfile = window.posLogic.getCurrentPOSProfile();
    const companySettings = window.posLogic.getCurrentCompanySettings();

    // --- Local Stock Check for Update ---
    if (item.is_stock_item && posProfile && posProfile.warehouse) {
        const itemFullData = await getItemByCode(item.item_code); // Fetch full item data for UOM info
        let requestedQtyInStockUOM = newQuantity;
        const salesUOM = item.uom || itemFullData.stock_uom;
        if (salesUOM !== itemFullData.stock_uom) {
            const uomEntry = itemFullData.uoms?.find(u => u.uom === salesUOM);
            if (uomEntry && uomEntry.conversion_factor) {
                requestedQtyInStockUOM = newQuantity * uomEntry.conversion_factor;
            } else {
                 console.warn(`Conversion factor not found for ${item.item_code} from ${salesUOM} to ${itemFullData.stock_uom}. Assuming 1:1 for stock check.`);
            }
        }

        const stockLevelDoc = await getStockLevel(item.item_code, posProfile.warehouse);
        const localActualQty = stockLevelDoc ? stockLevelDoc.actual_qty : 0;

        if (requestedQtyInStockUOM > localActualQty && !companySettings.allow_negative_stock) {
            alert(`Warning: Local stock for ${item.item_name} indicates only ${localActualQty} ${itemFullData.stock_uom} available in ${posProfile.warehouse}. Requested: ${requestedQtyInStockUOM} ${itemFullData.stock_uom}. Proceeding may lead to sync failure.`);
        } else if (requestedQtyInStockUOM > localActualQty && companySettings.allow_negative_stock) {
             console.warn(`Item ${item.item_name} quantity (${requestedQtyInStockUOM} ${itemFullData.stock_uom}) exceeds local stock (${localActualQty} ${itemFullData.stock_uom}). Negative stock allowed.`);
        }
    }
    // --- End Local Stock Check for Update ---

    item.qty = newQuantity;
    item.amount = item.qty * item.rate; // Rate should be stable unless customer changed
    
    window.ui.displayCart(); // Update UI
}

// Function to remove an item from the cart
function removeItemFromCart(itemCode) {
    currentCartItems = currentCartItems.filter(cartItem => cartItem.item_code !== itemCode);
    window.ui.displayCart(); // Update UI
}

// Function to recalculate all cart item prices (e.g., after customer change)
async function recalculateCartPrices() {
    for (let item of currentCartItems) {
        const itemFullData = await getItemByCode(item.item_code); // Get full item data for rate fallback
        let itemRate = itemFullData.standard_rate || 0;
        const targetPriceList = currentCustomer?.default_price_list || window.currentPOSProfile?.selling_price_list;
        if (targetPriceList) {
            const priceDoc = await getItemPrice(item.item_code, targetPriceList);
            if (priceDoc && priceDoc.price_list_rate) {
                itemRate = priceDoc.price_list_rate;
            }
        }
        item.rate = itemRate;
        item.amount = item.qty * item.rate;
    }
    window.ui.displayCart();
}


// Function to get current cart items
function getCartItems() {
    return [...currentCartItems]; // Return a copy
}

// Function to calculate cart totals
function getCartTotals() {
    const subtotal = currentCartItems.reduce((sum, item) => sum + item.amount, 0);
    // Dummy tax calculation for now
    const taxes = subtotal * 0.05; // Assuming a flat 5% tax
    const grandTotal = subtotal + taxes;
    return { subtotal, taxes, grandTotal };
}

// Function to clear the cart
function clearCart() {
    currentCartItems = [];
    // Reset customer to default? Or keep selected customer? For now, keep.
    // setCartCustomer(null); // Resets to Walk-in
    window.ui.displayCart(); // Update UI
    window.ui.displayAppliedPayments(); // Clear payments as well
}

// Expose cart functions globally or via a namespace
window.cart = {
    setCartCustomer,
    addItemToCart,
    updateCartItemQuantity,
    removeItemFromCart,
    getCartItems,
    getCartTotals,
    clearCart,
    recalculateCartPrices
};
