<template>
  <div class="min-h-screen flex items-center justify-center bg-dark-background p-4">
    <form @submit.prevent="handleAdminLogin" class="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md">
      <h2 class="text-3xl font-bold text-light-text mb-8 text-center">Admin Panel Login</h2>

      <div class="mb-5">
        <label for="adminUsername" class="block text-sm font-medium text-gray-300 mb-1">Username</label>
        <input 
          type="text" 
          id="adminUsername" 
          v-model="username"
          required
          class="w-full p-2.5 rounded-md bg-gray-100 text-gray-900 focus:ring-2 focus:ring-inset focus:ring-primary border border-gray-300 focus:border-primary"
          placeholder="Enter admin username"
        >
      </div>

      <div class="mb-8">
        <label for="adminPassword" class="block text-sm font-medium text-gray-300 mb-1">Password</label>
        <input 
          type="password" 
          id="adminPassword" 
          v-model="password"
          required
          class="w-full p-2.5 rounded-md bg-gray-100 text-gray-900 focus:ring-2 focus:ring-inset focus:ring-primary border border-gray-300 focus:border-primary"
          placeholder="Enter admin password"
        >
      </div>

      <div class="mb-4">
        <button 
          type="submit"
          :disabled="isLoading"
          class="w-full bg-primary hover:bg-opacity-90 text-light-text font-semibold py-2.5 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
        >
          <span v-if="isLoading">Logging in...</span>
          <span v-else>Login</span>
        </button>
      </div>

      <div v-if="errorMessage" class="text-danger-red text-sm mt-6 text-center p-3 bg-red-500 bg-opacity-10 border border-danger-red rounded-md">
        {{ errorMessage }}
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAdminAuthStore } from '../../store/adminAuthStore'; // Adjusted path

const username = ref('');
const password = ref('');
const errorMessage = ref('');
const isLoading = ref(false);

const router = useRouter();
const adminAuthStore = useAdminAuthStore();

const handleAdminLogin = async () => {
  isLoading.value = true;
  errorMessage.value = '';
  
  const loginSuccess = adminAuthStore.loginAdmin(username.value, password.value);

  if (loginSuccess) {
    if (adminAuthStore.hasAdminPasswordBeenChanged()) {
      router.push({ name: 'AdminDashboard' });
    } else {
      router.push({ name: 'ChangeAdminPassword' });
    }
  } else {
    errorMessage.value = 'Invalid username or password.';
  }
  isLoading.value = false;
};
</script>

<style scoped>
/* Styles specific to AdminLogin if needed */
</style>
