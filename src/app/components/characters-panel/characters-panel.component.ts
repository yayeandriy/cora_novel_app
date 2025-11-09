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
    if (this.isSelectMode || !this.selectedDoc) {
      // Show all characters in select mode or when no doc is selected
      return this.characters;
    }
    // Show only checked characters in normal mode when a doc is selected
    return this.characters.filter(char => this.docCharacterIds?.has(char.id));
  }

  onHeaderClick() {
    this.expandedChange.emit(!this.expanded);
  }

  onAddClick(event: MouseEvent) {
    event.stopPropagation();
    
    if (this.selectedDoc) {
      // Toggle select mode when doc is selected
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
    } else {
      // Create new character when no doc is selected (Project tab)
      this.add.emit();
    }
  }

  onNewCharacterSave(data: { id: number; name: string; desc: string }) {
    // Only proceed if name is provided
    if (data.name.trim()) {
      // Emit create event with the character data
      this.createCharacter.emit({ name: data.name, desc: data.desc });
    }
    // Clear the new character card
    this.newCharacter = null;
    // Exit select mode
    this.isSelectMode = false;
  }

  onNewCharacterCancel() {
    // Just clear the new character card without saving
    this.newCharacter = null;
  }
}
