// ui.js - Handles UI rendering and updates
// Assumes db.js is loaded (for db interaction) and cart.js (for cart data)

// --- Item Display ---
async function displayItems(searchTerm = '') {
    const itemListDiv = document.getElementById('itemList');
    if (!itemListDiv) return;
    itemListDiv.innerHTML = ''; // Clear previous items

    try {
        const items = await searchItems(searchTerm); // From db.js
        if (items.length === 0) {
            itemListDiv.innerHTML = '<p>No items found.</p>';
            return;
        }

        items.forEach(item => {
            const itemCard = document.createElement('div');
            itemCard.className = 'item-card';
            itemCard.dataset.itemCode = item.item_code; // Store item_code for adding to cart
            
            // Basic item info
            let cardHtml = `<h4>${item.item_name} (${item.item_code})</h4>`;
            
            // Try to get default price for display (simplification)
            // Actual price will be determined at cart addition based on customer/POS profile
            let displayPrice = "N/A";
            if (item.default_price) { // Assuming we might store a pre-calculated default_price
                displayPrice = item.default_price;
            } else if (window.currentPOSProfile && window.currentPOSProfile.selling_price_list && item.item_code) {
                // Try to get price from POS profile's default selling price list
                // This is an ASYNC operation, for simplicity in item listing, we might skip this
                // or show a placeholder. For now, keeping it simple.
                // const priceDoc = await getItemPrice(item.item_code, window.currentPOSProfile.selling_price_list);
                // if (priceDoc) displayPrice = priceDoc.price_list_rate;
            }
             cardHtml += `<p class="item-price">Price: ${displayPrice}</p>`;


            // Stock level display (informational)
            if (item.is_stock_item && window.currentPOSProfile && window.currentPOSProfile.warehouse) {
                // ASYNC operation, could be slow for many items.
                // Consider fetching stock in bulk or on demand. For now, placeholder.
                // const stock = await getStockLevel(item.item_code, window.currentPOSProfile.warehouse);
                // cardHtml += `<p class="item-stock">Stock: ${stock ? stock.actual_qty : 'N/A'}</p>`;
                 cardHtml += `<p class="item-stock">Stock: Query on add</p>`;
            } else if (item.is_stock_item) {
                cardHtml += `<p class="item-stock">Stock: N/A (No POS Warehouse)</p>`;
            }


            itemCard.innerHTML = cardHtml;
            itemCard.addEventListener('click', () => handleItemSelection(item));
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
    const cartTaxesEl = document.getElementById('cartTaxes'); // Dummy for now
    const cartGrandTotalEl = document.getElementById('cartGrandTotal');

    if (!cartItemsDiv) return;
    cartItemsDiv.innerHTML = ''; // Clear previous cart items

    const currentCart = window.cart.getCartItems(); // from cart.js
    
    if (currentCart.length === 0) {
        cartItemsDiv.innerHTML = '<p>Cart is empty.</p>';
    } else {
        currentCart.forEach(item => {
            const cartItemDiv = document.createElement('div');
            cartItemDiv.className = 'cart-item';
            cartItemDiv.innerHTML = `
                <div class="cart-item-details">
                    <strong>${item.item_name}</strong> (${item.item_code})<br>
                    <small>Rate: ${item.rate.toFixed(2)} | Qty: ${item.qty} | Amount: ${item.amount.toFixed(2)}</small>
                </div>
                <div class="cart-item-actions">
                    <input type="number" class="cart-item-qty-input" data-item-code="${item.item_code}" value="${item.qty}" min="1">
                    <button class="remove-cart-item-btn" data-item-code="${item.item_code}">X</button>
                </div>
            `;
            cartItemsDiv.appendChild(cartItemDiv);
        });
    }

    // Update totals
    const totals = window.cart.getCartTotals(); // from cart.js
    if (cartSubtotalEl) cartSubtotalEl.textContent = totals.subtotal.toFixed(2);
    if (cartTaxesEl) cartTaxesEl.textContent = totals.taxes.toFixed(2); // Dummy
    if (cartGrandTotalEl) cartGrandTotalEl.textContent = totals.grandTotal.toFixed(2);

    // Add event listeners for new cart item controls
    document.querySelectorAll('.cart-item-qty-input').forEach(input => {
        input.addEventListener('change', (e) => handleUpdateCartItemQuantity(e.target.dataset.itemCode, parseFloat(e.target.value)));
    });
    document.querySelectorAll('.remove-cart-item-btn').forEach(button => {
        button.addEventListener('click', (e) => handleRemoveItemFromCart(e.target.dataset.itemCode));
    });
}


// --- Customer Display ---
let customerSearchTimeout;
async function displayCustomerSuggestions(searchTerm) {
    const customerListDiv = document.getElementById('customerList');
    if (!customerListDiv) return;

    if (!searchTerm || searchTerm.length < 2) {
        customerListDiv.innerHTML = '';
        customerListDiv.style.display = 'none';
        return;
    }

    // Debounce search
    clearTimeout(customerSearchTimeout);
    customerSearchTimeout = setTimeout(async () => {
        try {
            const customers = await searchCustomers(searchTerm); // from db.js
            customerListDiv.innerHTML = '';
            if (customers.length > 0) {
                customers.forEach(cust => {
                    const custDiv = document.createElement('div');
                    custDiv.className = 'customer-list-item';
                    custDiv.textContent = `${cust.customer_name} (${cust.name})`;
                    custDiv.addEventListener('click', () => selectCustomer(cust));
                    customerListDiv.appendChild(custDiv);
                });
                customerListDiv.style.display = 'block';
            } else {
                customerListDiv.style.display = 'none';
            }
        } catch (error) {
            console.error("Error searching customers:", error);
            customerListDiv.style.display = 'none';
        }
    }, 300); // 300ms debounce
}

function selectCustomer(customer) {
    document.getElementById('selectedCustomerName').textContent = `${customer.customer_name} (${customer.name})`;
    document.getElementById('selectedCustomer').value = customer.name; // Store the ID/name
    document.getElementById('customerList').style.display = 'none';
    document.getElementById('customerSearch').value = ''; // Clear search input

    // Important: Update current customer in pos_logic.js or main.js
    window.posLogic.setCurrentCustomer(customer);
    window.cart.recalculateCartPrices(); // Recalculate cart prices if customer change affects price list
    displayCart(); // Refresh cart display as prices might change
}

function clearSelectedCustomer() {
    const defaultWalkIn = { name: "Walk-in", customer_name: "Walk-in", default_price_list: null };
    document.getElementById('selectedCustomerName').textContent = 'Walk-in';
    document.getElementById('selectedCustomer').value = 'Walk-in';
    window.posLogic.setCurrentCustomer(defaultWalkIn);
    window.cart.recalculateCartPrices();
    displayCart();
}

// --- Payment Mode Display ---
async function displayPaymentModes() {
    const paymentModeSelect = document.getElementById('paymentMode');
    if (!paymentModeSelect) return;
    paymentModeSelect.innerHTML = '';

    try {
        const modes = await getAllPaymentModes(); // from db.js
        modes.forEach(mode => {
            const option = document.createElement('option');
            option.value = mode.name; // Assuming mode.name is the identifier
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
    const payments = window.posLogic.getCurrentPayments(); // from pos_logic.js
    let totalPaid = 0;

    payments.forEach(p => {
        const paymentEntryDiv = document.createElement('div');
        paymentEntryDiv.className = 'payment-entry';
        paymentEntryDiv.textContent = `${p.mode_of_payment}: ${p.amount.toFixed(2)}`;
        // Add a remove button if needed:
        // const removeBtn = document.createElement('button');
        // removeBtn.textContent = 'X';
        // removeBtn.onclick = () => { removePayment(p.id_or_index); displayAppliedPayments(); };
        // paymentEntryDiv.appendChild(removeBtn);
        paymentsListDiv.appendChild(paymentEntryDiv);
        totalPaid += p.amount;
    });

    if (totalPaidAmountEl) totalPaidAmountEl.textContent = totalPaid.toFixed(2);

    const grandTotal = window.cart.getCartTotals().grandTotal;
    const change = totalPaid - grandTotal;
    if (changeAmountEl) {
        if (change >= 0) {
            changeAmountEl.textContent = `Change: ${change.toFixed(2)}`;
        } else {
            changeAmountEl.textContent = `Balance Due: ${(-change).toFixed(2)}`;
        }
    }
}


// Expose functions to global scope or handle via event listeners in main.js
window.ui = {
    displayItems,
    displayCart,
    displayCustomerSuggestions,
    selectCustomer,
    clearSelectedCustomer,
    displayPaymentModes,
    displayAppliedPayments
};
