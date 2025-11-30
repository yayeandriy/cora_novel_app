import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy, OnChanges, SimpleChanges, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface PlaceVm {
  id: number;
  name: string;
  desc: string;
}

@Component({
  selector: 'app-place-card',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './place-card.component.html',
  styleUrls: ['./place-card.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlaceCardComponent implements OnChanges, AfterViewInit {
  @Input() place!: PlaceVm;
  @Input() checked: boolean | null = null;
  @Input() canToggle: boolean = true;
  @Input() editing: boolean = false;
  @Input() mode: 'view' | 'selectable' = 'view';
  @Input() disableInteractions: boolean = false;

  @Output() toggle = new EventEmitter<{ id: number; checked: boolean }>();
  @Output() update = new EventEmitter<{ id: number; name: string; desc: string }>();
  @Output() remove = new EventEmitter<number>();

  @ViewChild('nameInput') nameInput?: ElementRef<HTMLInputElement>;

  isEditing = false;
  localName = '';
  localDesc = '';
  private shouldFocusOnNextRender = false;
  private singleClickTimer: any = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['editing']) {
      this.isEditing = !!this.editing;
      if (this.isEditing) {
        // Initialize locals on entering edit mode
        this.localName = this.place?.name ?? '';
        this.localDesc = this.place?.desc ?? '';
        this.shouldFocusOnNextRender = true;
      }
    }
  }

  ngAfterViewInit(): void {
    if (this.shouldFocusOnNextRender && this.nameInput) {
      setTimeout(() => this.nameInput?.nativeElement.focus(), 0);
      this.shouldFocusOnNextRender = false;
    }
  }

  startEdit() {
    if (this.disableInteractions) return;
    // Cancel any pending single-click toggle
    if (this.singleClickTimer) {
      clearTimeout(this.singleClickTimer);
      this.singleClickTimer = null;
    }
    this.isEditing = true;
    this.localName = this.place?.name ?? '';
    this.localDesc = this.place?.desc ?? '';
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
    if (this.disableInteractions) return;
    this.isEditing = false;
  }

  saveEdit() {
    if (this.disableInteractions) return;
    const name = this.localName?.trim() || 'New Place';
    const desc = this.localDesc ?? '';
    this.update.emit({ id: this.place.id, name, desc });
    this.isEditing = false;
  }

  onToggleChange(ev: Event) {
    if (this.disableInteractions) return;
    const input = ev.target as HTMLInputElement;
    this.toggle.emit({ id: this.place.id, checked: !!input?.checked });
  }

  onSelectToggle(ev: MouseEvent) {
    if (this.disableInteractions) return;
    // Defer toggle slightly so a possible double-click can cancel it
    if (this.singleClickTimer) {
      clearTimeout(this.singleClickTimer);
    }
    this.singleClickTimer = setTimeout(() => {
      this.toggle.emit({ id: this.place.id, checked: !(this.checked ?? false) });
      this.singleClickTimer = null;
    }, 180);
  }

  onDelete() {
    if (this.disableInteractions) return;
    this.remove.emit(this.place.id);
  }
}
