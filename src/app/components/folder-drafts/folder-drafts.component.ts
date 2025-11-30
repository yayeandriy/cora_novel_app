import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface FolderDraft {
  id: number;
  name: string;
  content?: string;
  updated_at?: string;
}

@Component({
  selector: 'app-folder-drafts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './folder-drafts.component.html',
  styleUrls: ['./folder-drafts.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FolderDraftsComponent {
  @Input() drafts: FolderDraft[] = [];
  @Input() focusedDraftId: number | null = null;

  @Output() draftCreate = new EventEmitter<void>();
  @Output() draftChange = new EventEmitter<{ draftId: number; content: string; cursorPosition: number }>();
  @Output() draftFocus = new EventEmitter<number>();
  @Output() draftBlur = new EventEmitter<number>();
  @Output() draftDelete = new EventEmitter<MouseEvent>();

  createDraft(event: MouseEvent) {
    event.stopPropagation();
    this.draftCreate.emit();
  }

  onDraftChange(draftId: number, content: string, cursorPosition: number) {
    this.draftChange.emit({ draftId, content, cursorPosition });
  }

  onDraftFocus(draftId: number) {
    this.draftFocus.emit(draftId);
  }

  onDraftBlur(draftId: number) {
    this.draftBlur.emit(draftId);
  }

  onDeleteClick(event: MouseEvent) {
    this.draftDelete.emit(event);
  }

  trackByDraftId(index: number, draft: FolderDraft) {
    return draft.id;
  }
}
