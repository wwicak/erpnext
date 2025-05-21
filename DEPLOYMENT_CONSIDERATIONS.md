# Deployment Strategy and Update Mechanisms for Tauri Offline POS

This document outlines the strategy for deploying the Tauri Offline POS application to multiple shop locations and considerations for future auto-update mechanisms.

## I. Deployment Strategy for Tauri Application

This strategy assumes an initial manual deployment to the 5 shop locations.

1.  **Build Application Artifacts:**
    *   For each target operating system (OS) used in the shops (e.g., Windows, Linux), build the Tauri application using the command:
        ```bash
        npm run tauri build
        # or
        yarn tauri build
        ```
    *   This command will generate native installers or application bundles:
        *   **Windows:** Typically an `.msi` installer (recommended for ease of installation and uninstallation) or a standalone `.exe`.
        *   **Linux:** `.AppImage` (portable), `.deb` (for Debian/Ubuntu-based systems), or other formats depending on the Linux distribution.
        *   **macOS:** `.dmg` disk image containing the `.app` bundle.
    *   Ensure builds are tested on representative hardware/OS versions for each shop environment.

2.  **Distribution of Installers/Packages:**
    *   The built application installers/packages need to be delivered to each of the 5 shop locations. Possible methods include:
        *   **Shared Network Drive:** If shops are connected via a WAN or VPN, place installers on a secure, accessible shared drive.
        *   **Secure Download Portal:** Upload installers to a secure internal portal or cloud storage (e.g., SharePoint, Google Drive with restricted access) from which shop managers or IT personnel can download them.
        *   **USB Drives:** For locations with limited connectivity, installers can be copied to USB drives and physically delivered. Ensure drives are scanned for malware.
        *   **Remote Deployment Tools:** If the organization uses Mobile Device Management (MDM) or other software deployment tools that support the target OS, these could be leveraged for a more automated rollout.

3.  **Installation on POS Terminals:**
    *   Local IT staff or trained shop managers will perform the installation on each POS terminal.
    *   **Windows:** Run the `.msi` installer (usually involves a standard installation wizard) or execute the `.exe`.
    *   **Linux:**
        *   `.AppImage`: Make it executable (`chmod +x appname.AppImage`) and run it. It can be placed in a common directory.
        *   `.deb`: Install using `sudo dpkg -i appname.deb` followed by `sudo apt-get install -f` if dependencies are needed.
    *   **macOS:** Open the `.dmg` file and drag the `.app` bundle to the `/Applications` folder.
    *   Ensure appropriate user permissions are considered for installation and application execution.

4.  **Initial Configuration per Terminal:**
    *   After installation, each POS terminal application must be configured for its specific environment:
        *   Launch the Tauri Offline POS application.
        *   Using the UI configuration section:
            *   Enter the **ERPNext Server URL**.
            *   Enter the specific **POS Profile Name** designated for that particular shop/terminal (this POS Profile must exist in ERPNext).
            *   Enter the **Company Name** associated with the POS Profile.
        *   Save the configuration. These settings are stored in `localStorage` on the terminal.
    *   Perform an **Initial Data Sync** as described in the application's `README.md` to populate the local IndexedDB with necessary data.
    *   Test a few offline transactions and a subsequent sync (once online) to ensure the setup is correct.

## II. Considerations for Auto-Update Mechanisms (Tauri)

Tauri has built-in support for auto-updates, which can significantly simplify the process of deploying new versions of the application once the initial deployment is done. This is a conceptual outline for future enhancement.

1.  **Tauri Updater Configuration:**
    *   The auto-update mechanism is configured in the `src-tauri/tauri.conf.json` file, under the `tauri > updater` section.
    *   **`active`**: Must be set to `true`.
    *   **`endpoints`**: An array of URLs pointing to a server-side JSON file (update manifest) that Tauri will check for new versions. Example: `["https://your-update-server.com/updates/manifest.json"]`.
    *   **`dialog`**: Can be set to `true` to use Tauri's built-in dialog for notifying the user about updates, or `false` if custom UI notifications are preferred.
    *   **`pubkey`**: A public key (string) used to verify the signature of the update. This ensures that updates are authentic and haven't been tampered with. You generate a key pair and include the public key here. The private key is used to sign the update artifacts.

2.  **Update Server:**
    *   A web server is required to host:
        *   **Update Manifest (JSON):** This file (e.g., `manifest.json`) describes the latest version, release notes, publication date, and download URLs for the application binaries for different platforms.
        *   **Application Binaries:** The actual installer files (e.g., `.msi.zip`, `.AppImage.tar.gz`) for the new version. These binaries must be signed with the private key corresponding to the `pubkey` in `tauri.conf.json`.
    *   This server can be a simple static file server, a cloud storage service with public URLs (e.g., AWS S3, GitHub Releases), or a custom backend.

3.  **Update Process (Conceptual):**
    *   When the Tauri application starts (or periodically, as configured or triggered), it fetches the update manifest from one of the specified `endpoints`.
    *   It compares the version in the manifest with its current version.
    *   If a newer version is found, it verifies the signature of the update using the `pubkey`.
    *   If the signature is valid, it will (if `dialog` is `true`) prompt the user to download and install the update.
    *   The download occurs in the background. Once downloaded, the user can be prompted to restart the application to apply the update.

4.  **Key Considerations for Implementation:**
    *   **Security:** Signing updates is crucial. Protect the private key carefully. Use HTTPS for the update server.
    *   **Server Infrastructure:** Decide on where and how to host the update server and artifacts.
    *   **Update Granularity:** Updates typically replace the entire application.
    *   **Rollback Strategy:** Consider how to handle problematic updates (though Tauri's updater aims for safe updates, manual rollback might involve reinstalling an older version).
    *   **User Experience:** How users are notified and when updates are applied (e.g., on startup, on demand).

Implementing auto-updates would require additional setup for the update server and signing process but would greatly streamline future application updates across the 5 shops.
---
