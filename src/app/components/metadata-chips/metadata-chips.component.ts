import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef, ElementRef, ViewChild, ViewEncapsulation, HostListener } from '@angular/core';
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
  @Output() dropdownVisibleChange = new EventEmitter<boolean>();

  dropdownVisible = false;
  dropdownPosition = { top: 0, left: 0 };
  editingItemId: number | null = null;
  editingItemName: string = '';
  searchQuery: string = '';

  constructor(private cdr: ChangeDetectorRef) {}

  // Global ESC key listener - intercepts ESC when dropdown is visible
  @HostListener('document:keydown.escape', ['$event'])
  onDocumentEsc(event: Event) {
    if (this.dropdownVisible) {
      event.stopPropagation();
      event.preventDefault();
      
      // If we're editing an item, just cancel editing
      if (this.editingItemId !== null) {
        this.editingItemId = null;
        this.editingItemName = '';
        this.cdr.markForCheck();
        return;
      }
      
      // Otherwise, close the dropdown
      this.closeDropdown();
      this.cdr.markForCheck();
    }
  }

  // Check if an item is currently assigned to the doc
  isItemAssigned(id: number): boolean {
    return this.items.some(item => item.id === id);
  }

  // Get dropdown items - prefer allItems if provided, otherwise use availableItems
  get dropdownItems(): MetadataItem[] {
    const items = this.allItems.length > 0 ? this.allItems : this.availableItems;
    if (!this.searchQuery.trim()) {
      return items;
    }
    const query = this.searchQuery.toLowerCase();
    return items.filter(item => item.name.toLowerCase().includes(query));
  }

  toggleDropdown(event: MouseEvent) {
    event.stopPropagation();
    if (this.dropdownVisible) {
      this.closeDropdown();
    } else {
      const button = event.currentTarget as HTMLElement;
      const rect = button.getBoundingClientRect();
      
      // Dropdown dimensions (approximate - 18rem = 288px)
      const dropdownWidth = 300;
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
      this.dropdownVisibleChange.emit(true);
    }
  }

  closeDropdown() {
    this.dropdownVisible = false;
    this.dropdownVisibleChange.emit(false);
    this.editingItemId = null;
    this.editingItemName = '';
    this.searchQuery = '';
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
    
    // Dropdown dimensions (approximate - 18rem = 288px)
    const dropdownWidth = 300;
    const dropdownHeight = 320;
    
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
    
    // Trigger change detection and focus the input after the view updates
    this.cdr.detectChanges();
    setTimeout(() => {
      const editInput = document.querySelector('.dropdown-edit-input') as HTMLInputElement;
      if (editInput) {
        // Scroll the editing item into view within the dropdown
        const itemWrapper = editInput.closest('.dropdown-item-wrapper');
        if (itemWrapper) {
          itemWrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        editInput.focus();
        editInput.select();
      }
    }, 50);
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
    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }
    
    // If there are filtered results, add the first one instead of creating
    const filtered = this.dropdownItems;
    if (filtered.length > 0 && filtered[0].name.toLowerCase() === trimmedName.toLowerCase()) {
      this.onAdd(filtered[0].id);
      return;
    }
    
    // Otherwise create new item
    this.create.emit(trimmedName);
    this.closeDropdown();
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
