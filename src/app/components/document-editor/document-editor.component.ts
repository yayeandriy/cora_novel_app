import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
  
  @Output() docNameChange = new EventEmitter<Doc>();
  @Output() docTextChange = new EventEmitter<void>();
  @Output() docSaved = new EventEmitter<void>();
  
  @ViewChild('docTitleInput') docTitleInput?: ElementRef<HTMLInputElement>;
  @ViewChild('editorTextarea') editorTextarea?: ElementRef<HTMLTextAreaElement>;

  focusEditor() {
    this.editorTextarea?.nativeElement.focus();
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
