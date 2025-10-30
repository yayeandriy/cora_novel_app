import { Component, ChangeDetectionStrategy, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EventCardComponent, EventVm } from '../event-card/event-card.component';

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
  @Input() selectedDoc: { id: number } | null = null;
  @Input() expanded: boolean = true;
  @Input() editingEventId: number | null = null;

  @Output() expandedChange = new EventEmitter<boolean>();
  @Output() add = new EventEmitter<void>();
  @Output() update = new EventEmitter<{ id: number; name: string; desc: string; start_date: string | null; end_date: string | null }>();
  @Output() remove = new EventEmitter<number>();
  @Output() toggle = new EventEmitter<{ eventId: number; checked: boolean }>();

  onHeaderClick() {
    this.expandedChange.emit(!this.expanded);
  }

  onAddClick(event: MouseEvent) {
    event.stopPropagation();
    this.add.emit();
  }
}
