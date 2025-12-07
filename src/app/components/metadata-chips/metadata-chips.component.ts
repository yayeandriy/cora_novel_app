import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ElementRef, ViewChild, ViewEncapsulation } from '@angular/core';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None
})
export class MetadataChipsComponent {
  @Input() items: MetadataItem[] = [];
  @Input() availableItems: MetadataItem[] = [];
  @Input() allItems: MetadataItem[] = []; // All items in the system
  @Input() type: MetadataType = 'character';
  @Input() placeholder: string = 'New item...';
  
  @Output() add = new EventEmitter<number>();
  @Output() remove = new EventEmitter<number>();
  @Output() deleteItem = new EventEmitter<number>();
  @Output() editItem = new EventEmitter<{ id: number; name: string }>();
  @Output() create = new EventEmitter<string>();
  @Output() reorder = new EventEmitter<number[]>();

  dropdownVisible = false;
  dropdownPosition = { top: 0, left: 0 };
  editingItemId: number | null = null;
  editingItemName: string = '';

  // Check if an item is currently assigned to the doc
  isItemAssigned(id: number): boolean {
    return this.items.some(item => item.id === id);
  }

  // Get dropdown items - prefer allItems if provided, otherwise use availableItems
  get dropdownItems(): MetadataItem[] {
    return this.allItems.length > 0 ? this.allItems : this.availableItems;
  }

  toggleDropdown(event: MouseEvent) {
    event.stopPropagation();
    if (this.dropdownVisible) {
      this.closeDropdown();
    } else {
      const button = event.currentTarget as HTMLElement;
      const rect = button.getBoundingClientRect();
      
      // Dropdown dimensions (approximate)
      const dropdownWidth = 200;
      const dropdownHeight = 240;
      
      // Calculate position with viewport boundary checking
      let left = rect.left;
      let top = rect.bottom + 4;
      
      // Check right edge
      if (left + dropdownWidth > window.innerWidth) {
        left = window.innerWidth - dropdownWidth - 8;
      }
      
      // Check left edge
      if (left < 8) {
        left = 8;
      }
      
      // Check bottom edge - if dropdown would go below viewport, show it above the button
      if (top + dropdownHeight > window.innerHeight) {
        top = rect.top - dropdownHeight - 4;
      }
      
      // Ensure it doesn't go above the viewport
      if (top < 8) {
        top = 8;
      }
      
      this.dropdownPosition = { top, left };
      this.dropdownVisible = true;
    }
  }

  closeDropdown() {
    this.dropdownVisible = false;
    this.editingItemId = null;
    this.editingItemName = '';
  }

  startEdit(item: MetadataItem, event: MouseEvent) {
    event.stopPropagation();
    this.editingItemId = item.id;
    this.editingItemName = item.name;
  }

  // Called when clicking edit button on the chip itself
  onEditItem(item: MetadataItem, event: MouseEvent) {
    event.stopPropagation();
    // Open dropdown and start editing the item
    const button = event.currentTarget as HTMLElement;
    const rect = button.getBoundingClientRect();
    
    // Dropdown dimensions (approximate)
    const dropdownWidth = 200;
    const dropdownHeight = 240;
    
    // Calculate position with viewport boundary checking
    let left = rect.left;
    let top = rect.bottom + 4;
    
    // Check right edge
    if (left + dropdownWidth > window.innerWidth) {
      left = window.innerWidth - dropdownWidth - 8;
    }
    
    // Check left edge
    if (left < 8) {
      left = 8;
    }
    
    // Check bottom edge - if dropdown would go below viewport, show it above the button
    if (top + dropdownHeight > window.innerHeight) {
      top = rect.top - dropdownHeight - 4;
    }
    
    // Ensure it doesn't go above the viewport
    if (top < 8) {
      top = 8;
    }
    
    this.dropdownPosition = { top, left };
    this.dropdownVisible = true;
    this.editingItemId = item.id;
    this.editingItemName = item.name;
  }

  saveEdit(event?: Event) {
    if (event) event.stopPropagation();
    if (this.editingItemId !== null && this.editingItemName.trim()) {
      this.editItem.emit({ id: this.editingItemId, name: this.editingItemName.trim() });
    }
    this.editingItemId = null;
    this.editingItemName = '';
  }

  cancelEdit(event?: Event) {
    if (event) event.stopPropagation();
    this.editingItemId = null;
    this.editingItemName = '';
  }

  onDrop(event: CdkDragDrop<MetadataItem[]>) {
    // Create a copy to avoid mutating the input directly before emitting
    const newItems = [...this.items];
    moveItemInArray(newItems, event.previousIndex, event.currentIndex);
    const newOrderIds = newItems.map(i => i.id);
    this.reorder.emit(newOrderIds);
  }

  onAdd(id: number) {
    if (this.isItemAssigned(id)) {
      // Already assigned - remove it
      this.remove.emit(id);
    } else {
      // Not assigned - add it
      this.add.emit(id);
    }
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

  onDeleteItem(id: number, event: MouseEvent) {
    event.stopPropagation();
    console.log('[MetadataChips] onDeleteItem called with id:', id);
    // Confirm deletion could be handled here or by the parent. 
    // For now, just emit.
    this.deleteItem.emit(id);
  }

  getChipClass(): string {
    return `${this.type}-chip`;
  }

  getAddBtnClass(): string {
    return `${this.type}-add`;
  }
}
