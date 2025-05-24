<template>
  <div class="p-6 bg-gray-700 text-light-text rounded-lg shadow-md">
    <h2 class="text-3xl font-semibold text-primary mb-8">Clerk Activity Log</h2>

    <!-- Filtering Section -->
    <div class="bg-gray-800 p-4 rounded-lg shadow-sm mb-6">
      <h3 class="text-xl font-semibold mb-4 text-secondary-accent">Filter Logs</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label for="filterDateStart" class="block text-sm font-medium text-gray-300 mb-1">Start Date</label>
          <input type="date" id="filterDateStart" v-model="filters.dateStart"
                 class="w-full p-2.5 rounded-md bg-gray-100 text-gray-900 text-sm focus:ring-2 focus:ring-inset focus:ring-primary border border-gray-300 focus:border-primary">
        </div>
        <div>
          <label for="filterDateEnd" class="block text-sm font-medium text-gray-300 mb-1">End Date</label>
          <input type="date" id="filterDateEnd" v-model="filters.dateEnd"
                 class="w-full p-2.5 rounded-md bg-gray-100 text-gray-900 text-sm focus:ring-2 focus:ring-inset focus:ring-primary border border-gray-300 focus:border-primary">
        </div>
        <div>
          <label for="filterClerkId" class="block text-sm font-medium text-gray-300 mb-1">Clerk ID/Name</label>
          <input type="text" id="filterClerkId" v-model="filters.clerkId" placeholder="Enter Clerk ID or Name"
                 class="w-full p-2.5 rounded-md bg-gray-100 text-gray-900 text-sm focus:ring-2 focus:ring-inset focus:ring-primary border border-gray-300 focus:border-primary">
        </div>
        <div>
          <label for="filterActivityType" class="block text-sm font-medium text-gray-300 mb-1">Activity Type</label>
          <input type="text" id="filterActivityType" v-model="filters.activityType" placeholder="e.g., SALE_COMPLETED"
                 class="w-full p-2.5 rounded-md bg-gray-100 text-gray-900 text-sm focus:ring-2 focus:ring-inset focus:ring-primary border border-gray-300 focus:border-primary">
        </div>
      </div>
      <div class="mt-4 text-right">
        <button @click="applyFilters"
                :disabled="isLoading"
                class="bg-action-pink hover:bg-opacity-90 text-light-text font-semibold py-2.5 px-6 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-action-pink transition-colors duration-150 disabled:opacity-50">
          Apply Filters
        </button>
      </div>
    </div>

    <!-- Log Display Table -->
    <div class="bg-gray-800 p-1 rounded-lg shadow-sm overflow-x-auto">
      <div v-if="isLoading" class="text-center py-10 text-gray-400">
        <svg class="animate-spin h-8 w-8 text-primary mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Loading logs...
      </div>
      <div v-else-if="logs.length === 0" class="text-center py-10 text-gray-500">
        No activity logs found matching your criteria.
      </div>
      <table v-else class="min-w-full divide-y divide-gray-700">
        <thead class="bg-gray-750">
          <tr>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Timestamp</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Clerk Name</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Clerk ID</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Activity Type</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Details</th>
          </tr>
        </thead>
        <tbody class="bg-gray-800 divide-y divide-gray-700">
          <tr v-for="log in logs" :key="log.id" class="hover:bg-gray-750 transition-colors duration-150">
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{{ formatDisplayTimestamp(log.timestamp) }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-200">{{ log.clerk_name }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{{ log.clerk_id }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-200">
              <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                    :class="getActivityTypeClass(log.activity_type)">
                {{ log.activity_type }}
              </span>
            </td>
            <td class="px-4 py-3 text-xs text-gray-400">
              <pre v-if="log.details" class="whitespace-pre-wrap">{{ formatDetails(log.details) }}</pre>
              <span v-else>N/A</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import * as localDB from '../../utils/localDB'; // Adjusted path

const logs = ref([]);
const isLoading = ref(false);
const filters = ref({
  dateStart: '',
  dateEnd: '',
  clerkId: '', // Will be used for clerk_name or clerk_id search
  activityType: '',
  limit: 100, // Default limit
});

async function fetchLogs() {
  isLoading.value = true;
  try {
    // Prepare filters for localDB.getClerkActivityLogs
    const dbFilters = { limit: filters.value.limit };
    if (filters.value.dateStart) dbFilters.dateStart = filters.value.dateStart + " 00:00:00";
    if (filters.value.dateEnd) dbFilters.dateEnd = filters.value.dateEnd + " 23:59:59";
    
    // For clerkId, localDB's getClerkActivityLogs can be adapted to search both clerk_id and clerk_name if desired,
    // or we keep it simple and it only searches clerk_id. For now, assuming it searches clerk_id.
    // If we want to search by name, the localDB function would need adjustment or client-side filtering post-fetch.
    // For simplicity, this example will pass clerkId as is.
    if (filters.value.clerkId.trim()) dbFilters.clerkId = filters.value.clerkId.trim();
    if (filters.value.activityType.trim()) dbFilters.activityType = filters.value.activityType.trim();

    logs.value = await localDB.getClerkActivityLogs(dbFilters);
  } catch (error) {
    console.error("Error fetching clerk activity logs:", error);
    logs.value = []; // Clear logs on error
    alert("Failed to load activity logs: " + error.message);
  } finally {
    isLoading.value = false;
  }
}

function applyFilters() {
  fetchLogs();
}

onMounted(() => {
  fetchLogs(); // Load initial logs
});

function formatDisplayTimestamp(timestamp) {
  if (!timestamp) return 'N/A';
  try {
    return new Date(timestamp).toLocaleString();
  } catch (e) {
    return timestamp; // Return raw if formatting fails
  }
}

function formatDetails(details) {
  if (typeof details === 'object' && details !== null) {
    return JSON.stringify(details, null, 2);
  }
  return details || 'N/A';
}

function getActivityTypeClass(activityType) {
  switch (activityType) {
    case 'CLERK_LOGIN':
    case 'SALE_COMPLETED':
      return 'bg-green-600 bg-opacity-50 text-green-100';
    case 'CLERK_LOGOUT':
    case 'CART_CLEARED':
      return 'bg-yellow-600 bg-opacity-50 text-yellow-100';
    case 'CLERK_LOGIN_FAILED':
      return 'bg-red-600 bg-opacity-50 text-red-100';
    case 'CART_HELD':
    case 'CART_RESUMED':
    case 'CART_DELETED_FROM_HOLD':
      return 'bg-blue-600 bg-opacity-50 text-blue-100';
    default:
      return 'bg-gray-600 bg-opacity-50 text-gray-100';
  }
}
</script>

<style scoped>
pre {
  font-family: 'Consolas', 'Monaco', monospace;
  max-width: 300px; /* Or adjust as needed */
  overflow-x: auto; /* Allow horizontal scroll for long details */
}
</style>
