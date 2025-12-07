import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

export interface MetadataItem {
  id: number;
  name: string;
}

export type MetadataType = 'character' | 'event' | 'place';

@Component({
  selector: 'app-metadata-chips',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
  templateUrl: './metadata-chips.component.html',
  styleUrls: ['./metadata-chips.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MetadataChipsComponent {
  @Input() items: MetadataItem[] = [];
  @Input() availableItems: MetadataItem[] = [];
  @Input() type: MetadataType = 'character';
  @Input() placeholder: string = 'New item...';
  
  @Output() add = new EventEmitter<number>();
  @Output() remove = new EventEmitter<number>();
  @Output() create = new EventEmitter<string>();
  @Output() reorder = new EventEmitter<number[]>();

  dropdownVisible = false;
  dropdownPosition = { top: 0, left: 0 };

  toggleDropdown(event: MouseEvent) {
    event.stopPropagation();
    if (this.dropdownVisible) {
      this.closeDropdown();
    } else {
      const button = event.currentTarget as HTMLElement;
      const rect = button.getBoundingClientRect();
      this.dropdownPosition = {
        top: rect.bottom + 4,
        left: rect.left
      };
      this.dropdownVisible = true;
    }
  }

  closeDropdown() {
    this.dropdownVisible = false;
  }

  onDrop(event: CdkDragDrop<MetadataItem[]>) {
    // Create a copy to avoid mutating the input directly before emitting
    const newItems = [...this.items];
    moveItemInArray(newItems, event.previousIndex, event.currentIndex);
    const newOrderIds = newItems.map(i => i.id);
    this.reorder.emit(newOrderIds);
  }

  onAdd(id: number) {
    this.add.emit(id);
    this.closeDropdown();
  }

  onCreate(name: string) {
    if (name.trim()) {
      this.create.emit(name.trim());
      this.closeDropdown();
    }
  }

  onRemove(id: number, event: MouseEvent) {
    event.stopPropagation();
    this.remove.emit(id);
  }

  getChipClass(): string {
    return `${this.type}-chip`;
  }

  getAddBtnClass(): string {
    return `${this.type}-add`;
  }
}
