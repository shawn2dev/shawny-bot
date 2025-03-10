export function daysSinceTargetDate(targetDate, timezone) {
    // Parse the target date into a Date object and convert to the specified timezone.
    const target = new Date(targetDate + "T00:00:00Z"); // Create target date in UTC
    
    // Get current date in the specified timezone and convert it to the same time format
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
    
    // Normalize both dates to midnight UTC time
    const targetDateUTC = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
    const nowDateUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  
    // Calculate the difference in time (in milliseconds)
    const timeDifference = nowDateUTC - targetDateUTC;
  
    // Convert the difference from milliseconds to days
    const daysPassed = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
  
    return daysPassed;
}