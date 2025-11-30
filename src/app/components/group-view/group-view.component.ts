import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FolderDraftsComponent, FolderDraft } from '../folder-drafts/folder-drafts.component';

export interface DocGroup {
  id: number;
  name: string;
  project_id: number;
  parent_id?: number | null;
  sort_order?: number | null;
  notes?: string | null;
  expanded: boolean;
  docs: any[];
  groups?: DocGroup[];
}

@Component({
  selector: 'app-group-view',
  standalone: true,
  imports: [CommonModule, FormsModule, FolderDraftsComponent],
  templateUrl: './group-view.component.html',
  styleUrls: ['./group-view.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GroupViewComponent implements OnInit {
  @Input() selectedGroup: DocGroup | null = null;
  @Input() folderDrafts: FolderDraft[] = [];
  
  @Output() groupNameChange = new EventEmitter<DocGroup>();
  @Output() createDocRequested = new EventEmitter<void>();
  @Output() focusTreeRequested = new EventEmitter<void>();
  @Output() notesChanged = new EventEmitter<void>();
  @Output() folderDraftCreate = new EventEmitter<void>();
  @Output() folderDraftChange = new EventEmitter<{ draftId: number; content: string; cursorPosition: number }>();
  @Output() folderDraftDelete = new EventEmitter<number>();
  
  @ViewChild('groupNameInput') groupNameInput?: ElementRef<HTMLInputElement>;

  notesExpanded: boolean = true;
  private readonly NOTES_EXPANDED_KEY = 'cora-folder-notes-expanded';

  onNameChange(group: DocGroup) {
    this.groupNameChange.emit(group);
  }

  toggleNotes() {
    this.notesExpanded = !this.notesExpanded;
    try {
      localStorage.setItem(this.NOTES_EXPANDED_KEY, String(this.notesExpanded));
    } catch {}
  }

  onNotesChange() {
    this.notesChanged.emit();
  }

  onCreateDoc() {
    this.createDocRequested.emit();
  }

  focusName() {
    const el = this.groupNameInput?.nativeElement;
    if (el) {
      el.focus();
      el.select();
    }
  }

  onNameEnter(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    if (this.selectedGroup) {
      this.groupNameChange.emit(this.selectedGroup);
    }
    // Request focus to be switched back to tree
    this.focusTreeRequested.emit();
  }

  // Folder drafts methods
  createFolderDraft() {
    this.folderDraftCreate.emit();
  }

  onFolderDraftChange(draftId: number, content: string, cursorPosition: number) {
    this.folderDraftChange.emit({ draftId, content, cursorPosition });
  }

  deleteFolderDraft(draftId: number) {
    this.folderDraftDelete.emit(draftId);
  }

  ngOnInit(): void {
    try {
      const savedNotesExpanded = localStorage.getItem(this.NOTES_EXPANDED_KEY);
      if (savedNotesExpanded != null) this.notesExpanded = savedNotesExpanded === 'true';
    } catch {}
  }
}
