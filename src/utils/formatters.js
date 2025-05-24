export function formatCurrency(value, currencySymbol = '$') {
  const numericValue = Number(value);
  if (isNaN(numericValue)) {
    // console.warn(`formatCurrency received non-numeric value: ${value}`);
    return `${currencySymbol}0.00`; // Or handle as 'N/A' or throw error
  }
  return `${currencySymbol}${numericValue.toFixed(2)}`;
}

export function formatDate(dateStringOrObject, options = { year: 'numeric', month: 'short', day: 'numeric' }) {
  if (!dateStringOrObject) return 'N/A';
  try {
    const date = new Date(dateStringOrObject);
    // Check if date is valid after parsing
    if (isNaN(date.getTime())) {
        // Try to parse YYYY-MM-DD if it's a simple string date from SQLite
        if (typeof dateStringOrObject === 'string' && dateStringOrObject.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const parts = dateStringOrObject.split('-');
            // new Date(year, monthIndex, day) - monthIndex is 0-based
            const validDate = new Date(parts[0], parts[1] - 1, parts[2]);
             if (isNaN(validDate.getTime())) {
                return dateStringOrObject; // Return original if still invalid
             }
             return validDate.toLocaleDateString(undefined, options);
        }
        return dateStringOrObject; // Return original if invalid
    }
    return date.toLocaleDateString(undefined, options);
  } catch (error) {
    console.error("Error formatting date:", dateStringOrObject, error);
    return String(dateStringOrObject); // Fallback to string representation
  }
}

// Example for time, if needed later
// export function formatTime(dateTimeStringOrObject) {
//   if (!dateTimeStringOrObject) return 'N/A';
//   try {
//     const date = new Date(dateTimeStringOrObject);
//     if (isNaN(date.getTime())) return String(dateTimeStringOrObject);
//     return date.toLocaleTimeString();
//   } catch (error) {
//     console.error("Error formatting time:", dateTimeStringOrObject, error);
//     return String(dateTimeStringOrObject);
//   }
// }
