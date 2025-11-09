import { Component, ChangeDetectionStrategy, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EventCardComponent, EventVm } from '../event-card/event-card.component';

export interface DocRef { id: number; }

@Component({
  selector: 'app-events-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, EventCardComponent],
  templateUrl: './events-panel.component.html',
  styleUrls: ['./events-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventsPanelComponent {
  @Input() events: EventVm[] = [];
  @Input() docEventIds: Set<number> | null = null;
  @Input() selectedDoc: DocRef | null = null;
  @Input() expanded: boolean = true;
  @Input() editingEventId: number | null = null;
  @Input() timelineHeaderVisible: boolean = false;

  @Output() expandedChange = new EventEmitter<boolean>();
  @Output() add = new EventEmitter<void>();
  @Output() createEvent = new EventEmitter<{ name: string; desc: string; start_date: string | null; end_date: string | null }>();
  @Output() update = new EventEmitter<{ id: number; name: string; desc: string; start_date: string | null; end_date: string | null }>();
  @Output() remove = new EventEmitter<number>();
  @Output() toggle = new EventEmitter<{ eventId: number; checked: boolean }>();
  @Output() timelineHeaderToggle = new EventEmitter<void>();

  isSelectMode = false;
  newEvent: EventVm | null = null;

  get visibleEvents(): EventVm[] {
    if (this.isSelectMode) {
      // Show all events in select mode
      return this.events;
    }
    // If docEventIds is null (Project tab), show all events
    if (this.docEventIds === null) {
      return this.events;
    }
    // Otherwise (Doc or Folder tab), filter by docEventIds
    if (this.docEventIds.size > 0) {
      return this.events.filter(event => this.docEventIds?.has(event.id));
    }
    // Empty set means no events attached (show empty state)
    return [];
  }

  onHeaderClick() {
    this.expandedChange.emit(!this.expanded);
  }

  onAddClick(event: MouseEvent) {
    event.stopPropagation();
    
    // Toggle select mode (works for all tabs)
    this.isSelectMode = !this.isSelectMode;
    
    if (this.isSelectMode) {
      // Create a new event card in edit mode
      this.newEvent = {
        id: -1, // Temporary ID for new event
        name: '',
        desc: '',
        start_date: null,
        end_date: null,
      };
    } else {
      // Clear the new event when exiting select mode
      this.newEvent = null;
    }
  }

  onNewEventSave(data: { id: number; name: string; desc: string; start_date: string | null; end_date: string | null }) {
    // Create event with the provided data (or defaults if empty)
    const name = data.name.trim() || 'New Event';
    const desc = data.desc || '';
    this.createEvent.emit({ name, desc, start_date: data.start_date, end_date: data.end_date });
    
    // Clear the new event card and exit select mode
    this.newEvent = null;
    this.isSelectMode = false;
  }

  onNewEventCancel() {
    // Just clear without creating
    this.newEvent = null;
    this.isSelectMode = false;
  }

  onTimelineToggleClick(event: MouseEvent) {
    event.stopPropagation();
    this.timelineHeaderToggle.emit();
  }
}
