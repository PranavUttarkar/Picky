import type { Restaurant } from '@/types/models';

/**
 * Determines if a restaurant is currently open based on the current day and time.
 * @param restaurant - The restaurant object with open_time fields
 * @returns Object with isOpen boolean and status string ('Open' | 'Closed')
 */
export function getRestaurantStatus(restaurant: Restaurant): { isOpen: boolean; status: 'Open' | 'Closed' } {
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeInMinutes = currentHour * 60 + currentMinute;

  // Map day index to field name
  const dayFields: Record<number, keyof Restaurant> = {
    0: 'open_time_sunday',
    1: 'open_time_monday',
    2: 'open_time_tuesday',
    3: 'open_time_wednesday',
    4: 'open_time_thursday',
    5: 'open_time_friday',
    6: 'open_time_saturday',
  };

  const hoursString = restaurant[dayFields[currentDay]];
  
  // If no hours data, return closed
  if (!hoursString || hoursString.trim().length === 0) {
    return { isOpen: false, status: 'Closed' };
  }

  const hoursLower = hoursString.toLowerCase().trim();

  // Check for "closed" explicitly
  if (hoursLower === 'closed' || hoursLower.includes('closed')) {
    return { isOpen: false, status: 'Closed' };
  }

  // Check for "open 24 hours" or "24 hours"
  if (hoursLower.includes('24') || hoursLower.includes('open 24')) {
    return { isOpen: true, status: 'Open' };
  }

  // Parse time ranges like "9:00 AM – 10:00 PM" or "9 AM - 10 PM"
  // Common formats:
  // - "9:00 AM – 10:00 PM"
  // - "9 AM - 10 PM"
  // - "9:00AM-10:00PM"
  // - "9:00 AM–10:00 PM" (en dash)
  const timeRangePattern = /(\d{1,2}):?(\d{2})?\s*(AM|PM)\s*[–\-]\s*(\d{1,2}):?(\d{2})?\s*(AM|PM)/i;
  const match = hoursString.match(timeRangePattern);

  if (match) {
    const [, startHourStr, startMinStr, startPeriod, endHourStr, endMinStr, endPeriod] = match;
    
    const startHour = parseInt(startHourStr, 10);
    const startMin = parseInt(startMinStr || '0', 10);
    const endHour = parseInt(endHourStr, 10);
    const endMin = parseInt(endMinStr || '0', 10);

    // Convert to 24-hour format
    let startTimeInMinutes = startHour % 12 * 60 + startMin;
    if (startPeriod.toUpperCase() === 'PM' && startHour !== 12) {
      startTimeInMinutes += 12 * 60;
    }
    if (startPeriod.toUpperCase() === 'AM' && startHour === 12) {
      startTimeInMinutes = startMin; // 12 AM = midnight
    }

    let endTimeInMinutes = endHour % 12 * 60 + endMin;
    if (endPeriod.toUpperCase() === 'PM' && endHour !== 12) {
      endTimeInMinutes += 12 * 60;
    }
    if (endPeriod.toUpperCase() === 'AM' && endHour === 12) {
      endTimeInMinutes = endMin; // 12 AM = midnight
    }

    // Handle case where closing time is next day (e.g., 11 PM - 2 AM)
    if (endTimeInMinutes < startTimeInMinutes) {
      endTimeInMinutes += 24 * 60;
    }

    // Check if current time is within the range
    let adjustedCurrentTime = currentTimeInMinutes;
    // If closing time wraps to next day and current time is before start, check previous day
    if (endTimeInMinutes >= 24 * 60 && currentTimeInMinutes < startTimeInMinutes) {
      adjustedCurrentTime += 24 * 60;
    }

    const isOpen = adjustedCurrentTime >= startTimeInMinutes && adjustedCurrentTime < endTimeInMinutes;
    return { isOpen, status: isOpen ? 'Open' : 'Closed' };
  }

  // If we can't parse the format, default to closed for safety
  return { isOpen: false, status: 'Closed' };
}

