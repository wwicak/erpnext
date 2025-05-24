<template>
  <div class="p-6 bg-gray-700 text-light-text rounded-lg shadow-md">
    <h2 class="text-3xl font-semibold text-primary mb-8">API Synchronization Log</h2>

    <!-- Filtering Section -->
    <div class="bg-gray-800 p-4 rounded-lg shadow-sm mb-6">
      <h3 class="text-xl font-semibold mb-4 text-secondary-accent">Filter Logs</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
        <div>
          <label for="filterApiLogDateStart" class="block text-sm font-medium text-gray-300 mb-1">Start Date</label>
          <input type="date" id="filterApiLogDateStart" v-model="filterOptions.dateStart"
                 class="w-full p-2.5 rounded-md bg-gray-100 text-gray-900 text-sm focus:ring-2 focus:ring-inset focus:ring-primary border border-gray-300 focus:border-primary">
        </div>
        <div>
          <label for="filterApiLogDateEnd" class="block text-sm font-medium text-gray-300 mb-1">End Date</label>
          <input type="date" id="filterApiLogDateEnd" v-model="filterOptions.dateEnd"
                 class="w-full p-2.5 rounded-md bg-gray-100 text-gray-900 text-sm focus:ring-2 focus:ring-inset focus:ring-primary border border-gray-300 focus:border-primary">
        </div>
        <div>
          <label for="filterApiLogOfflineId" class="block text-sm font-medium text-gray-300 mb-1">Offline Transaction ID</label>
          <input type="text" id="filterApiLogOfflineId" v-model="filterOptions.offlineId" placeholder="Enter Offline ID"
                 class="w-full p-2.5 rounded-md bg-gray-100 text-gray-900 text-sm focus:ring-2 focus:ring-inset focus:ring-primary border border-gray-300 focus:border-primary">
        </div>
        <div>
          <label for="filterApiLogStatus" class="block text-sm font-medium text-gray-300 mb-1">Status</label>
          <select id="filterApiLogStatus" v-model="filterOptions.status"
                  class="w-full p-2.5 rounded-md bg-gray-100 text-gray-900 text-sm focus:ring-2 focus:ring-inset focus:ring-primary border border-gray-300 focus:border-primary">
            <option value="">All</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILED">Failed</option>
            <option value="ATTEMPTING">Attempting</option>
          </select>
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
        Loading API sync logs...
      </div>
      <div v-else-if="logs.length === 0" class="text-center py-10 text-gray-500">
        No API sync logs found matching your criteria.
      </div>
      <table v-else class="min-w-full divide-y divide-gray-700">
        <thead class="bg-gray-750">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Timestamp</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Offline ID</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">ERPNext ID</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">HTTP Code</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Error Message</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody class="bg-gray-800 divide-y divide-gray-700">
          <tr v-for="log in logs" :key="log.id" class="hover:bg-gray-750 transition-colors duration-150">
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{{ formatDisplayTimestamp(log.timestamp) }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-200 truncate max-w-xs" :title="log.offline_transaction_id">{{ log.offline_transaction_id }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-200 truncate max-w-xs" :title="log.erpnext_invoice_id">{{ log.erpnext_invoice_id || 'N/A' }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm">
              <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full" :class="getStatusClass(log.status)">
                {{ log.status }}
              </span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{{ log.http_status_code || 'N/A' }}</td>
            <td class="px-4 py-3 text-sm text-gray-300 truncate max-w-md" :title="log.error_message">{{ log.error_message || 'N/A' }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm">
              <button @click="showDetails(log)" class="text-primary hover:underline text-xs">View Details</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Details Modal -->
    <div v-if="isDetailsModalVisible && selectedLogEntry" 
         class="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4"
         @click.self="closeDetailsModal">
      <div class="bg-gray-800 text-light-text p-6 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-semibold text-primary">Sync Log Details (ID: {{ selectedLogEntry.id }})</h3>
          <button @click="closeDetailsModal" class="text-gray-400 hover:text-light-text text-3xl font-light leading-none">&times;</button>
        </div>
        <div class="overflow-y-auto space-y-3 text-xs">
          <div><strong class="text-gray-400">Timestamp:</strong> {{ formatDisplayTimestamp(selectedLogEntry.timestamp) }}</div>
          <div><strong class="text-gray-400">Offline ID:</strong> {{ selectedLogEntry.offline_transaction_id }}</div>
          <div><strong class="text-gray-400">ERPNext ID:</strong> {{ selectedLogEntry.erpnext_invoice_id || 'N/A' }}</div>
          <div><strong class="text-gray-400">Status:</strong> {{ selectedLogEntry.status }}</div>
          <div><strong class="text-gray-400">HTTP Code:</strong> {{ selectedLogEntry.http_status_code || 'N/A' }}</div>
          <div><strong class="text-gray-400">Error:</strong> <pre class="whitespace-pre-wrap">{{ selectedLogEntry.error_message || 'N/A' }}</pre></div>
          <div><strong class="text-gray-400">Request Payload:</strong> <pre class="whitespace-pre-wrap bg-gray-700 p-2 rounded-md max-h-48 overflow-auto">{{ formatJsonForDisplay(selectedLogEntry.request_payload_json) }}</pre></div>
          <div><strong class="text-gray-400">Response Body:</strong> <pre class="whitespace-pre-wrap bg-gray-700 p-2 rounded-md max-h-48 overflow-auto">{{ formatJsonForDisplay(selectedLogEntry.response_body_json) }}</pre></div>
        </div>
        <div class="mt-6 text-right">
          <button @click="closeDetailsModal" class="bg-gray-600 hover:bg-gray-500 text-light-text font-semibold py-2 px-4 rounded-md">Close</button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import * as localDB from '../../utils/localDB'; 
import { formatDate } from '../../utils/formatters'; // Assuming formatDate can handle datetime strings

const logs = ref([]);
const isLoading = ref(false);
const filterOptions = ref({
  dateStart: '',
  dateEnd: '',
  status: '',
  offlineId: '',
  limit: 50, // Default limit for initial load
});
const selectedLogEntry = ref(null);
const isDetailsModalVisible = ref(false);

async function fetchLogs() {
  isLoading.value = true;
  try {
    const dbFilters = { limit: filterOptions.value.limit };
    if (filterOptions.value.dateStart) dbFilters.dateStart = filterOptions.value.dateStart + " 00:00:00";
    if (filterOptions.value.dateEnd) dbFilters.dateEnd = filterOptions.value.dateEnd + " 23:59:59";
    if (filterOptions.value.status) dbFilters.status = filterOptions.value.status;
    if (filterOptions.value.offlineId.trim()) dbFilters.offlineId = filterOptions.value.offlineId.trim();
    
    logs.value = await localDB.getApiSyncLogs(dbFilters);
  } catch (error) {
    console.error("Error fetching API sync logs:", error);
    logs.value = [];
    alert("Failed to load API sync logs: " + error.message);
  } finally {
    isLoading.value = false;
  }
}

function applyFilters() {
  filterOptions.value.limit = 100; // Reset to a higher limit when filters are applied manually
  fetchLogs();
}

onMounted(() => {
  // Set default date range for initial load (e.g., last 7 days)
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);
  filterOptions.value.dateStart = sevenDaysAgo.toISOString().split('T')[0];
  filterOptions.value.dateEnd = today.toISOString().split('T')[0];
  
  fetchLogs(); 
});

function formatDisplayTimestamp(timestamp) {
  if (!timestamp) return 'N/A';
  try {
    // Use specific options for date and time
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
    return new Date(timestamp).toLocaleString(undefined, options);
  } catch (e) {
    return timestamp; 
  }
}

function getStatusClass(status) {
  switch (status) {
    case 'SUCCESS': return 'bg-green-600 bg-opacity-50 text-green-100';
    case 'FAILED': return 'bg-red-600 bg-opacity-50 text-red-100';
    case 'ATTEMPTING': return 'bg-yellow-600 bg-opacity-50 text-yellow-100';
    default: return 'bg-gray-600 bg-opacity-50 text-gray-100';
  }
}

function showDetails(logEntry) {
  selectedLogEntry.value = logEntry;
  isDetailsModalVisible.value = true;
}

function closeDetailsModal() {
  isDetailsModalVisible.value = false;
  selectedLogEntry.value = null;
}

function formatJsonForDisplay(jsonString) {
  if (!jsonString) return 'N/A';
  try {
    const parsed = JSON.parse(jsonString);
    return JSON.stringify(parsed, null, 2); // Pretty print
  } catch (e) {
    return jsonString; // Return as is if not valid JSON
  }
}
</script>

<style scoped>
pre {
  font-family: 'Consolas', 'Monaco', monospace;
  /* max-width: 100%; Ensure it doesn't overflow modal */
  /* overflow-x: auto; already handled by parent div */
  word-break: break-all; /* Break long strings if no spaces */
}
</style>
