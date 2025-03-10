function getTimeZoneOffset(timezone) {
    const dateInTimeZone = new Date().toLocaleString("en-US", { timeZone: timezone });
    const offset = new Date(dateInTimeZone).getHours() - new Date().getHours();
    return offset >= 0 ? `+${offset}:00` : `${offset}:00`;
}

export function daysSinceTargetDate(targetDate, timezone) {
    // Create a Date object for the target date, considering the timezone
    const targetDateInTimeZone = new Date(targetDate + 'T00:00:00' + getTimeZoneOffset(timezone));
    
    // Get the current date and time in the same timezone
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: timezone }));
    
    // Calculate the difference in milliseconds
    const timeDifference = now - targetDateInTimeZone;
    
    // Convert the difference from milliseconds to days
    const daysPassed = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
    
    return daysPassed;
}
