export function formatCurrency(value, currencySymbol = '$') {
  const numericValue = Number(value);
  if (isNaN(numericValue)) {
    // console.warn(`formatCurrency received non-numeric value: ${value}`);
    return `${currencySymbol}0.00`; // Or handle as 'N/A' or throw error
  }
  return `${currencySymbol}${numericValue.toFixed(2)}`;
}

// Add other formatters here if needed later
// export function formatDate(dateStr) { ... }
// export function formatTime(timeStr) { ... }
