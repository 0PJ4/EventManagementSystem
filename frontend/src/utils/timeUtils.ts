/**
 * Timezone utilities for Eastern Standard Time (EST/EDT)
 * 
 * This module provides functions to ensure all times are displayed
 * and compared in Eastern Time, accounting for daylight saving time.
 */

/**
 * Eastern Time timezone identifier
 * Uses 'America/New_York' which automatically handles EST/EDT transitions
 */
export const EASTERN_TIMEZONE = 'America/New_York';

/**
 * Gets the current time in Eastern Time
 * 
 * @returns Date object representing current time in Eastern Time
 */
export function getEasternTime(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: EASTERN_TIMEZONE }));
}

/**
 * Converts a date to Eastern Time
 * 
 * @param date - Date to convert (can be string or Date object)
 * @returns Date object in Eastern Time
 */
export function toEasternTime(date: string | Date): Date {
  const inputDate = typeof date === 'string' ? new Date(date) : date;
  
  // Get the date string in Eastern Time
  const easternString = inputDate.toLocaleString('en-US', { 
    timeZone: EASTERN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  // Parse it back to a Date object (this will be in local time, but represents Eastern Time)
  // We need to create a date that represents the Eastern Time moment
  const [datePart, timePart] = easternString.split(', ');
  const [month, day, year] = datePart.split('/');
  const [hours, minutes, seconds] = timePart.split(':');
  
  // Create a date string in ISO format and parse it
  // Note: This creates a date that represents the Eastern Time moment in UTC
  const utcDate = new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}`);
  
  // Get the offset between UTC and Eastern Time for this date
  const easternOffset = getEasternOffset(utcDate);
  
  // Adjust the UTC date by the offset to get the correct Eastern Time representation
  return new Date(utcDate.getTime() - easternOffset * 60 * 1000);
}

/**
 * Gets the offset in minutes between UTC and Eastern Time for a given date
 * Accounts for daylight saving time (EDT vs EST)
 * 
 * @param date - Date to check
 * @returns Offset in minutes (negative for EST/EDT which is behind UTC)
 */
function getEasternOffset(date: Date): number {
  // Eastern Time is UTC-5 (EST) or UTC-4 (EDT)
  // We'll use Intl.DateTimeFormat to get the actual offset
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TIMEZONE,
    timeZoneName: 'longOffset'
  });
  
  const parts = formatter.formatToParts(date);
  const offsetPart = parts.find(part => part.type === 'timeZoneName');
  
  if (offsetPart) {
    // Parse offset like "GMT-5" or "GMT-4"
    const match = offsetPart.value.match(/GMT([+-])(\d+)/);
    if (match) {
      const sign = match[1] === '-' ? -1 : 1;
      const hours = parseInt(match[2], 10);
      return sign * hours * 60;
    }
  }
  
  // Fallback: EST is UTC-5, EDT is UTC-4
  // Check if DST is in effect (roughly March-November)
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const isDST = (month > 2 && month < 11) || 
                (month === 2 && day >= 8) || 
                (month === 11 && day <= 1);
  return isDST ? -4 * 60 : -5 * 60;
}

/**
 * Formats a date to display in Eastern Time
 * 
 * @param date - Date to format (can be string or Date object)
 * @param options - Intl.DateTimeFormatOptions for formatting
 * @returns Formatted date string in Eastern Time
 */
export function formatEasternTime(
  date: string | Date,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: EASTERN_TIMEZONE
  }
): string {
  const inputDate = typeof date === 'string' ? new Date(date) : date;
  return inputDate.toLocaleString('en-US', {
    ...options,
    timeZone: EASTERN_TIMEZONE
  });
}

/**
 * Formats a date to display in Eastern Time with date only
 * 
 * @param date - Date to format
 * @returns Formatted date string (e.g., "01/15/2024")
 */
export function formatEasternDate(date: string | Date): string {
  return formatEasternTime(date, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: EASTERN_TIMEZONE
  });
}

/**
 * Formats a date to display in Eastern Time with time only
 * 
 * @param date - Date to format
 * @returns Formatted time string (e.g., "2:30 PM EST")
 */
export function formatEasternDateTime(date: string | Date): string {
  const formatted = formatEasternTime(date, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: EASTERN_TIMEZONE
  });
  
  // Add timezone abbreviation
  const inputDate = typeof date === 'string' ? new Date(date) : date;
  const isDST = isDaylightSavingTime(inputDate);
  const tzAbbr = isDST ? 'EDT' : 'EST';
  
  return `${formatted} ${tzAbbr}`;
}

/**
 * Checks if a date is during daylight saving time in Eastern Time
 * 
 * @param date - Date to check
 * @returns true if EDT (daylight saving), false if EST
 */
function isDaylightSavingTime(date: Date): boolean {
  // DST in Eastern Time typically runs from second Sunday in March to first Sunday in November
  const year = date.getFullYear();
  const march = new Date(year, 2, 1); // March 1
  const november = new Date(year, 10, 1); // November 1
  
  // Find second Sunday in March
  let secondSundayMarch = new Date(march);
  const marchDayOfWeek = march.getDay();
  const daysToAdd = (7 - marchDayOfWeek + 7) % 7 + 7; // Second Sunday
  secondSundayMarch.setDate(1 + daysToAdd);
  
  // Find first Sunday in November
  let firstSundayNovember = new Date(november);
  const novemberDayOfWeek = november.getDay();
  const daysToAddNov = (7 - novemberDayOfWeek) % 7;
  firstSundayNovember.setDate(1 + daysToAddNov);
  
  return date >= secondSundayMarch && date < firstSundayNovember;
}

/**
 * Gets current time in Eastern Time as a Date object for comparisons
 * This ensures all time comparisons use Eastern Time
 * 
 * @returns Date object representing current Eastern Time
 */
export function getCurrentEasternTime(): Date {
  const now = new Date();
  // Convert current UTC time to Eastern Time representation
  const easternString = now.toLocaleString('en-US', { 
    timeZone: EASTERN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  // Parse and return as a Date object
  // Note: This creates a date that represents the Eastern Time moment
  const [datePart, timePart] = easternString.split(', ');
  const [month, day, year] = datePart.split('/');
  const [hours, minutes, seconds] = timePart.split(':');
  
  // Create a date in local time that represents the Eastern Time
  // We'll use this for comparisons - the actual UTC value doesn't matter for relative comparisons
  return new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}`);
}
