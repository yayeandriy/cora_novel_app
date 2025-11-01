# Project Timeline - Quick Start Guide

## Overview
The Project Timeline feature allows you to set start and end dates for your project and visualizes them with an intelligent, adaptive timeline bar.

## Location
The timeline is displayed at the top of the project view, directly below the header and project name, spanning the width of the document section.

## Setting Timeline Dates

### Start Date
1. Click the **"Set Start"** button (or the current start date if already set)
2. An inline date picker will appear
3. Select or type your desired start date
4. The date is automatically saved when you make a selection

### End Date
1. Click the **"Set End"** button (or the current end date if already set)
2. An inline date picker will appear
3. Select or type your desired end date
4. The date is automatically saved when you make a selection

## Timeline Visualization

### Adaptive Scaling
The timeline automatically adjusts its tick marks based on your date range:

- **Multi-year projects (3+ years)**
  - Major ticks: Years (2024, 2025, 2026)
  - Minor ticks: Quarters (Q1, Q2, Q3, Q4)

- **1-2 Year projects**
  - Major ticks: Years (2025, 2026)
  - Minor ticks: Months (Jan, Feb, Mar...)

- **Within one year**
  - Major ticks: Months (Jan 2025, Feb 2025...)
  - Minor ticks: Weeks

- **Within one month**
  - Major ticks: Weeks
  - Minor ticks: Days

### Visual Elements
- **Timeline Bar**: Horizontal line spanning the timeline
- **Major Ticks**: Taller tick marks with bold labels
- **Minor Ticks**: Shorter tick marks with lighter labels
- **Placeholder**: "Set start and end dates to view timeline" shown when no dates are set

## Examples

### Example 1: Novel Writing Project (1 year)
```
Start: January 1, 2025
End: December 31, 2025

Timeline shows: Monthly ticks (Jan, Feb, Mar... Dec)
```

### Example 2: Series Planning (5 years)
```
Start: January 1, 2025
End: December 31, 2029

Timeline shows: Yearly ticks (2025, 2026... 2029) with quarterly subdivisions
```

### Example 3: Short Story Sprint (1 month)
```
Start: June 1, 2025
End: June 30, 2025

Timeline shows: Weekly and daily tick marks
```

## Tips

1. **Set dates in order**: While not required, setting the start date before the end date provides better visual feedback

2. **Date persistence**: Your timeline dates are automatically saved to the database and will persist when you close and reopen the project

3. **Updating dates**: Simply click on any date button again to change it - no need to delete first

4. **Sidebar interaction**: The timeline automatically adjusts its position when you toggle the left sidebar

5. **Visual planning**: Use the timeline to visualize your project duration and plan your writing schedule

## Keyboard Shortcuts
When the date picker is open:
- **Arrow keys**: Navigate dates
- **Enter**: Confirm selection
- **Escape**: Close without changes

## Troubleshooting

### "Set Start" or "Set End" button doesn't respond
- Ensure the project is fully loaded
- Try refreshing the page
- Check that you're not in a read-only mode

### Timeline doesn't show tick marks
- Verify both start and end dates are set
- Ensure start date is before end date
- Try setting the dates again

### Dates don't persist
- Check your database connection
- Verify the migrations have run successfully
- Look in the console for any error messages

## Future Features (Coming Soon)
- Timeline markers for events
- Document-level timelines
- Interactive timeline navigation
- Timeline zoom controls
- Export timeline visualization

## Need Help?
Check the console for any error messages, or refer to the full implementation documentation in `TIMELINE_IMPLEMENTATION.md`.
