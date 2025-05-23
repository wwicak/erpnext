<template>
  <div class="min-h-screen bg-dark-background text-light-text">
    <LoginScreen v-if="!isLoggedIn" @login-success="handleLogin" />
    <POSInterface v-else @logout="handleLogout" />
  </div>
</template>

<script setup>
import { computed } from 'vue'; // Import computed
import { useAuthStore } from './store/authStore'; // Import authStore
import LoginScreen from './components/LoginScreen.vue';
import POSInterface from './components/POSInterface.vue';

const authStore = useAuthStore(); // Initialize the store
const isLoggedIn = computed(() => authStore.isAuthenticated); // Make isLoggedIn reactive to store state

// handleLogin and handleLogout are no longer needed here as
// components will directly call store actions, and App.vue reacts to store changes.

</script>

<style> /* Changed to global style for body background if needed, or keep scoped */
/* Global styles can go here if necessary, or in main.css */
/* For instance, to ensure the overall app background is dark if not covered by the div */
body {
  margin: 0; /* Reset default margin */
  /* background-color: #261926; /* dark-background, if the main div doesn't always cover */
}
</style>
