# Vue 3 Offline-First POS System for ERPNext

## Overview

This is an offline-first Point of Sale (POS) application designed to integrate with an ERPNext backend. It's built with modern web technologies, allowing for a responsive user experience and robust offline capabilities. Clerks can make sales even without an active internet connection, and these transactions can be synced to ERPNext later. The application also includes an Admin Panel for configuration and monitoring.

**Key Technologies:** Vue 3, Vite, Pinia (state management), Vue Router, Tailwind CSS (styling), TanStack Vue Query (data fetching/caching), and `wa-sqlite` (for client-side SQLite database via WASM, enabling offline storage).

## Features

### POS Interface (for Clerks)
*   **Login/Logout:** Secure login for POS clerks. Includes an automatic logout feature based on inactivity, configurable by an admin.
*   **Offline Sale Completion:** Core sales operations (adding items, processing payments) function without an active internet connection. Transactions are saved locally.
*   **Item Search & Barcode Scanning:** Efficiently find items by name, code, or by using a USB barcode scanner (HID keyboard wedge type).
*   **Cart Management:** Add items, update quantities with +/- buttons or direct input, remove items, and clear the entire cart.
*   **Payment Processing:** Supports multiple payment modes (configurable if linked to POS Profile in ERPNext).
*   **Hold & Resume Cart:** Save in-progress sales locally and resume them later, allowing multiple customers to be handled efficiently.
*   **Price Check:** Quickly look up item prices without adding them to the cart.
*   **Synchronization:** Sync completed offline sales with the ERPNext server when connectivity is available.

### Admin Panel
*   **Secure Admin Login:** Dedicated login for administrators with a default password that must be changed on first login.
*   **ERPNext URL Configuration:** Set and test the connection to the ERPNext server.
*   **Barcode Scanner Setup Guide & Test:** Provides information on configuring common USB barcode scanners and an area to test scanner input.
*   **Receipt Printer Setup Guide & Test Print:** Guides on setting up thermal receipt printers using browser-based printing and allows printing a sample receipt.
*   **Clerk Activity Logging & Viewing:** Tracks key clerk actions (logins, logouts, sales, cart operations) locally for audit and review.
*   **Daily Sales Report:** View a summary of sales transactions grouped by date, sourced from local offline transaction data.
*   **API Sync Log Viewing:** View logs of attempts to sync offline sales to ERPNext, including success/failure status and error messages.
*   **Auto-Logout Configuration:** Set the inactivity timeout duration for automatic logout of POS clerks.

## Prerequisites (Development)

*   **Node.js:** Version 18.x or later recommended.
*   **npm** (usually comes with Node.js) or **yarn**.

## Project Setup and Installation (Development)

1.  **Clone the Repository:**
    ```bash
    git clone <repository-url>
    cd <repository-name>
    ```

2.  **Navigate to the Frontend Project Directory:**
    The Vue 3 application is located in the `/src` directory of this project structure. However, `package.json` and `vite.config.js` are at the root. So, commands should be run from the root.
    ```bash
    # cd <repository-name> # (You should already be here)
    ```

3.  **Install Dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```

4.  **Run the Development Server:**
    ```bash
    npm run dev
    # or
    yarn dev
    ```

5.  Open your browser and navigate to the URL provided by Vite (typically `http://localhost:5173` or similar).

## Configuration

### 1. Connecting POS to ERPNext
*   The primary setting required is the **ERPNext Server URL**.
*   After logging into the Admin Panel, navigate to **Settings > ERPNext Configuration**.
*   Enter the full URL of your ERPNext instance (e.g., `https://your-company.erpnext.com` or `http://localhost:8000`).
*   Click "Save & Test Connection" to verify and save the URL. This URL is stored locally in the browser's `localStorage`.
*   **POS Profile & Company for Sync:** These settings (visible read-only in Admin's ERPNext Config page) are typically configured by the POS Clerk via the "Sync Controls" in the POS interface after they log in. This allows different POS terminals/clerks to use different POS Profiles.

### 2. Barcode Scanner Setup
*   Refer to **Admin Panel > Settings > Barcode Settings** for guidance and a test area.
*   Most USB barcode scanners function as Human Interface Devices (HID), emulating keyboard input. They are usually plug-and-play.
*   **Crucial Recommendation:** Configure your scanner to send an **"Enter" (Carriage Return/Line Feed) suffix** after each scan. This allows the application to reliably detect the end of a barcode input, especially for the global scanner listener in the POS interface. Consult your scanner's manual for instructions (often involves scanning configuration barcodes).
*   **Troubleshooting:**
    *   Ensure your OS recognizes the scanner.
    *   Test if the scanner types into a simple text editor (e.g., Notepad, TextEdit). If not, it's a system/scanner configuration issue.
    *   Ensure the scanner's output language/layout matches your system's keyboard layout.

### 3. Receipt Printer Setup
*   Refer to **Admin Panel > Settings > Printer Settings** for guidance and a test print button.
*   The application uses the browser's built-in print functionality (`window.print()`).
*   **Setup Guide:**
    1.  Install your receipt printer (typically thermal or dot-matrix, e.g., 72mm or 80mm width) in your operating system.
    2.  In the OS printer settings, set the correct paper size (e.g., "72mm x Receipt", "80mm x Receipt", or a custom size matching your paper roll).
    3.  Set margins to "None" or the minimum possible.
    4.  Set scale to 100% or "Actual Size".
    5.  In the browser's print preview dialog (appears when you print):
        *   Select your receipt printer.
        *   Verify paper size and orientation (usually Portrait).
        *   Set margins to "None" or "Minimum".
        *   Disable "Headers and footers".
        *   Ensure scale is 100%.
    *   For a smoother experience, you can set your receipt printer as the **default printer** in your OS if this computer is primarily for POS use.
*   **Troubleshooting:**
    *   Check the OS printer queue for errors.
    *   Use the "Test Print Sample Receipt" button in the Admin Panel. Carefully examine the browser's print preview.
    *   If text is cut off or formatting is incorrect, the issue is almost always related to paper size, margins, or scale settings in the OS printer properties or the browser's print dialog.

### 4. Admin Panel First Login
*   Navigate to `/admin` or `/admin/login`.
*   Default credentials:
    *   Username: `admin`
    *   Password: `passwordChange123`
*   You will be **mandatorily redirected to change this default password** after your first successful login. This is crucial for security.

### 5. Auto-Logout Configuration
*   The automatic logout timer for inactive POS clerks can be configured in the **Admin Panel > Settings > App Settings**.
*   Enter the desired timeout duration in minutes. Setting it to `0` disables the auto-logout feature.
*   This setting is stored locally in the browser's `localStorage`.

## Usage

### POS Clerk Interface
1.  **Login:** Access the POS via the root path (`/`). Enter your ERPNext username, password, and the POS Profile name configured for your terminal/role.
2.  **Initial Data Sync:** After login, essential data (items, prices, customers, etc.) is fetched from ERPNext based on your POS Profile. This may take a moment. A loading indicator will be shown.
3.  **Adding Items:**
    *   Use the search bar in the left panel to find items by name or code.
    *   Scan item barcodes using a configured USB scanner.
    *   Click "Add to Cart" on an item card.
4.  **Cart Management:**
    *   Adjust quantities using the input field or +/- buttons next to each item in the cart (right panel).
    *   Remove items by clicking the "Remove" button.
5.  **Customer:** A default customer (e.g., "Walk-in Customer") is usually pre-selected. Customer selection features can be expanded.
6.  **Hold/Resume:**
    *   Click "Hold Cart" to save the current cart locally and clear the interface for a new sale.
    *   Click "View/Resume Carts" to open a modal listing all held carts. You can resume or delete them.
7.  **Payments & Completion:**
    *   Once all items are added, use the "Payment" section to add payments by mode (e.g., Cash, Card).
    *   The system calculates Total Paid, Balance Due, and Change.
    *   Click "Complete Sale" when payment is sufficient. The sale is saved locally in the offline database.
8.  **Receipt Printing:** A receipt should be triggered for printing via the browser's print dialog after sale completion (ensure printer is configured).
9.  **Sync Controls (Header):**
    *   Displays ERPNext URL, POS Profile, and Company used for initial data sync. These can be reconfigured here if needed, followed by "Save Sync Config".
    *   "Sync Offline Sales" button: Manually triggers the synchronization of locally saved sales to ERPNext. Displays pending count and sync status.

### Admin Panel Interface
1.  **Login:** Navigate to `/admin/login` and use the admin credentials. Change password if it's the first login.
2.  **Dashboard:** A placeholder welcome page.
3.  **Change Password:** Allows changing the admin password.
4.  **Settings:**
    *   **ERPNext Configuration:** Manage and test the ERPNext server URL.
    *   **Barcode Settings:** View setup advice and test your barcode scanner.
    *   **Printer Settings:** View setup advice for receipt printers and print a test receipt.
    *   **App Settings:** Configure application-level settings like the POS clerk auto-logout timer.
5.  **System Logs:**
    *   **Clerk Activity Log:** View a log of clerk actions (logins, sales, etc.).
    *   **API Sync Log:** View detailed logs of attempts to sync offline sales to ERPNext.
6.  **Reports:**
    *   **Daily Sales Report:** View a summary of total sales per day, based on locally stored transactions.
7.  **Logout:** Use the "Logout" button in the sidebar to securely log out of the Admin Panel.

## Technologies Used

*   **Vue 3:** Progressive JavaScript framework for building the user interface.
*   **Vite:** Fast frontend build tool and development server.
*   **Pinia:** State management library for Vue.js.
*   **Vue Router:** Official router for Vue.js.
*   **Tailwind CSS:** Utility-first CSS framework for styling.
*   **TanStack Vue Query:** For data fetching, caching, and server state management (used for initial data sync).
*   **`wa-sqlite`:** WebAssembly (WASM) build of SQLite, enabling a full SQLite database to run in the browser for robust offline storage. Persisted via IndexedDB.

## Troubleshooting (General)

*   **Connection Issues:** Ensure the ERPNext URL configured in the Admin Panel is correct and that your ERPNext server is running and accessible from the device running the POS.
*   **Browser Console:** For any unexpected behavior, open your browser's developer tools (usually by pressing F12) and check the "Console" tab for error messages.
*   **Hardware Issues (Scanner, Printer):**
    *   **Scanner:** Test if it types correctly into a simple text editor first. If not, it's likely a scanner configuration or OS driver issue.
    *   **Printer:** Print a test page from your operating system's printer settings to confirm basic printer functionality. Then, check browser print preview settings carefully.
*   **Data Not Syncing:**
    *   Check the Admin Panel > API Sync Log for detailed error messages from ERPNext.
    *   Ensure your ERPNext server is reachable and the POS user has the necessary permissions.
    *   Verify the CSRF token handling if POST/PUT requests are failing (though this is largely handled internally).

---

This README provides a comprehensive guide to the Vue 3 Offline-First POS System. For specific API details or backend setup for ERPNext, refer to any accompanying backend documentation.
