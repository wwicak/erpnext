# POS Custom API Documentation

This document details the custom API endpoints created in `erpnext.pos_custom_api` for the Offline POS application. These endpoints facilitate data synchronization between the ERPNext server and the offline-capable POS terminals.

## 1. `get_initial_pos_data`

*   **Endpoint:** `/api/method/erpnext.pos_custom_api.get_initial_pos_data`
*   **Purpose:** Fetches all essential master data required for a POS terminal to start operating offline. This includes POS profile settings, items, prices, stock levels, customers, and other relevant configurations.
*   **Method:** `POST`
*   **Parameters:**
    *   `pos_profile_name` (string, required): The name of the POS Profile for which data is being requested.
    *   `company` (string, required): The company associated with the POS Profile.
*   **Request Body Structure:**
    ```json
    {
        "pos_profile_name": "My Shop POS",
        "company": "My Company LLC"
    }
    ```
*   **Response Payload Structure (Successful):**
    A JSON object containing various keys, each holding an array or object of data:
    ```json
    {
        "message": {
            "pos_profile_settings": { /* POSProfile DocType as_dict() output */ },
            "items": [ /* List of Item objects with details like item_code, item_name, stock_uom, barcodes, uoms, etc. */ ],
            "item_prices": [ /* List of Item Price objects */ ],
            "warehouses": [ /* List of Warehouse objects relevant to the POS profile */ ],
            "stock_levels": [ /* List of objects like { item_code, warehouse, actual_qty, timestamp } */ ],
            "customers": [ /* List of Customer objects relevant to the POS profile */ ],
            "payment_modes": [ /* List of Payment Mode DocType as_dict() outputs for modes in POS Profile */ ],
            "tax_templates": [ /* List of Sales Taxes and Charges Template objects */ ],
            "company_settings": { /* Object containing company-specific settings like default_currency, allow_negative_stock, etc. */ }
        }
    }
    ```
    *Example (partial for brevity):*
    ```json
    {
        "message": {
            "pos_profile_settings": {
                "name": "My Shop POS",
                "warehouse": "Stores - MS",
                "currency": "USD",
                "income_account": "Sales - MS",
                "payments": [
                    {"payment_mode": "Cash", "default_account": "Cash - MS"}
                ]
                // ... other POS Profile fields
            },
            "items": [
                {
                    "item_code": "ITM001",
                    "item_name": "Sample Item 1",
                    "stock_uom": "Nos",
                    "is_stock_item": 1,
                    "barcodes": [{"barcode": "123456789012", "barcode_uom": "Nos"}],
                    "uoms": [{"uom": "Nos", "conversion_factor": 1.0}]
                    // ... other item fields
                }
            ],
            "item_prices": [
                {"item_code": "ITM001", "price_list": "Standard Selling", "price_list_rate": 10.0, "currency": "USD"}
            ],
            "stock_levels": [
                {"item_code": "ITM001", "warehouse": "Stores - MS", "actual_qty": 100, "timestamp": "2024-03-15 10:00:00"}
            ],
            "company_settings": {
                "name": "My Company LLC",
                "default_currency": "USD",
                "allow_negative_stock": 0 
                // ... other company settings
            }
            // ... other data categories
        }
    }
    ```
*   **Key Validations/Logic:**
    *   Validates that the POS Profile exists and belongs to the specified company.
    *   Fetches data based on POS Profile configurations (e.g., item groups, customer groups, specified warehouse).
    *   Includes `allow_negative_stock` from global `Stock Settings`.

## 2. `sync_offline_transactions`

*   **Endpoint:** `/api/method/erpnext.pos_custom_api.sync_offline_transactions`
*   **Purpose:** Syncs a list of transactions created offline on a POS terminal to the ERPNext server. It attempts to create POS Invoices (or Sales Invoices based on configuration) for each transaction.
*   **Method:** `POST`
*   **Parameters:**
    *   `transactions_list` (list of objects, required): A list where each object represents an offline transaction.
    *   `pos_profile_name` (string, required): The name of the POS Profile from which these transactions originated.
    *   `company` (string, required): The company associated with the POS Profile.
*   **Request Body Structure:**
    ```json
    {
        "pos_profile_name": "My Shop POS",
        "company": "My Company LLC",
        "transactions_list": [
            {
                "name": "OFFLINE-TX-001", // Temporary offline ID for reference
                "customer": "Walk-in", // or Customer Name
                "posting_date": "2024-03-15",
                "posting_time": "10:30:00",
                "currency": "USD",
                "conversion_rate": 1.0,
                "selling_price_list": "Standard Selling",
                "items": [
                    {
                        "item_code": "ITM001",
                        "qty": 2,
                        "rate": 10.0,
                        "amount": 20.0,
                        "warehouse": "Stores - MS",
                        "uom": "Nos",
                        "conversion_factor": 1.0
                        // ... other item fields like serial_no, batch_no, income_account, cost_center
                    }
                ],
                "payments": [
                    {
                        "mode_of_payment": "Cash",
                        "amount": 20.0
                        // account will be derived by backend based on POS Profile/Payment Mode setup
                    }
                ],
                "paid_amount": 20.0,
                "grand_total": 20.0,
                "update_stock": 1,
                "offline_pos_name": "OFFLINE-TX-001", // Can be same as name or another local reference
                "local_stock_issue": false // Optional flag from client
                // ... other relevant header fields like loyalty_program, coupon_code, etc.
            }
            // ... more transactions
        ]
    }
    ```
*   **Response Payload Structure (Successful):**
    A JSON object containing a list of results, one for each transaction processed.
    ```json
    {
        "message": [
            {
                "name": "OFFLINE-TX-001", // Original offline ID from request
                "success": true,
                "doc_id": "POSINV-ACC-2024-00123", // ERPNext document name if successful
                "message": "POS Invoice POSINV-ACC-2024-00123 created and submitted successfully."
            },
            {
                "name": "OFFLINE-TX-002",
                "success": false,
                "error": "Item ITM002: Insufficient stock in Warehouse Stores - MS. Available: 0, Requested (in stock UOM Nos): 1.",
                "doc_id": null
            }
            // ... results for other transactions
        ]
    }
    ```
*   **Key Validations/Logic:**
    *   Validates POS Profile and Company.
    *   Determines whether to create `POS Invoice` or `Sales Invoice` based on `Accounts Settings.use_sales_invoice_in_pos`.
    *   **Performs rigorous real-time stock validation for each item *before* inserting the invoice document**, considering global `Stock Settings.allow_negative_stock`. If validation fails, the transaction is rejected.
    *   Maps fields from the transaction payload to the ERPNext invoice document.
    *   Derives payment accounts and item income/cost center accounts based on defaults if not provided.
    *   Calls standard ERPNext document validation methods (`set_missing_values`, controller validations like `validate_selling_price_list`, `validate_items`, `calculate_taxes_and_totals`, etc.) before insertion and submission.
    *   If insertion is successful but submission fails, attempts to delete the draft document to prevent orphaned drafts.

## 3. `get_updated_master_data`

*   **Endpoint:** `/api/method/erpnext.pos_custom_api.get_updated_master_data`
*   **Purpose:** Fetches master data that has been created or modified since a specified timestamp. Also includes information about deleted documents.
*   **Method:** `POST`
*   **Parameters:**
    *   `pos_profile_name` (string, required): The name of the POS Profile.
    *   `company` (string, required): The company associated with the POS Profile.
    *   `last_sync_timestamp` (string, required): ISO format timestamp (e.g., `YYYY-MM-DD HH:MM:SS`) indicating the last time data was successfully synced.
*   **Request Body Structure:**
    ```json
    {
        "pos_profile_name": "My Shop POS",
        "company": "My Company LLC",
        "last_sync_timestamp": "2024-03-14 18:00:00"
    }
    ```
*   **Response Payload Structure (Successful):**
    A JSON object where each key is a DocType name, and the value is a list of documents of that type that have been updated. Includes a special key `DeletedDocuments`.
    ```json
    {
        "message": {
            "Item": [
                { "name": "ITM003", "item_name": "New Item", "modified": "2024-03-15 09:30:00", /* ...other fields... */ }
            ],
            "Customer": [
                { "name": "CUST005", "customer_name": "Updated Customer", "modified": "2024-03-15 10:00:00", /* ...other fields... */ }
            ],
            "Item Price": [ 
                /* ... updated item prices ... */
            ],
            "POS Profile": [
                { /* Full POS Profile document as_dict() if it was updated */ }
            ],
            "DeletedDocuments": {
                "Item": ["ITM002"], // List of item codes that were deleted
                "Customer": ["CUST004"]
            }
            // ... other doctypes specified in `doctypes_to_sync` in the Python code
        }
    }
    ```
    *If no updates for a specific doctype, its key might be absent or have an empty list.*
*   **Key Validations/Logic:**
    *   Validates POS Profile and Company.
    *   Parses `last_sync_timestamp`.
    *   Iterates through a predefined list of DocTypes (`doctypes_to_sync` in the Python code).
    *   Filters documents based on the `modified` field being greater than `last_sync_timestamp`.
    *   Applies specific filters for certain DocTypes (e.g., item groups for Items, relevant price lists for Item Prices).
    *   For certain DocTypes (like `POS Profile`, `Sales Taxes and Charges Template`, `Payment Mode`), it fetches the full document dictionary if updated, to include child table data.
    *   Fetches deleted document entries from `tabDeleted Document` based on their creation timestamp and if the `deleted_doctype` is in the tracked list.
---

This documentation should provide a good starting point for developers using the API and for understanding its functionality.Okay, I have created `README.md` and `POS_CUSTOM_API.md`.

Now, I will create the third deliverable: an outline of the deployment strategy and auto-update considerations. I will create this as a new file named `DEPLOYMENT_CONSIDERATIONS.md`.
