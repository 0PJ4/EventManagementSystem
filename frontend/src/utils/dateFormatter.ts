/**
 * Smart Date Formatter
 * 
 * Industry-standard date formatting that provides a seamless user experience:
 * - Relative time for recent dates ("2 hours ago", "in 3 days")
 * - Context-aware formatting ("Today at 2:30 PM", "Tomorrow at 10:00 AM")
 * - Clean, readable format for all dates
 * 
 * All times are displayed in Eastern Time (EST/EDT)
 */

import { 
  format, 
  formatDistanceToNow, 
  formatDistanceToNowStrict,
  isToday, 
  isTomorrow, 
  isYesterday,
  isThisYear,
  differenceInDays,
  differenceInMinutes,
  parseISO
} from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { EASTERN_TIMEZONE } from './timeUtils';

/**
 * Formats a date with smart, context-aware display
 * 
 * Examples:
 * - "2 minutes ago" (very recent)
 * - "Today at 2:30 PM" (today)
 * - "Tomorrow at 10:00 AM" (tomorrow)
 * - "Jan 15 at 2:30 PM" (this year)
 * - "Jan 15, 2023 at 2:30 PM" (past year)
 * 
 * @param date - Date to format (string or Date object)
 * @param options - Formatting options
 * @returns Formatted date string
 */
export function formatSmartDate(
  date: string | Date,
  options: {
    includeTime?: boolean; // Whether to include time (default: true)
    relativeThreshold?: number; // Minutes threshold for relative time (default: 60)
    showYear?: boolean; // Force show year (default: auto)
  } = {}
): string {
  const {
    includeTime = true,
    relativeThreshold = 60, // Show relative time if within 60 minutes
    showYear = undefined
  } = options;

  const inputDate = typeof date === 'string' ? parseISO(date) : date;
  const easternDate = toZonedTime(inputDate, EASTERN_TIMEZONE);
  const now = toZonedTime(new Date(), EASTERN_TIMEZONE);

  // For very recent dates (within threshold), show relative time
  const minutesDiff = Math.abs(differenceInMinutes(now, easternDate));
  if (minutesDiff < relativeThreshold && minutesDiff > 0) {
    const relative = formatDistanceToNowStrict(easternDate, { addSuffix: true });
    if (includeTime) {
      const timeStr = format(easternDate, 'h:mm a');
      return `${relative} (${timeStr})`;
    }
    return relative;
  }

  // For today
  if (isToday(easternDate)) {
    if (includeTime) {
      return `Today at ${format(easternDate, 'h:mm a')}`;
    }
    return 'Today';
  }

  // For tomorrow
  if (isTomorrow(easternDate)) {
    if (includeTime) {
      return `Tomorrow at ${format(easternDate, 'h:mm a')}`;
    }
    return 'Tomorrow';
  }

  // For yesterday
  if (isYesterday(easternDate)) {
    if (includeTime) {
      return `Yesterday at ${format(easternDate, 'h:mm a')}`;
    }
    return 'Yesterday';
  }

  // For dates within 7 days, show relative + time
  const daysDiff = Math.abs(differenceInDays(now, easternDate));
  if (daysDiff <= 7) {
    const relative = formatDistanceToNow(easternDate, { addSuffix: true });
    if (includeTime) {
      const timeStr = format(easternDate, 'h:mm a');
      return `${relative} (${timeStr})`;
    }
    return relative;
  }

  // For this year, show date without year
  const shouldShowYear = showYear !== undefined 
    ? showYear 
    : !isThisYear(easternDate);

  if (includeTime) {
    if (shouldShowYear) {
      return format(easternDate, 'MMM d, yyyy \'at\' h:mm a');
    }
    return format(easternDate, 'MMM d \'at\' h:mm a');
  }

  // Date only
  if (shouldShowYear) {
    return format(easternDate, 'MMM d, yyyy');
  }
  return format(easternDate, 'MMM d');
}

/**
 * Formats an event date/time for display in event lists
 * Shows date and time in a compact, readable format
 * 
 * @param date - Date to format
 * @returns Formatted string like "Today at 2:30 PM" or "Jan 15 at 10:00 AM"
 */
export function formatEventDateTime(date: string | Date): string {
  return formatSmartDate(date, { includeTime: true, relativeThreshold: 0 });
}

/**
 * Formats a date for table/card displays
 * More compact format suitable for tables
 * 
 * @param date - Date to format
 * @returns Formatted string
 */
export function formatTableDate(date: string | Date): string {
  const inputDate = typeof date === 'string' ? parseISO(date) : date;
  const easternDate = toZonedTime(inputDate, EASTERN_TIMEZONE);
  const now = toZonedTime(new Date(), EASTERN_TIMEZONE);

  if (isToday(easternDate)) {
    return format(easternDate, 'h:mm a');
  }

  if (isTomorrow(easternDate)) {
    return `Tomorrow ${format(easternDate, 'h:mm a')}`;
  }

  if (isYesterday(easternDate)) {
    return `Yesterday ${format(easternDate, 'h:mm a')}`;
  }

  const daysDiff = Math.abs(differenceInDays(now, easternDate));
  if (daysDiff <= 7) {
    return format(easternDate, 'EEE h:mm a'); // "Mon 2:30 PM"
  }

  if (isThisYear(easternDate)) {
    return format(easternDate, 'MMM d, h:mm a'); // "Jan 15, 2:30 PM"
  }

  return format(easternDate, 'MMM d, yyyy h:mm a'); // "Jan 15, 2023, 2:30 PM"
}

/**
 * Formats a date range for events
 * Shows start and end times in a readable format
 * 
 * @param startDate - Event start date
 * @param endDate - Event end date
 * @returns Formatted string like "Today, 2:30 PM - 4:00 PM" or "Jan 15, 10:00 AM - 2:00 PM"
 */
export function formatEventRange(startDate: string | Date, endDate: string | Date): string {
  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;
  
  const easternStart = toZonedTime(start, EASTERN_TIMEZONE);
  const easternEnd = toZonedTime(end, EASTERN_TIMEZONE);

  const isSameDay = format(easternStart, 'yyyy-MM-dd') === format(easternEnd, 'yyyy-MM-dd');

  if (isSameDay) {
    if (isToday(easternStart)) {
      return `Today, ${format(easternStart, 'h:mm a')} - ${format(easternEnd, 'h:mm a')}`;
    }
    if (isTomorrow(easternStart)) {
      return `Tomorrow, ${format(easternStart, 'h:mm a')} - ${format(easternEnd, 'h:mm a')}`;
    }
    if (isThisYear(easternStart)) {
      return `${format(easternStart, 'MMM d')}, ${format(easternStart, 'h:mm a')} - ${format(easternEnd, 'h:mm a')}`;
    }
    return `${format(easternStart, 'MMM d, yyyy')}, ${format(easternStart, 'h:mm a')} - ${format(easternEnd, 'h:mm a')}`;
  }

  // Different days
  const startStr = formatEventDateTime(startDate);
  const endStr = formatEventDateTime(endDate);
  return `${startStr} - ${endStr}`;
}

/**
 * Formats a date for tooltips and detailed views
 * Full format with timezone
 * 
 * @param date - Date to format
 * @returns Full formatted string
 */
export function formatFullDate(date: string | Date): string {
  const inputDate = typeof date === 'string' ? parseISO(date) : date;
  const easternDate = toZonedTime(inputDate, EASTERN_TIMEZONE);
  
  // Determine if EST or EDT
  const janDate = new Date(easternDate.getFullYear(), 0, 1);
  const julDate = new Date(easternDate.getFullYear(), 6, 1);
  const stdOffset = Math.max(janDate.getTimezoneOffset(), julDate.getTimezoneOffset());
  const isDST = easternDate.getTimezoneOffset() < stdOffset;
  const tzAbbr = isDST ? 'EDT' : 'EST';

  return format(easternDate, `MMM d, yyyy 'at' h:mm a '${tzAbbr}'`);
}
