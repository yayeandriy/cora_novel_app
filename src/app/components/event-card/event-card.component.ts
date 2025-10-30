import { Component, ChangeDetectionStrategy, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface EventVm {
  id: number;
  name: string;
  desc: string;
  start_date?: string | null;
  end_date?: string | null;
}

@Component({
  selector: 'app-event-card',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './event-card.component.html',
  styleUrls: ['./event-card.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventCardComponent {
  @Input() event!: EventVm;
  @Input() checked: boolean | null = null;
  @Input() canToggle: boolean = true;
  @Input() editing: boolean = false;

  @Output() toggle = new EventEmitter<{ id: number; checked: boolean }>();
  @Output() update = new EventEmitter<{ id: number; name: string; desc: string; start_date: string | null; end_date: string | null }>();
  @Output() remove = new EventEmitter<number>();

  isEditing = false;
  name = '';
  desc = '';
  start_date: string | null = null;
  end_date: string | null = null;

  ngOnChanges() {
    this.isEditing = !!this.editing;
    if (this.isEditing) {
      this.name = this.event?.name ?? '';
      this.desc = this.event?.desc ?? '';
      this.start_date = this.event?.start_date ?? null;
      this.end_date = this.event?.end_date ?? null;
    }
  }

  onToggleChange(ev: Event) {
    const input = ev.target as HTMLInputElement;
    this.toggle.emit({ id: this.event.id, checked: !!input?.checked });
  }

  startEdit() { this.isEditing = true; this.ngOnChanges(); }
  cancelEdit() { this.isEditing = false; }

  saveEdit() {
    const payload = {
      id: this.event.id,
      name: (this.name || 'New Event').trim(),
      desc: this.desc ?? '',
      start_date: this.start_date ?? null,
      end_date: this.end_date ?? null,
    };
    this.update.emit(payload);
    this.isEditing = false;
  }

  onDelete() { this.remove.emit(this.event.id); }
}
