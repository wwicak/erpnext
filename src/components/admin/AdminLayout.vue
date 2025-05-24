<template>
  <div class="min-h-screen flex bg-dark-background text-light-text">
    <!-- Sidebar -->
    <aside class="w-64 bg-gray-800 p-6 shadow-lg flex flex-col">
      <h1 class="text-2xl font-bold text-secondary-accent mb-8 text-center">Admin Panel</h1>
      <nav class="flex-grow space-y-3">
        <router-link 
          to="/admin/dashboard" 
          class="block py-2.5 px-4 rounded-md hover:bg-gray-700 transition-colors duration-150"
          active-class="bg-primary text-white font-semibold"
        >
          Dashboard
        </router-link>
        <router-link 
          to="/admin/change-password" 
          class="block py-2.5 px-4 rounded-md hover:bg-gray-700 transition-colors duration-150"
          active-class="bg-primary text-white font-semibold"
        >
          Change Password
        </router-link>
        
        <!-- Placeholder Links -->
        <div class="pt-4 mt-4 border-t border-gray-700">
          <p class="px-4 py-2 text-xs text-gray-400 uppercase tracking-wider">Settings</p>
          <router-link
            to="/admin/erp-config"
            class="block py-2.5 px-4 rounded-md hover:bg-gray-700 transition-colors duration-150"
            active-class="bg-primary text-white font-semibold"
          >
            ERPNext Config
          </router-link>
          <router-link
            to="/admin/barcode-settings"
            class="block py-2.5 px-4 rounded-md hover:bg-gray-700 transition-colors duration-150"
            active-class="bg-primary text-white font-semibold"
          >
            Barcode Settings
          </router-link>
          <router-link
            to="/admin/printer-settings"
            class="block py-2.5 px-4 rounded-md hover:bg-gray-700 transition-colors duration-150"
            active-class="bg-primary text-white font-semibold"
          >
            Printer Settings
          </router-link>
        </div>
         <div class="pt-4 mt-4 border-t border-gray-700">
          <p class="px-4 py-2 text-xs text-gray-400 uppercase tracking-wider">System</p>
          <router-link
            to="/admin/activity-log"
            class="block py-2.5 px-4 rounded-md hover:bg-gray-700 transition-colors duration-150"
            active-class="bg-primary text-white font-semibold"
          >
            Clerk Activity Log
          </router-link>
        </div>
      </nav>
      
      <!-- Logout Button -->
      <div class="mt-auto pt-6 border-t border-gray-700">
        <button 
          @click="handleLogout"
          class="w-full bg-danger-red hover:bg-red-700 text-white font-semibold py-2.5 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-danger-red transition-colors duration-150"
        >
          Logout
        </button>
      </div>
    </aside>

    <!-- Main Content Area -->
    <main class="flex-grow p-8 overflow-y-auto">
      <router-view /> <!-- Child routes will be rendered here -->
    </main>
  </div>
</template>

<script setup>
import { useAdminAuthStore } from '../../store/adminAuthStore'; // Adjusted path
// No need to import router here for navigation, store action handles it.

const adminAuthStore = useAdminAuthStore();

const handleLogout = () => {
  adminAuthStore.logoutAdmin();
  // The logoutAdmin action in the store already handles navigation to /admin/login
};
</script>

<style scoped>
/* Specific styles for AdminLayout if needed */
/* Ensure active-class applies desired styles */
.router-link-exact-active, .router-link-active { /* Default active classes if not overridden by active-class prop */
  /* Example: if active-class prop isn't working as expected or for more control */
  /* background-color: theme('colors.primary'); */
  /* color: white; */
}
</style>
