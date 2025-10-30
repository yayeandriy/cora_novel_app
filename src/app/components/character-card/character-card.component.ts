import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy, OnChanges, SimpleChanges } from '@angular/core';
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
export class CharacterCardComponent implements OnChanges {
  @Input() character!: CharacterVm;
  @Input() checked: boolean | null = null;
  @Input() canToggle: boolean = true;
  @Input() editing: boolean = false;

  @Output() toggle = new EventEmitter<{ id: number; checked: boolean }>();
  @Output() update = new EventEmitter<{ id: number; name: string; desc: string }>();
  @Output() remove = new EventEmitter<number>();

  isEditing = false;
  localName = '';
  localDesc = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['editing']) {
      this.isEditing = !!this.editing;
      if (this.isEditing) {
        // Initialize locals on entering edit mode
        this.localName = this.character?.name ?? '';
        this.localDesc = this.character?.desc ?? '';
      }
    }
  }

  startEdit() {
    this.isEditing = true;
    this.localName = this.character?.name ?? '';
    this.localDesc = this.character?.desc ?? '';
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

  onDelete() {
    this.remove.emit(this.character.id);
  }
}
