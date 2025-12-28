import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FolderDraftsComponent, FolderDraft } from '../folder-drafts/folder-drafts.component';
import { MetadataChipsComponent } from '../metadata-chips/metadata-chips.component';

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
  imports: [CommonModule, FormsModule, FolderDraftsComponent, MetadataChipsComponent],
  templateUrl: './group-view.component.html',
  styleUrls: ['./group-view.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GroupViewComponent implements OnInit {
  @Input() selectedGroup: DocGroup | null = null;
  @Input() folderDrafts: FolderDraft[] = [];
  @Input() selectedFolderDraftId: number | null = null;
  
  // Metadata inputs
  @Input() characters: any[] = [];
  @Input() events: any[] = [];
  @Input() places: any[] = [];
  @Input() docCharactersCache: Map<number, number[]> = new Map();
  @Input() docEventsCache: Map<number, number[]> = new Map();
  @Input() docPlacesCache: Map<number, number[]> = new Map();
  
  @Output() groupNameChange = new EventEmitter<DocGroup>();
  @Output() createDocRequested = new EventEmitter<void>();
  @Output() focusTreeRequested = new EventEmitter<void>();
  @Output() notesChanged = new EventEmitter<void>();
  @Output() folderDraftCreate = new EventEmitter<void>();
  @Output() folderDraftChange = new EventEmitter<{ draftId: number; content: string; cursorPosition: number }>();
  @Output() folderDraftNameChange = new EventEmitter<{ draftId: number; name: string }>();
  @Output() folderDraftDelete = new EventEmitter<number>();
  @Output() folderDraftMove = new EventEmitter<{ draftId: number; newIndex: number }>();
  @Output() folderDraftSelect = new EventEmitter<number>();
  @Output() docCardClick = new EventEmitter<any>();
  
  // Metadata outputs
  @Output() characterAdd = new EventEmitter<{ docId: number; characterId: number }>();
  @Output() characterRemove = new EventEmitter<{ docId: number; characterId: number }>();
  @Output() characterCreate = new EventEmitter<{ docId: number; name: string }>();
  @Output() characterDelete = new EventEmitter<number>();
  @Output() characterEdit = new EventEmitter<{ id: number; name: string }>();
  @Output() characterReorder = new EventEmitter<{ docId: number; orderIds: number[] }>();
  
  @Output() eventAdd = new EventEmitter<{ docId: number; eventId: number }>();
  @Output() eventRemove = new EventEmitter<{ docId: number; eventId: number }>();
  @Output() eventCreate = new EventEmitter<{ docId: number; name: string }>();
  @Output() eventDelete = new EventEmitter<number>();
  @Output() eventEdit = new EventEmitter<{ id: number; name: string }>();
  @Output() eventReorder = new EventEmitter<{ docId: number; orderIds: number[] }>();
  
  @Output() placeAdd = new EventEmitter<{ docId: number; placeId: number }>();
  @Output() placeRemove = new EventEmitter<{ docId: number; placeId: number }>();
  @Output() placeCreate = new EventEmitter<{ docId: number; name: string }>();
  @Output() placeDelete = new EventEmitter<number>();
  @Output() placeEdit = new EventEmitter<{ id: number; name: string }>();
  @Output() placeReorder = new EventEmitter<{ docId: number; orderIds: number[] }>();
  
  @ViewChild('groupNameInput') groupNameInput?: ElementRef<HTMLInputElement>;

  notesExpanded: boolean = true;
  activeTab: 'notes' | 'docs' = 'docs';
  private readonly NOTES_EXPANDED_KEY = 'cora-folder-notes-expanded';
  private readonly ACTIVE_TAB_KEY = 'cora-folder-active-tab';

  ngOnInit() {
    // Restore active tab from localStorage
    try {
      const savedTab = localStorage.getItem(this.ACTIVE_TAB_KEY);
      if (savedTab === 'notes' || savedTab === 'docs') {
        this.activeTab = savedTab;
      }
    } catch {}
  }

  onNameChange(group: DocGroup) {
    this.groupNameChange.emit(group);
  }

  onDraftMove(event: { draftId: number; newIndex: number }) {
    this.folderDraftMove.emit(event);
  }

  onDraftSelect(draftId: number) {
    this.folderDraftSelect.emit(draftId);
  }

  toggleNotes() {
    this.activeTab = 'notes';
    try {
      localStorage.setItem(this.ACTIVE_TAB_KEY, this.activeTab);
    } catch {}
  }

  toggleDocCards() {
    this.activeTab = 'docs';
    try {
      localStorage.setItem(this.ACTIVE_TAB_KEY, this.activeTab);
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

  getGroupTitleSize(): number {
    const len = this.selectedGroup?.name ? this.selectedGroup.name.length : 0;
    return Math.max(1, len + 1);
  }

  getDocPreview(doc: any): string {
    const text = doc.text || '';
    if (!text.trim()) return 'Empty document';
    // Return first 100 characters as preview
    return text.substring(0, 100) + (text.length > 100 ? '...' : '');
  }

  onDocCardClick(doc: any) {
    this.docCardClick.emit(doc);
  }

  // Folder drafts methods
  createFolderDraft() {
    this.folderDraftCreate.emit();
  }

  onFolderDraftChange(draftId: number, content: string, cursorPosition: number) {
    this.folderDraftChange.emit({ draftId, content, cursorPosition });
  }

  onFolderDraftNameChange(draftId: number, name: string) {
    this.folderDraftNameChange.emit({ draftId, name });
  }

  deleteFolderDraft(draftId: number) {
    this.folderDraftDelete.emit(draftId);
  }

  // Doc card metadata helpers
  getDocCharacters(docId: number): any[] {
    const charIds = this.docCharactersCache.get(docId) || [];
    const charMap = new Map(this.characters.map(c => [c.id, c]));
    return charIds.map(id => charMap.get(id)).filter((c): c is any => c !== undefined);
  }

  getDocEvents(docId: number): any[] {
    const eventIds = this.docEventsCache.get(docId) || [];
    const eventMap = new Map(this.events.map(e => [e.id, e]));
    return eventIds.map(id => eventMap.get(id)).filter((e): e is any => e !== undefined);
  }

  getDocPlaces(docId: number): any[] {
    const placeIds = this.docPlacesCache.get(docId) || [];
    const placeMap = new Map(this.places.map(p => [p.id, p]));
    return placeIds.map(id => placeMap.get(id)).filter((p): p is any => p !== undefined);
  }

  getAvailableCharactersForDoc(docId: number): any[] {
    const linkedIds = this.docCharactersCache.get(docId) || [];
    return this.characters.filter(c => !linkedIds.includes(c.id));
  }

  getAvailableEventsForDoc(docId: number): any[] {
    const linkedIds = this.docEventsCache.get(docId) || [];
    return this.events.filter(e => !linkedIds.includes(e.id));
  }

  getAvailablePlacesForDoc(docId: number): any[] {
    const linkedIds = this.docPlacesCache.get(docId) || [];
    return this.places.filter(p => !linkedIds.includes(p.id));
  }

  // Metadata event handlers
  onCharacterAdd(docId: number, characterId: number) {
    this.characterAdd.emit({ docId, characterId });
  }

  onCharacterRemove(docId: number, characterId: number) {
    this.characterRemove.emit({ docId, characterId });
  }

  onCharacterCreate(docId: number, name: string) {
    this.characterCreate.emit({ docId, name });
  }

  onCharacterReorder(docId: number, orderIds: number[]) {
    this.characterReorder.emit({ docId, orderIds });
  }

  onEventAdd(docId: number, eventId: number) {
    this.eventAdd.emit({ docId, eventId });
  }

  onEventRemove(docId: number, eventId: number) {
    this.eventRemove.emit({ docId, eventId });
  }

  onEventCreate(docId: number, name: string) {
    this.eventCreate.emit({ docId, name });
  }

  onEventReorder(docId: number, orderIds: number[]) {
    this.eventReorder.emit({ docId, orderIds });
  }

  onPlaceAdd(docId: number, placeId: number) {
    this.placeAdd.emit({ docId, placeId });
  }

  onPlaceRemove(docId: number, placeId: number) {
    this.placeRemove.emit({ docId, placeId });
  }

  onPlaceCreate(docId: number, name: string) {
    this.placeCreate.emit({ docId, name });
  }

  onPlaceReorder(docId: number, orderIds: number[]) {
    this.placeReorder.emit({ docId, orderIds });
  }
}
