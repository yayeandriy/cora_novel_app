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

  getWordCount(): number {
    if (!this.selectedDoc?.text) return 0;
    const words = this.selectedDoc.text.split(/\s+/).filter(w => w.trim().length > 0);
    return words.length;
  }
}
