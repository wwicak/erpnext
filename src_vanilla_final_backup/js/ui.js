// ui.js - Handles UI rendering and updates

// --- UI State Management ---
function showLoginScreen() {
    if(document.getElementById('loginScreen')) document.getElementById('loginScreen').style.display = 'block';
    if(document.getElementById('mainPOSInterface')) document.getElementById('mainPOSInterface').style.display = 'none';
    if(document.getElementById('loginError')) document.getElementById('loginError').textContent = ''; // Clear previous errors
}

function showMainPOSInterface() {
    if(document.getElementById('loginScreen')) document.getElementById('loginScreen').style.display = 'none';
    if(document.getElementById('mainPOSInterface')) document.getElementById('mainPOSInterface').style.display = 'block';
}

function updateUserInfoDisplay(userName, posProfileName) {
    if(document.getElementById('loggedInUserName')) document.getElementById('loggedInUserName').textContent = userName || 'N/A';
    if(document.getElementById('activePOSProfile')) document.getElementById('activePOSProfile').textContent = posProfileName || 'N/A';
}

function displayLoginError(message) {
    const loginErrorEl = document.getElementById('loginError');
    if (loginErrorEl) loginErrorEl.textContent = message || "An unknown error occurred.";
}

// --- Item Display ---
async function displayItems(searchTerm = '') {
    const itemListDiv = document.getElementById('itemList');
    if (!itemListDiv) return;
    itemListDiv.innerHTML = ''; 

    try {
        const items = await db.items.where('item_name').startsWithIgnoreCase(searchTerm)
                            .or('item_code').startsWithIgnoreCase(searchTerm)
                            .or('barcodes_searchable').equals(searchTerm) // Assuming barcodes_searchable is an array of barcode strings
                            .limit(50).toArray();
                            
        if (items.length === 0) {
            itemListDiv.innerHTML = '<p>No items found.</p>';
            return;
        }

        items.forEach(item => {
            const itemCard = document.createElement('div');
            itemCard.className = 'item-card';
            itemCard.dataset.itemCode = item.item_code; 
            
            let cardHtml = `<h4>${item.item_name} (${item.item_code})</h4>`;
            let displayPrice = "N/A";
            // For simplicity, price display on card is basic. Actual price determined on add to cart.
            if (item.standard_rate) displayPrice = parseFloat(item.standard_rate).toFixed(2); 
            cardHtml += `<p class="item-price">Std. Rate: ${displayPrice}</p>`;

            if (item.is_stock_item) {
                 cardHtml += `<p class="item-stock">Stock: Query on add</p>`;
            }
            itemCard.innerHTML = cardHtml;
            itemCard.addEventListener('click', () => handleItemSelection(item)); // handleItemSelection is in main.js
            itemListDiv.appendChild(itemCard);
        });
    } catch (error) {
        console.error("Error displaying items:", error);
        itemListDiv.innerHTML = '<p>Error loading items.</p>';
    }
}

// --- Cart Display ---
function displayCart() {
    const cartItemsDiv = document.getElementById('cartItems');
    const cartSubtotalEl = document.getElementById('cartSubtotal');
    const cartTaxesEl = document.getElementById('cartTaxes'); 
    const cartGrandTotalEl = document.getElementById('cartGrandTotal');

    if (!cartItemsDiv) return;
    cartItemsDiv.innerHTML = ''; 

    const currentCart = window.cart.getCartItems(); 
    
    if (currentCart.length === 0) {
        cartItemsDiv.innerHTML = '<p>Cart is empty.</p>';
    } else {
        currentCart.forEach(item => {
            const cartItemDiv = document.createElement('div');
            cartItemDiv.className = 'cart-item';
            cartItemDiv.innerHTML = `
                <div class="cart-item-details">
                    <strong>${item.item_name}</strong> (${item.item_code})<br>
                    <small>Rate: ${parseFloat(item.rate).toFixed(2)} | Amount: ${parseFloat(item.amount).toFixed(2)}</small>
                </div>
                <div class="cart-item-actions">
                    <button class="cart-item-qty-decrease" data-item-code="${item.item_code}">-</button>
                    <input type="number" class="cart-item-qty-input" data-item-code="${item.item_code}" value="${item.qty}" min="1" step="1">
                    <button class="cart-item-qty-increase" data-item-code="${item.item_code}">+</button>
                    <button class="remove-cart-item-btn" data-item-code="${item.item_code}">X</button>
                </div>
            `;
            cartItemsDiv.appendChild(cartItemDiv);
        });
    }

    const totals = window.cart.getCartTotals(); 
    if (cartSubtotalEl) cartSubtotalEl.textContent = parseFloat(totals.subtotal).toFixed(2);
    if (cartTaxesEl) cartTaxesEl.textContent = parseFloat(totals.taxes).toFixed(2); 
    if (cartGrandTotalEl) cartGrandTotalEl.textContent = parseFloat(totals.grandTotal).toFixed(2);

    // Add event listeners for new cart item controls
    document.querySelectorAll('.cart-item-qty-input').forEach(input => {
        input.addEventListener('change', (e) => handleUpdateCartItemQuantity(e.target.dataset.itemCode, parseFloat(e.target.value)));
    });
    document.querySelectorAll('.remove-cart-item-btn').forEach(button => {
        button.addEventListener('click', (e) => handleRemoveItemFromCart(e.target.dataset.itemCode));
    });
    document.querySelectorAll('.cart-item-qty-decrease').forEach(button => {
        button.addEventListener('click', (e) => {
            const itemCode = e.target.dataset.itemCode;
            const input = document.querySelector(`.cart-item-qty-input[data-item-code="${itemCode}"]`);
            let currentVal = parseFloat(input.value);
            if (currentVal > 1) handleUpdateCartItemQuantity(itemCode, currentVal - 1);
            else if (currentVal === 1) handleRemoveItemFromCart(itemCode); // Or set qty to 0 and let update handle removal
        });
    });
    document.querySelectorAll('.cart-item-qty-increase').forEach(button => {
        button.addEventListener('click', (e) => {
            const itemCode = e.target.dataset.itemCode;
            const input = document.querySelector(`.cart-item-qty-input[data-item-code="${itemCode}"]`);
            let currentVal = parseFloat(input.value);
            handleUpdateCartItemQuantity(itemCode, currentVal + 1);
        });
    });
}


// --- Customer Display ---
// (Customer selection is now defaulted, search UI is hidden in index.html)
// Function to update active customer display if specific customer is chosen (future enhancement)
function displayActiveCustomerName(customer) {
    const activeCustomerNameEl = document.getElementById('activeCustomerName');
    if (activeCustomerNameEl) {
        activeCustomerNameEl.textContent = customer ? `${customer.customer_name} (${customer.name})` : 'Walk-in Customer';
    }
}


// --- Payment Mode Display ---
async function displayPaymentModes() {
    const paymentModeSelect = document.getElementById('paymentMode');
    if (!paymentModeSelect) return;
    paymentModeSelect.innerHTML = '';

    try {
        const modes = await db.payment_modes.toArray(); 
        if (modes.length === 0) {
            paymentModeSelect.innerHTML = '<option value="">No Payment Modes Synced</option>';
        }
        modes.forEach(mode => {
            const option = document.createElement('option');
            option.value = mode.name; 
            option.textContent = mode.mode_of_payment;
            paymentModeSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Error displaying payment modes:", error);
    }
}

function displayAppliedPayments() {
    const paymentsListDiv = document.getElementById('paymentsList');
    const totalPaidAmountEl = document.getElementById('totalPaidAmount');
    const changeAmountEl = document.getElementById('changeAmount');
    if (!paymentsListDiv) return;

    paymentsListDiv.innerHTML = '';
    const payments = window.posLogic.getCurrentPayments(); 
    let totalPaid = 0;

    payments.forEach(p => {
        const paymentEntryDiv = document.createElement('div');
        paymentEntryDiv.className = 'payment-entry';
        paymentEntryDiv.textContent = `${p.mode_of_payment}: ${parseFloat(p.amount).toFixed(2)}`;
        paymentsListDiv.appendChild(paymentEntryDiv);
        totalPaid += p.amount;
    });

    if (totalPaidAmountEl) totalPaidAmountEl.textContent = parseFloat(totalPaid).toFixed(2);

    const grandTotal = window.cart.getCartTotals().grandTotal;
    const change = totalPaid - grandTotal;
    if (changeAmountEl) {
        if (change >= 0 && grandTotal > 0) { // Only show change if paid and there was a total
            changeAmountEl.textContent = `Change: ${parseFloat(change).toFixed(2)}`;
        } else if (change < 0) {
            changeAmountEl.textContent = `Balance Due: ${parseFloat(-change).toFixed(2)}`;
        } else {
            changeAmountEl.textContent = '0.00';
        }
    }
}

// --- Price Check Modal ---
function showPriceCheckModal(show = true) {
    const modal = document.getElementById('priceCheckModal');
    if (modal) modal.style.display = show ? 'block' : 'none';
    if (show) document.getElementById('priceCheckItemInput').focus();
    else document.getElementById('priceCheckResult').innerHTML = ''; // Clear results when hiding
}

function displayPriceCheckResult(item, priceInfo) {
    const resultDiv = document.getElementById('priceCheckResult');
    if (!resultDiv) return;
    if (!item) {
        resultDiv.innerHTML = '<p>Item not found.</p>';
        return;
    }
    let priceDisplay = "N/A";
    if (priceInfo) {
        priceDisplay = `${parseFloat(priceInfo.price_list_rate).toFixed(2)} (${priceInfo.price_list})`;
    } else if (item.standard_rate) {
        priceDisplay = `${parseFloat(item.standard_rate).toFixed(2)} (Standard Rate)`;
    }
    resultDiv.innerHTML = `
        <h4>${item.item_name} (${item.item_code})</h4>
        <p><strong>Price: ${priceDisplay}</strong></p>
        <p>Stock UOM: ${item.stock_uom}</p>
        ${item.description ? `<p>Description: ${item.description}</p>` : ''}
    `;
}

// --- Held Carts Modal ---
function showHeldCartsModal(show = true) {
    const modal = document.getElementById('heldCartsModal');
    if (modal) modal.style.display = show ? 'block' : 'none';
    if (show) displayHeldCartsList(); // Refresh list when shown
}

async function displayHeldCartsList() {
    const listDiv = document.getElementById('heldCartsList');
    if (!listDiv) return;
    listDiv.innerHTML = '<p>Loading held carts...</p>';
    try {
        const heldCarts = await db.held_carts.orderBy('held_at').reverse().toArray();
        if (!heldCarts || heldCarts.length === 0) {
            listDiv.innerHTML = '<p>No carts are currently on hold.</p>';
            return;
        }
        listDiv.innerHTML = ''; // Clear loading
        heldCarts.forEach(cart => {
            const cartEntry = document.createElement('div');
            cartEntry.className = 'held-cart-entry';
            const itemCount = cart.cart_data.items.reduce((sum, item) => sum + item.qty, 0);
            const cartTotal = cart.cart_data.totals.grandTotal;
            cartEntry.innerHTML = `
                <span>Held at: ${new Date(cart.held_at).toLocaleString()} (${itemCount} items, Total: ${parseFloat(cartTotal).toFixed(2)})</span>
                <div>
                    <button class="resume-held-cart-btn" data-cart-id="${cart.id}">Resume</button>
                    <button class="delete-held-cart-btn" data-cart-id="${cart.id}">Delete</button>
                </div>
            `;
            listDiv.appendChild(cartEntry);
        });

        // Add event listeners for resume/delete buttons
        document.querySelectorAll('.resume-held-cart-btn').forEach(btn => {
            btn.addEventListener('click', (e) => handleResumeHeldCart(e.target.dataset.cartId));
        });
        document.querySelectorAll('.delete-held-cart-btn').forEach(btn => {
            btn.addEventListener('click', (e) => handleDeleteHeldCart(e.target.dataset.cartId));
        });

    } catch (error) {
        console.error("Error displaying held carts:", error);
        listDiv.innerHTML = '<p>Error loading held carts.</p>';
    }
}


window.ui = {
    showLoginScreen,
    showMainPOSInterface,
    updateUserInfoDisplay,
    displayLoginError,
    displayItems,
    displayCart,
    displayActiveCustomerName,
    displayPaymentModes,
    displayAppliedPayments,
    showPriceCheckModal,
    displayPriceCheckResult,
    showHeldCartsModal, // Already added in previous step
    displayHeldCartsList // Already added in previous step
};
