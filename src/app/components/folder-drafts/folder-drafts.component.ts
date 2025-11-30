import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ViewChild, ElementRef, OnChanges, SimpleChanges } from '@angular/core';
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
export class FolderDraftsComponent implements OnChanges {
  @ViewChild('scrollContainer') scrollContainer?: ElementRef<HTMLDivElement>;

  @Input() drafts: FolderDraft[] = [];

  @Output() draftCreate = new EventEmitter<void>();
  @Output() draftChange = new EventEmitter<{ draftId: number; content: string; cursorPosition: number }>();
  @Output() draftDelete = new EventEmitter<number>();

  private previousDraftsLength = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['drafts']) {
      if (this.drafts.length > this.previousDraftsLength) {
        // New draft added - scroll to the end and focus the new textarea
        setTimeout(() => {
          const el = this.scrollContainer?.nativeElement;
          if (el) {
            el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
            // Focus the last textarea (newest draft)
            const textareas = el.querySelectorAll<HTMLTextAreaElement>('.folder-draft-textarea');
            if (textareas.length > 0) {
              textareas[textareas.length - 1].focus();
            }
          }
        }, 50);
      }
    }
    this.previousDraftsLength = this.drafts.length;
  }

  createDraft(event: MouseEvent) {
    event.stopPropagation();
    this.draftCreate.emit();
  }

  onDraftChange(draftId: number, content: string, cursorPosition: number) {
    this.draftChange.emit({ draftId, content, cursorPosition });
  }

  onDeleteDraft(draftId: number, event: MouseEvent) {
    event.stopPropagation();
    this.draftDelete.emit(draftId);
  }

  trackByDraftId(index: number, draft: FolderDraft) {
    return draft.id;
  }
}
