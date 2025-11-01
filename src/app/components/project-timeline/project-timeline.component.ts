import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, ElementRef, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TimelineService } from '../../services/timeline.service';
import type { Timeline } from '../../shared/models';

interface TimelineTick {
  label: string;
  position: number; // percentage
  type: 'year' | 'quarter' | 'month' | 'week' | 'day';
}

@Component({
  selector: 'app-project-timeline',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './project-timeline.component.html',
  styleUrls: ['./project-timeline.component.css'],
  changeDetection: ChangeDetectionStrategy.Default
})
export class ProjectTimelineComponent implements OnInit, OnChanges {
  @Input() projectId?: number;
  @Input() projectName: string = '';
  @Input() projectDesc: string | null = null;
  @Input() startDate: string | null = null;
  @Input() endDate: string | null = null;
  @Input() editable: boolean = true;

  @Output() startDateChange = new EventEmitter<string>();
  @Output() endDateChange = new EventEmitter<string>();
  @Output() timelineUpdated = new EventEmitter<Timeline>();

  private timeline: Timeline | null = null;

  constructor(
    private timelineService: TimelineService,
    private cdr: ChangeDetectorRef
  ) {}

  // Inline fallback inputs visibility
  showStartInline: boolean = false;
  showEndInline: boolean = false;

  // ViewChild references to inline inputs (set when rendered)
  @ViewChild('inlineStartInput') inlineStartInput?: ElementRef<HTMLInputElement>;
  @ViewChild('inlineEndInput') inlineEndInput?: ElementRef<HTMLInputElement>;

  ngOnInit() {
    // Don't block on initialization - load timeline asynchronously
    if (this.projectId) {
      this.loadTimeline();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['projectId'] && !changes['projectId'].firstChange && this.projectId) {
      this.loadTimeline();
    }
  }

  private loadTimeline(): void {
    if (!this.projectId) return;
    
    this.timelineService.getTimelineByEntity('project', this.projectId)
      .then(timeline => {
        if (timeline) {
          this.timeline = timeline;
          this.startDate = timeline.start_date ?? null;
          this.endDate = timeline.end_date ?? null;
          this.cdr.markForCheck();
        }
      })
      .catch(error => {
        console.warn('Timeline not found or error loading timeline:', error);
        // Silently fail - timeline is optional
      });
  }

  private saveTimeline(startDate: string | null, endDate: string | null): void {
    if (!this.projectId) return;
    
    this.timelineService.upsertTimeline(
      'project',
      this.projectId,
      startDate,
      endDate
    )
      .then(updated => {
        this.timeline = updated;
        this.timelineUpdated.emit(updated);
        this.cdr.markForCheck();
      })
      .catch(error => {
        console.error('Error saving timeline:', error);
        // You might want to show a user-facing error here
      });
  }

  openStartDatePicker() {
    // Trigger native date picker by dispatching a click on the hidden input
    if (!this.editable) return;
    console.log('openStartDatePicker called, editable:', this.editable);
    
  // Create a temporary hidden input to trigger the native date picker.
    const tempInput = document.createElement('input');
    tempInput.type = 'date';
    if (this.startDate) {
      tempInput.value = this.formattedStartDate;
    }
    // Keep it invisible but attached to the DOM.
    tempInput.style.position = 'absolute';
    tempInput.style.opacity = '0';
    tempInput.style.left = '-9999px';
    document.body.appendChild(tempInput);

    const cleanup = () => {
      document.body.removeChild(tempInput);
    };

    const changeHandler = (e: Event) => {
      const val = (e.target as HTMLInputElement).value;
      console.log('Start date picker changed:', val);
      if (val) {
        this.onStartDateChange(val);
      }
      tempInput.removeEventListener('change', changeHandler);
      cleanup();
    };
    tempInput.addEventListener('change', changeHandler);

    if (typeof (tempInput as any).showPicker === 'function') {
      (tempInput as any).showPicker();
    } else {
      tempInput.click();
      tempInput.focus();
    }

    // Always show the inline fallback input so the user can pick a date
    // in environments where programmatic opening is blocked (Tauri/webview).
    this.showStartInline = true;
    // Focus the inline input after it renders
    setTimeout(() => {
      try {
        this.inlineStartInput?.nativeElement.focus();
      } catch (e) {
        // ignore
      }
    }, 0);
  }

  openEndDatePicker() {
    // Trigger native date picker by dispatching a click on the hidden input
    if (!this.editable) return;
    console.log('openEndDatePicker called, editable:', this.editable);
    
    const tempInput = document.createElement('input');
    tempInput.type = 'date';
    if (this.endDate) {
      tempInput.value = this.formattedEndDate;
    }
    tempInput.style.position = 'absolute';
    tempInput.style.opacity = '0';
    tempInput.style.left = '-9999px';
    document.body.appendChild(tempInput);

    const cleanup = () => {
      document.body.removeChild(tempInput);
    };

    const changeHandler = (e: Event) => {
      const val = (e.target as HTMLInputElement).value;
      console.log('End date picker changed:', val);
      if (val) {
        this.onEndDateChange(val);
      }
      tempInput.removeEventListener('change', changeHandler);
      cleanup();
    };
    tempInput.addEventListener('change', changeHandler);

    if (typeof (tempInput as any).showPicker === 'function') {
      (tempInput as any).showPicker();
    } else {
      tempInput.click();
      tempInput.focus();
    }

    this.showEndInline = true;
    setTimeout(() => {
      try {
        this.inlineEndInput?.nativeElement.focus();
      } catch (e) {
        // ignore
      }
    }, 0);
  }

  formatDateString(value: string | null): string {
    if (!value) return '';
    // Convert ISO date to yyyy-mm-dd for input
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  }

  get formattedStartDate(): string {
    return this.formatDateString(this.startDate);
  }

  get formattedEndDate(): string {
    return this.formatDateString(this.endDate);
  }

  onStartDateChange(newValue: string) {
    if (newValue) {
      this.startDate = newValue;
      this.showStartInline = false;
      this.startDateChange.emit(newValue);
      this.cdr.detectChanges();
      
      // Save in background without blocking UI
      setTimeout(() => {
        this.saveTimeline(newValue, this.endDate);
      }, 0);
    }
  }

  onEndDateChange(newValue: string) {
    if (newValue) {
      this.endDate = newValue;
      this.showEndInline = false;
      this.endDateChange.emit(newValue);
      this.cdr.detectChanges();
      
      // Save in background without blocking UI
      setTimeout(() => {
        this.saveTimeline(this.startDate, newValue);
      }, 0);
    }
  }

  parseDate(dateStr: string | null): Date | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }

  getTicks(): TimelineTick[] {
    const start = this.parseDate(this.startDate);
    const end = this.parseDate(this.endDate);

    if (!start || !end || start >= end) {
      return [];
    }

    const totalMs = end.getTime() - start.getTime();
    const totalDays = totalMs / (1000 * 60 * 60 * 24);
    const totalMonths = totalDays / 30.44;
    const totalYears = totalDays / 365.25;

    let ticks: TimelineTick[] = [];
    let majorInterval = 0;
    let minorInterval = 0;
    let majorType: 'year' | 'month' | 'week' | 'day' = 'month';
    let minorType: 'quarter' | 'month' | 'week' | 'day' = 'month';

    if (totalYears >= 3) {
      // Years and quarters
      majorInterval = 1;
      minorInterval = 0.25;
      majorType = 'year';
      minorType = 'quarter';
    } else if (totalYears >= 1) {
      // Years and months
      majorInterval = 1;
      minorInterval = 1/12;
      majorType = 'year';
      minorType = 'month';
    } else if (totalMonths > 9) {
      // More than 9 months: show only months, no minor ticks (too many weeks)
      majorInterval = 1;
      minorInterval = 1;
      majorType = 'month';
      minorType = 'month';
    } else if (totalMonths >= 1) {
      // 1-9 months: show months and weeks (Sundays)
      majorInterval = 1;
      minorInterval = 1;
      majorType = 'month';
      minorType = 'week';
    } else if (totalDays >= 7) {
      // Weeks and days
      majorInterval = 1;
      minorInterval = 1/7;
      majorType = 'week';
      minorType = 'day';
    } else {
      // Days
      majorInterval = 1;
      minorInterval = 0.5;
      majorType = 'day';
      minorType = 'day';
    }

    // Helper function to add interval to date
    const addInterval = (date: Date, type: 'year' | 'month' | 'week' | 'day' | 'quarter', interval: number): Date => {
      const result = new Date(date);
      if (type === 'year') {
        result.setFullYear(result.getFullYear() + Math.round(interval));
      } else if (type === 'quarter') {
        // Convert quarters to months (1 quarter = 3 months)
        result.setMonth(result.getMonth() + Math.round(3 * interval));
      } else if (type === 'month') {
        // Always add at least 1 month to prevent infinite loops
        result.setMonth(result.getMonth() + Math.max(1, Math.round(interval)));
      } else if (type === 'week') {
        result.setDate(result.getDate() + Math.max(7, Math.round(7 * interval)));
      } else {
        result.setDate(result.getDate() + Math.max(1, Math.round(interval)));
      }
      return result;
    };

    // Helper function to round date to interval boundary
    const roundToInterval = (date: Date, type: 'year' | 'month' | 'week' | 'day' | 'quarter', roundDown: boolean): Date => {
      const result = new Date(date);
      if (type === 'year') {
        result.setMonth(roundDown ? 0 : 11);
        result.setDate(roundDown ? 1 : 31);
      } else if (type === 'quarter') {
        const quarter = Math.floor(result.getMonth() / 3);
        const startMonth = roundDown ? quarter * 3 : Math.min(3 * (quarter + 1) - 1, 11);
        result.setMonth(startMonth);
        result.setDate(roundDown ? 1 : 30);
      } else if (type === 'month') {
        result.setDate(roundDown ? 1 : 31);
      } else if (type === 'week') {
        const dayOfWeek = result.getDay();
        const daysToSubtract = roundDown ? dayOfWeek : 6 - dayOfWeek;
        result.setDate(result.getDate() - daysToSubtract);
      }
      return result;
    };

    // Generate major ticks
    let current = roundToInterval(new Date(start), majorType, true);
    let lastLabel = '';
    const maxTicks = 200; // Reduced safety limit for better performance
    let iterations = 0;
    const maxIterations = 500; // Prevent infinite loops
    while (current <= end && ticks.length < maxTicks && iterations < maxIterations) {
      iterations++;
      const prevTime = current.getTime();
      const msFromStart = current.getTime() - start.getTime();
      const position = (msFromStart / totalMs) * 100;
      
      const label = this.formatTick(current, majorType);
      // Only add tick if label is different from the last one (prevents duplicates)
      if (label !== lastLabel) {
        ticks.push({
          label,
          position,
          type: majorType
        });
        lastLabel = label;
      }

      current = addInterval(current, majorType, majorInterval);
      
      // Safety check: if date didn't advance, break to prevent infinite loop
      if (current.getTime() <= prevTime) {
        console.error('Infinite loop detected in major ticks generation');
        break;
      }
    }

    // Generate minor ticks
    if (minorType !== majorType) {
      current = roundToInterval(new Date(start), minorType, true);
      iterations = 0;
      while (current <= end && ticks.length < maxTicks && iterations < maxIterations) {
        iterations++;
        const prevTime = current.getTime();
        const msFromStart = current.getTime() - start.getTime();
        const position = (msFromStart / totalMs) * 100;
        
        // Check if this position is close to a major tick (within 2%)
        const isNearMajor = ticks.some(t => Math.abs(t.position - position) < 2);
        if (!isNearMajor && position > 0 && position < 100) {
          const label = this.formatTick(current, minorType);
          // Only add tick if label is different from the last one
          if (label !== lastLabel) {
            ticks.push({
              label,
              position,
              type: minorType
            });
            lastLabel = label;
          }
        }

        current = addInterval(current, minorType, minorInterval);
        
        // Safety check: if date didn't advance, break to prevent infinite loop
        if (current.getTime() <= prevTime) {
          console.error('Infinite loop detected in minor ticks generation');
          break;
        }
      }
    }

    return ticks.sort((a, b) => a.position - b.position);
  }

  formatTick(date: Date, type: 'year' | 'month' | 'week' | 'day' | 'quarter'): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    switch (type) {
      case 'year':
        return year.toString();
      case 'quarter':
        const q = Math.floor((date.getMonth()) / 3) + 1;
        // Only show year if it's the first quarter (Q1)
        return month === 1 ? `Q${q} ${year}` : `Q${q}`;
      case 'month':
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        // Only show year if it's January (start of a new year)
        return month === 1 ? `${monthNames[month - 1]} ${year}` : monthNames[month - 1];
      case 'week':
        // Get the Sunday of the week (end of week)
        const sundayDate = new Date(date);
        const dayOfWeek = sundayDate.getDay();
        // Calculate days to add to get to Sunday (0 = Sunday, so add (7 - dayOfWeek) % 7, but we want the end of week Sunday)
        const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
        sundayDate.setDate(sundayDate.getDate() + daysToSunday);
        const sundayDay = sundayDate.getDate();
        // Always show only the day, never the year
        return `${sundayDay}`;
      case 'day':
        return `${month}/${day}`;
    }
  }

  getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }
}
