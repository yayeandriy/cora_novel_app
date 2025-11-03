import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { Draft } from '../../shared/models';

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
  selector: 'app-document-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './document-editor.component.html',
  styleUrls: ['./document-editor.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentEditorComponent {
  @Input() selectedDoc: Doc | null = null;
  @Input() showSaveStatus: boolean = false;
  @Input() hasUnsavedChanges: boolean = false;
  @Input() allProjectDocs: Doc[] = [];
  // Drafts integration
  @Input() drafts: Draft[] = [];
  @Input() draftSyncStatus: Record<number, 'syncing' | 'synced' | 'pending'> = {};
  @Input() selectedDraftId: number | null = null;
  
  @Output() draftAdd = new EventEmitter<void>();
  @Output() draftSelect = new EventEmitter<number>();
  @Output() draftRenamed = new EventEmitter<{ id: number; name: string }>();
  @Output() draftChanged = new EventEmitter<{ draftId: number; content: string; cursorPosition: number }>();
  @Output() draftBlurred = new EventEmitter<number>();
  @Output() draftDeleted = new EventEmitter<number>();
  
  @Output() docNameChange = new EventEmitter<Doc>();
  @Output() docTextChange = new EventEmitter<void>();
  @Output() docSaved = new EventEmitter<void>();
  
  @ViewChild('docTitleInput') docTitleInput?: ElementRef<HTMLInputElement>;
  @ViewChild('editorTextarea') editorTextarea?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('draftTextarea') draftTextarea?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('draftNameInput') draftNameInput?: ElementRef<HTMLInputElement>;

  // Inline rename state
  editingDraftId: number | null = null;
  draftNameEdit: string = '';

  focusEditor() {
    this.editorTextarea?.nativeElement.focus();
  }

  // Draft helpers
  get selectedDraft() {
    return this.drafts.find(d => d.id === this.selectedDraftId) || null;
  }

  addDraft() {
    this.draftAdd.emit();
  }

  selectDraft(id: number) {
    this.draftSelect.emit(id);
    setTimeout(() => this.draftTextarea?.nativeElement.focus(), 0);
  }

  // Draft name editing
  startEditDraftName(draftId: number, currentName: string) {
    this.editingDraftId = draftId;
    this.draftNameEdit = currentName;
    // Ensure selected for split view
    if (this.selectedDraftId !== draftId) {
      this.draftSelect.emit(draftId);
    }
    setTimeout(() => {
      const el = this.draftNameInput?.nativeElement;
      if (el) { el.focus(); el.select(); }
    }, 0);
  }

  saveDraftName() {
    if (this.editingDraftId == null) return;
    const newName = (this.draftNameEdit || '').trim();
    const id = this.editingDraftId;
    this.editingDraftId = null;
    if (!newName) return; // no empty names
    this.draftRenamed.emit({ id, name: newName });
  }

  cancelDraftNameEdit() {
    this.editingDraftId = null;
  }

  onClickDeleteDraft(draftId: number) {
    // Emit delete without triggering input blur-save
    this.draftDeleted.emit(draftId);
    this.editingDraftId = null;
  }

  onDraftInput(event: Event, draftId: number) {
    const target = event.target as HTMLTextAreaElement;
    this.draftChanged.emit({ draftId, content: target.value, cursorPosition: target.selectionStart });
  }

  onDraftBlur(draftId: number) {
    this.draftBlurred.emit(draftId);
  }

  focusTitle() {
    const el = this.docTitleInput?.nativeElement;
    if (el) {
      el.focus();
      el.select();
    }
  }

  onTitleChange(doc: Doc) {
    this.docNameChange.emit(doc);
  }

  onTextChange() {
    this.docTextChange.emit();
  }

  onBlur() {
    this.docSaved.emit();
  }

  // Document statistics
  getDocCharCount(): number {
    if (!this.selectedDoc?.text) return 0;
    return this.selectedDoc.text.length;
  }

  getDocWordCount(): number {
    if (!this.selectedDoc?.text) return 0;
    const words = this.selectedDoc.text.split(/\s+/).filter(w => w.trim().length > 0);
    return words.length;
  }

  getDocPageCount(): number {
    // Standard: 1 page = 1800 characters (including spaces)
    const chars = this.getDocCharCount();
    return Math.ceil(chars / 1800);
  }

  // Project statistics
  getProjectCharCount(): number {
    return this.allProjectDocs.reduce((total, doc) => {
      return total + (doc.text?.length || 0);
    }, 0);
  }

  getProjectWordCount(): number {
    return this.allProjectDocs.reduce((total, doc) => {
      if (!doc.text) return total;
      const words = doc.text.split(/\s+/).filter(w => w.trim().length > 0);
      return total + words.length;
    }, 0);
  }

  getProjectPageCount(): number {
    const chars = this.getProjectCharCount();
    return Math.ceil(chars / 1800);
  }

  // Format large numbers with K suffix
  formatNumber(num: number): string {
    if (num >= 1000) {
      return Math.floor(num / 1000) + 'K';
    }
    return num.toString();
  }
}
