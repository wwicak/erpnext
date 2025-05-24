<template>
  <div class="p-6 bg-gray-700 text-light-text rounded-lg shadow-md">
    <h2 class="text-3xl font-semibold text-primary mb-8">Application Settings</h2>

    <div class="max-w-lg space-y-6">
      <!-- Auto-Logout Timer Setting -->
      <div class="bg-gray-800 p-6 rounded-lg shadow-sm">
        <h3 class="text-xl font-semibold text-secondary-accent mb-3">POS Auto-Logout</h3>
        <label for="autoLogoutMinutes" class="block text-sm font-medium text-gray-300 mb-1">
          Auto-Logout Timer (minutes)
        </label>
        <input 
          type="number" 
          id="autoLogoutMinutes" 
          v-model.number="autoLogoutMinutes"
          min="0"
          class="w-full sm:w-1/2 p-2.5 rounded-md bg-gray-100 text-gray-900 text-sm focus:ring-2 focus:ring-inset focus:ring-primary border border-gray-300 focus:border-primary"
        >
        <p class="text-xs text-gray-400 mt-1">
          Set the duration of inactivity before a clerk is automatically logged out.
          Enter 0 to disable auto-logout.
        </p>
      </div>

      <!-- Save Settings Button -->
      <div>
        <button 
          @click="handleSaveSettings"
          class="bg-action-pink hover:bg-opacity-90 text-light-text font-semibold py-2.5 px-6 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-700 focus:ring-action-pink transition-colors duration-150"
        >
          Save Settings
        </button>
      </div>

      <!-- Success/Error Message Area -->
      <div v-if="message" 
           class="p-3 rounded-md text-sm"
           :class="{
             'bg-green-500 bg-opacity-10 border border-green-500 text-green-300': messageType === 'success',
             'bg-red-500 bg-opacity-10 border border-danger-red text-danger-red': messageType === 'error'
           }"
      >
        {{ message }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const AUTO_LOGOUT_MINUTES_KEY = 'posAutoLogoutMinutes';
const autoLogoutMinutes = ref(0); // Default to 0 (disabled)
const message = ref('');
const messageType = ref(''); // 'success' or 'error'

onMounted(() => {
  const storedMinutes = localStorage.getItem(AUTO_LOGOUT_MINUTES_KEY);
  if (storedMinutes !== null) {
    const parsedMinutes = parseInt(storedMinutes, 10);
    if (!isNaN(parsedMinutes)) {
      autoLogoutMinutes.value = parsedMinutes;
    } else {
      autoLogoutMinutes.value = 0; // Default to 0 if stored value is invalid
      localStorage.setItem(AUTO_LOGOUT_MINUTES_KEY, '0'); // Correct invalid stored value
    }
  } else {
      autoLogoutMinutes.value = 0; // Default to 0 if not set
      localStorage.setItem(AUTO_LOGOUT_MINUTES_KEY, '0'); // Initialize if not set
  }
});

function handleSaveSettings() {
  message.value = ''; // Clear previous message
  try {
    const minutesToSave = parseInt(autoLogoutMinutes.value, 10);
    if (isNaN(minutesToSave) || minutesToSave < 0) {
      messageType.value = 'error';
      message.value = 'Invalid input. Please enter a non-negative number for minutes.';
      // Optionally reset input to current valid stored value or 0
      const storedMinutes = localStorage.getItem(AUTO_LOGOUT_MINUTES_KEY);
      autoLogoutMinutes.value = storedMinutes ? parseInt(storedMinutes, 10) : 0;
      return;
    }
    
    localStorage.setItem(AUTO_LOGOUT_MINUTES_KEY, String(minutesToSave));
    autoLogoutMinutes.value = minutesToSave; // Ensure ref is also correctly typed number

    messageType.value = 'success';
    message.value = 'Settings saved successfully!';
    
    // Clear message after a few seconds
    setTimeout(() => {
      message.value = '';
      messageType.value = '';
    }, 3000);

  } catch (error) {
    console.error("Error saving settings:", error);
    messageType.value = 'error';
    message.value = 'Failed to save settings. Please try again.';
  }
}
</script>

<style scoped>
/* Styles specific to AdminSettings if needed */
</style>
