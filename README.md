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
*   **DocType:** `POS Session Log` (see `POS_CUSTOM_API.md` for schema).
*   **Custom Fields:**
    *   On `Sales Invoice` and/or `POS Invoice`: `custom_pos_attendant` (Link to User).
    *   On `Selling Settings`: `pos_walk_in_customer` (Link to Customer).

### 2. Tauri Application Configuration

Upon first launch, you need to configure the application:

*   **ERPNext Server URL:** Enter the full URL of your ERPNext server (e.g., `https://your-erp.com` or `http://localhost:8000`). This field is located in the header bar of the main POS interface.
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
*   An initial data synchronization process will be automatically triggered to fetch data relevant to the logged-in POS Profile.

### Logout
*   To log out, click the **"Logout"** button in the header.
*   This will clear your session and return you to the login screen.

## Usage Guide

### 1. Initial Data Sync
*   After a successful login, an initial data sync is automatically attempted.
*   You can also manually trigger a sync or update sync configurations (ERPNext URL, POS Profile for sync, Company for sync) using the controls in the header bar of the main POS interface.
*   Click **"Sync Initial Data"** to fetch/update local data stores (items, customers, prices, etc.).
*   A status message will indicate progress and completion. This step is crucial for offline functionality.

### 2. Customer Handling
*   Customer selection is optional.
*   By default, sales will be associated with a "Walk-in Customer". This default is configured in ERPNext (either in the POS Profile or globally in Selling Settings).
*   The name of the active customer (e.g., "Walk-in Customer" or a selected customer's name) is displayed in the cart panel.
*   (Note: The UI for searching and selecting specific customers is currently hidden to streamline the process but can be re-enabled for future needs).

### 3. Adding Items to Cart
*   **Searching:** Use the search bar in the "Items" panel to find items by name or code.
*   **Barcode Scanning:**
    *   Ensure your cursor is not in an input field where you intend to type text (e.g., payment amount). The item search bar can also accept barcode scans.
    *   Simply scan the item's barcode. Most barcode scanners emulate keyboard input, typing the barcode number and pressing "Enter".
    *   If the barcode is found in the local database, the item will be added to the cart, or its quantity incremented if already present.
*   **Clicking Item Card:** Click on an item card from the displayed list to add it to the cart.
*   **Quantity Input:**
    *   Once an item is in the cart, its quantity can be adjusted:
        *   Directly type the desired quantity into the number field next to the item.
        *   Use the "+" and "-" buttons to increment or decrement the quantity.
    *   Scanning an item that is already in the cart will increment its quantity by one.
*   **Stock Warnings:** If local stock data indicates insufficient quantity (and server settings disallow negative stock), a warning `alert` may appear. You can still add the item to the cart, but it might fail during server sync if stock is truly unavailable.

### 4. Price Check
*   Click the **"Price Check"** button in the "Items" panel.
*   A modal window will appear.
*   Scan a barcode or type an item code/name into the input field and click "Lookup" (or press Enter).
*   The item's details and its price (based on the current POS Profile and default customer context) will be displayed without adding the item to the cart.
*   Close the modal using the "×" button.

### 5. Hold & Resume Cart
*   **Holding a Cart:**
    *   If you need to temporarily suspend a transaction (e.g., customer forgot their wallet), click the **"Hold Cart"** button.
    *   You may be prompted to enter an optional name for the held cart (e.g., customer's name) for easier identification.
    *   The current cart (items, customer, any partial payments) will be saved locally, and the main cart interface will be cleared.
*   **Viewing & Resuming Carts:**
    *   Click the **"View/Resume Carts"** button.
    *   A modal will display a list of all currently held carts, showing when they were held and any name given.
    *   To resume a cart: Click the "Resume" button next to the desired cart. You'll be asked to confirm if your current cart isn't empty. The selected cart's contents (items, customer, payments) will be loaded, and it will be removed from the held list.
    *   To delete a held cart: Click the "Delete" button. You'll be asked to confirm.

### 6. Processing Payments & Completing Sale
*   Select a payment mode from the dropdown.
*   Enter the amount paid. Click "Add Payment." Multiple payments can be added.
*   Total paid and change/balance are displayed.
*   Click **"Complete Sale"**. The transaction is saved locally with a `sync_status: 'pending'`.
*   An alert confirms the offline sale. If a potential local stock issue was noted (item quantity exceeded local snapshot when negative stock is disallowed by server), this may be mentioned.

### 7. Syncing Offline Transactions
*   (Currently, explicit UI for triggering sync of pending transactions is minimal).
*   Offline transactions are intended to be synced with the ERPNext server when connectivity is available. This typically involves a background process or a manual "Sync Pending Sales" button (future enhancement).
*   The `syncOfflineTransactions` API on the backend handles the actual creation of ERPNext invoices from these local records, including setting the POS attendant ID.

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

This local data enables the POS to function without an active internet connection.
