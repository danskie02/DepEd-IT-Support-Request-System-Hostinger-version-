import { format } from "date-fns";

/**
 * Formats a date string from the database to local time
 * Handles timezone conversion properly
 * PostgreSQL stores timestamps in UTC, so we need to ensure proper conversion
 */
export function formatLocalDate(dateInput: string | Date, formatString: string = "MMM d, yyyy h:mm a"): string {
  let date: Date;
  
  if (dateInput instanceof Date) {
    date = dateInput;
  } else if (typeof dateInput === 'string') {
    // If the string doesn't have timezone info, assume it's UTC from the database
    // PostgreSQL timestamps are typically in UTC
    const dateStr = dateInput as string;
    if (!dateStr.includes('Z') && !dateStr.includes('+') && !dateStr.includes('-', 10)) {
      // Add 'Z' to indicate UTC if not present (assuming it's from PostgreSQL)
      date = new Date(dateStr + 'Z');
    } else {
      date = new Date(dateStr);
    }
  } else {
    // Fallback
    date = new Date(dateInput);
  }
  
  return format(date, formatString);
}
