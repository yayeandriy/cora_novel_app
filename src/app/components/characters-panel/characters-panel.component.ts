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

  onHeaderClick() {
    this.expandedChange.emit(!this.expanded);
  }

  onAddClick(event: MouseEvent) {
    event.stopPropagation();
    this.add.emit();
  }
}
