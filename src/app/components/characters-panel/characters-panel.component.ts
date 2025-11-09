import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CharacterCardComponent, CharacterVm } from '../character-card/character-card.component';

export interface DocRef { id: number; }

@Component({
  selector: 'app-characters-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, CharacterCardComponent],
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

  isSelectMode = false;
  newCharacter: CharacterVm | null = null;

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
    
    if (this.isSelectMode) {
      // Create a new character card in edit mode
      this.newCharacter = {
        id: -1, // Temporary ID for new character
        name: '',
        desc: '',
      };
    } else {
      // Clear the new character when exiting select mode
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
}
