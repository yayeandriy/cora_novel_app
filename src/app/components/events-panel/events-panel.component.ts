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
    if (this.isSelectMode || !this.selectedDoc) {
      // Show all events in select mode or when no doc is selected
      return this.events;
    }
    // Show only checked events in normal mode when a doc is selected
    return this.events.filter(event => this.docEventIds?.has(event.id));
  }

  onHeaderClick() {
    this.expandedChange.emit(!this.expanded);
  }

  onAddClick(event: MouseEvent) {
    event.stopPropagation();
    
    if (this.selectedDoc) {
      // Toggle select mode when doc is selected
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
    } else {
      // Create new event when no doc is selected (Project tab)
      this.add.emit();
    }
  }

  onNewEventSave(data: { id: number; name: string; desc: string; start_date: string | null; end_date: string | null }) {
    // Only proceed if name is provided
    if (data.name.trim()) {
      // Emit create event with the provided data
      this.createEvent.emit({ name: data.name, desc: data.desc, start_date: data.start_date, end_date: data.end_date });
    }
    // Clear the new event card
    this.newEvent = null;
    // Exit select mode
    this.isSelectMode = false;
  }

  onNewEventCancel() {
    // Just clear the new event card without saving
    this.newEvent = null;
  }

  onTimelineToggleClick(event: MouseEvent) {
    event.stopPropagation();
    this.timelineHeaderToggle.emit();
  }
}
