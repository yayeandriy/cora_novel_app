import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { MetadataChipsComponent } from '../metadata-chips/metadata-chips.component';
import { CharactersPanelComponent } from '../characters-panel/characters-panel.component';
import { EventsPanelComponent } from '../events-panel/events-panel.component';
import { PlacesPanelComponent } from '../places-panel/places-panel.component';
import { PersistTextareaHeightDirective } from '../../shared/persist-textarea-height.directive';

export interface Character {
  id: number;
  name: string;
  desc: string;
}

export interface Event {
  id: number;
  name: string;
  desc: string;
  start_date?: string | null;
  end_date?: string | null;
}

export interface Place {
  id: number;
  name: string;
  desc: string;
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

export interface DocGroup {
  id: number;
  name: string;
  project_id: number;
  parent_id?: number | null;
  sort_order?: number | null;
  notes?: string | null;
}

export interface Project {
  id: number;
  name: string;
  desc?: string | null;
  path?: string | null;
  notes?: string | null;
  timeline_start?: string | null;
  timeline_end?: string | null;
}

type TabType = 'doc' | 'folder' | 'project';

@Component({
  selector: 'app-right-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, MetadataChipsComponent, CharactersPanelComponent, EventsPanelComponent, PlacesPanelComponent, PersistTextareaHeightDirective],
  templateUrl: './right-sidebar.component.html',
  styleUrls: ['./right-sidebar.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RightSidebarComponent {
  @Input() selectedDoc: Doc | null = null;
  @Input() selectedDocGroup: DocGroup | null = null;
  @Input() project: Project | null = null;
  @Input() characters: Character[] = [];
  @Input() events: Event[] = [];
  @Input() places: any[] = [];
  @Input() drafts: Draft[] = [];
  @Input() draftSyncStatus: Record<number, 'syncing' | 'synced' | 'pending'> = {};
  @Input() docCharacterIds: Set<number> | null = null;
  @Input() docGroupCharacterIds: Set<number> | null = null;
  @Input() editingCharacterId: number | null = null;
  @Input() docEventIds: Set<number> | null = null;
  @Input() docGroupEventIds: Set<number> | null = null;
  @Input() editingEventId: number | null = null;
  @Input() docPlaceIds: Set<number> | null = null;
  @Input() docGroupPlaceIds: Set<number> | null = null;
  @Input() editingPlaceId: number | null = null;
  
  activeTab: TabType = 'doc';
  
  @Input() draftsExpanded: boolean = true;
  @Input() timelineHeaderVisible: boolean = false;
  
  @Output() draftsExpandedChange = new EventEmitter<boolean>();
  
  @Output() docNotesChanged = new EventEmitter<void>();
  @Output() docGroupNotesChanged = new EventEmitter<void>();
  @Output() projectNotesChanged = new EventEmitter<void>();
  @Output() draftCreated = new EventEmitter<void>();
  @Output() draftChanged = new EventEmitter<{ draftId: number; content: string; cursorPosition: number }>();
  @Output() draftBlurred = new EventEmitter<number>();
  @Output() draftDeleted = new EventEmitter<number>();
  @Output() draftContentRequested = new EventEmitter<number>();
  @Output() widthChanged = new EventEmitter<number>();
  @Output() collapseToggle = new EventEmitter<void>();
  @Output() timelineHeaderToggle = new EventEmitter<void>();
  // Character events
  @Output() characterAdd = new EventEmitter<void>();
  @Output() characterCreate = new EventEmitter<{ name: string; desc: string }>();
  @Output() characterNameChange = new EventEmitter<{ id: number; name: string }>();
  @Output() characterDescChange = new EventEmitter<{ id: number; desc: string }>();
  @Output() characterUpdate = new EventEmitter<{ id: number; name: string; desc: string }>();
  @Output() characterDelete = new EventEmitter<number>();
  @Output() characterToggle = new EventEmitter<{ characterId: number; checked: boolean }>();
  @Output() docGroupCharacterToggle = new EventEmitter<{ characterId: number; checked: boolean }>();
  // Event outputs
  @Output() eventAdd = new EventEmitter<void>();
  @Output() eventCreate = new EventEmitter<{ name: string; desc: string; start_date: string | null; end_date: string | null }>();
  @Output() eventUpdate = new EventEmitter<{ id: number; name: string; desc: string; start_date: string | null; end_date: string | null }>();
  @Output() eventDelete = new EventEmitter<number>();
  @Output() eventToggle = new EventEmitter<{ eventId: number; checked: boolean }>();
  @Output() docGroupEventToggle = new EventEmitter<{ eventId: number; checked: boolean }>();
  // Place outputs
  @Output() placeAdd = new EventEmitter<void>();
  @Output() placeCreate = new EventEmitter<{ name: string; desc: string }>();
  @Output() placeUpdate = new EventEmitter<{ id: number; name: string; desc: string }>();
  @Output() placeDelete = new EventEmitter<number>();
  @Output() placeToggle = new EventEmitter<{ placeId: number; checked: boolean }>();
  @Output() docGroupPlaceToggle = new EventEmitter<{ placeId: number; checked: boolean }>();
  // Reorder outputs (visible-list order of IDs)
  @Output() charactersReorder = new EventEmitter<number[]>();
  @Output() eventsReorder = new EventEmitter<number[]>();
  @Output() placesReorder = new EventEmitter<number[]>();
  
  rightWidth = 300; // internal tracker for live drag; host width comes from parent binding
  isResizing = false;

  switchTab(tab: TabType) {
    this.activeTab = tab;
  }

  onDocNotesChange() {
    this.docNotesChanged.emit();
  }

  onDocGroupNotesChange() {
    this.docGroupNotesChanged.emit();
  }

  onProjectNotesChange() {
    this.projectNotesChanged.emit();
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

  onToggleCollapse() {
    this.collapseToggle.emit();
  }

  // ===== Characters UI handlers =====
  onCharacterAdd() {
    this.characterAdd.emit();
  }

  onCharacterCreate(data: { name: string; desc: string }) {
    // Emit character creation with the provided data
    this.characterCreate.emit(data);
  }

  onCharacterNameChange(char: Character, name: string) {
    this.characterNameChange.emit({ id: char.id, name });
  }

  onCharacterDescChange(char: Character, desc: string) {
    this.characterDescChange.emit({ id: char.id, desc });
  }

  onCharacterUpdate(payload: { id: number; name: string; desc: string }) {
    this.characterUpdate.emit(payload);
  }

  onCharacterDelete(id: number) {
    this.characterDelete.emit(id);
  }

  onCharacterToggle(id: number, event: any) {
    const input = event?.target as HTMLInputElement;
    const checked = !!input?.checked;
    this.characterToggle.emit({ characterId: id, checked });
  }

  onDocGroupCharacterToggle(id: number, event: any) {
    const input = event?.target as HTMLInputElement;
    const checked = !!input?.checked;
    this.docGroupCharacterToggle.emit({ characterId: id, checked });
  }

  onEventCreate(data: { name: string; desc: string; start_date: string | null; end_date: string | null }) {
    this.eventCreate.emit(data);
  }

  onEventToggle(id: number, event: any) {
    const input = event?.target as HTMLInputElement;
    const checked = !!input?.checked;
    this.eventToggle.emit({ eventId: id, checked });
  }

  onDocGroupEventToggle(id: number, event: any) {
    const input = event?.target as HTMLInputElement;
    const checked = !!input?.checked;
    this.docGroupEventToggle.emit({ eventId: id, checked });
  }

  // ===== Places UI handlers =====

  onPlaceAdd() {
    this.placeAdd.emit();
  }

  onPlaceCreate(data: { name: string; desc: string }) {
    this.placeCreate.emit(data);
  }

  onPlaceUpdate(payload: { id: number; name: string; desc: string }) {
    this.placeUpdate.emit(payload);
  }

  onPlaceDelete(id: number) {
    this.placeDelete.emit(id);
  }

  onPlaceToggle(id: number, event: any) {
    const input = event?.target as HTMLInputElement;
    const checked = !!input?.checked;
    this.placeToggle.emit({ placeId: id, checked });
  }

  onDocGroupPlaceToggle(id: number, event: any) {
    const input = event?.target as HTMLInputElement;
    const checked = !!input?.checked;
    this.docGroupPlaceToggle.emit({ placeId: id, checked });
  }

  onTimelineHeaderToggle() {
    this.timelineHeaderToggle.emit();
  }

  // ===== Drag and Drop Handlers =====
  onReorderCharacters(newOrder: number[]) {
    this.charactersReorder.emit(newOrder);
  }

  onReorderEvents(newOrder: number[]) {
    this.eventsReorder.emit(newOrder);
  }

  onReorderPlaces(newOrder: number[]) {
    this.placesReorder.emit(newOrder);
  }

  // Helper to get items NOT already attached to the current doc
  getAvailableCharacters(): Character[] {
    if (!this.docCharacterIds) return this.characters;
    return this.characters.filter(c => !this.docCharacterIds!.has(c.id));
  }

  getAvailableEvents(): Event[] {
    if (!this.docEventIds) return this.events;
    return this.events.filter(e => !this.docEventIds!.has(e.id));
  }

  getAvailablePlaces(): any[] {
    if (!this.docPlaceIds) return this.places;
    return this.places.filter(p => !this.docPlaceIds!.has(p.id));
  }

  // Actions
  addCharacter(id: number) {
    this.characterToggle.emit({ characterId: id, checked: true });
  }

  removeCharacter(id: number, event?: MouseEvent) {
    if (event) event.stopPropagation();
    this.characterToggle.emit({ characterId: id, checked: false });
  }

  deleteCharacter(id: number) {
    console.log('[RightSidebar] deleteCharacter called with id:', id);
    this.characterDelete.emit(id);
  }

  editCharacter(payload: { id: number; name: string }) {
    // Emit update with empty desc - the parent will handle preserving existing desc
    this.characterUpdate.emit({ id: payload.id, name: payload.name, desc: '' });
  }

  createAndAddCharacter(name: string) {
    if (!name.trim()) return;
    this.characterCreate.emit({ name: name.trim(), desc: '' });
  }

  addEvent(id: number) {
    this.eventToggle.emit({ eventId: id, checked: true });
  }

  removeEvent(id: number, event?: MouseEvent) {
    if (event) event.stopPropagation();
    this.eventToggle.emit({ eventId: id, checked: false });
  }

  deleteEvent(id: number) {
    console.log('[RightSidebar] deleteEvent called with id:', id);
    this.eventDelete.emit(id);
  }

  editEvent(payload: { id: number; name: string }) {
    // Emit update with minimal data - the parent will handle preserving existing fields
    this.eventUpdate.emit({ id: payload.id, name: payload.name, desc: '', start_date: null, end_date: null });
  }

  createAndAddEvent(name: string) {
    if (!name.trim()) return;
    this.eventCreate.emit({ name: name.trim(), desc: '', start_date: null, end_date: null });
  }

  addPlace(id: number) {
    this.placeToggle.emit({ placeId: id, checked: true });
  }

  removePlace(id: number, event?: MouseEvent) {
    if (event) event.stopPropagation();
    this.placeToggle.emit({ placeId: id, checked: false });
  }

  deletePlace(id: number) {
    console.log('[RightSidebar] deletePlace called with id:', id);
    this.placeDelete.emit(id);
  }

  editPlace(payload: { id: number; name: string }) {
    // Emit update with empty desc - the parent will handle preserving existing desc
    this.placeUpdate.emit({ id: payload.id, name: payload.name, desc: '' });
  }

  createAndAddPlace(name: string) {
    if (!name.trim()) return;
    this.placeCreate.emit({ name: name.trim(), desc: '' });
  }

  // Get attached items for display
  getAttachedCharacters(): Character[] {
    if (!this.docCharacterIds) return [];
    return this.characters.filter(c => this.docCharacterIds!.has(c.id));
  }

  getAttachedEvents(): Event[] {
    if (!this.docEventIds) return [];
    return this.events.filter(e => this.docEventIds!.has(e.id));
  }

  getAttachedPlaces(): any[] {
    if (!this.docPlaceIds) return [];
    return this.places.filter(p => this.docPlaceIds!.has(p.id));
  }
}
