import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, ChangeDetectionStrategy, ChangeDetectorRef, OnInit, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FolderDraftsComponent, FolderDraft } from '../folder-drafts/folder-drafts.component';
import { MetadataChipsComponent } from '../metadata-chips/metadata-chips.component';
import type { Draft } from '../../shared/models';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

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
export class GroupViewComponent implements OnInit, OnChanges, OnDestroy {
  constructor(private cdr: ChangeDetectorRef) {}
  @Input() selectedGroup: DocGroup | null = null;
  @Input() folderDrafts: FolderDraft[] = [];
  @Input() selectedFolderDraftId: number | null = null;
  @Input() groupDocDrafts: Draft[] = [];
  
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
  @Output() groupDocDraftCreate = new EventEmitter<{ docId: number }>();
  @Output() groupDocDraftContentChange = new EventEmitter<{ docId: number; draftId: number; content: string }>();
  @Output() groupDocDraftNameChange = new EventEmitter<{ docId: number; draftId: number; name: string }>();
  @Output() groupDocDraftDelete = new EventEmitter<{ docId: number; draftId: number }>();
  
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
  activeTab: 'notes' | 'docs' | 'drafts' = 'docs';
  private readonly NOTES_EXPANDED_KEY = 'cora-folder-notes-expanded';
  private readonly ACTIVE_TAB_KEY = 'cora-folder-active-tab';

  private draftContentSubject = new Subject<{ docId: number; draftId: number; content: string }>();
  private draftNameSubject = new Subject<{ docId: number; draftId: number; name: string }>();
  private draftSubs = [
    this.draftContentSubject.pipe(
      debounceTime(500),
      distinctUntilChanged((a, b) => a.draftId === b.draftId && a.content === b.content)
    ).subscribe(e => this.groupDocDraftContentChange.emit(e)),
    this.draftNameSubject.pipe(
      debounceTime(500),
      distinctUntilChanged((a, b) => a.draftId === b.draftId && a.name === b.name)
    ).subscribe(e => this.groupDocDraftNameChange.emit(e))
  ];

  ngOnDestroy() {
    this.draftSubs.forEach(s => s.unsubscribe());
  }

  // Doc card metadata helpers - cache to avoid recreating arrays on each check
  private docCharactersResultCache = new Map<number, any[]>();
  private docEventsResultCache = new Map<number, any[]>();
  private docPlacesResultCache = new Map<number, any[]>();
  private availableCharactersCache = new Map<number, any[]>();
  private availableEventsCache = new Map<number, any[]>();
  private availablePlacesCache = new Map<number, any[]>();

  ngOnInit() {
    // Restore active tab from localStorage
    try {
      const savedTab = localStorage.getItem(this.ACTIVE_TAB_KEY);
      if (savedTab === 'notes' || savedTab === 'docs' || savedTab === 'drafts') {
        this.activeTab = savedTab;
      }
    } catch {}
  }

  ngOnChanges(changes: SimpleChanges) {
    // When cache Maps change, trigger change detection and clear local caches
    if (changes['docCharactersCache'] || changes['docEventsCache'] || changes['docPlacesCache'] || 
        changes['selectedGroup'] || changes['characters'] || changes['events'] || changes['places']) {
      // Clear local result caches when inputs change
      this.docCharactersResultCache.clear();
      this.docEventsResultCache.clear();
      this.docPlacesResultCache.clear();
      this.availableCharactersCache.clear();
      this.availableEventsCache.clear();
      this.availablePlacesCache.clear();
      this.cdr.markForCheck();
    }
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
    this.cdr.markForCheck();
  }

  toggleDocCards() {
    this.activeTab = 'docs';
    try {
      localStorage.setItem(this.ACTIVE_TAB_KEY, this.activeTab);
    } catch {}
    this.cdr.markForCheck();
  }

  toggleDrafts() {
    this.activeTab = 'drafts';
    try {
      localStorage.setItem(this.ACTIVE_TAB_KEY, this.activeTab);
    } catch {}
    this.cdr.markForCheck();
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

  getAllDocsInGroup(): { id: number; name: string }[] {
    return (this.selectedGroup?.docs ?? []).map((d: any) => ({ id: d.id, name: d.name || 'Untitled' }));
  }

  getDraftsGroupedByDoc(): { docId: number; docName: string; drafts: Draft[] }[] {
    if (!this.selectedGroup) return [];
    return this.selectedGroup.docs.map((doc: any) => ({
      docId: doc.id,
      docName: doc.name || 'Untitled',
      drafts: this.groupDocDrafts.filter(d => d.doc_id === doc.id)
    }));
  }

  get groupDocDraftsCount(): number {
    return this.groupDocDrafts.length;
  }

  onGroupDocDraftCreate(docId: number) {
    this.groupDocDraftCreate.emit({ docId });
  }

  onGroupDocDraftContentChange(docId: number, draftId: number, content: string) {
    this.draftContentSubject.next({ docId, draftId, content });
  }

  onGroupDocDraftNameChange(docId: number, draftId: number, event: Event) {
    const name = (event.target as HTMLInputElement).value;
    this.draftNameSubject.next({ docId, draftId, name });
  }

  onGroupDocDraftDelete(docId: number, draftId: number, event: MouseEvent) {
    event.stopPropagation();
    this.groupDocDraftDelete.emit({ docId, draftId });
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
    if (this.docCharactersResultCache.has(docId)) {
      return this.docCharactersResultCache.get(docId)!;
    }
    const charIds = this.docCharactersCache.get(docId) || [];
    const charMap = new Map(this.characters.map(c => [c.id, c]));
    const result = charIds.map(id => charMap.get(id)).filter((c): c is any => c !== undefined);
    this.docCharactersResultCache.set(docId, result);
    return result;
  }

  getDocEvents(docId: number): any[] {
    if (this.docEventsResultCache.has(docId)) {
      return this.docEventsResultCache.get(docId)!;
    }
    const eventIds = this.docEventsCache.get(docId) || [];
    const eventMap = new Map(this.events.map(e => [e.id, e]));
    const result = eventIds.map(id => eventMap.get(id)).filter((e): e is any => e !== undefined);
    this.docEventsResultCache.set(docId, result);
    return result;
  }

  getDocPlaces(docId: number): any[] {
    if (this.docPlacesResultCache.has(docId)) {
      return this.docPlacesResultCache.get(docId)!;
    }
    const placeIds = this.docPlacesCache.get(docId) || [];
    const placeMap = new Map(this.places.map(p => [p.id, p]));
    const result = placeIds.map(id => placeMap.get(id)).filter((p): p is any => p !== undefined);
    this.docPlacesResultCache.set(docId, result);
    return result;
  }

  getAvailableCharactersForDoc(docId: number): any[] {
    if (this.availableCharactersCache.has(docId)) {
      return this.availableCharactersCache.get(docId)!;
    }
    const linkedIds = this.docCharactersCache.get(docId) || [];
    const result = this.characters.filter(c => !linkedIds.includes(c.id));
    this.availableCharactersCache.set(docId, result);
    return result;
  }

  getAvailableEventsForDoc(docId: number): any[] {
    if (this.availableEventsCache.has(docId)) {
      return this.availableEventsCache.get(docId)!;
    }
    const linkedIds = this.docEventsCache.get(docId) || [];
    const result = this.events.filter(e => !linkedIds.includes(e.id));
    this.availableEventsCache.set(docId, result);
    return result;
  }

  getAvailablePlacesForDoc(docId: number): any[] {
    if (this.availablePlacesCache.has(docId)) {
      return this.availablePlacesCache.get(docId)!;
    }
    const linkedIds = this.docPlacesCache.get(docId) || [];
    const result = this.places.filter(p => !linkedIds.includes(p.id));
    this.availablePlacesCache.set(docId, result);
    return result;
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
