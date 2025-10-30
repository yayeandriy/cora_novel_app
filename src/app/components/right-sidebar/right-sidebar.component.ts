import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DraftsPanelComponent } from '../drafts-panel/drafts-panel.component';

export interface Character {
  id: number;
  name: string;
  desc: string;
}

export interface Event {
  id: number;
  name: string;
  desc: string;
  startDate?: string;
  endDate?: string;
}

export interface Draft {
  id: number;
  name: string;
  content?: string;
  updated_at?: string;
}

export interface Doc {
  id: number;
  name?: string | null;
  project_id: number;
  doc_group_id?: number | null;
  sort_order?: number | null;
  text?: string | null;
  notes?: string | null;
  path?: string;
  timeline_id?: number | null;
}

@Component({
  selector: 'app-right-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, DraftsPanelComponent],
  templateUrl: './right-sidebar.component.html',
  styleUrls: ['./right-sidebar.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RightSidebarComponent {
  @Input() selectedDoc: Doc | null = null;
  @Input() characters: Character[] = [];
  @Input() events: Event[] = [];
  @Input() drafts: Draft[] = [];
  @Input() draftSyncStatus: Record<number, 'syncing' | 'synced' | 'pending'> = {};
  
  @Input() charactersExpanded: boolean = true;
  @Input() eventsExpanded: boolean = true;
  @Input() notesExpanded: boolean = true;
  @Input() draftsExpanded: boolean = true;
  
  @Output() charactersExpandedChange = new EventEmitter<boolean>();
  @Output() eventsExpandedChange = new EventEmitter<boolean>();
  @Output() notesExpandedChange = new EventEmitter<boolean>();
  @Output() draftsExpandedChange = new EventEmitter<boolean>();
  
  @Output() notesChanged = new EventEmitter<void>();
  @Output() draftCreated = new EventEmitter<void>();
  @Output() draftChanged = new EventEmitter<{ draftId: number; content: string; cursorPosition: number }>();
  @Output() draftBlurred = new EventEmitter<number>();
  @Output() draftDeleted = new EventEmitter<number>();
  @Output() draftContentRequested = new EventEmitter<number>();
  @Output() widthChanged = new EventEmitter<number>();
  
  rightWidth = 300; // internal tracker for live drag; host width comes from parent binding
  isResizing = false;

  onCharactersToggle() {
    this.charactersExpandedChange.emit(!this.charactersExpanded);
  }

  onEventsToggle() {
    this.eventsExpandedChange.emit(!this.eventsExpanded);
  }

  onNotesToggle() {
    this.notesExpandedChange.emit(!this.notesExpanded);
  }

  onNotesChange() {
    this.notesChanged.emit();
  }

  onDraftsToggle(expanded: boolean) {
    this.draftsExpandedChange.emit(expanded);
  }

  onDraftCreated() {
    this.draftCreated.emit();
  }

  onDraftChanged(event: { draftId: number; content: string; cursorPosition: number }) {
    this.draftChanged.emit(event);
  }

  onDraftBlurred(draftId: number) {
    this.draftBlurred.emit(draftId);
  }

  onDraftDeleted(draftId: number) {
    this.draftDeleted.emit(draftId);
  }

  onDraftContentRequested(draftId: number) {
    this.draftContentRequested.emit(draftId);
  }

  startResize(event: MouseEvent) {
    this.isResizing = true;
    event.preventDefault();
    
    const onMouseMove = (e: MouseEvent) => {
      if (this.isResizing) {
        // Width from cursor to right edge of window; allow it to grow freely, enforce a sensible min
        this.rightWidth = Math.max(250, window.innerWidth - e.clientX);
        this.widthChanged.emit(this.rightWidth);
      }
    };
    
    const onMouseUp = () => {
      this.isResizing = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }
}
