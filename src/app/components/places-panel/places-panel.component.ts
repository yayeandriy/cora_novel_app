import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlaceCardComponent, PlaceVm } from '../place-card/place-card.component';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

export interface DocRef { id: number; }

@Component({
  selector: 'app-places-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, PlaceCardComponent, DragDropModule],
  templateUrl: './places-panel.component.html',
  styleUrls: ['./places-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlacesPanelComponent {
  @Input() places: PlaceVm[] = [];
  @Input() docPlaceIds: Set<number> | null = null;
  @Input() selectedDoc: DocRef | null = null;
  @Input() expanded: boolean = true;
  @Input() editingPlaceId: number | null = null;

  @Output() expandedChange = new EventEmitter<boolean>();
  @Output() add = new EventEmitter<void>();
  @Output() update = new EventEmitter<{ id: number; name: string; desc: string }>();
  @Output() remove = new EventEmitter<number>();
  @Output() toggle = new EventEmitter<{ placeId: number; checked: boolean }>();
  @Output() createPlace = new EventEmitter<{ name: string; desc: string }>();
  // Emits the ordered list of IDs as they appear in the visible list after a drag-drop reordering
  @Output() reorder = new EventEmitter<number[]>();

  isSelectMode = false;
  newPlace: PlaceVm | null = null;
  // Drag state (used by Angular CDK)
  hoverIndex: number | null = null;

  get visiblePlaces(): PlaceVm[] {
    if (this.isSelectMode) {
      // Show all places in select mode
      return this.places;
    }
    // If docPlaceIds is null (Project tab), show all places
    if (this.docPlaceIds === null) {
      return this.places;
    }
    // Otherwise (Doc or Folder tab), filter by docPlaceIds
    if (this.docPlaceIds.size > 0) {
      return this.places.filter(place => this.docPlaceIds?.has(place.id));
    }
    // Empty set means no places attached (show empty state)
    return [];
  }

  onHeaderClick() {
    this.expandedChange.emit(!this.expanded);
  }

  onAddClick(event: MouseEvent) {
    event.stopPropagation();
    
    // Toggle select mode (works for all tabs)
    this.isSelectMode = !this.isSelectMode;

    // Do not auto-create an edit card; show an explicit Add button in the list instead
    if (!this.isSelectMode) {
      // Clear any in-progress creation when exiting select mode
      this.newPlace = null;
    }
  }

  onNewPlaceSave(data: { id: number; name: string; desc: string }) {
    // Create place with the provided data (or defaults if empty)
    const name = data.name.trim() || 'New Place';
    const desc = data.desc || '';
    this.createPlace.emit({ name, desc });
    
    // Clear the new place card and exit select mode
    this.newPlace = null;
    this.isSelectMode = false;
  }

  onNewPlaceCancel() {
    // Just clear without creating
    this.newPlace = null;
    this.isSelectMode = false;
  }

  onAddPlaceClick(event: MouseEvent) {
    event.stopPropagation();
    // Create a new place card in edit mode when the inline button is clicked
    this.newPlace = {
      id: -1,
      name: '',
      desc: '',
    };
  }

  // ===== Drag & Drop using Angular CDK =====
  onDropCdk(event: CdkDragDrop<PlaceVm[]>) {
    const list = [...this.visiblePlaces];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    console.log('[PlacesPanel] cdk drop', { prev: event.previousIndex, curr: event.currentIndex, order: list.map(p => p.id) });
    // Optimistically reorder local places for snappy UI
    this.places = this.applyOrder(this.places, list.map(p => p.id));
    // Emit new order for parent persistence
    this.reorder.emit(list.map(p => p.id));
  }

  private applyOrder<T extends { id: number }>(items: T[], orderIds: number[]): T[] {
    if (!orderIds || orderIds.length === 0) return [...items];
    const idToItem = new Map(items.map(i => [i.id, i] as const));
    const seen = new Set<number>();
    const inOrder: T[] = [];
    for (const id of orderIds) {
      const item = idToItem.get(id);
      if (item) { inOrder.push(item); seen.add(id); }
    }
    const remainder = items.filter(i => !seen.has(i.id));
    return [...inOrder, ...remainder];
  }
}
