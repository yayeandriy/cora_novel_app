import { Component, ChangeDetectionStrategy, EventEmitter, Input, Output, OnChanges, SimpleChanges, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
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
export class EventCardComponent implements OnChanges, AfterViewInit {
  @Input() event!: EventVm;
  @Input() checked: boolean | null = null;
  @Input() canToggle: boolean = true;
  @Input() editing: boolean = false;
  @Input() mode: 'view' | 'selectable' = 'view';

  @Output() toggle = new EventEmitter<{ id: number; checked: boolean }>();
  @Output() update = new EventEmitter<{ id: number; name: string; desc: string; start_date: string | null; end_date: string | null }>();
  @Output() remove = new EventEmitter<number>();

  @ViewChild('nameInput') nameInput?: ElementRef<HTMLInputElement>;

  isEditing = false;
  localName = '';
  localDesc = '';
  localStartDate: string | null = null;
  localEndDate: string | null = null;
  
  private shouldFocusOnNextRender = false;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['editing'] && this.editing) {
      this.startEdit();
    }
    if (changes['event'] || changes['editing']) {
      if (this.isEditing) {
        this.localName = this.event?.name ?? '';
        this.localDesc = this.event?.desc ?? '';
        this.localStartDate = this.event?.start_date ?? null;
        this.localEndDate = this.event?.end_date ?? null;
      }
    }
  }

  ngAfterViewInit() {
    if (this.shouldFocusOnNextRender && this.nameInput) {
      this.nameInput.nativeElement.focus();
      this.nameInput.nativeElement.select();
      this.shouldFocusOnNextRender = false;
    }
  }

  onToggleChange(ev: Event) {
    const input = ev.target as HTMLInputElement;
    this.toggle.emit({ id: this.event.id, checked: !!input?.checked });
  }

  onSelectToggle() {
    // In selectable mode, clicking toggles the selection
    const newChecked = !this.checked;
    this.toggle.emit({ id: this.event.id, checked: newChecked });
  }

  startEdit() {
    this.isEditing = true;
    this.localName = this.event?.name ?? '';
    this.localDesc = this.event?.desc ?? '';
    this.localStartDate = this.event?.start_date ?? null;
    this.localEndDate = this.event?.end_date ?? null;
    this.shouldFocusOnNextRender = true;
    // Focus will happen after the view updates
    setTimeout(() => {
      const nameInput = document.querySelector('.name-input') as HTMLInputElement;
      if (nameInput) {
        nameInput.focus();
        nameInput.select();
      }
    }, 0);
  }

  cancelEdit() {
    this.isEditing = false;
  }

  saveEdit() {
    const name = this.localName?.trim() || 'New Event';
    const desc = this.localDesc ?? '';
    const payload = {
      id: this.event.id,
      name,
      desc,
      start_date: this.localStartDate ?? null,
      end_date: this.localEndDate ?? null,
    };
    this.update.emit(payload);
    this.isEditing = false;
  }

  onDelete() {
    this.remove.emit(this.event.id);
  }
}
