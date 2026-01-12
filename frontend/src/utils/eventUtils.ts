/**
 * Event categorization utilities
 * 
 * This module provides clear, consistent logic for categorizing events
 * into past, current (ongoing), and upcoming categories based on their
 * start and end times relative to the current time.
 * 
 * All times are handled in Eastern Time (EST/EDT).
 */

import { getCurrentEasternTime } from './timeUtils';

export interface EventTimeInfo {
  startTime: string | Date;
  endTime: string | Date;
}

/**
 * Determines if an event is in the past (has ended)
 * 
 * @param event - Event with startTime and endTime
 * @param referenceTime - Optional reference time (defaults to current Eastern Time)
 * @returns true if the event has ended
 * 
 * Logic: event.endTime < referenceTime (all times in Eastern Time)
 */
export function isPastEvent(
  event: EventTimeInfo,
  referenceTime: Date = getCurrentEasternTime()
): boolean {
  const eventEndTime = new Date(event.endTime);
  return referenceTime > eventEndTime;
}

/**
 * Determines if an event is currently ongoing
 * 
 * @param event - Event with startTime and endTime
 * @param referenceTime - Optional reference time (defaults to current Eastern Time)
 * @returns true if the event is currently happening
 * 
 * Logic: referenceTime >= event.startTime && referenceTime <= event.endTime (all times in Eastern Time)
 */
export function isCurrentEvent(
  event: EventTimeInfo,
  referenceTime: Date = getCurrentEasternTime()
): boolean {
  const eventStartTime = new Date(event.startTime);
  const eventEndTime = new Date(event.endTime);
  return referenceTime >= eventStartTime && referenceTime <= eventEndTime;
}

/**
 * Determines if an event is upcoming (hasn't started yet)
 * 
 * @param event - Event with startTime and endTime
 * @param referenceTime - Optional reference time (defaults to current Eastern Time)
 * @returns true if the event hasn't started yet
 * 
 * Logic: referenceTime < event.startTime (all times in Eastern Time)
 */
export function isUpcomingEvent(
  event: EventTimeInfo,
  referenceTime: Date = getCurrentEasternTime()
): boolean {
  const eventStartTime = new Date(event.startTime);
  return referenceTime < eventStartTime;
}

/**
 * Categorizes events into past, current, and upcoming
 * 
 * @param events - Array of events with startTime and endTime
 * @param referenceTime - Optional reference time (defaults to current Eastern Time)
 * @returns Object with categorized events
 * 
 * All times are compared in Eastern Time (EST/EDT)
 */
export function categorizeEvents<T extends EventTimeInfo>(
  events: T[],
  referenceTime: Date = getCurrentEasternTime()
): {
  pastEvents: T[];
  currentEvents: T[];
  upcomingEvents: T[];
} {
  const pastEvents: T[] = [];
  const currentEvents: T[] = [];
  const upcomingEvents: T[] = [];

  events.forEach((event) => {
    if (isPastEvent(event, referenceTime)) {
      pastEvents.push(event);
    } else if (isCurrentEvent(event, referenceTime)) {
      currentEvents.push(event);
    } else if (isUpcomingEvent(event, referenceTime)) {
      upcomingEvents.push(event);
    }
  });

  return {
    pastEvents,
    currentEvents,
    upcomingEvents,
  };
}

/**
 * Gets all events that have started (current + past)
 * Useful for attendance calculations
 * 
 * @param events - Array of events with startTime and endTime
 * @param referenceTime - Optional reference time (defaults to current Eastern Time)
 * @returns Array of events that have started
 * 
 * All times are compared in Eastern Time (EST/EDT)
 */
export function getStartedEvents<T extends EventTimeInfo>(
  events: T[],
  referenceTime: Date = getCurrentEasternTime()
): T[] {
  return events.filter(
    (event) => new Date(event.startTime) <= referenceTime
  );
}
