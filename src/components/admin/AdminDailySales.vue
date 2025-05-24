<template>
  <div class="p-6 bg-gray-700 text-light-text rounded-lg shadow-md">
    <h2 class="text-3xl font-semibold text-primary mb-8">Daily Sales Report</h2>

    <!-- Filtering Section -->
    <div class="bg-gray-800 p-4 rounded-lg shadow-sm mb-6">
      <h3 class="text-xl font-semibold mb-4 text-secondary-accent">Filter Report</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div>
          <label for="reportDateStart" class="block text-sm font-medium text-gray-300 mb-1">Start Date</label>
          <input type="date" id="reportDateStart" v-model="filterOptions.dateStart"
                 class="w-full p-2.5 rounded-md bg-gray-100 text-gray-900 text-sm focus:ring-2 focus:ring-inset focus:ring-primary border border-gray-300 focus:border-primary">
        </div>
        <div>
          <label for="reportDateEnd" class="block text-sm font-medium text-gray-300 mb-1">End Date</label>
          <input type="date" id="reportDateEnd" v-model="filterOptions.dateEnd"
                 class="w-full p-2.5 rounded-md bg-gray-100 text-gray-900 text-sm focus:ring-2 focus:ring-inset focus:ring-primary border border-gray-300 focus:border-primary">
        </div>
        <div>
          <button @click="generateReport"
                  :disabled="isLoading"
                  class="w-full bg-action-pink hover:bg-opacity-90 text-light-text font-semibold py-2.5 px-6 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-action-pink transition-colors duration-150 disabled:opacity-50">
            <span v-if="isLoading">Generating...</span>
            <span v-else>Generate Report</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Report Display Table -->
    <div class="bg-gray-800 p-1 rounded-lg shadow-sm overflow-x-auto">
      <div v-if="isLoading" class="text-center py-10 text-gray-400">
         <svg class="animate-spin h-8 w-8 text-primary mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Loading report data...
      </div>
      <div v-else-if="reportData.length === 0" class="text-center py-10 text-gray-500">
        No sales data found for the selected period.
      </div>
      <table v-else class="min-w-full divide-y divide-gray-700">
        <thead class="bg-gray-750">
          <tr>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Date</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Transaction Count</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Total Sales</th>
          </tr>
        </thead>
        <tbody class="bg-gray-800 divide-y divide-gray-700">
          <tr v-for="daySummary in reportData" :key="daySummary.date" class="hover:bg-gray-750 transition-colors duration-150">
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-200">{{ formatDate(daySummary.date) }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-300 text-center">{{ daySummary.transactionCount }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-100 font-semibold">{{ formatCurrency(daySummary.totalSales) }}</td>
          </tr>
        </tbody>
         <tfoot v-if="reportData.length > 0" class="bg-gray-750 border-t-2 border-gray-600">
            <tr>
                <td class="px-4 py-3 text-right text-sm font-bold text-gray-200" colspan="2">Grand Total for Period:</td>
                <td class="px-4 py-3 text-sm font-bold text-primary">{{ formatCurrency(periodGrandTotal) }}</td>
            </tr>
        </tfoot>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import * as localDB from '../../utils/localDB'; 
import { formatCurrency, formatDate } from '../../utils/formatters';

const reportData = ref([]);
const isLoading = ref(false);

// Initialize with a default date range (e.g., current month or last 7 days)
const getISODateString = (date) => date.toISOString().split('T')[0];
const today = new Date();
const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

const filterOptions = ref({
  dateStart: getISODateString(firstDayOfMonth),
  dateEnd: getISODateString(today),
});

async function generateReport() {
  isLoading.value = true;
  reportData.value = []; // Clear previous data
  try {
    const filtersToApply = {
      dateStart: filterOptions.value.dateStart || undefined, // Pass undefined if empty
      dateEnd: filterOptions.value.dateEnd || undefined,
    };
    const transactions = await localDB.getAllSalesForReporting(filtersToApply);
    
    // Process transactions to aggregate by date
    const dailySummary = {};
    transactions.forEach(tx => {
      const date = tx.posting_date; // Assuming posting_date is YYYY-MM-DD
      if (!dailySummary[date]) {
        dailySummary[date] = {
          date: date,
          transactionCount: 0,
          totalSales: 0,
        };
      }
      dailySummary[date].transactionCount++;
      dailySummary[date].totalSales += parseFloat(tx.grand_total || 0);
    });
    
    // Convert summary object to array and sort by date
    reportData.value = Object.values(dailySummary).sort((a, b) => new Date(a.date) - new Date(b.date));

  } catch (error) {
    console.error("Error generating daily sales report:", error);
    alert("Failed to generate report: " + error.message);
  } finally {
    isLoading.value = false;
  }
}

const periodGrandTotal = computed(() => {
    return reportData.value.reduce((sum, day) => sum + day.totalSales, 0);
});

onMounted(() => {
  generateReport(); // Load report with default date range on mount
});
</script>

<style scoped>
/* Styles specific to AdminDailySales if needed */
</style>
