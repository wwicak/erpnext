<template>
  <div class="flex items-center justify-between p-3 bg-gray-700 rounded-lg shadow">
    <div class="user-details text-sm">
      <p class="text-gray-300">User: <span class="font-semibold text-gray-100">{{ authStore.userName || 'N/A' }}</span></p>
      <p class="text-gray-300">Profile: <span class="font-semibold text-gray-100">{{ authStore.loginPOSProfileName || 'N/A' }}</span></p>
    </div>
    <button 
      @click="handleLogout"
      class="bg-danger-red hover:bg-red-700 text-white font-semibold py-1.5 px-4 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-700 focus:ring-danger-red transition-colors duration-150">
      Logout
    </button>
  </div>
</template>

<script setup>
import { useAuthStore } from '../store/authStore';
import { useRouter } from 'vue-router'; // Assuming Vue Router might be used later for programmatic navigation after logout

const authStore = useAuthStore();
const router = useRouter(); // Example if Vue Router is used

const handleLogout = () => {
  authStore.logout();
  // The App.vue's v-if on isLoggedIn should handle view switch.
  // If using Vue Router and need to redirect to a specific /login page:
  // router.push('/login'); 
  // For now, App.vue's conditional rendering handles it.
};
</script>

<style scoped>
/* Scoped styles for UserInfoHeader.vue if needed */
</style>
