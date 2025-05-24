<template>
  <div class="min-h-screen flex items-center justify-center bg-dark-background p-4">
    <div class="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md">
      <h2 class="text-3xl font-bold text-light-text mb-8 text-center">Change Admin Password</h2>
      
      <p v-if="!isDefaultPassword" class="mb-4 text-center text-yellow-400 bg-yellow-900 bg-opacity-30 p-3 rounded-md text-sm">
        Your password has already been changed from the default. You can still update it here.
      </p>
      <p v-else class="mb-4 text-center text-warning-orange bg-orange-900 bg-opacity-30 p-3 rounded-md text-sm">
        This is your first login. Please change the default password to secure your admin panel.
      </p>

      <form @submit.prevent="handleChangePassword">
        <div class="mb-5">
          <label for="newPassword" class="block text-sm font-medium text-gray-300 mb-1">New Password</label>
          <input 
            type="password" 
            id="newPassword" 
            v-model="newPassword"
            required
            class="w-full p-2.5 rounded-md bg-gray-100 text-gray-900 focus:ring-2 focus:ring-inset focus:ring-primary border border-gray-300 focus:border-primary"
            placeholder="Enter new password"
          >
        </div>

        <div class="mb-8">
          <label for="confirmPassword" class="block text-sm font-medium text-gray-300 mb-1">Confirm New Password</label>
          <input 
            type="password" 
            id="confirmPassword" 
            v-model="confirmPassword"
            required
            class="w-full p-2.5 rounded-md bg-gray-100 text-gray-900 focus:ring-2 focus:ring-inset focus:ring-primary border border-gray-300 focus:border-primary"
            placeholder="Confirm new password"
          >
        </div>

        <div class="mb-4">
          <button 
            type="submit"
            :disabled="isLoading"
            class="w-full bg-primary hover:bg-opacity-90 text-light-text font-semibold py-2.5 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
          >
            <span v-if="isLoading">Changing Password...</span>
            <span v-else>Change Password</span>
          </button>
        </div>

        <div v-if="errorMessage" class="text-danger-red text-sm mt-6 text-center p-3 bg-red-500 bg-opacity-10 border border-danger-red rounded-md">
          {{ errorMessage }}
        </div>
        <div v-if="successMessage" class="text-green-400 text-sm mt-6 text-center p-3 bg-green-500 bg-opacity-10 border border-green-500 rounded-md">
          {{ successMessage }}
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAdminAuthStore } from '../../store/adminAuthStore'; // Adjusted path

const newPassword = ref('');
const confirmPassword = ref('');
const errorMessage = ref('');
const successMessage = ref('');
const isLoading = ref(false);

const router = useRouter();
const adminAuthStore = useAdminAuthStore();

const isDefaultPassword = computed(() => adminAuthStore.currentAdminPassword === 'passwordChange123' && !adminAuthStore.hasAdminPasswordBeenChanged());

onMounted(() => {
    // This is a simple check. Route guards are better for robust access control.
    if (!adminAuthStore.isAdminAuthenticated) {
        router.push({ name: 'AdminLogin' });
    }
    // If password HAS been changed AND current path is change-password (and not forced by logic),
    // it might imply user navigated here manually. They can still change it.
    // The main force happens at login.
});

const handleChangePassword = async () => {
  isLoading.value = true;
  errorMessage.value = '';
  successMessage.value = '';

  if (newPassword.value.length < 8) {
    errorMessage.value = 'New password must be at least 8 characters long.';
    isLoading.value = false;
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    errorMessage.value = 'Passwords do not match.';
    isLoading.value = false;
    return;
  }
  if (newPassword.value === 'passwordChange123') {
    errorMessage.value = 'New password cannot be the default password.';
    isLoading.value = false;
    return;
  }

  const success = adminAuthStore.changeAdminPassword(newPassword.value);

  if (success) {
    successMessage.value = 'Password changed successfully! Redirecting to dashboard...';
    setTimeout(() => {
      router.push({ name: 'AdminDashboard' });
    }, 2000);
  } else {
    // This case should ideally not be hit if admin is logged in,
    // but as a fallback.
    errorMessage.value = 'Failed to change password. Please try again.';
  }
  isLoading.value = false;
};
</script>

<style scoped>
/* Styles specific to ChangeAdminPassword if needed */
</style>
