import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface Draft {
  id: number;
  name: string;
  content?: string;
  updated_at?: string;
}

@Component({
  selector: 'app-drafts-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './drafts-panel.component.html',
  styleUrls: ['./drafts-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DraftsPanelComponent {
  @Input() drafts: Draft[] = [];
  @Input() draftSyncStatus: Record<number, 'syncing' | 'synced' | 'pending'> = {};
  @Input() expanded: boolean = true;
  
  @Output() expandedChange = new EventEmitter<boolean>();
  @Output() draftCreated = new EventEmitter<void>();
  @Output() draftChanged = new EventEmitter<{ draftId: number; content: string; cursorPosition: number }>();
  @Output() draftBlurred = new EventEmitter<number>();
  @Output() draftDeleted = new EventEmitter<number>();
  @Output() draftContentRequested = new EventEmitter<number>();

  toggleExpanded() {
    this.expandedChange.emit(!this.expanded);
  }

  createDraft() {
    this.draftCreated.emit();
  }

  getDraftContent(draftId: number): string {
    this.draftContentRequested.emit(draftId);
    return '';
  }

  onDraftChange(draftId: number, event: any) {
    const content = event.target.value;
    const cursorPosition = event.target.selectionStart;
    this.draftChanged.emit({ draftId, content, cursorPosition });
  }

  onDraftBlur(draftId: number) {
    this.draftBlurred.emit(draftId);
  }

  deleteDraft(draftId: number, event: MouseEvent) {
    event.stopPropagation();
    this.draftDeleted.emit(draftId);
  }

  trackByDraftId(index: number, draft: Draft) {
    return draft.id;
  }
}
