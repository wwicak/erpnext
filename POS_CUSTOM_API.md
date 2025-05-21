# POS Custom API Documentation

This document details the custom API endpoints created in `erpnext.pos_custom_api` for the Offline POS application. These endpoints facilitate data synchronization between the ERPNext server and the offline-capable POS terminals.

## 1. `pos_login`

*   **Endpoint:** `/api/method/erpnext.pos_custom_api.pos_login`
*   **Purpose:** Authenticates a POS user against ERPNext credentials and creates a session log entry for auditing purposes. Optionally associates the login with a specific POS Profile.
*   **Method:** `POST`
*   **Parameters:**
    *   `usr` (String, Mandatory): The User ID (typically email address) of the user attempting to log in.
    *   `pwd` (String, Mandatory): The password for the user.
    *   `pos_profile_name` (String, Optional): The name of the POS Profile this login session is associated with. This can be used for logging and context.
*   **Request Body Structure:**
    ```json
    {
        "usr": "pos_attendant@example.com",
        "pwd": "securepassword123",
        "pos_profile_name": "Shop A POS"
    }
    ```
*   **Successful Response Example (200 OK):**
    ```json
    {
        "message": "Authentication Success",
        "user_id": "pos_attendant@example.com",
        "full_name": "POS Attendant Name",
        "session_csrf_token": "abcdef1234567890" 
    }
    ```
*   **Error Response Example (401 Unauthorized - Authentication Failed):**
    ```json
    {
        "error": "Invalid login credentials", 
        "error_title": "Authentication Failed"
    }
    ```
*   **Error Response Example (500 Internal Server Error - Other issues):**
    ```json
    {
        "error": "An unexpected error occurred during login.",
        "error_title": "Login Error"
    }
    ```
*   **Key Validations/Logic:**
    *   Uses `frappe.login_manager.authenticate` for standard ERPNext authentication.
    *   (Optional, currently commented out in code): Can be configured to check if the authenticated user has a specific role (e.g., "POS Attendant").
    *   On successful authentication, creates a `POS Session Log` entry with `event_type="Login"`.
    *   Returns user details and a `session_csrf_token` which might be needed for subsequent authenticated API calls if not using cookie-based sessions for all requests.

## 2. `get_initial_pos_data`

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
    *   Includes `allow_negative_stock` from global `Stock Settings` in `company_settings`.
    *   **Customer Data:** Ensures that the default "Walk-in Customer" (from `POS Profile.customer` or `Selling Settings.pos_walk_in_customer`) is included in the customer list if they exist and are part of the company, even if disabled (as defaults might need to be selectable).
    *   **Item Data:** Item objects include a `barcodes_searchable` array field (populated from `Item Barcode` child table or direct barcode field) to facilitate efficient barcode lookups on the client-side. Item objects also include a `uoms` array with UOMs and their conversion factors.

## 3. `sync_offline_transactions`

*   **Endpoint:** `/api/method/erpnext.pos_custom_api.sync_offline_transactions`
*   **Purpose:** Syncs a list of transactions created offline on a POS terminal to the ERPNext server. It attempts to create POS Invoices (or Sales Invoices based on configuration) for each transaction.
*   **Method:** `POST`
*   **Parameters:**
    *   `transactions_list` (list of objects, required): A list where each object represents an offline transaction.
    *   `pos_profile_name` (string, required): The name of the POS Profile from which these transactions originated.
    *   `company` (string, required): The company associated with the POS Profile.
    *   `attendant_user_id` (string, optional): The User ID of the logged-in POS attendant who processed the transactions.
*   **Request Body Structure:**
    ```json
    {
        "pos_profile_name": "My Shop POS",
        "company": "My Company LLC",
        "attendant_user_id": "pos_user@example.com", // Optional
        "transactions_list": [
            {
                "name": "OFFLINE-TX-001", // Temporary offline ID for reference
                "customer": "", // Can be empty if default customer is to be used
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
    *   **Default Customer Fallback:** If `customer` is not provided in an individual transaction object, the system attempts to assign a default customer. The lookup order is: 1. `POS Profile.customer`, 2. `Selling Settings.pos_walk_in_customer` (custom field).
    *   **Attendant ID:** If `attendant_user_id` is provided and the target invoice doctype has a `custom_pos_attendant` field, this field is set with the provided User ID.
    *   **Stock Validation:** Performs rigorous real-time stock validation for each item *before* inserting the invoice document, considering global `Stock Settings.allow_negative_stock`. If validation fails, the transaction is rejected.
    *   Maps fields from the transaction payload to the ERPNext invoice document.
    *   Derives payment accounts and item income/cost center accounts based on defaults if not provided.
    *   Calls standard ERPNext document validation methods (`set_missing_values`, controller validations like `validate_selling_price_list`, `validate_items`, `calculate_taxes_and_totals`, etc.) before insertion and submission.
    *   If insertion is successful but submission fails, attempts to delete the draft document to prevent orphaned drafts.

## 4. `get_updated_master_data`

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

## 5. `get_receipt_template_details`

*   **Endpoint:** `/api/method/erpnext.pos_custom_api.get_receipt_template_details`
*   **Purpose:** Fetches the relevant POS receipt template for a given POS Profile and Company.
*   **Method:** `POST`
*   **Parameters:**
    *   `pos_profile_name` (String, Optional): The name of the POS Profile. If provided, the system will first look for a template specifically linked to this profile.
    *   `company` (String, Optional): The name of the Company. This is used to find a company-wide default template if no profile-specific template is found or if `pos_profile_name` is not provided. The API will attempt to derive the company from the POS Profile if only `pos_profile_name` is given. If company context cannot be established, an error is thrown.
*   **Request Body Structure Examples:**
    ```json
    // To get template for a specific POS Profile (company can be derived)
    {
        "pos_profile_name": "My Shop POS" 
    }
    ```
    ```json
    // To get a company's default template (if no POS Profile specified)
    {
        "company": "My Company LLC"
    }
    ```
*   **Response Payload Structure (Successful):**
    A JSON object representing a single `POS Receipt Template` document (or a system default).
    ```json
    {
        "message": {
            "name": "My Cafe Receipt", // Name of the POS Receipt Template document or "_system_default_"
            "template_name": "My Cafe Receipt", // Or "System Default Receipt"
            "company": "My Company LLC",
            "pos_profile": "My Shop POS", // Or null
            "is_default": 0, // 1 if it's a company default not tied to a specific profile
            "receipt_width_mm": 78,
            "header_logo": "/files/my_logo.png", // Full URL if absolute, or relative path
            "header_text": "<div style='text-align:center;'><h1>My Cafe</h1><p>123 Main St</p></div>",
            "item_line_format": "{qty} x {item_name} @ {rate} = {amount}",
            "subtotal_label": "Subtotal:",
            "tax_label_format": "{description} ({tax_rate}%): {amount}",
            "grand_total_label": "TOTAL:",
            "payment_mode_label_format": "{mode_of_payment}: {amount}",
            "change_due_label": "Change Due:",
            "footer_text": "<p style='text-align:center;'>Thanks for your visit!</p>",
            "font_size_css": "10pt",
            "line_spacing_css": "1.2",
            "disable_erpnext_branding": 1
            // ... any other fields from the POS Receipt Template Doctype
        }
    }
    ```
*   **Fallback Logic & System Default:**
    1.  **Profile-Specific:** The system first tries to find a `POS Receipt Template` directly linked to the `pos_profile_name` (and matching `company`, `disabled=0`).
    2.  **Company Default:** If no profile-specific template is found, it looks for a template marked as `is_default=1` for the given `company` (`disabled=0`).
    3.  **System Default:** If neither is found, or if the `POS Receipt Template` Doctype does not exist, a hardcoded system default template is returned. This system default will have its `name` field set to `_system_default_`. Its `header_text` includes placeholders like `{company_name}`, `{company_address}`, and `{company_phone}` which are populated by the API using the Company's details.
*   **Note:** If the `POS Receipt Template` Doctype itself does not exist in the system, the API will log a warning and return the system default.

## Appendix

### A.1. `POS Session Log` Doctype

*   **Purpose:** Logs POS user login and logout events for auditing. This Doctype needs to be manually created in ERPNext if it doesn't exist.
*   **Key Fields:**
    *   `user` (Link to User, Mandatory): The user who performed the action.
    *   `event_type` (Select, Mandatory; Options: "Login", "Logout"): The type of event being logged.
    *   `timestamp` (Datetime, Mandatory; Default: Now): The exact date and time of the event.
    *   `pos_profile` (Link to POS Profile, Optional): The POS Profile associated with the session, if applicable.
    *   `ip_address` (Data, Optional): The IP address from which the user initiated the session.
    *   `notes` (Small Text, Optional): Any additional notes related to the session event (e.g., successful login, failed attempt details if logged).
*   **Permissions:** System Manager should have full access. Other roles may be granted read or create access as needed. Log entries are typically created by the system/API on behalf of the user.

### A.2. `POS Receipt Template` Doctype
*   **Purpose:** Allows users to define custom layouts and content for POS receipts. Templates can be specific to a POS Profile or set as a company-wide default.
*   **Key Fields (Illustrative - see full definition in development tasks):**
    *   `template_name` (Data, Mandatory, Unique): User-friendly name for the template.
    *   `company` (Link to Company, Mandatory): Company this template belongs to.
    *   `pos_profile` (Link to POS Profile, Optional, Unique): If set, this template is exclusively for this POS Profile.
    *   `is_default` (Check): If checked, this template is the default for the company (used if no profile-specific template is found).
    *   `header_logo` (Attach Image): Logo for the receipt header.
    *   `header_text` (Text Editor): HTML/Text for the receipt header (e.g., shop name, address).
    *   `item_line_format` (Small Text): Format string for item lines (e.g., `"{qty} x {item_name} - {rate} - {amount}"`).
    *   `tax_label_format` (Data): Format for tax lines (e.g., `"{description} ({tax_rate}%): {amount}"`).
    *   `footer_text` (Text Editor): HTML/Text for the receipt footer (e.g., thank you message, terms).
    *   `receipt_width_mm` (Int): Width of the receipt paper in millimeters (e.g., 78).
    *   `font_size_css` (Data): CSS font size (e.g., "10pt", "12px").
    *   `line_spacing_css` (Data): CSS line-height value (e.g., "1.2").
    *   `disable_erpnext_branding` (Check): Option to hide "Powered by ERPNext".
*   **Placeholders:** The text fields (`header_text`, `item_line_format`, `footer_text`, etc.) can use placeholders that the client-side application will replace with actual transaction data (e.g., `{company_name}`, `{item_name}`, `{grand_total}`). The system default template uses `{company_name}`, `{company_address}`, and `{company_phone}` in its `header_text` which are populated by the API.

---

This documentation should provide a good starting point for developers using the API and for understanding its functionality.
