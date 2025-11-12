import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CharacterCardComponent, CharacterVm } from '../character-card/character-card.component';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

export interface DocRef { id: number; }

@Component({
  selector: 'app-characters-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, CharacterCardComponent, DragDropModule],
  templateUrl: './characters-panel.component.html',
  styleUrls: ['./characters-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CharactersPanelComponent {
  @Input() characters: CharacterVm[] = [];
  @Input() docCharacterIds: Set<number> | null = null;
  @Input() selectedDoc: DocRef | null = null;
  @Input() expanded: boolean = true;
  @Input() editingCharacterId: number | null = null;

  @Output() expandedChange = new EventEmitter<boolean>();
  @Output() add = new EventEmitter<void>();
  @Output() update = new EventEmitter<{ id: number; name: string; desc: string }>();
  @Output() remove = new EventEmitter<number>();
  @Output() toggle = new EventEmitter<{ characterId: number; checked: boolean }>();
  @Output() createCharacter = new EventEmitter<{ name: string; desc: string }>();
  // Emits the ordered list of IDs as they appear in the visible list after a drag-drop reordering
  @Output() reorder = new EventEmitter<number[]>();

  isSelectMode = false;
  isReorderMode = false;
  newCharacter: CharacterVm | null = null;
  // Drag state (used by Angular CDK)
  hoverIndex: number | null = null;

  get visibleCharacters(): CharacterVm[] {
    if (this.isSelectMode) {
      // Show all characters in select mode
      return this.characters;
    }
    // If docCharacterIds is null (Project tab), show all characters
    if (this.docCharacterIds === null) {
      return this.characters;
    }
    // Otherwise (Doc or Folder tab), filter by docCharacterIds
    if (this.docCharacterIds.size > 0) {
      return this.characters.filter(char => this.docCharacterIds?.has(char.id));
    }
    // Empty set means no characters attached (show empty state)
    return [];
  }

  onHeaderClick() {
    this.expandedChange.emit(!this.expanded);
  }

  onAddClick(event: MouseEvent) {
    event.stopPropagation();
    
    // Toggle select mode (works for all tabs)
    this.isSelectMode = !this.isSelectMode;
    // Selecting and reordering are mutually exclusive
    if (this.isSelectMode) {
      this.isReorderMode = false;
    }

    // Do not auto-create an edit card; show an explicit Add button in the list instead
    if (!this.isSelectMode) {
      // Clear any in-progress creation when exiting select mode
      this.newCharacter = null;
    }
  }

  onNewCharacterSave(data: { id: number; name: string; desc: string }) {
    // Create character with the provided data (or defaults if empty)
    const name = data.name.trim() || 'New Character';
    const desc = data.desc || '';
    this.createCharacter.emit({ name, desc });
    
    // Clear the new character card and exit select mode
    this.newCharacter = null;
    this.isSelectMode = false;
  }

  onNewCharacterCancel() {
    // Just clear without creating
    this.newCharacter = null;
    this.isSelectMode = false;
  }

  onAddCharacterClick(event: MouseEvent) {
    event.stopPropagation();
    // Create a new character card in edit mode when the inline button is clicked
    this.newCharacter = {
      id: -1,
      name: '',
      desc: '',
    };
  }

  onReorderToggle(event: MouseEvent) {
    event.stopPropagation();
    this.isReorderMode = !this.isReorderMode;
    console.log('[CharactersPanel] reorder toggle ->', this.isReorderMode);
    if (this.isReorderMode) {
      // Exit select mode and clear any in-progress creation
      this.isSelectMode = false;
      this.newCharacter = null;
    }
  }

  // ===== Drag & Drop using Angular CDK =====
  onDropCdk(event: CdkDragDrop<CharacterVm[]>) {
    if (!this.isReorderMode) return;
    const list = [...this.visibleCharacters];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    console.log('[CharactersPanel] cdk drop', { prev: event.previousIndex, curr: event.currentIndex, order: list.map(c => c.id) });
    // Optimistically reorder local characters for snappy UI
    this.characters = this.applyOrder(this.characters, list.map(c => c.id));
    // Emit new order for parent persistence
    this.reorder.emit(list.map(c => c.id));
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
