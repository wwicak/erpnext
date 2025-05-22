# Tauri Offline POS Application

This application provides an offline-first Point of Sale (POS) interface that syncs with an ERPNext backend. It allows users to conduct sales even when network connectivity is unavailable and syncs transactions once connectivity is restored.

## Features

*   **Offline First:** Core POS operations (browsing items, creating sales, processing payments) are available without an active internet connection.
*   **ERPNext Integration:** Synchronizes products, pricing, customers, and transactions with your ERPNext instance.
*   **User Authentication:** Secure login for POS attendants, with session logging on the backend.
*   **Barcode Scanning:** Quickly add items to the cart using a barcode scanner (keyboard wedge type).
*   **Enhanced Quantity Input:** Easily adjust item quantities in the cart using typed input or +/- buttons.
*   **Price Check:** Look up item prices without adding them to the cart.
*   **Hold & Resume Cart:** Save in-progress sales and resume them later.
*   **Default Customer:** Streamlined workflow with a configurable default "Walk-in Customer".
*   **Customizable Receipt Printing:** Print sales receipts using templates configured in ERPNext.
*   **Local Data Storage:** Uses IndexedDB to store POS data locally on the device.

## Prerequisites

To develop and build the Tauri Offline POS application, you will need:

*   **Node.js and npm (or yarn/pnpm):** For managing frontend dependencies and running scripts.
    *   [Node.js Download](https://nodejs.org/)
*   **Rust:** The backend of the Tauri application is written in Rust.
    *   [Install Rust](https://www.rust-lang.org/tools/install)
*   **Tauri CLI Prerequisites:** System-specific dependencies (e.g., WebView2 for Windows, WebKitGTK for Linux, Xcode Command Line Tools for macOS).
    *   Follow the "Prerequisites" guide on the [official Tauri website](https://tauri.app/v1/guides/getting-started/prerequisites).
*   **Tauri CLI:**
    ```bash
    npm install -g @tauri-apps/cli
    # or
    yarn global add @tauri-apps/cli
    ```

## Development

1.  **Clone the repository (if applicable).**
2.  **Install frontend dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```
3.  **Run the application in development mode:**
    ```bash
    npm run tauri dev
    # or
    yarn tauri dev
    ```
    This will open the application window. Changes to frontend code (in `src/`) should trigger hot reloading.

## Building for Production

To build the application for your target operating system:

```bash
npm run tauri build
# or
yarn tauri build
```

Build artifacts (e.g., `.msi` for Windows, `.AppImage` or `.deb` for Linux, `.dmg` for macOS) will be in `src-tauri/target/release/bundle/`.

## Initial Setup & Configuration

### 1. ERPNext Backend Setup
Ensure the corresponding `erpnext.pos_custom_api` Python module is installed on your ERPNext instance. This module provides the necessary API endpoints for the POS application. Refer to `POS_CUSTOM_API.md` for details.
You will also need to manually create the following in ERPNext:
*   **DocTypes:**
    *   `POS Session Log` (for audit trails of logins).
    *   `POS Receipt Template` (for customizing printed receipts).
    (See `POS_CUSTOM_API.md` for schema details of these DocTypes).
*   **Custom Fields:**
    *   On `Sales Invoice` and/or `POS Invoice`: `custom_pos_attendant` (Link to User, Label: "POS Attendant").
    *   On `Selling Settings`: `pos_walk_in_customer` (Link to Customer, Label: "POS Walk-in Customer").

### 2. Tauri Application Configuration

Upon first launch, you need to configure the application:

*   **ERPNext Server URL:** Enter the full URL of your ERPNext server (e.g., `https://your-erp.com` or `http://localhost:8000`). This field is located in the header bar of the main POS interface (visible after login).
*   Click **"Save Sync Config"** after entering the URL. This setting is stored locally.

## User Authentication & Login

Before accessing the main POS interface, users must log in:

1.  **Launch the application.** You will be presented with a login screen.
2.  **Username:** Enter your ERPNext username.
3.  **Password:** Enter your ERPNext password.
4.  **POS Profile:** Enter the exact name of the POS Profile configured in ERPNext that this terminal session should use. This profile dictates settings like default warehouse, pricing, available payment modes, etc.
5.  Click **"Login"**.

Upon successful authentication:
*   The main POS interface will be displayed.
*   Your full name and the active POS Profile name will be shown in the header.
*   An initial data synchronization process will be automatically triggered to fetch data relevant to the logged-in POS Profile, including the receipt template.

### Logout
*   To log out, click the **"Logout"** button in the header.
*   This will clear your session and return you to the login screen.

## Usage Guide

### 1. Initial Data Sync
*   After a successful login, an initial data sync is automatically attempted. This fetches items, prices, customers, stock levels, payment modes, tax templates, company settings, and the relevant receipt template.
*   You can also manually trigger a sync or update sync configurations (ERPNext URL, POS Profile for sync, Company for sync) using the controls in the header bar of the main POS interface.
*   Click **"Sync Initial Data"** to fetch/update local data stores.
*   A status message will indicate progress and completion. This step is crucial for offline functionality.

### 2. Customer Handling
*   Customer selection is optional.
*   By default, sales will be associated with a "Walk-in Customer". This default is configured in ERPNext (either in the POS Profile or globally in Selling Settings) and fetched during initial sync.
*   The name of the active customer is displayed in the cart panel.

### 3. Adding Items to Cart
*   **Searching:** Use the search bar in the "Items" panel to find items by name or code.
*   **Barcode Scanning:** Scan an item's barcode. The item will be added to the cart, or its quantity incremented if already present. The item search bar can also accept barcode scans.
*   **Clicking Item Card:** Click on an item card from the displayed list to add it to the cart.
*   **Quantity Input:** Adjust quantity using the input field or +/- buttons in the cart. Scanning an item already in the cart increments its quantity.
*   **Stock Warnings:** Local stock levels are checked. If insufficient and server disallows negative stock, a warning may appear. The item can still be added, but sync might fail if stock is unavailable on the server.

### 4. Price Check
*   Click the **"Price Check"** button.
*   Scan a barcode or type an item code/name into the modal and lookup.
*   Item details and price (based on current POS context) are displayed.

### 5. Hold & Resume Cart
*   **Holding:** Click **"Hold Cart"**. Optionally name the cart. The current cart is saved locally, and the main cart interface clears.
*   **Viewing & Resuming:** Click **"View/Resume Carts"**. A modal lists held carts. Click "Resume" to load a cart (confirming discard of current cart if not empty) or "Delete" to remove it.

### 6. Processing Payments & Completing Sale
*   Select payment mode(s) and enter amounts.
*   Click **"Complete Sale"**. The transaction is saved locally.
*   An alert confirms the offline sale. Receipt printing (if configured) is triggered.

### 7. Receipt Printing
*   **Configuration:** Receipt layouts are managed in ERPNext via the "POS Receipt Template" Doctype. Templates can be linked to a POS Profile or set as a company default. The relevant template is fetched during initial data sync.
*   **Automatic Printing:** Printing usually occurs automatically after a sale is completed. (Note: An application-level setting to control auto-print is a conceptual future enhancement).
*   **Reprinting:** A "Print Last Receipt" button allows reprinting the last completed transaction's receipt.
*   **Printer Setup (User Guidance):**
    *   Ensure your POS printer (thermal/dot-matrix, typically 76-80mm width) is installed and configured in your operating system.
    *   The application uses the OS's standard print dialog. Select your POS printer in this dialog.
    *   For a smoother experience, consider setting your POS printer as the default printer in your OS settings.
    *   The generated receipt HTML is optimized for narrow paper common in POS printers.

### 8. Syncing Offline Transactions
*   Offline transactions are stored locally and are intended to be synced with ERPNext when connectivity is available.
*   (Note: The UI for manually triggering the sync of pending transactions or viewing detailed sync status is a future enhancement. Currently, sync is primarily managed during the initial data load after login or via the manual "Sync Initial Data" button which would also sync pending transactions if that logic is added to `syncOfflineTransactions`'s caller).

## Local Data Storage (IndexedDB)

The application uses IndexedDB (via Dexie.js) to store data locally for offline use:

*   **`pos_profiles`**: Configuration of the POS terminal.
*   **`items`**: Product catalog, including details, UOMs, `barcodes_searchable` array.
*   **`item_prices`**: Pricing rules.
*   **`customers`**: Customer information.
*   **`warehouses`**: Warehouse details.
*   **`stock_levels`**: Snapshots of item quantities.
*   **`payment_modes`**: Available payment methods.
*   **`tax_templates`**: Tax templates.
*   **`company_settings`**: ERPNext company settings (e.g., `allow_negative_stock`, `pos_walk_in_customer`).
*   **`offline_transactions`**: Sales made while offline.
*   **`held_carts`**: Temporarily saved carts.
*   **`receipt_template_data`**: (Conceptual - could be stored in `localStorage` or a dedicated store if fetched separately, currently part of initial sync payload and used directly).

This local data enables the POS to function without an active internet connection.
