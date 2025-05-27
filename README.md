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

## Development Environment Setup (Offline Mode)

This section details how to set up a local development environment where the POS application can run without a live ERPNext backend. This is useful for focusing on UI/UX development and features that don't require real-time ERPNext interaction. We'll use `json-server` to simulate the ERPNext API.

*(Note: Commands are generally shown using `npm`. If you are using `yarn`, the equivalent commands (e.g., `yarn install`, `yarn dev`, `yarn build`, `yarn add --dev <package>`) can be used.)*

**Prerequisites:**

*   Node.js and npm installed.
*   Git installed.

**Steps:**

1.  **Clone the Repository & Basic Setup:**
    *   If you haven't already, clone the repository and navigate into the project's root directory.
    *   Install the main frontend dependencies:
        ```bash
        cd src
        npm install
        cd ..
        # Return to project root
        ```

2.  **Install `json-server`:**
    *   `json-server` will act as our mock ERPNext API. Install it as a development dependency for the frontend project.
        ```bash
        npm install --save-dev json-server --prefix src
        ```

3.  **Create Mock API Data (`db.json`):**
    *   In your `src` directory, create a file named `db.json`. This file will contain the mock data that `json-server` will serve.
    *   Below is an example structure. You'll need to populate it with more comprehensive data that matches the fields expected by the `fetchInitialPOSData` function in `src/services/api.js`.
        *Ensure the `name` field of your "POS Profile" object in `db.json` (e.g., "Mock POS Profile") exactly matches the value you set for `VITE_POS_PROFILE_OFFLINE` in your `src/.env.local` file. This is important for the offline login to correctly identify the mock POS Profile.*

        ```json
        // src/db.json
        {
          "POS Profile": [
            {
              "name": "Mock POS Profile",
              "company": "Mock Company Inc.",
              "warehouse": "Mock Warehouse - MCI",
              "currency": "USD",
              "selling_price_list": "Mock Selling Price List",
              "default_customer_group": "All Customer Groups",
              "default_customer": "Walk-in-Offline",
              "payments": [
                { "mode_of_payment": "Cash", "type": "Cash", "account": "Cash - MCI" },
                { "mode_of_payment": "Card", "type": "Bank", "account": "Card - MCI" }
              ],
              "customer_groups": [
                { "customer_group": "All Customer Groups" }
              ]
            }
          ],
          "Company": [
            {
              "name": "Mock Company Inc.",
              "allow_negative_stock": 0,
              "pos_walk_in_customer": "Walk-in-Offline",
              "default_currency": "USD",
              "default_customer_group": "All Customer Groups"
            }
          ],
          "Item": [
            {
              "item_code": "ITEM001", "item_name": "Mock Item 1", "description": "Description for Mock Item 1",
              "stock_uom": "Nos", "image": "", "standard_rate": 10.99, "is_stock_item": 1,
              "income_account": "Sales - MCI", "cost_center": "Main - MCI",
              "barcodes": [{ "barcode": "1234567890123", "barcode_type": "EAN13" }]
            }
          ],
          "Item Price": [
            { "item_code": "ITEM001", "price_list_rate": 10.99, "price_list": "Mock Selling Price List", "selling": 1 }
          ],
          "Customer": [
            {
              "name": "Walk-in-Offline", "customer_name": "Offline Walk-in Customer",
              "customer_group": "Retail"
            }
          ],
          "Sales Invoice": []
        }
        ```

4.  **Add Script to `src/package.json` for `json-server`:**
    *   Open `src/package.json` and add/update the `scripts` section:
        ```json
        // src/package.json
        {
          // ... other parts of package.json
          "scripts": {
            "dev": "vite",
            "build": "vite build",
            "preview": "vite preview",
            "test": "vitest",
            // ... other scripts ...
            "mock:api": "json-server --watch db.json --port 3001 --routes routes.json" // Added this
          },
          // ...
        }
        ```
    *   **Create `src/routes.json` for API Prefixing:** ERPNext APIs are often prefixed (e.g., `/api/resource/...`). Create `src/routes.json` to map these:
        ```json
        // src/routes.json
        {
          "/api/resource/*": "/$1"
        }
        ```
        This makes `json-server` behave more like Frappe's resource API URLs.

5.  **Configure Environment Variables for Offline Mode (`src/.env.local`):**
    *   In the `src` directory, create a file named `.env.local` (if it doesn't exist). This file should *not* be committed to Git.
    *   Add the following variables:
        ```env
        # src/.env.local

        # --- Offline Development Mode ---
        VITE_OFFLINE_DEV_MODE=true

        # URL for the mock API server
        VITE_ERPEXT_BASE_URL=http://localhost:3001

        # Dummy POS Profile and Company for offline login (should match data in db.json)
        VITE_POS_PROFILE_OFFLINE="Mock POS Profile" 
        VITE_COMPANY_OFFLINE="Mock Company Inc."
        ```

6.  **Adapt `src/services/api.js` for Offline Mode:**
    *   The application's API service needs to respect these environment variables.
    *   **Base URL Handling:** Modify `fetchApi` (or where `erpNextUrl` is determined for this function) to use `import.meta.env.VITE_ERPEXT_BASE_URL` when `VITE_OFFLINE_DEV_MODE` is `'true'`.
        *Example of how `erpNextUrl` could be determined before being passed to or used within `fetchApi`:*
        ```javascript
        // Conceptual: Somewhere in your app's logic (e.g., a config store, or before calling fetchApi)
        // let erpNextUrlForApiCall = localStorage.getItem('erpnext_url'); // Or from Pinia store
        // if (import.meta.env.VITE_OFFLINE_DEV_MODE === 'true') {
        //   erpNextUrlForApiCall = import.meta.env.VITE_ERPEXT_BASE_URL;
        // }
        // // Then use erpNextUrlForApiCall when invoking fetchApi or inside it.
        ```
    *   **Authentication Bypass:** Modify `loginToERPNext` and `getFrappeCsrfToken` in `src/services/api.js`:
        ```javascript
        // src/services/api.js
        export async function loginToERPNext(erpNextUrl, username, password) {
          if (import.meta.env.VITE_OFFLINE_DEV_MODE === 'true') {
            console.warn("OFFLINE DEV MODE: Bypassing ERPNext Login");
            // Use dummy values for clerk login from .env.local or hardcode if preferred for offline
            return { full_name: 'Offline Admin', user_id: username };
          }
          // ... original loginToERPNext code ...
        }

        export async function getFrappeCsrfToken(erpNextUrl) {
          if (import.meta.env.VITE_OFFLINE_DEV_MODE === 'true') {
            console.warn("OFFLINE DEV MODE: Returning dummy CSRF token");
            return "dummy_csrf_token_offline";
          }
          // ... original getFrappeCsrfToken code ...
        }
        ```
    *   Ensure that when these functions are called, the `erpNextUrl` argument they receive (if any) is also the one adjusted for offline mode (i.e., `http://localhost:3001`). The `fetchInitialPOSData` function, for instance, should end up using this mock URL.

7.  **Running the Offline Development Environment:**
    *   **Terminal 1 (from `src` directory):** Start the mock API server.
        ```bash
        cd src
        npm run mock:api
        ```
    *   **Terminal 2 (from `src` directory):** Start the Vite development server for the Vue app.
        ```bash
        cd src
        npm run dev
        ```
    *   Open your browser to the URL provided by Vite (usually `http://localhost:5173`).
    *   The application should now:
        *   Bypass actual ERPNext login (you might use any credentials, or adjust login form to accept dummy ones).
        *   Fetch initial data (items, customers, etc.) from your `json-server`.
        *   Allow you to perform sales, which will be saved locally in `wa-sqlite`.
        *   Attempts to "sync" sales will go to `json-server`.

**Important Notes for Offline Mode:**
*   The mock data in `db.json` needs to be realistic enough for the features you are working on. You may need to expand it over time.
*   `json-server` provides a very basic API simulation. Complex business logic, validation, or relationships that ERPNext handles on the backend will not be present.
*   When switching back to online mode (connecting to a real ERPNext), set `VITE_OFFLINE_DEV_MODE=false` in `src/.env.local` (or remove the line/file) and ensure your application logic correctly sources the live ERPNext URL and POS Profile details.

## Building the Application

This section explains how to build the Vue.js frontend application for deployment. The process involves compiling the Vue.js code, CSS, and other assets into static files that can be served by a web server or packaged into a desktop application using Tauri.

*(Note: Commands are generally shown using `npm`. If you are using `yarn`, the equivalent commands (e.g., `yarn install`, `yarn dev`, `yarn build`) can be used.)*

**Prerequisites:**

*   Node.js and npm installed.
*   Frontend dependencies installed (run `npm install` in the `src` directory if you haven't already).

**Build Steps:**

1.  **Building the Vue.js Frontend:**
    *   Navigate to the frontend application directory (`src`):
        ```bash
        cd src
        ```
    *   Run the build command:
        ```bash
        npm run build
        ```
    *   **Output:** Vite will create a `dist` subdirectory inside the `src` directory (i.e., `src/dist`). This `src/dist` folder contains all the static assets for your frontend application, including:
        *   `index.html`
        *   JavaScript files (minified and chunked for performance) in an `assets` subfolder.
        *   CSS files (minified) in an `assets` subfolder.
        *   Any other static assets like images or fonts you've included.
    *   The contents of this `src/dist` folder are what you would deploy to a web server for a web-based POS, or what Tauri will package for a desktop application.

2.  **Building the Tauri Desktop Application (Recommended for Offline POS):**
    *   The `DEPLOYMENT_CONSIDERATIONS.md` file (in the root of the project) and the project structure (`src-tauri` directory) indicate that this POS is intended to be packaged as a Tauri desktop application for robust offline capabilities.
    *   **Ensure Vue Frontend is Built First:** The Tauri build process typically relies on the output of the Vue.js build (`src/dist`).
    *   **Tauri Configuration Check (`src-tauri/tauri.conf.json`):**
        *   Open the `src-tauri/tauri.conf.json` file.
        *   Verify the `tauri > build > distDir` setting. For the Vite build process described above, this should ideally be set to `../src/dist` to correctly point to the Vue.js build output.
        *   It's good practice to also set the `beforeBuildCommand` in `tauri.conf.json` to automatically trigger the Vue.js build. Example:
            ```json
            // src-tauri/tauri.conf.json
            {
              // ...
              "build": {
                // "devPath": "http://localhost:5173", // If your Vite server runs on 5173
                "devPath": "../src", // If Vite serves index.html from src root directly
                "distDir": "../src/dist", // Points to Vite's build output
                "beforeDevCommand": "npm run dev --prefix ../src", // Optional: command to run Vite dev server
                "beforeBuildCommand": "npm run build --prefix ../src" // Ensures Vue app is built before Tauri build
              },
              // ...
            }
            ```
            *(Adjust `devPath` based on how your Vite dev server is accessed by Tauri; `../src/dist` for `distDir` is key for release builds).*
    *   **Run the Tauri Build Command:**
        *   Navigate to the root of the project (the directory containing `src` and `src-tauri`).
        *   Execute the Tauri build command. If you have `@tauri-apps/cli` as a dev dependency in your root `package.json` with a script:
            ```bash
            npm run tauri build 
            ```
        *   If not, and `@tauri-apps/cli` is installed globally or you're using `npx`:
            ```bash
            npx tauri build
            ```
    *   **Output:** Tauri will generate native application bundles in `src-tauri/target/release/bundle/`. The type of bundle depends on your operating system (e.g., `.msi` for Windows, `.AppImage` or `.deb` for Linux, `.dmg` for macOS).
    *   These are the files you would distribute for installing the desktop POS application. Refer to `DEPLOYMENT_CONSIDERATIONS.md` for more details.

**Summary of Build Outputs:**

*   **`src/dist/`**: Contains the static web application. Ready for web deployment or to be packaged by Tauri.
*   **`src-tauri/target/release/bundle/`**: Contains the installable desktop application packages (if Tauri build is performed).

Choose the appropriate build process based on whether you intend to deploy the POS as a web application or a Tauri-based desktop application. For the full offline-first experience, the Tauri build is the primary target.

## Production Deployment

This section provides guidelines for deploying the POS application. The primary deployment method for its intended offline-first capabilities is as a **Tauri desktop application**. However, the core Vue.js web application can also be deployed to a web server.

*(Note: Commands are generally shown using `npm`. If you are using `yarn`, the equivalent commands can be used.)*

**I. Deploying as a Tauri Desktop Application (Recommended):**

1.  **Build Application Artifacts:**
    *   Follow the steps in the "Building the Application" section to generate the native installers or application bundles (e.g., `.msi` for Windows, `.AppImage` or `.deb` for Linux, `.dmg` for macOS). These will be located in `src-tauri/target/release/bundle/`.

2.  **Distribution of Installers/Packages:**
    *   Refer to the **`DEPLOYMENT_CONSIDERATIONS.md`** document (located in the project root) for a detailed strategy on distributing and installing the Tauri application artifacts on POS terminals.

3.  **Production Configuration (In-App):**
    *   After installation on a POS terminal:
        *   Launch the POS application.
        *   Navigate to the Admin Panel (usually accessible via an `/admin` path or button within the app).
        *   Log in as an administrator.
        *   Go to **Settings > ERPNext Configuration**.
        *   Enter the **full URL of your live ERPNext server** (e.g., `https://your-company.erpnext.com`).
        *   Save and test the connection.
    *   **Clerk Login & Sync Configuration (Post-Admin Setup):**
        *   Clerks will log in using their ERPNext credentials.
        *   In the POS interface (usually via "Sync Controls" or similar in the header/menu after clerk login), configure:
            *   The correct **POS Profile Name** for that specific terminal (this POS Profile must exist and be configured in ERPNext).
            *   The **Company Name** associated with the POS Profile (often auto-filled from the POS Profile data from ERPNext).
        *   Perform an initial data sync to download items, customers, etc., from the live ERPNext server.

4.  **Auto-Updates (Future Enhancement):**
    *   The `DEPLOYMENT_CONSIDERATIONS.md` also discusses setting up auto-updates for the Tauri application. The `src-tauri/tauri.conf.json` currently has `updater.active` set to `false`. To enable auto-updates, this would need to be configured along with an update server.

**II. Deploying as a Web Application (Alternative):**

If you wish to deploy the POS as a traditional web application (this will offer `wa-sqlite` browser-based offline storage but may have different characteristics for hardware integration compared to Tauri):

1.  **Build the Vue.js Frontend:**
    *   Follow the steps in "Building the Application" to generate the static web assets in the `src/dist/` folder.

2.  **Choose a Static Web Host:**
    *   The contents of `src/dist/` are static files (HTML, CSS, JavaScript) and can be hosted on any modern web server or static hosting provider (e.g., Nginx, Apache, AWS S3 with CloudFront, Netlify, Vercel).

3.  **Deployment Steps (General Example with Nginx):**
    *   **Copy Files:** Transfer the contents of your `src/dist/` folder to your web server (e.g., to `/var/www/your-pos-directory`).
    *   **Configure Web Server (Nginx Example):**
        You'll need to configure your web server to serve the `index.html` for all routes to support Vue Router (client-side routing).
        ```nginx
        # Example Nginx configuration
        server {
            listen 80;
            server_name your-pos-domain.com; # Replace with your domain or IP

            root /var/www/your-pos-directory; # Path to your src/dist contents
            index index.html;

            location / {
                try_files $uri $uri/ /index.html;
            }

            # It is STRONGLY recommended to configure SSL (HTTPS) for production.
            # Example (requires SSL certificate and key):
            # listen 443 ssl;
            # ssl_certificate /path/to/your/fullchain.pem;
            # ssl_certificate_key /path/to/your/privkey.pem;
            # include /etc/letsencrypt/options-ssl-nginx.conf; # If using Let's Encrypt
            # ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;   # If using Let's Encrypt
        }
        ```
    *   **Restart Web Server:** After configuration, restart Nginx (e.g., `sudo systemctl restart nginx`).

4.  **Production Configuration (In-App for Web Deployment):**
    *   Similar to the Tauri app, the web application needs to be configured to point to your live ERPNext server.
    *   Access the POS web application via its URL.
    *   Configuration for ERPNext URL, POS Profile, and Company is done through the Admin Panel and Sync Controls as described for the Tauri application.
    *   **CORS:** Ensure your ERPNext server is configured to accept requests from the domain where the POS web application is hosted. This involves adjusting Cross-Origin Resource Sharing (CORS) settings in your Frappe/ERPNext site configuration (e.g., in `site_config.json` or via Frappe framework settings).

5.  **Security for Web Deployment:**
    *   **HTTPS:** Always use HTTPS for a production POS application.
    *   **Secure ERPNext:** Ensure your ERPNext instance is also secured with HTTPS and has appropriate access controls.

**Important Considerations for All Deployments:**

*   **ERPNext Server URL:** This is the most critical piece of configuration. Ensure it's correctly set in the application after deployment to point to your **live ERPNext instance**.
*   **Backup Local Data:** While `wa-sqlite` provides offline capabilities, ensure users understand that regular synchronization with ERPNext is crucial for data safety and central record-keeping. The local browser/Tauri database is not a substitute for server-side backups of ERPNext.
*   **Backend Deployment:** This document **only covers the frontend POS application deployment**. Deploying and managing the ERPNext backend is a separate process and is not covered here. Refer to Frappe and ERPNext documentation for backend deployment.

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
