import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ViewChild, ElementRef, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

export interface FolderDraft {
  id: number;
  name: string;
  content?: string;
  updated_at?: string;
  sort_order?: number;
}

@Component({
  selector: 'app-folder-drafts',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
  templateUrl: './folder-drafts.component.html',
  styleUrls: ['./folder-drafts.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FolderDraftsComponent implements OnChanges, OnDestroy {
  @ViewChild('scrollContainer') scrollContainer?: ElementRef<HTMLDivElement>;

  @Input() drafts: FolderDraft[] = [];
  @Input() layout: 'horizontal' | 'grid' = 'horizontal';

  @Output() draftCreate = new EventEmitter<void>();
  @Output() draftChange = new EventEmitter<{ draftId: number; content: string; cursorPosition: number }>();
  @Output() draftNameChange = new EventEmitter<{ draftId: number; name: string }>();
  @Output() draftDelete = new EventEmitter<number>();
  @Output() draftMove = new EventEmitter<{ draftId: number; newIndex: number }>();

  private previousDraftsLength = 0;
  private nameChangeSubject = new Subject<{ draftId: number; name: string }>();
  private nameChangeSubscription = this.nameChangeSubject.pipe(
    debounceTime(500),
    distinctUntilChanged((prev, curr) => prev.draftId === curr.draftId && prev.name === curr.name)
  ).subscribe(change => this.draftNameChange.emit(change));

  drop(event: CdkDragDrop<FolderDraft[]>) {
    if (event.previousIndex === event.currentIndex) return;
    
    const draft = this.drafts[event.previousIndex];
    
    // Optimistic update
    moveItemInArray(this.drafts, event.previousIndex, event.currentIndex);
    
    this.draftMove.emit({ draftId: draft.id, newIndex: event.currentIndex });
  }

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

  onNameInput(draftId: number, event: Event) {
    const input = event.target as HTMLInputElement;
    this.nameChangeSubject.next({ draftId, name: input.value });
  }

  onNameEnter(event: Event) {
    const input = event.target as HTMLInputElement;
    input.blur();
  }

  trackByDraftId(index: number, draft: FolderDraft) {
    return draft.id;
  }

  ngOnDestroy() {
    this.nameChangeSubscription.unsubscribe();
  }
}
