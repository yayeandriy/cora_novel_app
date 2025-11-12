import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy, OnChanges, SimpleChanges, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface CharacterVm {
  id: number;
  name: string;
  desc: string;
}

@Component({
  selector: 'app-character-card',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './character-card.component.html',
  styleUrls: ['./character-card.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CharacterCardComponent implements OnChanges, AfterViewInit {
  @Input() character!: CharacterVm;
  @Input() checked: boolean | null = null;
  @Input() canToggle: boolean = true;
  @Input() editing: boolean = false;
  @Input() mode: 'view' | 'selectable' = 'view';

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
        this.localName = this.character?.name ?? '';
        this.localDesc = this.character?.desc ?? '';
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
    // Cancel any pending single-click toggle
    if (this.singleClickTimer) {
      clearTimeout(this.singleClickTimer);
      this.singleClickTimer = null;
    }
    this.isEditing = true;
    this.localName = this.character?.name ?? '';
    this.localDesc = this.character?.desc ?? '';
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
    const name = this.localName?.trim() || 'New Character';
    const desc = this.localDesc ?? '';
    this.update.emit({ id: this.character.id, name, desc });
    this.isEditing = false;
  }

  onToggleChange(ev: Event) {
    const input = ev.target as HTMLInputElement;
    this.toggle.emit({ id: this.character.id, checked: !!input?.checked });
  }

  onSelectToggle(ev: MouseEvent) {
    // Defer toggle slightly so a possible double-click can cancel it
    if (this.singleClickTimer) {
      clearTimeout(this.singleClickTimer);
      this.singleClickTimer = null;
    }
    this.singleClickTimer = setTimeout(() => {
      const newChecked = !this.checked;
      this.toggle.emit({ id: this.character.id, checked: newChecked });
      this.singleClickTimer = null;
    }, 200);
  }

  onDelete() {
    this.remove.emit(this.character.id);
  }
}
