export async function fetchApi(method, erpNextUrl, endpoint, data = null, headers = {}) {
  const defaultHeaders = {
    'Accept': 'application/json',
  };
  if (data && !(data instanceof FormData)) { // FormData sets its own Content-Type
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const config = {
    method: method.toUpperCase(),
    headers: {
      ...defaultHeaders,
      ...headers,
    },
    // credentials: 'omit', // Default: 'same-origin'. Change if dealing with CORS and cookies.
                         // For 'include', server needs 'Access-Control-Allow-Credentials': 'true'
  };

  if (data) {
    config.body = (data instanceof FormData) ? data : JSON.stringify(data);
  }
  
  const fullEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const response = await fetch(`${erpNextUrl}${fullEndpoint}`, config);

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch (e) {
      // Try to get text if JSON parsing fails (e.g., HTML error page)
      const errorText = await response.text();
      errorData = { message: errorText || response.statusText || 'An unknown error occurred' };
    }
    // Add status code to the error object for more context
    errorData.statusCode = response.status; 
    throw new Error(errorData.message || `API request failed with status ${response.status}`);
  }

  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return { success: true, data: null };
  }
  return await response.json();
}


export async function loginToERPNext(erpNextUrl, username, password) {
  const response = await fetch(`${erpNextUrl}/api/method/login`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: `usr=${encodeURIComponent(username)}&pwd=${encodeURIComponent(password)}`
  });

  if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        const textError = await response.text();
        errorData = { message: textError || response.statusText || 'Login failed due to server error' };
      }
      throw new Error(errorData.exc_type === "AuthenticationError" || (errorData.message && errorData.message.includes("Invalid login credentials")) ? "Invalid login credentials" : errorData.message || 'Login failed');
  }

  const data = await response.json();
  
  if (data.message && data.message.toLowerCase() !== "logged in") {
    throw new Error(data.message || "Login was not successful.");
  }
  // Note: CSRF token might be available in cookies or need a separate fetch.
  // For now, this login doesn't explicitly return a CSRF token to be stored.
  // This might need adjustment if CSRF token is required for subsequent POSTs.
  return { 
    full_name: data.full_name, 
    user_id: data.user_id,
  };
}

export async function getFrappeCsrfToken(erpNextUrl) {
  // This function attempts to get a CSRF token. Often, after login, the token is
  // available globally as `frappe.csrf_token` if the app runs within Frappe's context,
  // or it might be set in a cookie that `fetch` includes automatically.
  // For SPAs, an explicit fetch might be needed if header-based CSRF is enforced.
  try {
    // A common method is to call a simple GET endpoint that ensures session is valid
    // and might return the token or ensure it's set in cookies.
    // Frappe v13+ often uses `frappe.realtime.get_user_info` or similar simple calls.
    // Let's try a known method:
    const response = await fetchApi('GET', erpNextUrl, '/api/method/frappe.handler.get_csrf_token');
    // The actual token is usually in response.message if this endpoint is used.
    // If this specific endpoint doesn't work or is not available,
    // another common way is `frappe.auth.get_logged_in_user` which might refresh it.
    // Or, sometimes just making any authenticated GET request might set it.
    // For now, we'll rely on this specific Frappe method.
    if (response && response.message) {
        console.log("CSRF Token obtained:", response.message);
        return response.message;
    }
    // Fallback or if the above doesn't yield a token directly in message:
    // Some setups might require a different approach or the token is expected to be in a cookie.
    // This is a common source of issues for external SPAs.
    console.warn("getFrappeCsrfToken: Standard endpoint didn't return token in message. Check network tab for 'X-Frappe-CSRF-Token' or 'frappe.csrf_token' in JS context if applicable. Using a dummy token for now.");
    return "dummy_csrf_token_from_api_service_fallback"; // Fallback placeholder
  } catch (error) {
    console.error("Error in getFrappeCsrfToken:", error);
    // If the primary method fails, it might be okay if cookies handle CSRF.
    // Depending on strictness, might throw error or return a dummy/null.
    return "dummy_csrf_token_on_error"; // Placeholder
  }
}


export async function fetchInitialPOSData(erpNextUrl, posProfileForSync, companyForSyncFallback, csrfToken) {
  console.log('Fetching initial POS data for profile:', posProfileForSync, 'company fallback:', companyForSyncFallback);
  const headers = csrfToken ? { 'X-Frappe-CSRF-Token': csrfToken } : {};

  const posProfileFields = `["name", "company", "warehouse", "currency", "selling_price_list", "default_customer_group", "default_customer", "payments.mode_of_payment", "payments.type", "payments.account", "customer_groups.customer_group"]`;
  const posProfileData = await fetchApi('GET', erpNextUrl, `/api/resource/POS Profile/${posProfileForSync}?fields=${posProfileFields}`, null, headers);
  
  const activePOSProfileDetails = posProfileData.data;
  if (!activePOSProfileDetails) throw new Error(`POS Profile ${posProfileForSync} not found.`);
  
  const companyToUse = activePOSProfileDetails.company || companyForSyncFallback;
  if (!companyToUse) throw new Error("Company could not be determined.");
  activePOSProfileDetails.name = posProfileForSync;

  const paymentModes = (activePOSProfileDetails.payments || []).map(p => ({ mode_of_payment: p.mode_of_payment, type: p.type, account: p.account }));

  const companyFields = `["name", "allow_negative_stock", "pos_walk_in_customer", "default_currency", "default_customer_group"]`;
  const companySettingsData = await fetchApi('GET', erpNextUrl, `/api/resource/Company/${companyToUse}?fields=${companyFields}`, null, headers);
  const companySettings = companySettingsData.data;

  if (activePOSProfileDetails.currency) companySettings.default_currency = activePOSProfileDetails.currency;
  activePOSProfileDetails.default_customer_group = activePOSProfileDetails.default_customer_group || companySettings.default_customer_group;
  activePOSProfileDetails.pos_walk_in_customer = activePOSProfileDetails.default_customer || companySettings.pos_walk_in_customer || 'Walk-in';

  const itemFields = `["item_code", "item_name", "description", "stock_uom", "image", "standard_rate", "is_stock_item", "variant_of", "income_account", "cost_center", "barcodes.barcode", "barcodes.barcode_type"]`;
  const itemFilters = JSON.stringify([['disabled', '=', 0], ['is_sales_item', '=', 1]]);
  const itemsData = await fetchApi('GET', erpNextUrl, `/api/resource/Item?fields=${itemFields}&filters=${itemFilters}&limit_page_length=0`, null, headers);
  let items = itemsData.data || [];

  if (activePOSProfileDetails.selling_price_list) {
    const itemPriceFields = `["item_code", "price_list_rate"]`;
    const itemPriceFilters = JSON.stringify([['price_list', '=', activePOSProfileDetails.selling_price_list], ['selling', '=', 1]]);
    const itemPricesData = await fetchApi('GET', erpNextUrl, `/api/resource/Item Price?fields=${itemPriceFields}&filters=${itemPriceFilters}&limit_page_length=0`, null, headers);
    const itemPrices = itemPricesData.data || [];
    const priceMap = new Map(itemPrices.map(p => [p.item_code, p.price_list_rate]));
    items = items.map(item => ({ ...item, rate: priceMap.get(item.item_code) || item.standard_rate || 0 }));
  } else {
    items = items.map(item => ({ ...item, rate: item.standard_rate || 0 }));
  }

  const customerFields = `["name", "customer_name", "default_price_list", "customer_group", "email_id", "mobile_no"]`;
  let customerFiltersArr = [['disabled', '=', 0]];
  const posCustomerGroups = (activePOSProfileDetails.customer_groups || []).map(cg => cg.customer_group).filter(Boolean);
  if (posCustomerGroups.length > 0) {
    customerFiltersArr.push(['customer_group', 'in', posCustomerGroups.join(',')]);
  } else if (activePOSProfileDetails.default_customer_group) {
    customerFiltersArr.push(['customer_group', '=', activePOSProfileDetails.default_customer_group]);
  }
  const customerFilters = JSON.stringify(customerFiltersArr);
  const customersData = await fetchApi('GET', erpNextUrl, `/api/resource/Customer?fields=${customerFields}&filters=${customerFilters}&limit_page_length=0`, null, headers);
  let customers = customersData.data || [];
  
  const walkInCustomerName = activePOSProfileDetails.pos_walk_in_customer;
  if (walkInCustomerName && !customers.some(c => c.name === walkInCustomerName)) {
      try {
          const specificCustomerData = await fetchApi('GET', erpNextUrl, `/api/resource/Customer/${walkInCustomerName}?fields=${customerFields}`, null, headers);
          if (specificCustomerData.data) customers.unshift(specificCustomerData.data);
      } catch (e) {
          console.warn(`Walk-in customer "${walkInCustomerName}" not found or error fetching:`, e.message);
          if (!customers.some(c => c.name === 'Walk-in')) {
            customers.unshift({ name: 'Walk-in', customer_name: 'Walk-in Customer', customer_group: activePOSProfileDetails.default_customer_group || 'All Groups' });
          }
          activePOSProfileDetails.pos_walk_in_customer = customers[0].name;
      }
  } else if (!walkInCustomerName && customers.length === 0) {
      customers.push({ name: 'Walk-in', customer_name: 'Walk-in Customer', customer_group: 'All Groups' });
      activePOSProfileDetails.pos_walk_in_customer = 'Walk-in';
  }

  return { items, activePOSProfileDetails, companySettings, paymentModes, customers };
}

export async function submitPOSInvoice(erpNextUrl, transactionData, csrfToken) {
  console.log("Submitting POS Invoice with data:", transactionData);
  const headers = { 'Content-Type': 'application/json' };
  if (csrfToken) {
    headers['X-Frappe-CSRF-Token'] = csrfToken;
  }

  // Ensure items and payments are arrays (they should be from localDB processing)
  const itemsForApi = Array.isArray(transactionData.items) ? transactionData.items : JSON.parse(transactionData.items_json || '[]');
  const paymentsForApi = Array.isArray(transactionData.payments) ? transactionData.payments : JSON.parse(transactionData.payments_json || '[]');

  const salesInvoiceData = {
    // docstatus: 0, // Save as draft first, then submit? Or submit directly if API allows.
                      // For POS, typically submit (docstatus=1) directly.
                      // The API might handle this implicitly based on `is_pos`.
    is_pos: 1,
    customer: transactionData.customer,
    company: transactionData.company,
    pos_profile: transactionData.pos_profile,
    offline_pos_name: transactionData.offline_id, // For idempotency
    
    posting_date: transactionData.posting_date,
    posting_time: transactionData.posting_time,
    // Use posting_date for due_date if not specifically calculated
    due_date: transactionData.posting_date, 
    
    currency: transactionData.currency,
    conversion_rate: transactionData.conversion_rate || 1,
    selling_price_list: transactionData.selling_price_list,
    
    // Map items from transactionData.items (which should be an array of objects)
    items: itemsForApi.map(item => ({
      item_code: item.item_code,
      qty: item.qty,
      rate: item.rate,
      amount: item.amount,
      uom: item.uom || item.stock_uom,
      conversion_factor: item.conversion_factor || 1,
      warehouse: item.warehouse, // This should be set correctly in transactionData items
      income_account: item.income_account, // Ensure these are part of item data if needed
      cost_center: item.cost_center, // Ensure these are part of item data if needed
      // Add other mandatory item fields if any
    })),
    
    // Map payments from transactionData.payments
    payments: paymentsForApi.map(payment => ({
      mode_of_payment: payment.mode_of_payment,
      amount: payment.amount,
      // account: payment.account, // If account is determined and needed per payment mode
      type: payment.type || undefined, // Type might be needed by ERPNext
    })),
    
    update_stock: transactionData.update_stock ? 1 : 0, // Ensure boolean to int
    
    // Grand totals are usually calculated by ERPNext based on items and taxes.
    // Sending them might be ignored or could cause conflict if calculations differ.
    // It's safer to let ERPNext calculate these unless API specifically requires them.
    // grand_total: transactionData.grand_total,
    // paid_amount: transactionData.paid_amount,
    // change_amount: transactionData.change_amount,

    // Required custom fields or other standard fields
    // e.g., set_posting_time: 1 (if applicable)
  };

  // ERPNext usually requires submitting the document for it to affect ledger and stock
  // This can be done by setting docstatus = 1, or by calling a separate "submit" endpoint after creation.
  // Often, for Sales Invoice, you create it with docstatus=0 (draft) and then POST to /api/method/frappe.desk.form.save.submit_doc
  // However, for `is_pos=1`, the behavior might be to submit directly.
  // Let's try submitting directly by setting `docstatus: 1` (if API doesn't auto-submit `is_pos`)
  // Or, more commonly, the API might handle submission implicitly for POS.
  // If direct submission fails, a two-step (save draft, then submit) process might be needed.
  // For now, we'll assume direct creation as a submitted document is possible or handled by is_pos=1.

  try {
    const response = await fetchApi('POST', erpNextUrl, '/api/resource/Sales Invoice', salesInvoiceData, headers);
    console.log("POS Invoice submitted successfully to ERPNext:", response);
    return response; // Contains { data: { name: "INV-XXXX" ... } } on success
  } catch (error) {
    console.error("Error submitting POS Invoice to ERPNext:", error);
    // Attach more specific error data if possible
    const errorData = {
        message: error.message,
        statusCode: error.statusCode, // If fetchApi added it
        requestBody: salesInvoiceData // For debugging
    };
    throw errorData; // Re-throw enriched error
  }
}
