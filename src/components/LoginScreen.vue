<template>
  <div class="min-h-screen flex items-center justify-center bg-dark-background p-4">
    <form @submit.prevent="handleLogin" class="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md">
      <h2 class="text-3xl font-bold text-light-text mb-8 text-center">POS Login</h2>

      <div v-if="!syncConfigStore.erpNextUrl" class="mb-6 p-3 bg-warning-orange bg-opacity-20 text-warning-orange border border-warning-orange rounded-md">
        <p class="font-semibold text-center">Configuration Incomplete</p>
        <p class="text-sm text-center mt-1">ERPNext URL is not configured. Please set it up via Sync Controls if accessible, or contact admin.</p>
      </div>

      <div class="mb-5">
        <label for="username" class="block text-sm font-medium text-gray-300 mb-1">Username</label>
        <input type="text" id="username" v-model="username"
               :disabled="loginMutation.isPending.value || !syncConfigStore.erpNextUrl"
               class="w-full p-2.5 rounded-md bg-gray-100 text-gray-900 focus:ring-2 focus:ring-inset focus:ring-primary border border-gray-300 focus:border-primary disabled:opacity-50"
               placeholder="e.g., user@example.com">
      </div>

      <div class="mb-5">
        <label for="password" class="block text-sm font-medium text-gray-300 mb-1">Password</label>
        <input type="password" id="password" v-model="password"
               :disabled="loginMutation.isPending.value || !syncConfigStore.erpNextUrl"
               class="w-full p-2.5 rounded-md bg-gray-100 text-gray-900 focus:ring-2 focus:ring-inset focus:ring-primary border border-gray-300 focus:border-primary disabled:opacity-50"
               placeholder="Enter your password">
      </div>

      <div class="mb-8">
        <label for="pos_profile_name" class="block text-sm font-medium text-gray-300 mb-1">POS Profile Name</label>
        <input type="text" id="pos_profile_name" v-model="posProfileNameFromUI"
               :disabled="loginMutation.isPending.value || !syncConfigStore.erpNextUrl"
               class="w-full p-2.5 rounded-md bg-gray-100 text-gray-900 focus:ring-2 focus:ring-inset focus:ring-primary border border-gray-300 focus:border-primary disabled:opacity-50"
               placeholder="e.g., Main Retail Counter">
      </div>

      <div class="mb-4">
        <button type="submit"
                :disabled="loginMutation.isPending.value || !syncConfigStore.erpNextUrl"
                class="w-full bg-primary hover:bg-opacity-90 text-light-text font-semibold py-2.5 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150">
          <span v-if="loginMutation.isPending.value">Logging in...</span>
          <span v-else>Login</span>
        </button>
      </div>

      <div v-if="authStore.loginError" class="text-danger-red text-sm mt-6 text-center p-3 bg-red-500 bg-opacity-10 border border-danger-red rounded-md">
        {{ authStore.loginError }}
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useMutation } from '@tanstack/vue-query';
import { useAuthStore } from '../store/authStore';
import { useSyncConfigStore } from '../store/syncConfigStore';

const authStore = useAuthStore();
const syncConfigStore = useSyncConfigStore();

// Load sync config on component mount if not already loaded (e.g. on page refresh)
if (!syncConfigStore.erpNextUrl) {
  syncConfigStore.loadSyncConfig();
}

const username = ref('');
const password = ref('');
const posProfileNameFromUI = ref('');


// Clear login error when component mounts or when user starts typing
watch([username, password, posProfileNameFromUI], () => {
  if (authStore.loginError) {
    authStore.clearLoginError();
  }
});

const loginMutation = useMutation({
  mutationFn: (credentials) => 
    authStore.login(credentials.erpNextUrl, credentials.username, credentials.password, credentials.posProfileNameFromUI),
  onSuccess: (data) => {
    username.value = '';
    password.value = '';
    posProfileNameFromUI.value = '';
    // console.log('Login successful via LoginScreen, user data:', data);
    // App.vue handles view switching based on authStore.isLoggedIn
  },
  onError: (error) => {
    // console.error('Login failed via LoginScreen:', error.message);
    password.value = ''; // Clear password on error
  }
});

const handleLogin = () => {
  if (!syncConfigStore.erpNextUrl) {
    authStore.setLoginError("ERPNext URL is not configured. Cannot attempt login.");
    return;
  }
  if (!username.value || !password.value || !posProfileNameFromUI.value) {
    authStore.setLoginError("Username, Password, and POS Profile Name are required.");
    return;
  }
  authStore.clearLoginError(); 
  loginMutation.mutate({
    erpNextUrl: syncConfigStore.erpNextUrl,
    username: username.value,
    password: password.value,
    posProfileNameFromUI: posProfileNameFromUI.value
  });
};
</script>

<style scoped>
/* Additional specific styles can go here if Tailwind isn't enough */
</style>
