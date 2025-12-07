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
  @Input() selectedDraftId: number | null = null;

  @Output() draftCreate = new EventEmitter<void>();
  @Output() draftChange = new EventEmitter<{ draftId: number; content: string; cursorPosition: number }>();
  @Output() draftNameChange = new EventEmitter<{ draftId: number; name: string }>();
  @Output() draftDelete = new EventEmitter<number>();
  @Output() draftMove = new EventEmitter<{ draftId: number; newIndex: number }>();
  @Output() draftSelect = new EventEmitter<number>();

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
      const prevDrafts: FolderDraft[] = changes['drafts'].previousValue ?? [];
      const prevLength = prevDrafts.length;
      const currLength = this.drafts.length;
      console.log('[DEBUG] folder-drafts ngOnChanges - prevLength:', prevLength, 'currLength:', currLength);
      // Only auto-focus when exactly 1 new draft was added (user created a draft),
      // not when loading multiple drafts from backend
      if (currLength === prevLength + 1 && prevLength > 0) {
        // Find the new draft by comparing IDs
        const prevIds = new Set(prevDrafts.map(d => d.id));
        const newDraft = this.drafts.find(d => !prevIds.has(d.id));
        const newDraftIndex = newDraft ? this.drafts.findIndex(d => d.id === newDraft.id) : -1;
        console.log('[DEBUG] folder-drafts ngOnChanges - new draft:', newDraft?.id, 'at index:', newDraftIndex);
        
        if (newDraftIndex !== -1) {
          // New draft added - scroll to the new draft and focus its textarea
          setTimeout(() => {
            const el = this.scrollContainer?.nativeElement;
            if (el) {
              const textareas = el.querySelectorAll<HTMLTextAreaElement>('.folder-draft-textarea');
              console.log('[DEBUG] folder-drafts ngOnChanges - found', textareas.length, 'textareas, focusing index', newDraftIndex);
              if (textareas.length > newDraftIndex) {
                const targetTextarea = textareas[newDraftIndex];
                // Scroll the new draft into view
                targetTextarea.scrollIntoView({ behavior: 'smooth', inline: 'center' });
                targetTextarea.focus();
              }
            }
          }, 50);
        }
      }
    }
    if (changes['selectedDraftId']) {
      console.log('[DEBUG] folder-drafts ngOnChanges - selectedDraftId changed to:', this.selectedDraftId);
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

  onDraftFocus(draftId: number) {
    this.draftSelect.emit(draftId);
  }

  // Handle wheel scroll - enable horizontal scroll with vertical wheel
  onContainerWheel(event: WheelEvent) {
    // Only apply horizontal scroll in horizontal layout
    if (this.layout !== 'horizontal') return;
    
    const container = event.currentTarget as HTMLElement;
    if (!container) return;
    
    // Use deltaY for horizontal scroll (works with and without Shift)
    if (event.deltaY !== 0) {
      event.preventDefault();
      container.scrollLeft += event.deltaY;
    }
  }

  trackByDraftId(index: number, draft: FolderDraft) {
    return draft.id;
  }

  ngOnDestroy() {
    this.nameChangeSubscription.unsubscribe();
  }
}
