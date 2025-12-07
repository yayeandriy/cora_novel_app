import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import { TimelineService } from '../../services/timeline.service';
import { confirm, open, ask } from '@tauri-apps/plugin-dialog';
import { DocTreeComponent } from '../../components/doc-tree/doc-tree.component';
import { DocumentEditorComponent } from '../../components/document-editor/document-editor.component';
import { GroupViewComponent } from '../../components/group-view/group-view.component';
import { RightSidebarComponent } from '../../components/right-sidebar/right-sidebar.component';
import { MetadataChipsComponent } from '../../components/metadata-chips/metadata-chips.component';
import { ProjectTimelineComponent } from '../../components/project-timeline/project-timeline.component';
import { AppFooterComponent } from '../../components/app-footer/app-footer.component';
import { FolderDraftsComponent } from '../../components/folder-drafts/folder-drafts.component';
import type { Timeline, FolderDraft } from '../../shared/models';

interface DocGroup {
  id: number;
  name: string;
  project_id: number;
  parent_id?: number | null;
  sort_order?: number | null;
  notes?: string | null;
  expanded: boolean;
  docs: Doc[];
  groups?: DocGroup[];
}

interface Doc {
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

interface Character {
  id: number;
  name: string;
  desc: string;
}

interface Event {
  id: number;
  name: string;
  desc: string;
  start_date?: string | null;
  end_date?: string | null;
}

@Component({
  selector: 'app-project-view',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    DocTreeComponent,
    DocumentEditorComponent,
    GroupViewComponent,
    RightSidebarComponent,
    MetadataChipsComponent,
    ProjectTimelineComponent,
    AppFooterComponent,
    FolderDraftsComponent
  ],
  templateUrl: './project-view.component.html',
  styleUrls: ['./project-view.component.css'],
  host: {
    '(document:keydown)': 'handleKeyDown($event)'
  }
})
export class ProjectViewComponent implements OnInit, OnDestroy {
  @ViewChild('docTree') docTree?: ElementRef<HTMLDivElement>;
  @ViewChild(DocTreeComponent) docTreeComponent?: DocTreeComponent;
  @ViewChild(DocumentEditorComponent) documentEditorComponent?: DocumentEditorComponent;
  @ViewChild(GroupViewComponent) groupViewComponent?: GroupViewComponent;
  @ViewChild(ProjectTimelineComponent) projectTimelineComponent?: ProjectTimelineComponent;
  
  projectId: number = 0;
  projectName: string = '';
  editingProjectName = false;
  projectNameEdit: string = '';
  timelineStart: string | null = null;
  timelineEnd: string | null = null;
  
  // Layout state
  leftCollapsed = false;
  rightCollapsed = false;
  leftWidth = 250;
  rightWidth = 300;
  timelineHeaderVisible = false;
  
  // Deletion state
  isDeletingItem = false;
  
  // Save state
  lastSaveTime: Date | null = null;
  showSaveStatus = false;
  hasUnsavedChanges = false;
  private saveStatusTimeout: any;
  private autoSaveTimeout: any;
  private autoSaveNotesTimeout: any;
  
  // Local doc state cache
  private docStateCache: Map<number, {text?: string | null, notes?: string | null}> = new Map();
  
  // Content
  docGroups: DocGroup[] = [];
  allProjectDocs: Doc[] = [];  // All docs in project (for stats)
  selectedDoc: Doc | null = null;
  selectedGroup: DocGroup | null = null;
  currentGroup: DocGroup | null = null;
  expandedGroupIds: Set<number> = new Set();
  // Draft markers for doc tree
  groupsWithDrafts: Set<number> = new Set();
  docsWithDrafts: Set<number> = new Set();
  
  // Right sidebar
  draftsExpanded = true;
  
  projectData: import('../../shared/models').Project | null = null;
  characters: Character[] = [];
  events: Event[] = [];
  places: any[] = [];
  drafts: any[] = [];
  // Folder drafts UI state
  folderDraftsExpanded = false;
  folderDrafts: FolderDraft[] = [];
  folderDraftsCount: number = 0;
  editingFolderDraftId: number | null = null;
  folderDraftNameEdit: string = '';
  selectedFolderDraftId: number | null = null;
  private folderDraftLocalContent: Map<number, string> = new Map();
  private folderDraftAutoSaveTimeouts: Map<number, any> = new Map();
  private folderDraftSyncedClearTimeouts: Map<number, any> = new Map();
  folderDraftSyncStatus: Record<number, 'syncing' | 'synced' | 'pending'> = {};
  focusedFolderDraftId: number | null = null;
  // Project drafts UI state
  projectDraftsExpanded = false;
  projectDrafts: import('../../shared/models').ProjectDraft[] = [];
  projectDraftsCount: number = 0;
  editingProjectDraftId: number | null = null;
  projectDraftNameEdit: string = '';
  selectedProjectDraftId: number | null = null;
  private projectDraftLocalContent: Map<number, string> = new Map();
  private projectDraftAutoSaveTimeouts: Map<number, any> = new Map();
  private projectDraftSyncedClearTimeouts: Map<number, any> = new Map();
  projectDraftSyncStatus: Record<number, 'syncing' | 'synced' | 'pending'> = {};
  private focusedProjectDraftId: number | null = null;
  private projectDraftClickTimer: any;
  private folderDraftClickTimer: any;
  // Characters per-doc and per-doc-group selection
  docCharacterIds: Set<number> = new Set();
  docGroupCharacterIds: Set<number> = new Set();
  // Editing state for character cards
  editingCharacterId: number | null = null;
  // Events per-doc and per-doc-group selection and editing
  docEventIds: Set<number> = new Set();
  docGroupEventIds: Set<number> = new Set();
  editingEventId: number | null = null;
  // Places per-doc and per-doc-group selection and editing
  docPlaceIds: Set<number> = new Set();
  docGroupPlaceIds: Set<number> = new Set();
  editingPlaceId: number | null = null;
  
  // Draft local caching and syncing
  private draftLocalContent: Map<number, string> = new Map();
  private draftAutoSaveTimeouts: Map<number, any> = new Map();
  private draftSyncedClearTimeouts: Map<number, any> = new Map();
  draftSyncStatus: Record<number, 'syncing' | 'synced' | 'pending'> = {};
  private focusedDraftId: number | null = null;
  selectedDraftId: number | null = null;

  // Inline edit state for folder (doc group)
  editingFolderName = false;
  folderNameEdit: string = '';
  
  private getDraftSelectionKey(docId: number): string {
    return `cora-draft-selected-${this.projectId}-${docId}`;
  }
  private getProjectDraftSelectionKey(projectId: number): string {
    return `cora-project-draft-selected-${projectId}`;
  }
  private getProjectDraftsExpandedKey(projectId: number): string {
    return `cora-project-drafts-expanded-${projectId}`;
  }
  private getLocalProjectDraftKey(draftId: number): string {
    return `cora-project-draft-${draftId}`;
  }
  // Local ordering keys for characters/events (until backend sort_order exists)
  private getCharactersOrderKey(projectId: number): string {
    return `cora-characters-order-${projectId}`;
  }
  private getEventsOrderKey(projectId: number): string {
    return `cora-events-order-${projectId}`;
  }
  private getPlacesOrderKey(projectId: number): string {
    return `cora-places-order-${projectId}`;
  }

  // Import flow state
  showImportDialog = false;
  pendingImportFiles: string[] = [];
  pendingImportFolders: string[] = [];
  importTargetGroupId: number | null = null;
  flattenedGroups: Array<{ id: number; label: string }> = [];
  // Header notes expansion state
  projectHeaderExpanded = false;
  folderHeaderExpanded = false;
  // Scroll-based header visibility
  headersHiddenByScroll = false;
  headersHoverVisible = false;
  // Track which folder is expanded in project header view
  projectHeaderSelectedGroupId: number | null = null;
  // Track which doc is expanded in project header view to show its characters/events/places
  projectHeaderExpandedDocId: number | null = null;
  // Track which doc card is highlighted (selected but no navigation)
  projectHeaderHighlightedDocId: number | null = null;
  // Cache for doc metadata (characters, events, places) in project header view
  private projectHeaderDocCharactersCache: Map<number, number[]> = new Map();
  private projectHeaderDocEventsCache: Map<number, number[]> = new Map();
  private projectHeaderDocPlacesCache: Map<number, number[]> = new Map();

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    // No-op
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projectService: ProjectService,
    private timelineService: TimelineService,
    private changeDetector: ChangeDetectorRef
  ) {}

  // Project name editing
  startEditProjectName(event?: MouseEvent) {
    if (event) event.stopPropagation();
    this.editingProjectName = true;
    this.projectNameEdit = this.projectName;
    // Focus handled by template using #projectNameInput
    setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>('input.project-name-input');
      if (el) {
        el.focus();
        el.select();
      }
    }, 0);
  }


  // Toggle project header expansion (show/hide project notes editor)
  async onProjectHeaderClick(event: MouseEvent) {
    if (this.isInteractiveHeaderClick(event)) return;
    this.projectHeaderExpanded = !this.projectHeaderExpanded;
    // Clear folder and doc selection when collapsing project header
    if (!this.projectHeaderExpanded) {
      this.projectHeaderSelectedGroupId = null;
      this.projectHeaderExpandedDocId = null;
      this.projectHeaderHighlightedDocId = null;
    } else {
      // When expanding, automatically select the current folder (if any)
      const currentGroup = this.selectedGroup || this.currentGroup;
      if (currentGroup) {
        this.projectHeaderSelectedGroupId = currentGroup.id;
        // Load metadata for all docs in this folder
        await this.loadProjectHeaderFolderDocsMetadata(currentGroup);
      }
    }
  }

  // Handle folder chip click in project header - toggle expansion without navigation
  async onProjectFolderChipClick(group: DocGroup, event: MouseEvent) {
    event.stopPropagation();
    // Toggle: if already selected, deselect; otherwise select
    if (this.projectHeaderSelectedGroupId === group.id) {
      this.projectHeaderSelectedGroupId = null;
    } else {
      this.projectHeaderSelectedGroupId = group.id;
      // Load metadata for all docs in this folder
      await this.loadProjectHeaderFolderDocsMetadata(group);
    }
    // Clear expanded doc and highlighted doc when folder changes
    this.projectHeaderExpandedDocId = null;
    this.projectHeaderHighlightedDocId = null;
  }

  // Handle doc card click in project header - just highlight, don't navigate
  onProjectDocCardClick(doc: Doc, event: MouseEvent) {
    event.stopPropagation();
    // Toggle highlight
    if (this.projectHeaderHighlightedDocId === doc.id) {
      this.projectHeaderHighlightedDocId = null;
    } else {
      this.projectHeaderHighlightedDocId = doc.id;
    }
  }

  // Handle wheel scroll on docs cards container - enable horizontal scroll with vertical wheel
  onDocsContainerWheel(event: WheelEvent) {
    const container = event.currentTarget as HTMLElement;
    if (!container) return;
    
    // Use deltaY for horizontal scroll (works with and without Shift)
    if (event.deltaY !== 0) {
      event.preventDefault();
      container.scrollLeft += event.deltaY;
    }
  }

  // Handle scroll on editor area to detect when headers are hidden
  onEditorAreaScroll(scrollTop: number) {
    const wasHidden = this.headersHiddenByScroll;
    // Headers are considered hidden if scrolled more than 50px
    this.headersHiddenByScroll = scrollTop > 50;
    if (wasHidden !== this.headersHiddenByScroll) {
      console.log('[DEBUG] onEditorAreaScroll - scrollTop:', scrollTop, 'headersHiddenByScroll changed to:', this.headersHiddenByScroll);
    }
    // If headers become visible due to scrolling up, hide the hover overlay
    if (!this.headersHiddenByScroll) {
      this.headersHoverVisible = false;
    }
  }

  // Handle doc header click - toggle floating headers when scrolled
  onDocHeaderClick() {
    console.log('[DEBUG] onDocHeaderClick - headersHiddenByScroll:', this.headersHiddenByScroll, 'headersHoverVisible:', this.headersHoverVisible);
    if (this.headersHiddenByScroll) {
      this.headersHoverVisible = !this.headersHoverVisible;
      console.log('[DEBUG] onDocHeaderClick - toggled headersHoverVisible to:', this.headersHoverVisible);
    } else {
      console.log('[DEBUG] onDocHeaderClick - headers not hidden by scroll, not toggling');
    }
  }

  // Handle click on floating headers overlay (outside of header bars) - dismiss
  onFloatingHeadersClick(event: MouseEvent) {
    // Only dismiss if clicking directly on the overlay, not on child elements
    if (event.target === event.currentTarget) {
      this.headersHoverVisible = false;
    }
  }

  // Load metadata for all docs in a folder for project header view
  private async loadProjectHeaderFolderDocsMetadata(group: DocGroup): Promise<void> {
    const docs = group.docs || [];
    await Promise.all(docs.map(doc => this.loadProjectHeaderDocMetadata(doc.id)));
  }

  // Get docs for the folder selected in project header
  getProjectHeaderSelectedGroupDocs(): Doc[] {
    if (!this.projectHeaderSelectedGroupId) return [];
    const group = this.docGroups.find(g => g.id === this.projectHeaderSelectedGroupId);
    return group?.docs || [];
  }

  // Get the folder selected in project header
  getProjectHeaderSelectedGroup(): DocGroup | null {
    if (!this.projectHeaderSelectedGroupId) return null;
    return this.docGroups.find(g => g.id === this.projectHeaderSelectedGroupId) || null;
  }

  // Handle doc chip click in project header - toggle expansion to show characters/events/places
  async onProjectDocChipClick(doc: Doc, event: MouseEvent) {
    event.stopPropagation();
    // Toggle: if already expanded, collapse; otherwise expand
    if (this.projectHeaderExpandedDocId === doc.id) {
      this.projectHeaderExpandedDocId = null;
    } else {
      this.projectHeaderExpandedDocId = doc.id;
      // Load doc metadata if not cached
      await this.loadProjectHeaderDocMetadata(doc.id);
    }
  }

  // Load characters, events, places for a doc in project header view
  private async loadProjectHeaderDocMetadata(docId: number): Promise<void> {
    try {
      // Load characters if not cached
      if (!this.projectHeaderDocCharactersCache.has(docId)) {
        const charIds = await this.projectService.listDocCharacters(docId);
        this.projectHeaderDocCharactersCache.set(docId, charIds);
      }
      // Load events if not cached
      if (!this.projectHeaderDocEventsCache.has(docId)) {
        const eventIds = await this.projectService.listDocEvents(docId);
        this.projectHeaderDocEventsCache.set(docId, eventIds);
      }
      // Load places if not cached
      if (!this.projectHeaderDocPlacesCache.has(docId)) {
        const placeIds = await this.projectService.listDocPlaces(docId);
        this.projectHeaderDocPlacesCache.set(docId, placeIds);
      }
    } catch (error) {
      console.error('Failed to load doc metadata for project header:', error);
    }
  }

  // Get characters for a doc in project header view (preserves cache order)
  getProjectHeaderDocCharacters(docId: number): Character[] {
    const charIds = this.projectHeaderDocCharactersCache.get(docId) || [];
    const charMap = new Map(this.characters.map(c => [c.id, c]));
    return charIds.map(id => charMap.get(id)).filter((c): c is Character => c !== undefined);
  }

  // Get events for a doc in project header view (preserves cache order)
  getProjectHeaderDocEvents(docId: number): Event[] {
    const eventIds = this.projectHeaderDocEventsCache.get(docId) || [];
    const eventMap = new Map(this.events.map(e => [e.id, e]));
    return eventIds.map(id => eventMap.get(id)).filter((e): e is Event => e !== undefined);
  }

  // Get places for a doc in project header view (preserves cache order)
  getProjectHeaderDocPlaces(docId: number): any[] {
    const placeIds = this.projectHeaderDocPlacesCache.get(docId) || [];
    const placeMap = new Map(this.places.map(p => [p.id, p]));
    return placeIds.map(id => placeMap.get(id)).filter((p): p is any => p !== undefined);
  }

  // Get available items to add (not already linked to doc)
  getAvailableCharactersForDoc(docId: number): Character[] {
    const linkedIds = this.projectHeaderDocCharactersCache.get(docId) || [];
    return this.characters.filter(c => !linkedIds.includes(c.id));
  }

  getAvailableEventsForDoc(docId: number): Event[] {
    const linkedIds = this.projectHeaderDocEventsCache.get(docId) || [];
    return this.events.filter(e => !linkedIds.includes(e.id));
  }

  getAvailablePlacesForDoc(docId: number): any[] {
    const linkedIds = this.projectHeaderDocPlacesCache.get(docId) || [];
    return this.places.filter(p => !linkedIds.includes(p.id));
  }

  // Add item to doc metadata
  async addCharacterToDocCard(docId: number, characterId: number) {
    try {
      await this.projectService.attachCharacterToDoc(docId, characterId);
      // Update cache
      const current = this.projectHeaderDocCharactersCache.get(docId) || [];
      this.projectHeaderDocCharactersCache.set(docId, [...current, characterId]);
      
      // Update sidebar if this is the selected doc
      if (this.selectedDoc && this.selectedDoc.id === docId) {
        this.docCharacterIds = new Set([...this.docCharacterIds, characterId]);
      }
      this.changeDetector.markForCheck();
    } catch (error) {
      console.error('Failed to add character to doc:', error);
    }
  }

  async addEventToDocCard(docId: number, eventId: number) {
    try {
      await this.projectService.attachEventToDoc(docId, eventId);
      // Update cache
      const current = this.projectHeaderDocEventsCache.get(docId) || [];
      this.projectHeaderDocEventsCache.set(docId, [...current, eventId]);
      
      // Update sidebar if this is the selected doc
      if (this.selectedDoc && this.selectedDoc.id === docId) {
        this.docEventIds = new Set([...this.docEventIds, eventId]);
      }
      this.changeDetector.markForCheck();
    } catch (error) {
      console.error('Failed to add event to doc:', error);
    }
  }

  async addPlaceToDocCard(docId: number, placeId: number) {
    try {
      await this.projectService.attachPlaceToDoc(docId, placeId);
      // Update cache
      const current = this.projectHeaderDocPlacesCache.get(docId) || [];
      this.projectHeaderDocPlacesCache.set(docId, [...current, placeId]);
      
      // Update sidebar if this is the selected doc
      if (this.selectedDoc && this.selectedDoc.id === docId) {
        this.docPlaceIds = new Set([...this.docPlaceIds, placeId]);
      }
      this.changeDetector.markForCheck();
    } catch (error) {
      console.error('Failed to add place to doc:', error);
    }
  }

  // Create new item and add to doc from dropdown
  async createAndAddCharacterToDoc(docId: number, name: string) {
    if (!name.trim()) return;
    try {
      const created = await this.projectService.createCharacter(this.projectId, name.trim(), '');
      this.characters = [...this.characters, created as Character];
      // Also attach to doc
      await this.projectService.attachCharacterToDoc(docId, created.id);
      const current = this.projectHeaderDocCharactersCache.get(docId) || [];
      this.projectHeaderDocCharactersCache.set(docId, [...current, created.id]);
      
      // Update sidebar if this is the selected doc
      if (this.selectedDoc && this.selectedDoc.id === docId) {
        this.docCharacterIds = new Set([...this.docCharacterIds, created.id]);
      }
      this.changeDetector.markForCheck();
    } catch (error) {
      console.error('Failed to create character:', error);
    }
  }

  async createAndAddEventToDoc(docId: number, name: string) {
    if (!name.trim()) return;
    try {
      const created = await this.projectService.createEvent(this.projectId, name.trim(), '');
      this.events = [...this.events, created as Event];
      // Also attach to doc
      await this.projectService.attachEventToDoc(docId, created.id);
      const current = this.projectHeaderDocEventsCache.get(docId) || [];
      this.projectHeaderDocEventsCache.set(docId, [...current, created.id]);
      
      // Update sidebar if this is the selected doc
      if (this.selectedDoc && this.selectedDoc.id === docId) {
        this.docEventIds = new Set([...this.docEventIds, created.id]);
      }
      this.changeDetector.markForCheck();
    } catch (error) {
      console.error('Failed to create event:', error);
    }
  }

  async createAndAddPlaceToDoc(docId: number, name: string) {
    if (!name.trim()) return;
    try {
      const created = await this.projectService.createPlace(this.projectId, name.trim(), '');
      this.places = [...this.places, created as any];
      // Also attach to doc
      await this.projectService.attachPlaceToDoc(docId, created.id);
      const current = this.projectHeaderDocPlacesCache.get(docId) || [];
      this.projectHeaderDocPlacesCache.set(docId, [...current, created.id]);
      
      // Update sidebar if this is the selected doc
      if (this.selectedDoc && this.selectedDoc.id === docId) {
        this.docPlaceIds = new Set([...this.docPlaceIds, created.id]);
      }
      this.changeDetector.markForCheck();
    } catch (error) {
      console.error('Failed to create place:', error);
    }
  }

  // Remove item from doc metadata
  async removeCharacterFromDocCard(docId: number, characterId: number, event?: MouseEvent) {
    if (event) event.stopPropagation();
    try {
      await this.projectService.detachCharacterFromDoc(docId, characterId);
      const current = this.projectHeaderDocCharactersCache.get(docId) || [];
      this.projectHeaderDocCharactersCache.set(docId, current.filter(id => id !== characterId));
      
      // Update sidebar if this is the selected doc
      if (this.selectedDoc && this.selectedDoc.id === docId) {
        this.docCharacterIds.delete(characterId);
        this.docCharacterIds = new Set(this.docCharacterIds);
      }
      this.changeDetector.markForCheck();
    } catch (error) {
      console.error('Failed to remove character from doc:', error);
    }
  }

  async removeEventFromDocCard(docId: number, eventId: number, event?: MouseEvent) {
    if (event) event.stopPropagation();
    try {
      await this.projectService.detachEventFromDoc(docId, eventId);
      const current = this.projectHeaderDocEventsCache.get(docId) || [];
      this.projectHeaderDocEventsCache.set(docId, current.filter(id => id !== eventId));
      
      // Update sidebar if this is the selected doc
      if (this.selectedDoc && this.selectedDoc.id === docId) {
        this.docEventIds.delete(eventId);
        this.docEventIds = new Set(this.docEventIds);
      }
      this.changeDetector.markForCheck();
    } catch (error) {
      console.error('Failed to remove event from doc:', error);
    }
  }

  async removePlaceFromDocCard(docId: number, placeId: number, event?: MouseEvent) {
    if (event) event.stopPropagation();
    try {
      await this.projectService.detachPlaceFromDoc(docId, placeId);
      const current = this.projectHeaderDocPlacesCache.get(docId) || [];
      this.projectHeaderDocPlacesCache.set(docId, current.filter(id => id !== placeId));
      
      // Update sidebar if this is the selected doc
      if (this.selectedDoc && this.selectedDoc.id === docId) {
        this.docPlaceIds.delete(placeId);
        this.docPlaceIds = new Set(this.docPlaceIds);
      }
      this.changeDetector.markForCheck();
    } catch (error) {
      console.error('Failed to remove place from doc:', error);
    }
  }

  // Reorder handlers for doc card metadata
  reorderDocCardCharacters(docId: number, orderIds: number[]): void {
    this.projectHeaderDocCharactersCache.set(docId, orderIds);
    this.changeDetector.markForCheck();
  }

  reorderDocCardEvents(docId: number, orderIds: number[]): void {
    this.projectHeaderDocEventsCache.set(docId, orderIds);
    this.changeDetector.markForCheck();
  }

  reorderDocCardPlaces(docId: number, orderIds: number[]): void {
    this.projectHeaderDocPlacesCache.set(docId, orderIds);
    this.changeDetector.markForCheck();
  }

  // Toggle folder header expansion (show/hide folder notes editor)
  onFolderHeaderClick(event: MouseEvent) {
    if (this.isInteractiveHeaderClick(event)) return;
    this.folderHeaderExpanded = !this.folderHeaderExpanded;
    console.log('[DEBUG] onFolderHeaderClick - expanded:', this.folderHeaderExpanded, 'selectedGroup:', this.selectedGroup?.id, 'currentGroup:', this.currentGroup?.id);
    
    // Load drafts when expanding the header
    if (this.folderHeaderExpanded) {
      const group = this.selectedGroup || this.currentGroup;
      console.log('[DEBUG] onFolderHeaderClick - will load drafts for group:', group?.id, group?.name);
      if (group) {
        this.loadFolderDrafts(group.id);
      }
    }
  }

  onDraftFocus(draftId: number) {
    console.log('[DEBUG] onDraftFocus called with draftId:', draftId);
    this.focusedFolderDraftId = draftId;
    
    // Also mark this draft as selected and persist to localStorage
    this.selectedFolderDraftId = draftId;
    const group = this.selectedGroup || this.currentGroup;
    console.log('[DEBUG] onDraftFocus - group:', group?.id, group?.name);
    if (group) {
      try {
        const key = this.getFolderDraftSelectionKey(group.id);
        console.log('[DEBUG] onDraftFocus - saving to localStorage, key:', key, 'value:', draftId);
        localStorage.setItem(key, String(draftId));
        // Verify it was saved
        const saved = localStorage.getItem(key);
        console.log('[DEBUG] onDraftFocus - verified localStorage value:', saved);
      } catch (e) {
        console.error('[DEBUG] onDraftFocus - localStorage error:', e);
      }
    } else {
      console.warn('[DEBUG] onDraftFocus - no group found, cannot save selection!');
    }
    
    console.log('focusedFolderDraftId set to:', this.focusedFolderDraftId);
    console.log('Delete button should now be visible. Checking...');
    this.changeDetector.detectChanges();
    setTimeout(() => {
      const deleteBtn = document.querySelector('.delete-draft-btn');
      console.log('Delete button exists in DOM:', !!deleteBtn);
      if (deleteBtn) {
        console.log('Delete button is:', deleteBtn);
      }
    }, 100);
  }

  onDeleteDraftClick(event: MouseEvent) {
    console.log('Delete button clicked!');
    console.log('focusedFolderDraftId:', this.focusedFolderDraftId);
    event.stopPropagation();
    event.preventDefault();
    
    if (this.focusedFolderDraftId !== null) {
      console.log('Calling deleteFolderDraft with id:', this.focusedFolderDraftId);
      this.deleteFolderDraft(this.focusedFolderDraftId);
    } else {
      console.log('No focused draft to delete!');
    }
  }

  // Guard: avoid toggling when clicking inputs/buttons/controls inside header rows
  private isInteractiveHeaderClick(event: MouseEvent): boolean {
    const el = event.target as HTMLElement | null;
    if (!el) return false;
    const interactiveSelector = 'input, textarea, button, .drafts-row, .draft-add-btn, .drafts-toggle, .draft-delete-btn, .delete-draft-btn, .create-draft-btn, .draft-name-input, .project-name-input, .folder-name-input, a, [role="button"]';
    return !!el.closest(interactiveSelector);
  }

  // Two-way proxy for folder notes binding regardless of selected vs current group
  get folderNotes(): string {
    const g: any = this.selectedGroup || this.currentGroup;
    return (g?.notes ?? '') as string;
  }
  set folderNotes(val: string) {
    const g: any = this.selectedGroup || this.currentGroup;
    if (g) g.notes = val;
  }

  // Folder name editing
  startEditFolderName(event?: MouseEvent) {
    if (event) event.stopPropagation();
    const group = this.selectedGroup || this.currentGroup;
    if (!group) return;
    this.editingFolderName = true;
    this.folderNameEdit = group.name || '';
    setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>('input.folder-name-input');
      if (el) { el.focus(); el.select(); }
    }, 0);
  }

  async saveFolderName() {
    if (!this.editingFolderName) return;
    const group = this.selectedGroup || this.currentGroup;
    if (!group) { this.editingFolderName = false; return; }
    const newName = (this.folderNameEdit || '').trim();
    this.editingFolderName = false;
    if (!newName || newName === group.name) {
      this.folderNameEdit = group.name || '';
      return;
    }
    try {
      await this.projectService.renameDocGroup(group.id, newName);
      // Update local state
      const found = this.findGroupById(this.docGroups, group.id);
      if (found) found.name = newName;
      if (this.selectedGroup && this.selectedGroup.id === group.id) this.selectedGroup.name = newName;
      if (this.currentGroup && this.currentGroup.id === group.id) this.currentGroup.name = newName;
      this.folderNameEdit = newName;
      // Optional: reload tree to keep ordering stable
      await this.loadProject(true);
    } catch (error) {
      console.error('Failed to rename folder:', error);
      alert('Failed to rename folder: ' + error);
      // revert input
      this.folderNameEdit = group.name || '';
    }
  }

  onFolderNameKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.saveFolderName();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.editingFolderName = false;
      const group = this.selectedGroup || this.currentGroup;
      this.folderNameEdit = group?.name || '';
    }
  }

  async saveProjectName() {
    const newName = (this.projectNameEdit || '').trim();
    if (!this.editingProjectName) return;
    this.editingProjectName = false;
    if (!newName || newName === this.projectName) {
      // No change or empty -> revert to previous
      this.projectNameEdit = this.projectName;
      return;
    }
    try {
      const updated = await this.projectService.updateProject(this.projectId, { name: newName });
      // Prefer backend response if present; else fallback to requested name
      this.projectName = (updated as any)?.name ?? newName;
      this.projectNameEdit = this.projectName;
    } catch (error) {
      console.error('Failed to rename project:', error);
      alert('Failed to rename project: ' + error);
      // Revert UI value
      this.projectNameEdit = this.projectName;
    }
  }

  onProjectNameKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.saveProjectName();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.editingProjectName = false;
      this.projectNameEdit = this.projectName;
    }
  }

  ngOnInit() {
    this.route.params.subscribe((params: any) => {
      this.projectId = +params['id'];
      this.loadProject();
    });
    
    this.loadLayoutState();
  }

  ngOnDestroy() {
    // Clean up timers
    if (this.saveStatusTimeout) {
      clearTimeout(this.saveStatusTimeout);
    }
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }
    if (this.autoSaveNotesTimeout) {
      clearTimeout(this.autoSaveNotesTimeout);
    }
  }

  // ========= Import .txt files =========
  async onImportRequested() {
    try {
      // Step 1: always allow selecting folders (import to root-level groups)
      const folderSelection = await open({
        multiple: true,
        directory: true,
        title: 'Select folder(s) to import'
      });
      const folders = folderSelection ? (Array.isArray(folderSelection) ? folderSelection : [folderSelection]) : [];

      // Step 2: optional additional files import
      const fileSelection = await open({
        multiple: true,
        directory: false,
        filters: [{ name: 'Text Files', extensions: ['txt'] }],
        title: 'Select .txt files to also import (optional)'
      });
      const files = fileSelection ? (Array.isArray(fileSelection) ? fileSelection : [fileSelection]) : [];

      if (folders.length === 0 && files.length === 0) return;

      if (files.length === 0) {
        // Only folders -> import immediately to root (backend ignores group id for folders)
        await this.projectService.importTxtFiles(this.projectId, -1, folders as string[]);
        await this.loadProject(true);
        setTimeout(() => this.focusTree(), 0);
        return;
      }

      // If files exist and there are no groups yet, create default one
      if (this.docGroups.length === 0) {
        const group = await this.projectService.createDocGroup(this.projectId, 'Imported', null);
        this.pendingImportFolders = folders as string[];
        this.pendingImportFiles = files as string[];
        await this.performImport([...this.pendingImportFolders, ...this.pendingImportFiles], group.id);
        this.pendingImportFolders = [];
        this.pendingImportFiles = [];
        return;
      }

      // Store selections; ask for destination only for files
      this.pendingImportFolders = folders as string[];
      this.pendingImportFiles = files as string[];
      this.flattenedGroups = this.flattenGroupsForSelect(this.docGroups);
      this.importTargetGroupId = this.selectedGroup?.id ?? (this.flattenedGroups[0]?.id ?? null);
      this.showImportDialog = true;
    } catch (err) {
      console.error('Failed to select files for import:', err);
    }
  }

  // Import Folders: create root-level groups, no prompts
  async onImportFoldersRequested() {
    try {
      const folderSelection = await open({ multiple: true, directory: true, title: 'Select folder(s) to import' });
      const folders = folderSelection ? (Array.isArray(folderSelection) ? folderSelection : [folderSelection]) : [];
      if (folders.length === 0) return;
      await this.projectService.importTxtFiles(this.projectId, -1, folders as string[]);
      await this.loadProject(true);
      setTimeout(() => this.focusTree(), 0);
    } catch (err) {
      console.error('Failed to import folders:', err);
      alert('Failed to import folders: ' + err);
    }
  }

  // Import Files: ask for destination folder
  async onImportFilesRequested() {
    try {
      const fileSelection = await open({ multiple: true, directory: false, filters: [{ name: 'Text Files', extensions: ['txt'] }], title: 'Select .txt files to import' });
      const files = fileSelection ? (Array.isArray(fileSelection) ? fileSelection : [fileSelection]) : [];
      if (files.length === 0) return;

      // If no folders exist, create default and import directly
      if (this.docGroups.length === 0) {
        const group = await this.projectService.createDocGroup(this.projectId, 'Imported', null);
        await this.performImport(files as string[], group.id);
        return;
      }

      // Otherwise show destination picker modal
      this.pendingImportFolders = [];
      this.pendingImportFiles = files as string[];
      this.flattenedGroups = this.flattenGroupsForSelect(this.docGroups);
      this.importTargetGroupId = this.selectedGroup?.id ?? (this.flattenedGroups[0]?.id ?? null);
      this.showImportDialog = true;
    } catch (err) {
      console.error('Failed to import files:', err);
      alert('Failed to import files: ' + err);
    }
  }

  cancelImport() {
    this.showImportDialog = false;
    this.pendingImportFiles = [];
    this.pendingImportFolders = [];
    this.importTargetGroupId = null;
  }

  async confirmImport() {
    if (!this.importTargetGroupId || this.pendingImportFiles.length === 0) return;
  const files = [...this.pendingImportFolders, ...this.pendingImportFiles];
    const groupId = Number(this.importTargetGroupId);
    this.cancelImport();
    await this.performImport(files, groupId);
  }

  private async performImport(files: string[], groupId: number) {
    try {
      await this.projectService.importTxtFiles(this.projectId, groupId, files);
      await this.loadProject(true);
      const group = this.findGroupById(this.docGroups, groupId);
      if (group) this.selectGroup(group);
      setTimeout(() => this.focusTree(), 0);
    } catch (error) {
      console.error('Import failed:', error);
      alert('Failed to import files: ' + error);
    }
  }

  private flattenGroupsForSelect(groups: DocGroup[], depth = 0): Array<{ id: number; label: string }> {
    const items: Array<{ id: number; label: string }> = [];
    for (const g of groups) {
      const prefix = depth > 0 ? '—'.repeat(depth) + ' ' : '';
      items.push({ id: g.id, label: `${prefix}${g.name}` });
      if (g.groups && g.groups.length) {
        items.push(...this.flattenGroupsForSelect(g.groups, depth + 1));
      }
    }
    return items;
  }

  async loadProject(preserveSelection: boolean = false, skipRestore: boolean = false) {
    try {
      // Save current selection if we want to preserve it
      const currentDocId = preserveSelection ? this.selectedDoc?.id : null;
      const currentGroupId = preserveSelection ? this.selectedGroup?.id : null;

      // Load project details
      const project = await this.projectService.getProject(this.projectId);
      if (project) {
        this.projectName = project.name;
        this.projectData = project;
      }
      
      // Load project timeline for parent component (needed for doc timeline click calculations)
      const projectTimeline = await this.timelineService.getTimelineByEntity('project', this.projectId);
      if (projectTimeline) {
        this.timelineStart = projectTimeline.start_date ?? null;
        this.timelineEnd = projectTimeline.end_date ?? null;
      }

      // Load doc groups and docs from backend
      const [groups, docs] = await Promise.all([
        this.projectService.listDocGroups(this.projectId),
        this.projectService.listDocs(this.projectId)
      ]);

      // Store all docs for stats calculation
      this.allProjectDocs = docs;

      // Restore tree expansion state before building the tree
      this.restoreTreeState();

      // Build hierarchical structure
      this.docGroups = this.buildDocGroupTree(groups, docs);
  // Populate draft markers in the background
  this.populateInitialDraftMarkers(groups, docs).catch(err => console.warn('populateInitialDraftMarkers failed', err));

  // Load characters, events, and places
  await Promise.all([this.loadCharacters(), this.loadEvents(), this.loadPlaces()]);

      // Restore draft tool expansion states from localStorage
      try {
        const projDraftsExpanded = localStorage.getItem(this.getProjectDraftsExpandedKey(this.projectId));
        if (projDraftsExpanded != null) {
          this.projectDraftsExpanded = projDraftsExpanded === 'true';
          if (this.projectDraftsExpanded) {
            // Preload project drafts and optionally restore selection
            await this.loadProjectDrafts(this.projectId, /*restoreSelection*/ true);
          } else {
            // Ensure we still have the count when collapsed
            await this.refreshProjectDraftsCount();
          }
        }
      } catch {}

      try {
        const folderExpanded = localStorage.getItem(this.getFolderDraftsExpandedKey(this.projectId));
        if (folderExpanded != null) {
          this.folderDraftsExpanded = folderExpanded === 'true';
          // Actual loading of folder drafts is tied to group selection; will load on selectGroup()
        }
      } catch {}

      // Skip restoration if requested (e.g., when creating new doc and managing selection manually)
      if (skipRestore) {
        return;
      }

      // Restore selection
      if (preserveSelection && (currentDocId || currentGroupId)) {
        // Restore the previous selection
        if (currentDocId) {
          const doc = this.findDocById(currentDocId);
          if (doc) {
            this.selectDoc(doc);
            return;
          }
        }
        if (currentGroupId) {
          const group = this.findGroupById(this.docGroups, currentGroupId);
          if (group) {
            this.selectGroup(group);
            return;
          }
        }
      }

      // Otherwise restore from localStorage or select first item
      this.restoreSelection();
    } catch (error) {
      console.error('Failed to load project:', error);
    }
  }

  private buildDocGroupTree(groups: any[], docs: Doc[]): DocGroup[] {
    // Create a map of groups by ID
    const groupMap = new Map<number, DocGroup>();
    
    // Initialize all groups and restore expanded state
    groups.forEach(g => {
      groupMap.set(g.id, {
        ...g,
        expanded: this.expandedGroupIds.has(g.id),
        docs: [],
        groups: []
      });
    });
    
    // Assign docs to their groups (ignore root-level docs)
    docs.forEach(doc => {
      if (doc.doc_group_id) {
        const group = groupMap.get(doc.doc_group_id);
        if (group) {
          group.docs.push(doc);
        }
      }
      // Ignore docs without a group - we don't support root-level docs
    });

    // Build hierarchy: find root groups and assign children
    const rootGroups: DocGroup[] = [];
    
    groups.forEach(g => {
      const group = groupMap.get(g.id);
      if (!group) return;

      if (g.parent_id === null || g.parent_id === undefined) {
        // Root level group
        rootGroups.push(group);
      } else {
        // Child group - add to parent's groups array
        const parent = groupMap.get(g.parent_id);
        if (parent) {
          if (!parent.groups) parent.groups = [];
          parent.groups.push(group);
        }
      }
    });

    return rootGroups;
  }

  private findFirstDoc(groups: DocGroup[]): Doc | null {
    for (const group of groups) {
      if (group.docs.length > 0) {
        return group.docs[0];
      }
      if (group.groups && group.groups.length > 0) {
        const doc = this.findFirstDoc(group.groups);
        if (doc) return doc;
      }
    }
    return null;
  }

  toggleGroup(group: DocGroup) {
    group.expanded = !group.expanded;
    if (group.expanded) {
      this.expandedGroupIds.add(group.id);
    } else {
      this.expandedGroupIds.delete(group.id);
    }
    // Save tree state when toggling
    this.saveTreeState();
  }

  async selectDoc(doc: Doc) {
    // First, save any unsaved changes from the previous doc to cache
    if (this.selectedDoc) {
      this.docStateCache.set(this.selectedDoc.id, {
        text: this.selectedDoc.text,
        notes: this.selectedDoc.notes
      });
    }

    // Fetch fresh doc data to ensure we have the latest notes
    try {
      const freshDoc = await this.projectService.getDoc(doc.id);
      if (freshDoc) {
        this.selectedDoc = freshDoc;
        // Also update the doc in the docGroups tree so it stays in sync
        this.updateDocInTree(freshDoc);
      } else {
        this.selectedDoc = doc;
      }
    } catch (error) {
      console.error('Failed to fetch fresh doc data:', error);
      this.selectedDoc = doc;
    }

    // Restore any cached state for this doc (in case it was edited but not saved yet)
    const cachedState = this.docStateCache.get(this.selectedDoc.id);
    if (cachedState) {
      if (cachedState.text !== undefined) {
        this.selectedDoc.text = cachedState.text;
      }
      if (cachedState.notes !== undefined) {
        this.selectedDoc.notes = cachedState.notes;
      }
    }
    
    this.selectedGroup = null; // Clear group selection - only ONE selection at a time
    
    // Track parent group for create button context
    if (this.selectedDoc.doc_group_id) {
      this.currentGroup = this.findGroupById(this.docGroups, this.selectedDoc.doc_group_id) || null;
    } else {
      this.currentGroup = null;
    }
    
  // Load drafts for this document
    this.selectedDraftId = null; // reset draft selection when switching docs
    await this.loadDrafts(this.selectedDoc.id);
  // Load characters attached to this doc
  await this.loadDocCharacters(this.selectedDoc.id);
  // Load events attached to this doc
  await this.loadDocEvents(this.selectedDoc.id);
  // Load places attached to this doc
  await this.loadDocPlaces(this.selectedDoc.id);
  
  // Load parent folder characters, events, and places for Folder tab
  if (this.currentGroup) {
    await this.loadDocGroupCharacters(this.currentGroup.id);
    await this.loadDocGroupEvents(this.currentGroup.id);
    await this.loadDocGroupPlaces(this.currentGroup.id);
    // Load folder drafts if the folder header is expanded (visible in main editor area)
    if (this.folderHeaderExpanded) {
      // Clear previous folder draft selection when switching folders
      this.selectedFolderDraftId = null;
      await this.loadFolderDrafts(this.currentGroup.id, /*restoreSelection*/ true);
    } else {
      // If folder drafts panel is collapsed, ensure counts are available for toggler
      this.refreshFolderDraftsCount(this.currentGroup.id);
    }
  } else {
    this.docGroupCharacterIds = new Set();
    this.docGroupEventIds = new Set();
    // Clear folder drafts when no parent group
    this.folderDrafts = [];
    this.folderDraftsCount = 0;
    this.selectedFolderDraftId = null;
  }
    
    // Save selection to localStorage
    this.saveSelection();
  }

  private updateDocInTree(updatedDoc: Doc) {
    // Find and update the doc in the docGroups tree
    const updateInGroups = (groups: DocGroup[]): boolean => {
      for (const group of groups) {
        const docIndex = group.docs.findIndex(d => d.id === updatedDoc.id);
        if (docIndex !== -1) {
          group.docs[docIndex] = { ...group.docs[docIndex], ...updatedDoc };
          return true;
        }
        if (group.groups && updateInGroups(group.groups)) {
          return true;
        }
      }
      return false;
    };
    updateInGroups(this.docGroups);
  }


  selectGroup(group: DocGroup, event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    const isSame = this.selectedGroup?.id === group.id;
    if (isSame) {
      // Toggle expand/collapse when clicking the already selected folder
      group.expanded = !group.expanded;
      if (group.expanded) {
        this.expandedGroupIds.add(group.id);
      } else {
        this.expandedGroupIds.delete(group.id);
      }
      this.saveTreeState();
      // Keep current selection persisted
      this.saveSelection();
      return;
    }

    // Select new group
    this.selectedGroup = group;
    this.selectedDoc = null; // Clear doc selection - only ONE selection at a time
    this.currentGroup = group; // Track group for create button context
    // Auto-expand on first selection
    if (!group.expanded) {
      group.expanded = true;
      this.expandedGroupIds.add(group.id);
      this.saveTreeState();
    }

    // Save selection to localStorage
    this.saveSelection();
    // Clear doc-specific character selection when no doc is selected
    this.docCharacterIds = new Set();
    this.docEventIds = new Set();

    // Load doc group characters and events
    this.loadDocGroupCharacters(group.id);
    this.loadDocGroupEvents(group.id);

    // Load folder drafts if the drafts panel is expanded; else refresh count
    if (this.folderDraftsExpanded) {
      this.loadFolderDrafts(group.id);
    } else {
      this.refreshFolderDraftsCount(group.id);
    }
  }

  private saveSelection() {
    const selection = {
      projectId: this.projectId,
      docId: this.selectedDoc?.id || null,
      groupId: this.selectedGroup?.id || null
    };
    localStorage.setItem(`project_${this.projectId}_selection`, JSON.stringify(selection));
  }

  private saveTreeState() {
    const treeState = {
      projectId: this.projectId,
      expandedGroupIds: Array.from(this.expandedGroupIds)
    };
    localStorage.setItem(`project_${this.projectId}_tree_state`, JSON.stringify(treeState));
  }

  private restoreTreeState() {
    try {
      const saved = localStorage.getItem(`project_${this.projectId}_tree_state`);
      if (saved) {
        const treeState = JSON.parse(saved);
        this.expandedGroupIds = new Set(treeState.expandedGroupIds);
      }
    } catch (error) {
      console.error('Failed to restore tree state:', error);
      this.expandedGroupIds = new Set();
    }
  }

  async onExportProjectRequested() {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select destination folder for export'
      });
      if (!selected || Array.isArray(selected)) return;
      await this.projectService.exportProject(this.projectId, selected as string);
      alert('Project exported successfully');
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed: ' + err);
    }
  }

  private restoreSelection() {
    try {
      const saved = localStorage.getItem(`project_${this.projectId}_selection`);
      if (saved) {
        const selection = JSON.parse(saved);
        
        // Try to restore saved selection
        if (selection.docId) {
          const doc = this.findDocById(selection.docId);
          if (doc) {
            this.selectDoc(doc);
            // Focus tree so keyboard navigation works immediately
            setTimeout(() => this.focusTree(), 0);
            return;
          }
        }
        
        if (selection.groupId) {
          const group = this.findGroupById(this.docGroups, selection.groupId);
          if (group) {
            this.selectGroup(group);
            // Focus tree so keyboard navigation works immediately
            setTimeout(() => this.focusTree(), 0);
            return;
          }
        }
      }
    } catch (error) {
      console.error('Failed to restore selection:', error);
    }
    
    // Fallback: select first item
    this.selectFirstItem();
  }

  private selectFirstItem() {
    // Try to select first doc
    const firstDoc = this.findFirstDoc(this.docGroups);
    if (firstDoc) {
      this.selectDoc(firstDoc);
      // Focus tree so keyboard navigation works immediately
      setTimeout(() => this.focusTree(), 0);
      return;
    }
    
    // If no docs, select first group
    if (this.docGroups.length > 0) {
      this.selectGroup(this.docGroups[0]);
      // Focus tree so keyboard navigation works immediately
      setTimeout(() => this.focusTree(), 0);
    }
  }

  private findDocById(docId: number): Doc | null {
    const searchInGroups = (groups: DocGroup[]): Doc | null => {
      for (const group of groups) {
        // Search in group's docs
        const doc = group.docs.find(d => d.id === docId);
        if (doc) return doc;
        
        // Search in nested groups
        if (group.groups) {
          const found = searchInGroups(group.groups);
          if (found) return found;
        }
      }
      return null;
    };
    
    return searchInGroups(this.docGroups);
  }

  getAllDocs(): Doc[] {
    const allDocs: Doc[] = [];
    const collectDocs = (groups: DocGroup[]): void => {
      for (const group of groups) {
        allDocs.push(...group.docs);
        if (group.groups) {
          collectDocs(group.groups);
        }
      }
    };
    collectDocs(this.docGroups);
    return allDocs;
  }

  private findGroupById(groups: DocGroup[], id: number): DocGroup | null {
    for (const group of groups) {
      if (group.id === id) return group;
      if (group.groups && group.groups.length > 0) {
        const found = this.findGroupById(group.groups, id);
        if (found) return found;
      }
    }
    return null;
  }

  handleKeyDown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    
    // ESC always focuses the tree
    if (event.key === 'Escape') {
      event.preventDefault();

      // If headers overlay is visible, hide it
      if (this.headersHoverVisible) {
        this.headersHoverVisible = false;
        return;
      }

      this.focusTree();
      return;
    }

    // Cmd+S to save (works in textarea or anywhere)
    // Use event.code to support different keyboard layouts
    if ((event.key === 'S' || event.key === 's' || event.code === 'KeyS') && event.metaKey) {
      event.preventDefault();
      this.saveDoc();
      return;
    }

    // Cmd+1 to toggle left sidebar (tree)
    if ((event.key === '1' || event.code === 'Digit1') && event.metaKey) {
      event.preventDefault();
      this.toggleLeftSidebar();
      return;
    }

    // Cmd+2 to toggle both sidebars (full width)
    if ((event.key === '2' || event.code === 'Digit2') && event.metaKey) {
      event.preventDefault();
      this.toggleBothSidebars();
      return;
    }

    // Cmd+3 to toggle right sidebar
    if ((event.key === '3' || event.code === 'Digit3') && event.metaKey) {
      event.preventDefault();
      this.toggleRightSidebar();
      return;
    }

    // Cmd+Shift+N to create new folder (check both key and code for layout support)
    if ((event.key === 'N' || event.key === 'n' || event.code === 'KeyN') && event.metaKey && event.shiftKey) {
      event.preventDefault();
      this.createGroup();
      return;
    }

    // Cmd+N to create new document (without shift)
    if ((event.key === 'N' || event.key === 'n' || event.code === 'KeyN') && event.metaKey && !event.shiftKey) {
      event.preventDefault();
      if (this.currentGroup) {
        this.createDocInGroup(this.currentGroup);
      } else {
        this.createDoc();
      }
      return;
    }

    // Only handle delete key in tree context (not in textarea or input)
    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
      return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      if (this.selectedDoc) {
        this.deleteDoc(this.selectedDoc);
      } else if (this.selectedGroup) {
        this.deleteGroup(this.selectedGroup);
      }
    }
  }

  // Called from footer delete button
  deleteSelectedItem() {
    if (this.selectedDoc) {
      this.deleteDoc(this.selectedDoc);
    } else if (this.selectedGroup) {
      this.deleteGroup(this.selectedGroup);
    }
  }

  async deleteDoc(doc: Doc) {
    console.log('deleteDoc called for:', doc.name);
    this.isDeletingItem = true;
    const confirmed = await confirm(`Delete "${doc.name}"?`, { title: 'Confirm Delete', kind: 'warning' });
    console.log('Confirmation result:', confirmed);
    if (!confirmed) {
      console.log('Delete cancelled by user');
      this.isDeletingItem = false;
      return;
    }

    console.log('Proceeding with deletion');
    try {
      // Preferred: keep selection inside the same folder
      // Determine parent group and choose next doc in that group (or first),
      // if none left then select the group itself
      let selectDocId: number | null = null;
      let selectGroupId: number | null = null;

      const parentGroup = doc.doc_group_id ? this.findGroupById(this.docGroups, doc.doc_group_id) : null;
      if (parentGroup) {
        const docsInGroup = parentGroup.docs;
        const idx = docsInGroup.findIndex(d => d.id === doc.id);
        if (docsInGroup.length > 1) {
          const nextIndex = idx + 1 < docsInGroup.length ? idx + 1 : 0;
          selectDocId = docsInGroup[nextIndex].id;
        } else {
          // No other docs will remain, select the group after deletion
          selectGroupId = parentGroup.id;
        }
      } else {
        // Fallback to previous global behavior if no parent group (shouldn't happen normally)
        const items = this.getFlatTreeItems();
        const currentIndex = items.findIndex(item => item.type === 'doc' && item.data.id === doc.id);
        if (currentIndex > 0) {
          const prev = items[currentIndex - 1];
          if (prev.type === 'doc') selectDocId = prev.data.id; else selectGroupId = prev.data.id;
        } else if (currentIndex < items.length - 1) {
          const next = items[currentIndex + 1];
          if (next.type === 'doc') selectDocId = next.data.id; else selectGroupId = next.data.id;
        }
      }

      console.log('Calling backend deleteDoc');
      await this.projectService.deleteDoc(doc.id);
      console.log('Backend deletion complete');
      
      // Clear current selection
      this.selectedDoc = null;
      this.selectedGroup = null;
      this.currentGroup = null;
  this.selectedDraftId = null;
      
  // Reload tree but do NOT auto-restore selection; we'll set it manually
  await this.loadProject(false, true);
      
      // Restore selection within the same folder
      if (selectDocId) {
        const foundDoc = this.findDocById(selectDocId);
        if (foundDoc) {
          this.selectDoc(foundDoc);
        }
      } else if (selectGroupId) {
        const foundGroup = this.findGroupById(this.docGroups, selectGroupId);
        if (foundGroup) {
          this.selectGroup(foundGroup);
        }
      }
      
      // Keep focus on tree
      setTimeout(() => this.focusTree(), 0);
    } catch (error) {
      console.error('Failed to delete doc:', error);
      alert('Failed to delete document: ' + error);
    } finally {
      this.isDeletingItem = false;
    }
  }

  async deleteGroup(group: DocGroup) {
    this.isDeletingItem = true;
    const confirmed = await confirm(`Delete folder "${group.name}" and all its contents?`, { title: 'Confirm Delete', kind: 'warning' });
    if (!confirmed) {
      console.log('Delete cancelled');
      this.isDeletingItem = false;
      return;
    }

    try {
      // Find item to select after deletion (previous or next)
      const items = this.getFlatTreeItems();
      const currentIndex = items.findIndex(item => item.type === 'group' && item.data.id === group.id);
      let newSelection: {type: 'group' | 'doc', data: any} | null = null;
      
      if (currentIndex > 0) {
        // Select previous item
        newSelection = items[currentIndex - 1];
      } else if (currentIndex < items.length - 1) {
        // Select next item
        newSelection = items[currentIndex + 1];
      }

      await this.projectService.deleteDocGroup(group.id);
      
      // Clear current selection
      this.selectedGroup = null;
      this.selectedDoc = null;
      this.currentGroup = null;
  this.selectedDraftId = null;
      
      await this.loadProject();
      
      // Restore selection to previous/next item
      if (newSelection) {
        if (newSelection.type === 'doc') {
          const foundDoc = this.findDocById(newSelection.data.id);
          if (foundDoc) {
            this.selectDoc(foundDoc);
          }
        } else {
          const foundGroup = this.findGroupById(this.docGroups, newSelection.data.id);
          if (foundGroup) {
            this.selectGroup(foundGroup);
          }
        }
      }
      
      // Keep focus on tree
      setTimeout(() => this.focusTree(), 0);
    } catch (error) {
      console.error('Failed to delete group:', error);
      alert('Failed to delete folder: ' + error);
    } finally {
      this.isDeletingItem = false;
    }
  }

  async renameGroup(group: DocGroup) {
    console.log('renameGroup called, isDeletingItem:', this.isDeletingItem);
    // Don't rename if we're in the middle of deleting
    if (this.isDeletingItem) {
      console.log('Skipping rename because isDeletingItem is true');
      return;
    }

    if (!group.name || !group.name.trim()) {
      group.name = 'New Folder';
    }
    
    try {
      await this.projectService.renameDocGroup(group.id, group.name!);
      console.log('Group renamed successfully');
      // Reload tree to reflect the new name, preserving current selection
      await this.loadProject(true);
    } catch (error) {
      console.error('Failed to rename group:', error);
      alert('Failed to rename folder: ' + error);
    }
  }

  async renameDoc(doc: Doc) {
    console.log('renameDoc called, isDeletingItem:', this.isDeletingItem);
    // Don't rename if we're in the middle of deleting
    if (this.isDeletingItem) {
      console.log('Skipping rename because isDeletingItem is true');
      return;
    }
    
    if (!doc.name || !doc.name.trim()) {
      doc.name = 'Untitled Document';
    }
    
    try {
      await this.projectService.renameDoc(doc.id, doc.name!);
      console.log('Doc renamed successfully');
      // Reload tree to reflect the new name, preserving current selection
      await this.loadProject(true);
    } catch (error) {
      console.error('Failed to rename doc:', error);
      alert('Failed to rename document: ' + error);
    }
  }

  focusEditor() {
    this.documentEditorComponent?.focusEditor();
  }

  focusTree() {
    this.docTreeComponent?.focusTree();
  }

  handleTreeKeyDown(event: KeyboardEvent) {
    // Reorder with Option/Alt + Arrow keys
    if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && event.altKey) {
      event.preventDefault();
      const direction = event.key === 'ArrowUp' ? 'up' : 'down';
      this.reorderSelected(direction);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.navigateTree('up');
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.navigateTree('down');
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.expandSelectedGroup();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.collapseSelectedGroup();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      // If a doc is selected, focus the editor
      if (this.selectedDoc) {
        this.focusEditor();
      } else if (this.selectedGroup) {
        // If a folder is selected, toggle expansion
        this.toggleGroup(this.selectedGroup);
      }
    } else if ((event.key === 'R' || event.code === 'KeyR') && event.shiftKey) {
      event.preventDefault();
      // Shift+R: Focus the name input for renaming (works with different keyboard layouts)
      if (this.selectedDoc) {
        // Focus the title input in the document editor (rename)
        setTimeout(() => {
          this.documentEditorComponent?.focusTitle();
        }, 0);
      } else if (this.selectedGroup) {
        // Focus the group name input for renaming
        setTimeout(() => {
          this.groupViewComponent?.focusName();
        }, 0);
      }
    }
  }

  private async reorderSelected(direction: 'up' | 'down') {
    try {
      if (this.selectedDoc) {
        const doc = this.selectedDoc;
        const group = doc.doc_group_id ? this.findGroupById(this.docGroups, doc.doc_group_id) : null;
        if (!group) return;

        const docIndex = group.docs.findIndex(d => d.id === doc.id);

        if (direction === 'up') {
          if (docIndex > 0) {
            // Normal reorder within the same group
            await this.projectService.reorderDoc(doc.id, 'up');
            await this.loadProject(true);
            return;
          } else {
            // At top of the group -> move to previous sibling group (end)
            const sib = this.findGroupSiblingsAndIndex(group.id);
            if (sib.siblings && sib.indexInSiblings > 0) {
              const prevGroup = sib.siblings[sib.indexInSiblings - 1];
              // Ensure target group is expanded
              await this.expandGroup(prevGroup.id);
              await this.projectService.moveDocToGroup(doc.id, prevGroup.id);
              await this.loadProject(true);
            }
            return;
          }
        } else {
          if (docIndex < group.docs.length - 1) {
            // Normal reorder within the same group
            await this.projectService.reorderDoc(doc.id, 'down');
            await this.loadProject(true);
            return;
          } else {
            // At bottom of the group -> move to next sibling group and place as FIRST
            const sib = this.findGroupSiblingsAndIndex(group.id);
            if (sib.siblings && sib.indexInSiblings < sib.siblings.length - 1) {
              const nextGroup = sib.siblings[sib.indexInSiblings + 1];
              // Ensure target group is expanded
              await this.expandGroup(nextGroup.id);
              // Compute how many docs are currently in target group; after move, item likely appended to end
              const docsBefore = nextGroup.docs.length;
              await this.projectService.moveDocToGroup(doc.id, nextGroup.id);
              // Move up 'docsBefore' times to get to index 0
              for (let i = 0; i < docsBefore; i++) {
                await this.projectService.reorderDoc(doc.id, 'up');
              }
              await this.loadProject(true);
            }
            return;
          }
        }
      }
      if (this.selectedGroup) {
        await this.projectService.reorderDocGroup(this.selectedGroup.id, direction);
        await this.loadProject(true);
        return;
      }
    } catch (error) {
      console.error('Failed to reorder item:', error);
    }
  }

  private findGroupSiblingsAndIndex(targetGroupId: number): { siblings: DocGroup[] | null; indexInSiblings: number } {
    const search = (groups: DocGroup[]): { siblings: DocGroup[] | null; indexInSiblings: number } | null => {
      const idx = groups.findIndex(g => g.id === targetGroupId);
      if (idx !== -1) return { siblings: groups, indexInSiblings: idx };
      for (const g of groups) {
        if (g.groups && g.groups.length > 0) {
          const found = search(g.groups);
          if (found) return found;
        }
      }
      return null;
    };
    return search(this.docGroups) ?? { siblings: null, indexInSiblings: -1 };
  }

  private navigateTree(direction: 'up' | 'down') {
    // Build a flat list of all visible items in order
    const items = this.getFlatTreeItems();
    if (items.length === 0) return;

    // Find current selection index
    let currentIndex = -1;
    if (this.selectedDoc) {
      currentIndex = items.findIndex(item => item.type === 'doc' && item.data.id === this.selectedDoc!.id);
    } else if (this.selectedGroup) {
      currentIndex = items.findIndex(item => item.type === 'group' && item.data.id === this.selectedGroup!.id);
    }

    // Calculate new index with cyclic behavior
    let newIndex: number;
    if (currentIndex === -1) {
      // Nothing selected
      if (direction === 'down') {
        // Select first item when pressing down with no selection
        newIndex = 0;
      } else {
        // Select last item when pressing up with no selection
        newIndex = items.length - 1;
      }
    } else if (direction === 'up') {
      // Cycle to bottom when going up from top
      newIndex = currentIndex === 0 ? items.length - 1 : currentIndex - 1;
    } else {
      // Cycle to top when going down from bottom
      newIndex = currentIndex === items.length - 1 ? 0 : currentIndex + 1;
    }

    // Select the new item
    const newItem = items[newIndex];
    if (newItem.type === 'doc') {
      this.selectDoc(newItem.data);
    } else {
      this.selectGroup(newItem.data);
    }
  }

  private getFlatTreeItems(): Array<{type: 'group' | 'doc', data: any}> {
    const items: Array<{type: 'group' | 'doc', data: any}> = [];
    
    const addGroup = (group: DocGroup) => {
      items.push({ type: 'group', data: group });
      
      if (group.expanded) {
        // Add nested groups first
        if (group.groups) {
          group.groups.forEach(subGroup => addGroup(subGroup));
        }
        
        // Then add docs
        group.docs.forEach(doc => {
          items.push({ type: 'doc', data: doc });
        });
      }
    };
    
    this.docGroups.forEach(group => addGroup(group));
    return items;
  }

  private expandSelectedGroup() {
    if (this.selectedGroup && !this.selectedGroup.expanded) {
      this.toggleGroup(this.selectedGroup);
    }
  }

  private collapseSelectedGroup() {
    if (this.selectedGroup && this.selectedGroup.expanded) {
      this.toggleGroup(this.selectedGroup);
    } else if (this.selectedDoc && this.currentGroup) {
      // If a doc is selected, collapse means select its parent folder
      this.selectGroup(this.currentGroup);
    }
  }

  async saveDoc() {
    if (!this.selectedDoc) return;

    try {
      const text = this.selectedDoc.text || '';
      await this.projectService.updateDocText(this.selectedDoc.id, text);
      console.log('Doc saved successfully');
      
      // Clear cache for this doc since it's now synced
      this.docStateCache.delete(this.selectedDoc.id);
      
      // Update save state
      this.lastSaveTime = new Date();
      this.showSaveStatus = true;
      this.hasUnsavedChanges = false;
      
      // Hide the save status after 3 seconds
      if (this.saveStatusTimeout) {
        clearTimeout(this.saveStatusTimeout);
      }
      this.saveStatusTimeout = setTimeout(() => {
        this.showSaveStatus = false;
      }, 3000);
    } catch (error) {
      console.error('Failed to save doc:', error);
      alert('Failed to save document: ' + error);
    }
  }

  onDocumentTextChange() {
    // Cache text immediately so we never lose it
    if (this.selectedDoc) {
      const cached = this.docStateCache.get(this.selectedDoc.id) || {};
      cached.text = this.selectedDoc.text;
      this.docStateCache.set(this.selectedDoc.id, cached);
    }

    // Mark as having unsaved changes
    this.hasUnsavedChanges = true;
    
    // Clear existing auto-save timer
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }
    
    // Set new auto-save timer (save after 2 seconds of inactivity)
    this.autoSaveTimeout = setTimeout(() => {
      this.saveDoc();
    }, 2000);
  }

  onDocumentNotesChange() {
    // Cache notes immediately so we never lose them
    if (this.selectedDoc) {
      const cached = this.docStateCache.get(this.selectedDoc.id) || {};
      cached.notes = this.selectedDoc.notes;
      this.docStateCache.set(this.selectedDoc.id, cached);
    }

    // Clear existing auto-save timer for notes
    if (this.autoSaveNotesTimeout) {
      clearTimeout(this.autoSaveNotesTimeout);
    }
    
    // Set new auto-save timer (save after 2 seconds of inactivity)
    this.autoSaveNotesTimeout = setTimeout(() => {
      this.saveDocNotes();
    }, 2000);
  }

  async saveDocNotes() {
    if (!this.selectedDoc) return;

    try {
      const notes = this.selectedDoc.notes || '';
      await this.projectService.updateDocNotes(this.selectedDoc.id, notes);
      console.log('Doc notes saved successfully');
      
      // Clear cache for this doc since it's now synced
      this.docStateCache.delete(this.selectedDoc.id);
      
      // Reload the entire doc tree to ensure everything stays in sync
      // This preserves the current selection
      await this.loadProject(true);
    } catch (error) {
      console.error('Failed to save doc notes:', error);
    }
  }

  onDocGroupNotesChange() {
    // Auto-save doc group notes after 2 seconds of inactivity
    if (this.autoSaveNotesTimeout) {
      clearTimeout(this.autoSaveNotesTimeout);
    }
    
    this.autoSaveNotesTimeout = setTimeout(() => {
      this.saveDocGroupNotes();
    }, 2000);
  }

  async saveDocGroupNotes() {
    const grp = this.selectedGroup || this.currentGroup;
    if (!grp) return;

    try {
      const notes = grp.notes || '';
      await this.projectService.updateDocGroupNotes(grp.id, notes);
      console.log('Doc group notes saved successfully');
      
      // Reload to keep in sync
      await this.loadProject(true);
    } catch (error) {
      console.error('Failed to save doc group notes:', error);
    }
  }

  onProjectNotesChange() {
    // Auto-save project notes after 2 seconds of inactivity
    if (this.autoSaveNotesTimeout) {
      clearTimeout(this.autoSaveNotesTimeout);
    }
    
    this.autoSaveNotesTimeout = setTimeout(() => {
      this.saveProjectNotes();
    }, 2000);
  }

  async saveProjectNotes() {
    if (!this.projectData) return;

    try {
      const notes = this.projectData.notes || '';
      await this.projectService.updateProject(this.projectId, { notes });
      console.log('Project notes saved successfully');
    } catch (error) {
      console.error('Failed to save project notes:', error);
    }
  }

  async createGroup() {
    console.log('createGroup called');
    const name = 'New Folder'; // Simple default name for now
    console.log('Folder name:', name);

    try {
      let group;
      
      // If a group is selected, create after it
      if (this.selectedGroup && this.selectedGroup.sort_order !== null && this.selectedGroup.sort_order !== undefined) {
        group = await this.projectService.createDocGroupAfter(
          this.projectId, 
          name, 
          this.selectedGroup.parent_id ?? null,
          this.selectedGroup.sort_order
        );
      } else {
        // Otherwise create at end
        group = await this.projectService.createDocGroup(this.projectId, name);
      }
      
      console.log('Group created:', group);
      
      // Reload the project - SKIP automatic restore so we can manually set selection
      await this.loadProject(false, true);
      
      // Find the newly created group from the freshly loaded tree
      const newGroup = this.findGroupById(this.docGroups, group.id);
      if (newGroup) {
        // Auto-select the newly created folder ONLY
        this.selectedGroup = newGroup; // Use the group from the reloaded tree
        this.selectedDoc = null; // Clear doc selection
        this.currentGroup = newGroup;
        console.log('Group selected from reloaded tree:', this.selectedGroup.id, this.selectedGroup.name);
        
        // Save the new selection to localStorage
        this.saveSelection();
      } else {
        console.warn('Could not find newly created group in reloaded tree');
      }
      
      // Force Angular to detect changes
      this.changeDetector.detectChanges();
      
      // Focus and select the text in the group name input
      setTimeout(() => {
        // Will be handled in child component
      }, 0);
    } catch (error) {
      console.error('Failed to create group:', error);
      alert('Failed to create folder: ' + error);
    }
  }

  async createDoc() {
    console.log('createDoc called');
    
    // Create doc in the current folder context
    if (!this.currentGroup) {
      alert('Please select a folder first');
      return;
    }

    const name = 'Untitled Document'; // Simple default name for now
    const groupId = this.currentGroup.id;
    console.log('Document name:', name, 'in group:', groupId);

    try {
      let doc;
      
      // If a doc is selected in the same group, create after it
      if (this.selectedDoc && this.selectedDoc.doc_group_id === groupId && 
          this.selectedDoc.sort_order !== null && this.selectedDoc.sort_order !== undefined) {
        doc = await this.projectService.createDocAfter(
          this.projectId, 
          name, 
          groupId,
          this.selectedDoc.sort_order
        );
      } else {
        // Otherwise create at end of group
        doc = await this.projectService.createDocNew(this.projectId, name, groupId);
      }
      
      console.log('Doc created:', doc);
      
      // Reload the project - SKIP automatic restore so we can manually set selection
      await this.loadProject(false, true);
      
      // NOW expand the group in the NEW tree
      await this.expandGroup(groupId);
      
      // Find the newly created doc from the freshly loaded tree
      const newDoc = this.findDocById(doc.id);
      console.log('Looking for doc with id:', doc.id);
      console.log('Current docGroups:', this.docGroups);
      if (newDoc) {
        this.selectedDoc = newDoc; // Use the doc from the reloaded tree
        this.selectedGroup = null; // Clear group selection
        this.currentGroup = this.findGroupById(this.docGroups, groupId) || null;
        console.log('Doc selected from reloaded tree:', this.selectedDoc.id, this.selectedDoc.name);
        
        // Save the new selection to localStorage
        this.saveSelection();
      } else {
        console.warn('Could not find newly created doc in reloaded tree');
        console.warn('Backend returned doc:', doc);
        console.warn('Available docs in groups:', JSON.stringify(this.docGroups.map(g => ({ id: g.id, docs: g.docs.map(d => ({ id: d.id, name: d.name })) }))));
      }
      
      // Force Angular to detect changes and render the updated tree
      this.changeDetector.detectChanges();
      
      // Focus the document title input in the editor once it's rendered
      setTimeout(() => {
        this.documentEditorComponent?.focusTitle();
      }, 0);
    } catch (error) {
      console.error('Failed to create doc:', error);
      alert('Failed to create document: ' + error);
    }
  }

    async createDocInGroup(group: DocGroup) {
    console.log('createDocInGroup called for group:', group.id);
    const name = 'Untitled Document';
    const groupId = group.id;

    try {
      let doc;
      
      // If a doc is selected in the same group, create after it
      if (this.selectedDoc && this.selectedDoc.doc_group_id === groupId && 
          this.selectedDoc.sort_order !== null && this.selectedDoc.sort_order !== undefined) {
        doc = await this.projectService.createDocAfter(
          this.projectId, 
          name, 
          groupId,
          this.selectedDoc.sort_order
        );
      } else {
        // Otherwise create at end of group
        doc = await this.projectService.createDocNew(this.projectId, name, groupId);
      }
      
      console.log('Doc created:', doc);
      
      // Reload the project - SKIP automatic restore so we can manually set selection
      await this.loadProject(false, true);
      
      // NOW expand the group in the NEW tree
      await this.expandGroup(groupId);
      
      // Find the newly created doc from the freshly loaded tree
      const newDoc = this.findDocById(doc.id);
      console.log('Looking for doc with id:', doc.id);
      console.log('Current docGroups:', this.docGroups);
      if (newDoc) {
        this.selectedDoc = newDoc; // Use the doc from the reloaded tree
        this.selectedGroup = null; // Clear group selection
        this.currentGroup = this.findGroupById(this.docGroups, groupId) || null;
        console.log('Doc selected from reloaded tree:', this.selectedDoc.id, this.selectedDoc.name);
        
        // Save the new selection to localStorage
        this.saveSelection();
      } else {
        console.warn('Could not find newly created doc in reloaded tree');
        console.warn('Backend returned doc:', doc);
        console.warn('Available docs in groups:', JSON.stringify(this.docGroups.map(g => ({ id: g.id, docs: g.docs.map(d => ({ id: d.id, name: d.name })) }))));
      }
      
      // Force Angular to detect changes and render the updated tree
      this.changeDetector.detectChanges();
      
      // Focus the document title input in the editor once it's rendered
      setTimeout(() => {
        this.documentEditorComponent?.focusTitle();
      }, 0);
    } catch (error) {
      console.error('Failed to create doc:', error);
      alert('Failed to create document: ' + error);
    }
  }

  private async expandGroup(groupId: number) {
    this.expandedGroupIds.add(groupId);
    const group = this.findGroupById(this.docGroups, groupId);
    if (group) {
      group.expanded = true;
    }
    // Save tree state when expanding a group
    this.saveTreeState();
  }

  async createDraft() {
    if (!this.selectedDoc) {
      alert('Please select a document first');
      return;
    }

    const draftName = `Draft ${new Date().toLocaleTimeString()}`;
    const draftContent = ''; // Start with empty content, not the doc's current text
    
    try {
      console.log('Creating draft for doc:', this.selectedDoc.id);
      const draft = await this.projectService.createDraft(
        this.selectedDoc.id,
        draftName,
        draftContent
      );
      console.log('Draft created:', draft);
      
  // Reload drafts for the current document
  await this.loadDrafts(this.selectedDoc.id);
  // Select the newly created draft to open split view
  this.selectedDraftId = draft.id;
  try { localStorage.setItem(this.getDraftSelectionKey(this.selectedDoc.id), String(draft.id)); } catch {}
      // Ensure brand-new draft starts with EMPTY content in UI and local cache
      this.draftLocalContent.set(draft.id, '');
      this.setLocalDraftContent(draft.id, '');
      const idx = this.drafts.findIndex(d => d.id === draft.id);
      if (idx !== -1) {
        this.drafts[idx] = { ...this.drafts[idx], content: '' };
      }
      // Mark as pending so a blur will sync the empty content if user doesn't type
      this.draftSyncStatus[draft.id] = 'pending';
    } catch (error) {
      console.error('Failed to create draft:', error);
      alert('Failed to create draft: ' + error);
    }
  }

  // ==================== FOLDER DRAFTS UI ====================
  toggleFolderDrafts() {
    console.log('[DEBUG] toggleFolderDrafts called, current expanded:', this.folderDraftsExpanded);
    this.folderDraftsExpanded = !this.folderDraftsExpanded;
    console.log('[DEBUG] toggleFolderDrafts - new expanded:', this.folderDraftsExpanded);
    const group = this.selectedGroup || this.currentGroup;
    console.log('[DEBUG] toggleFolderDrafts - group:', group?.id, group?.name);
    if (this.folderDraftsExpanded && group) {
      // When expanding, restore previously selected folder draft from localStorage
      console.log('[DEBUG] toggleFolderDrafts - calling loadFolderDrafts with restoreSelection=true');
      this.loadFolderDrafts(group.id, /*restoreSelection*/ true);
    } else if (group) {
      // Collapsing: retain count indicator
      console.log('[DEBUG] toggleFolderDrafts - collapsing, refreshing count');
      this.refreshFolderDraftsCount(group.id);
    }
    // Persist selection visibility per group
    try { localStorage.setItem(this.getFolderDraftsExpandedKey(this.projectId), String(this.folderDraftsExpanded)); } catch {}
  }

  async loadFolderDrafts(docGroupId: number, restoreSelection: boolean = true) {
    console.log('[DEBUG] loadFolderDrafts called - docGroupId:', docGroupId, 'restoreSelection:', restoreSelection);
    try {
      this.folderDrafts = await this.projectService.listFolderDrafts(docGroupId);
      this.folderDraftsCount = this.folderDrafts.length;
      console.log('[DEBUG] loadFolderDrafts - loaded', this.folderDraftsCount, 'drafts:', this.folderDrafts.map(d => ({ id: d.id, name: d.name })));
      // Update tree marker for this folder
      if (this.folderDraftsCount > 0) {
        this.groupsWithDrafts.add(docGroupId);
      } else {
        this.groupsWithDrafts.delete(docGroupId);
      }
      // Load local cached content for each folder draft
      for (const d of this.folderDrafts) {
        const cached = this.getLocalFolderDraftContent(d.id);
        if (cached !== null) {
          this.folderDraftLocalContent.set(d.id, cached);
          (d as any).content = cached;
        } else {
          const backendContent = (d as any).content || '';
          this.folderDraftLocalContent.set(d.id, backendContent);
          (d as any).content = backendContent;
        }
        delete this.folderDraftSyncStatus[d.id];
        const t = this.folderDraftSyncedClearTimeouts.get(d.id);
        if (t) { clearTimeout(t); this.folderDraftSyncedClearTimeouts.delete(d.id); }
      }
      // Optionally restore previously selected folder draft for this group
      if (restoreSelection) {
        try {
          console.log('[DEBUG] loadFolderDrafts - about to call getFolderDraftSelectionKey with docGroupId:', docGroupId, 'projectId:', this.projectId);
          const key = this.getFolderDraftSelectionKey(docGroupId);
          console.log('[DEBUG] loadFolderDrafts - generated key:', key);
          const savedIdStr = localStorage.getItem(key);
          console.log('[DEBUG] loadFolderDrafts - restoreSelection: key=', key, 'savedIdStr=', savedIdStr);
          if (savedIdStr) {
            const savedId = parseInt(savedIdStr, 10);
            console.log('[DEBUG] loadFolderDrafts - parsed savedId:', savedId);
            const draftExists = this.folderDrafts.some(fd => fd.id === savedId);
            console.log('[DEBUG] loadFolderDrafts - draftExists:', draftExists, 'selectedDraftId:', this.selectedDraftId);
            if (draftExists) {
              // Only restore if no document draft is currently selected, to avoid hiding doc draft tools
              if (this.selectedDraftId == null) {
                console.log('[DEBUG] loadFolderDrafts - RESTORING selectedFolderDraftId to:', savedId);
                this.selectedFolderDraftId = savedId;
              } else {
                console.log('[DEBUG] loadFolderDrafts - NOT restoring because selectedDraftId is set:', this.selectedDraftId);
              }
            } else {
              // Saved selection no longer valid
              console.log('[DEBUG] loadFolderDrafts - draft no longer exists, removing from localStorage');
              localStorage.removeItem(this.getFolderDraftSelectionKey(docGroupId));
              if (this.selectedFolderDraftId === savedId) {
                this.selectedFolderDraftId = null;
              }
            }
          } else {
            console.log('[DEBUG] loadFolderDrafts - no saved selection found');
          }
        } catch (e) {
          console.error('[DEBUG] loadFolderDrafts - error restoring selection:', e);
        }
      } else {
        console.log('[DEBUG] loadFolderDrafts - restoreSelection is false, skipping restore');
      }
    } catch (e) {
      console.error('Failed to load folder drafts:', e);
      this.folderDrafts = [];
      this.folderDraftsCount = 0;
    }
  }

  async createFolderDraft() {
    const group = this.selectedGroup || this.currentGroup;
    if (!group) {
      alert('Please select a folder first');
      return;
    }
    try {
      const now = new Date();
      const draftName = `Note ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
      
      // Calculate insert index if a draft is selected
      let insertIndex: number | undefined;
      if (this.selectedFolderDraftId != null) {
        const currentIndex = this.folderDrafts.findIndex(d => d.id === this.selectedFolderDraftId);
        if (currentIndex !== -1) {
          insertIndex = currentIndex + 1;
        }
      }
      
      console.log('[DEBUG] createFolderDraft - creating draft with insertIndex:', insertIndex);
      
      // Create the draft and get the new draft's ID
      const newDraft = await this.projectService.createFolderDraft(group.id, draftName, '', insertIndex);
      console.log('[DEBUG] createFolderDraft - newDraft created with id:', newDraft.id);
      
      // Load drafts but don't restore previous selection
      await this.loadFolderDrafts(group.id, /*restoreSelection*/ false);
      this.folderDraftsCount = this.folderDrafts.length;
      
      console.log('[DEBUG] createFolderDraft - after load, setting selectedFolderDraftId to:', newDraft.id);
      // Select the newly created draft and persist to localStorage
      this.selectedFolderDraftId = newDraft.id;
      try {
        const key = this.getFolderDraftSelectionKey(group.id);
        localStorage.setItem(key, String(newDraft.id));
        console.log('[DEBUG] createFolderDraft - saved to localStorage, key:', key, 'value:', newDraft.id);
      } catch {}
      console.log('[DEBUG] createFolderDraft - final selectedFolderDraftId:', this.selectedFolderDraftId);
    } catch (e) {
      console.error('Failed to create folder draft:', e);
      alert('Failed to create folder draft: ' + e);
    }
  }

  async deleteFolderDraft(id: number) {
    console.log('deleteFolderDraft called with id:', id);
    try {
      await this.projectService.deleteFolderDraft(id);
      console.log('Draft deleted from backend, updating UI...');
      
      // Remove from local storage
      try {
        localStorage.removeItem(this.getLocalFolderDraftKey(id));
      } catch {}
      
      // Filter out the deleted draft - create new array reference for change detection
      const filteredDrafts = this.folderDrafts.filter(d => d.id !== id);
      this.folderDrafts = [...filteredDrafts];
      
      if (this.selectedFolderDraftId === id) {
        this.selectedFolderDraftId = null;
      }
      if (this.focusedFolderDraftId === id) {
        this.focusedFolderDraftId = null;
      }
      
      // Clear any pending timeouts
      const timeout = this.folderDraftAutoSaveTimeouts.get(id);
      if (timeout) {
        clearTimeout(timeout);
        this.folderDraftAutoSaveTimeouts.delete(id);
      }
      const clearTimeout2 = this.folderDraftSyncedClearTimeouts.get(id);
      if (clearTimeout2) {
        clearTimeout(clearTimeout2);
        this.folderDraftSyncedClearTimeouts.delete(id);
      }
      
      // Clean up local content
      this.folderDraftLocalContent.delete(id);
      delete this.folderDraftSyncStatus[id];
      
      this.folderDraftsCount = this.folderDrafts.length;
      const group = this.selectedGroup || this.currentGroup;
      if (group) {
        if (this.folderDraftsCount > 0) {
          this.groupsWithDrafts.add(group.id);
        } else {
          this.groupsWithDrafts.delete(group.id);
        }
      }
      
      console.log('Draft deleted successfully, drafts remaining:', this.folderDrafts.length);
      this.changeDetector.markForCheck();
    } catch (e) {
      console.error('Failed to delete folder draft:', e);
      alert('Failed to delete folder draft: ' + e);
    }
  }

  async onFolderDraftMove(payload: { draftId: number; newIndex: number }) {
    try {
      await this.projectService.moveFolderDraft(payload.draftId, payload.newIndex);
    } catch (e) {
      console.error('Failed to move folder draft:', e);
      const group = this.selectedGroup || this.currentGroup;
      if (group) await this.loadFolderDrafts(group.id);
    }
  }

  startEditFolderDraft(d: FolderDraft) {
    // Cancel pending click-based deselection so double-click doesn't clear selection
    if (this.folderDraftClickTimer) { clearTimeout(this.folderDraftClickTimer); this.folderDraftClickTimer = null; }
    this.editingFolderDraftId = d.id;
    this.folderDraftNameEdit = d.name;
    setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>('input.draft-name-input');
      if (el) { el.focus(); el.select(); }
    }, 0);
  }

  async saveFolderDraftName() {
    if (this.editingFolderDraftId == null) return;
    const id = this.editingFolderDraftId;
    const name = (this.folderDraftNameEdit || '').trim();
    this.editingFolderDraftId = null;
    if (!name) return;
    try {
      const updated = await this.projectService.updateFolderDraft(id, { name });
      const idx = this.folderDrafts.findIndex(d => d.id === id);
      if (idx !== -1) {
        this.folderDrafts[idx] = { ...this.folderDrafts[idx], name: (updated as any).name, updated_at: (updated as any).updated_at } as any;
        this.folderDrafts = [...this.folderDrafts];
        this.folderDraftsCount = this.folderDrafts.length;
      }
    } catch (e) {
      console.error('Failed to rename folder draft:', e);
      alert('Failed to rename folder draft: ' + e);
    }
  }

  cancelFolderDraftEdit() {
    this.editingFolderDraftId = null;
  }

  onFolderDraftSelect(draftId: number) {
    console.log('[DEBUG] onFolderDraftSelect called with draftId:', draftId, 'current selectedFolderDraftId:', this.selectedFolderDraftId);
    // Pure selection logic - no toggling
    if (this.selectedFolderDraftId !== draftId) {
      console.log('[DEBUG] onFolderDraftSelect - changing selection from', this.selectedFolderDraftId, 'to', draftId);
      if (this.folderDraftClickTimer) { clearTimeout(this.folderDraftClickTimer); this.folderDraftClickTimer = null; }
      this.selectedFolderDraftId = draftId;
      
      // Clear other selections
      if (this.selectedDraftId != null) {
        this.selectedDraftId = null;
        if (this.selectedDoc) {
          try { localStorage.removeItem(this.getDraftSelectionKey(this.selectedDoc.id)); } catch {}
        }
      }
      if (this.selectedProjectDraftId != null) {
        this.selectedProjectDraftId = null;
        try { localStorage.removeItem(this.getProjectDraftSelectionKey(this.projectId)); } catch {}
      }

      // Persist selection
      const group = this.selectedGroup || this.currentGroup;
      if (group) {
        try {
          const key = this.getFolderDraftSelectionKey(group.id);
          localStorage.setItem(key, String(this.selectedFolderDraftId));
        } catch {}
      }
    } else {
      // If already selected, ensure no pending deselect timer is running
      if (this.folderDraftClickTimer) { 
        clearTimeout(this.folderDraftClickTimer); 
        this.folderDraftClickTimer = null; 
      }
    }
  }

  // ===== Folder draft selection & syncing =====
  onFolderDraftChipClick(d: FolderDraft, event?: MouseEvent) {
    if (event) event.stopPropagation();
    // Click-to-select, click-again-to-collapse with dblclick cancel
    if (this.selectedFolderDraftId !== d.id) {
      if (this.folderDraftClickTimer) { clearTimeout(this.folderDraftClickTimer); this.folderDraftClickTimer = null; }
      this.selectedFolderDraftId = d.id;
    } else {
      if (this.folderDraftClickTimer) { clearTimeout(this.folderDraftClickTimer); }
      this.folderDraftClickTimer = setTimeout(() => {
        this.selectedFolderDraftId = null;
        this.folderDraftClickTimer = null;
        // Persist cleared selection
        const group = this.selectedGroup || this.currentGroup;
        if (group) {
          try {
            const key = this.getFolderDraftSelectionKey(group.id);
            localStorage.removeItem(key);
          } catch {}
        }
      }, 220);
    }

    // Only one draft type edited at a time: clear doc/project selections when a folder draft is actively selected
    if (this.selectedFolderDraftId != null) {
      if (this.selectedDraftId != null) {
        this.selectedDraftId = null;
        if (this.selectedDoc) {
          try { localStorage.removeItem(this.getDraftSelectionKey(this.selectedDoc.id)); } catch {}
        }
      }
      if (this.selectedProjectDraftId != null) {
        this.selectedProjectDraftId = null;
        try { localStorage.removeItem(this.getProjectDraftSelectionKey(this.projectId)); } catch {}
      }
    }

    const group = this.selectedGroup || this.currentGroup;
    if (group) {
      try {
        const key = this.getFolderDraftSelectionKey(group.id);
        if (this.selectedFolderDraftId == null) localStorage.removeItem(key); else localStorage.setItem(key, String(this.selectedFolderDraftId));
      } catch {}
    }
  }

  // ===== Project drafts UI =====
  toggleProjectDrafts() {
    this.projectDraftsExpanded = !this.projectDraftsExpanded;
    if (this.projectDraftsExpanded) {
      this.loadProjectDrafts(this.projectId, /*restoreSelection*/ false);
    }
    try { localStorage.setItem(this.getProjectDraftsExpandedKey(this.projectId), String(this.projectDraftsExpanded)); } catch {}
  }

  async loadProjectDrafts(projectId: number, restoreSelection: boolean = true) {
    try {
      this.projectDrafts = await this.projectService.listProjectDrafts(projectId);
      this.projectDraftsCount = this.projectDrafts.length;
      for (const d of this.projectDrafts) {
        const cached = this.getLocalProjectDraftContent(d.id);
        if (cached !== null) {
          this.projectDraftLocalContent.set(d.id, cached);
          (d as any).content = cached;
        } else {
          const backendContent = (d as any).content || '';
          this.projectDraftLocalContent.set(d.id, backendContent);
          (d as any).content = backendContent;
        }
        delete this.projectDraftSyncStatus[d.id];
        const t = this.projectDraftSyncedClearTimeouts.get(d.id);
        if (t) { clearTimeout(t); this.projectDraftSyncedClearTimeouts.delete(d.id); }
      }
      if (restoreSelection) {
        try {
          const savedIdStr = localStorage.getItem(this.getProjectDraftSelectionKey(projectId));
          if (savedIdStr) {
            const savedId = parseInt(savedIdStr, 10);
            if (this.projectDrafts.some(pd => pd.id === savedId)) {
              // Only restore if no doc or folder draft is currently selected
              if (this.selectedDraftId == null && this.selectedFolderDraftId == null) {
                this.selectedProjectDraftId = savedId;
              }
            } else {
              localStorage.removeItem(this.getProjectDraftSelectionKey(projectId));
              if (this.selectedProjectDraftId === savedId) this.selectedProjectDraftId = null;
            }
          }
        } catch {}
      }
    } catch (e) {
      console.error('Failed to load project drafts:', e);
      this.projectDrafts = [];
      this.projectDraftsCount = 0;
    }
  }

  async createProjectDraft() {
    try {
      const draftName = `Draft ${new Date().toLocaleTimeString()}`;
      await this.projectService.createProjectDraft(this.projectId, draftName, '');
      await this.loadProjectDrafts(this.projectId);
      this.projectDraftsCount = this.projectDrafts.length;
    } catch (e) {
      console.error('Failed to create project draft:', e);
      alert('Failed to create project draft: ' + e);
    }
  }

  async deleteProjectDraft(id: number) {
    try {
      await this.projectService.deleteProjectDraft(id);
      this.projectDrafts = this.projectDrafts.filter(d => d.id !== id);
      if (this.selectedProjectDraftId === id) {
        this.selectedProjectDraftId = null;
      }
      this.projectDraftsCount = this.projectDrafts.length;
    } catch (e) {
      console.error('Failed to delete project draft:', e);
      alert('Failed to delete project draft: ' + e);
    }
  }

  startEditProjectDraft(d: import('../../shared/models').ProjectDraft) {
    if (this.projectDraftClickTimer) { clearTimeout(this.projectDraftClickTimer); this.projectDraftClickTimer = null; }
    this.editingProjectDraftId = d.id;
    this.projectDraftNameEdit = d.name;
    setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>('input.draft-name-input');
      if (el) { el.focus(); el.select(); }
    }, 0);
  }

  async saveProjectDraftName() {
    if (this.editingProjectDraftId == null) return;
    const id = this.editingProjectDraftId;
    const name = (this.projectDraftNameEdit || '').trim();
    this.editingProjectDraftId = null;
    if (!name) return;
    try {
      const updated = await this.projectService.updateProjectDraft(id, { name });
      const idx = this.projectDrafts.findIndex(d => d.id === id);
      if (idx !== -1) {
        this.projectDrafts[idx] = { ...this.projectDrafts[idx], name: (updated as any).name, updated_at: (updated as any).updated_at } as any;
        this.projectDrafts = [...this.projectDrafts];
        this.projectDraftsCount = this.projectDrafts.length;
      }
    } catch (e) {
      console.error('Failed to rename project draft:', e);
      alert('Failed to rename project draft: ' + e);
    }
  }

  cancelProjectDraftEdit() {
    this.editingProjectDraftId = null;
  }

  onProjectDraftChipClick(d: import('../../shared/models').ProjectDraft, event?: MouseEvent) {
    if (event) event.stopPropagation();
    if (this.selectedProjectDraftId !== d.id) {
      if (this.projectDraftClickTimer) { clearTimeout(this.projectDraftClickTimer); this.projectDraftClickTimer = null; }
      this.selectedProjectDraftId = d.id;
    } else {
      if (this.projectDraftClickTimer) { clearTimeout(this.projectDraftClickTimer); }
      this.projectDraftClickTimer = setTimeout(() => {
        this.selectedProjectDraftId = null;
        this.projectDraftClickTimer = null;
        try { localStorage.removeItem(this.getProjectDraftSelectionKey(this.projectId)); } catch {}
      }, 220);
    }

    // Only one draft type at a time: clear doc and folder selections when selecting a project draft
    if (this.selectedProjectDraftId != null) {
      if (this.selectedDraftId != null) {
        this.selectedDraftId = null;
        if (this.selectedDoc) {
          try { localStorage.removeItem(this.getDraftSelectionKey(this.selectedDoc.id)); } catch {}
        }
      }
      if (this.selectedFolderDraftId != null) {
        this.selectedFolderDraftId = null;
        const group = this.selectedGroup || this.currentGroup;
        if (group) {
          try { localStorage.removeItem(this.getFolderDraftSelectionKey(group.id)); } catch {}
        }
      }
    }

    try {
      const key = this.getProjectDraftSelectionKey(this.projectId);
      if (this.selectedProjectDraftId == null) localStorage.removeItem(key); else localStorage.setItem(key, String(this.selectedProjectDraftId));
    } catch {}
  }

  getSelectedProjectDraftName(): string | null {
    if (this.selectedProjectDraftId == null) return null;
    const pd = this.projectDrafts.find(p => p.id === this.selectedProjectDraftId);
    return pd ? pd.name : null;
  }

  getProjectDraftLocalContent(draftId: number): string {
    return this.projectDraftLocalContent.get(draftId) || '';
  }

  private getLocalProjectDraftContent(draftId: number): string | null {
    try { return localStorage.getItem(this.getLocalProjectDraftKey(draftId)); } catch { return null; }
  }

  private setLocalProjectDraftContent(draftId: number, content: string): void {
    try { localStorage.setItem(this.getLocalProjectDraftKey(draftId), content); } catch {}
  }

  onProjectDraftChange(draftId: number, content: string, cursorPosition: number): void {
    this.focusedProjectDraftId = draftId;
    this.projectDraftLocalContent.set(draftId, content);
    this.setLocalProjectDraftContent(draftId, content);
    this.projectDraftSyncStatus[draftId] = 'pending';
    const prevClear = this.projectDraftSyncedClearTimeouts.get(draftId);
    if (prevClear) { clearTimeout(prevClear); this.projectDraftSyncedClearTimeouts.delete(draftId); }
    const existing = this.projectDraftAutoSaveTimeouts.get(draftId);
    if (existing) clearTimeout(existing);
    const timeout = setTimeout(() => { this.syncProjectDraftToBackend(draftId, cursorPosition); }, 500);
    this.projectDraftAutoSaveTimeouts.set(draftId, timeout);
  }

  onProjectDraftBlur(draftId: number): void {
    if (this.focusedProjectDraftId === draftId) this.focusedProjectDraftId = null;
    const t = this.projectDraftAutoSaveTimeouts.get(draftId);
    if (t) { clearTimeout(t); this.projectDraftAutoSaveTimeouts.delete(draftId); }
    if (this.projectDraftSyncStatus[draftId] === 'pending') {
      this.syncProjectDraftToBackend(draftId);
    }
  }

  private async syncProjectDraftToBackend(draftId: number, cursorPosition?: number): Promise<void> {
    const content = this.projectDraftLocalContent.get(draftId);
    if (content === undefined) return;
    const wasFocused = this.focusedProjectDraftId === draftId;
    const prevClear = this.projectDraftSyncedClearTimeouts.get(draftId);
    if (prevClear) { clearTimeout(prevClear); this.projectDraftSyncedClearTimeouts.delete(draftId); }
    this.projectDraftSyncStatus[draftId] = 'syncing';
    try {
      await this.projectService.updateProjectDraft(draftId, { content });
      this.projectDraftSyncStatus[draftId] = 'synced';
      const clearTimer = setTimeout(() => {
        if (this.projectDraftSyncStatus[draftId] === 'synced') { delete this.projectDraftSyncStatus[draftId]; }
        this.projectDraftSyncedClearTimeouts.delete(draftId);
      }, 2500);
      this.projectDraftSyncedClearTimeouts.set(draftId, clearTimer);
      if (wasFocused && cursorPosition !== undefined) {
        // caret restoration handled by browser for now
      }
    } catch (e) {
      console.error('Failed to sync project draft:', e);
      this.projectDraftSyncStatus[draftId] = 'pending';
    }
  }

  getSelectedFolderDraftName(): string | null {
    if (this.selectedFolderDraftId == null) return null;
    const fd = this.folderDrafts.find(f => f.id === this.selectedFolderDraftId);
    return fd ? fd.name : null;
  }

  getFolderDraftLocalContent(draftId: number): string {
    return this.folderDraftLocalContent.get(draftId) || '';
  }

  private getLocalFolderDraftKey(draftId: number): string {
    return `cora-folder-draft-${draftId}`;
  }

  private getLocalFolderDraftContent(draftId: number): string | null {
    try { return localStorage.getItem(this.getLocalFolderDraftKey(draftId)); } catch { return null; }
  }

  private setLocalFolderDraftContent(draftId: number, content: string): void {
    try { localStorage.setItem(this.getLocalFolderDraftKey(draftId), content); } catch {}
  }

  private getFolderDraftSelectionKey(groupId: number): string {
    return `cora-folder-draft-selected-${this.projectId}-${groupId}`;
  }

  private getFolderDraftsExpandedKey(projectId: number): string {
    return `cora-folder-drafts-expanded-${projectId}`;
  }

  private async refreshProjectDraftsCount(): Promise<void> {
    try {
      const drafts = await this.projectService.listProjectDrafts(this.projectId);
      this.projectDraftsCount = drafts.length;
    } catch {
      this.projectDraftsCount = 0;
    }
  }

  private async refreshFolderDraftsCount(groupId: number): Promise<void> {
    try {
      const drafts = await this.projectService.listFolderDrafts(groupId);
      this.folderDraftsCount = drafts.length;
      if (this.folderDraftsCount > 0) {
        this.groupsWithDrafts.add(groupId);
      } else {
        this.groupsWithDrafts.delete(groupId);
      }
    } catch {
      this.folderDraftsCount = 0;
      this.groupsWithDrafts.delete(groupId);
    }
  }

  // Populate draft markers for tree items (runs asynchronously after tree build)
  private async populateInitialDraftMarkers(groupsRaw: any[], docsRaw: Doc[]): Promise<void> {
    this.groupsWithDrafts = new Set();
    this.docsWithDrafts = new Set();
    const groupPromises = groupsRaw.map(g => this.projectService.listFolderDrafts(g.id)
      .then(arr => ({ id: g.id, count: arr.length }))
      .catch(() => ({ id: g.id, count: 0 })));
    const docPromises = docsRaw.map(d => this.projectService.listDrafts(d.id)
      .then(arr => ({ id: d.id, count: arr.length }))
      .catch(() => ({ id: d.id, count: 0 })));
    const [groupResults, docResults] = await Promise.all([
      Promise.all(groupPromises),
      Promise.all(docPromises)
    ]);
    for (const r of groupResults) if (r.count > 0) this.groupsWithDrafts.add(r.id);
    for (const r of docResults) if (r.count > 0) this.docsWithDrafts.add(r.id);
    this.changeDetector.markForCheck();
  }

  onFolderDraftChange(draftId: number, content: string, cursorPosition: number): void {
    this.focusedFolderDraftId = draftId;
    this.folderDraftLocalContent.set(draftId, content);
    this.setLocalFolderDraftContent(draftId, content);
    this.folderDraftSyncStatus[draftId] = 'pending';
    const prevClear = this.folderDraftSyncedClearTimeouts.get(draftId);
    if (prevClear) { clearTimeout(prevClear); this.folderDraftSyncedClearTimeouts.delete(draftId); }
    const existing = this.folderDraftAutoSaveTimeouts.get(draftId);
    if (existing) clearTimeout(existing);
    const timeout = setTimeout(() => { this.syncFolderDraftToBackend(draftId, cursorPosition); }, 500);
    this.folderDraftAutoSaveTimeouts.set(draftId, timeout);
  }

  onFolderDraftBlur(draftId: number): void {
    if (this.focusedFolderDraftId === draftId) this.focusedFolderDraftId = null;
    const t = this.folderDraftAutoSaveTimeouts.get(draftId);
    if (t) { clearTimeout(t); this.folderDraftAutoSaveTimeouts.delete(draftId); }
    if (this.folderDraftSyncStatus[draftId] === 'pending') {
      this.syncFolderDraftToBackend(draftId);
    }
  }

  async onFolderDraftNameChange(draftId: number, name: string): Promise<void> {
    try {
      await this.projectService.updateFolderDraft(draftId, { name });
      // Update local draft data
      const draft = this.folderDrafts.find(d => d.id === draftId);
      if (draft) {
        draft.name = name;
      }
    } catch (e) {
      console.error('Failed to update folder draft name:', e);
    }
  }

  private async syncFolderDraftToBackend(draftId: number, cursorPosition?: number): Promise<void> {
    const content = this.folderDraftLocalContent.get(draftId);
    if (content === undefined) return;
    const wasFocused = this.focusedFolderDraftId === draftId;
    const prevClear = this.folderDraftSyncedClearTimeouts.get(draftId);
    if (prevClear) { clearTimeout(prevClear); this.folderDraftSyncedClearTimeouts.delete(draftId); }
    this.folderDraftSyncStatus[draftId] = 'syncing';
    try {
      await this.projectService.updateFolderDraft(draftId, { content });
      this.folderDraftSyncStatus[draftId] = 'synced';
      const clearTimer = setTimeout(() => {
        if (this.folderDraftSyncStatus[draftId] === 'synced') { delete this.folderDraftSyncStatus[draftId]; }
        this.folderDraftSyncedClearTimeouts.delete(draftId);
      }, 2500);
      this.folderDraftSyncedClearTimeouts.set(draftId, clearTimer);
      if (wasFocused && cursorPosition !== undefined) {
        // caret restoration handled by browser for now
      }
    } catch (e) {
      console.error('Failed to sync folder draft:', e);
      this.folderDraftSyncStatus[draftId] = 'pending';
    }
  }

  private async loadDrafts(docId: number) {
    try {
      this.drafts = await this.projectService.listDrafts(docId);
      console.log('Loaded drafts:', this.drafts);
      // Update draft marker for this doc
      if (this.drafts.length > 0) {
        this.docsWithDrafts.add(docId);
      } else {
        this.docsWithDrafts.delete(docId);
      }
      
      // Load local cached content for each draft
      for (const draft of this.drafts) {
        const cached = this.getLocalDraftContent(draft.id);
        if (cached !== null) {
          this.draftLocalContent.set(draft.id, cached);
          draft.content = cached; // reflect into UI model
        } else {
          // Initialize local cache with backend content
          const backendContent = draft.content || '';
          this.draftLocalContent.set(draft.id, backendContent);
          draft.content = backendContent; // reflect into UI model
        }
        // Do not show initial synced checkmark on load; clear any previous timers/status
        delete this.draftSyncStatus[draft.id];
        const t = this.draftSyncedClearTimeouts.get(draft.id);
        if (t) { clearTimeout(t); this.draftSyncedClearTimeouts.delete(draft.id); }
      }
      // Restore previously selected draft for this doc if it still exists
      try {
        const savedIdStr = localStorage.getItem(this.getDraftSelectionKey(docId));
        if (savedIdStr) {
          const savedId = parseInt(savedIdStr, 10);
          if (this.drafts.some(d => d.id === savedId)) {
            this.selectedDraftId = savedId;
          } else {
            this.selectedDraftId = null;
            localStorage.removeItem(this.getDraftSelectionKey(docId));
          }
        }
      } catch {}
    } catch (error) {
      console.error('Failed to load drafts:', error);
    }
  }

  private async loadCharacters(): Promise<void> {
    try {
  const chars = await this.projectService.listCharacters(this.projectId);
  const list = chars.map(c => ({ id: c.id, name: c.name, desc: c.desc ?? '' }));
  // Apply any locally persisted order (temporary until backend field exists)
  try {
    const saved = localStorage.getItem(this.getCharactersOrderKey(this.projectId));
    if (saved) {
      const order: number[] = JSON.parse(saved);
      this.characters = this.applyOrder(list, order);
    } else {
      this.characters = list;
    }
  } catch {
    this.characters = list;
  }
    } catch (error) {
      console.error('Failed to load characters:', error);
      this.characters = [];
    }
  }

  private async loadEvents(): Promise<void> {
    try {
      const evs = await this.projectService.listEvents(this.projectId);
      // Normalize to local interface (desc empty string default)
      const list = evs.map(e => ({ id: e.id, name: e.name, desc: e.desc ?? '', start_date: e.start_date ?? null, end_date: e.end_date ?? null } as any));
      // Apply any locally persisted order
      try {
        const saved = localStorage.getItem(this.getEventsOrderKey(this.projectId));
        if (saved) {
          const order: number[] = JSON.parse(saved);
          this.events = this.applyOrder(list, order);
        } else {
          this.events = list;
        }
      } catch {
        this.events = list;
      }
    } catch (error) {
      console.error('Failed to load events:', error);
      this.events = [];
    }
  }

  private async loadPlaces(): Promise<void> {
    try {
      const pls = await this.projectService.listPlaces(this.projectId);
      const list = pls.map(p => ({ id: p.id, name: p.name, desc: p.desc ?? '' }));
      // Apply any locally persisted order
      try {
        const saved = localStorage.getItem(this.getPlacesOrderKey(this.projectId));
        if (saved) {
          const order: number[] = JSON.parse(saved);
          this.places = this.applyOrder(list, order);
        } else {
          this.places = list;
        }
      } catch {
        this.places = list;
      }
    } catch (error) {
      console.error('Failed to load places:', error);
      this.places = [];
    }
  }

  private async loadDocCharacters(docId: number): Promise<void> {
    try {
      const ids = await this.projectService.listDocCharacters(docId);
      this.docCharacterIds = new Set(ids);
    } catch (error) {
      console.error('Failed to load doc characters:', error);
      this.docCharacterIds = new Set();
    }
  }

  private async loadDocEvents(docId: number): Promise<void> {
    try {
      const ids = await this.projectService.listDocEvents(docId);
      this.docEventIds = new Set(ids);
    } catch (error) {
      console.error('Failed to load doc events:', error);
      this.docEventIds = new Set();
    }
  }

  private async loadDocGroupCharacters(docGroupId: number): Promise<void> {
    try {
      // Load characters mirrored from all docs within this folder
      const ids = await this.projectService.listDocGroupCharactersFromDocs(docGroupId);
      this.docGroupCharacterIds = new Set(ids);
    } catch (error) {
      console.error('Failed to load doc group characters:', error);
      this.docGroupCharacterIds = new Set();
    }
  }

  private async loadDocGroupEvents(docGroupId: number): Promise<void> {
    try {
      // Load events mirrored from all docs within this folder
      const ids = await this.projectService.listDocGroupEventsFromDocs(docGroupId);
      this.docGroupEventIds = new Set(ids);
    } catch (error) {
      console.error('Failed to load doc group events:', error);
      this.docGroupEventIds = new Set();
    }
  }

  private async loadDocPlaces(docId: number): Promise<void> {
    try {
      const ids = await this.projectService.listDocPlaces(docId);
      this.docPlaceIds = new Set(ids);
    } catch (error) {
      console.error('Failed to load doc places:', error);
      this.docPlaceIds = new Set();
    }
  }

  private async loadDocGroupPlaces(docGroupId: number): Promise<void> {
    try {
      // Load places mirrored from all docs within this folder
      const ids = await this.projectService.listDocGroupPlacesFromDocs(docGroupId);
      this.docGroupPlaceIds = new Set(ids);
    } catch (error) {
      console.error('Failed to load doc group places:', error);
      this.docGroupPlaceIds = new Set();
    }
  }

  // ===== Characters sidebar handlers =====
  async onSidebarCharacterAdd(): Promise<void> {
    try {
      // Ensure panel is opened
      const created = await this.projectService.createCharacter(this.projectId, 'New Character', '');
  this.characters = [...this.characters, { id: created.id, name: created.name, desc: created.desc ?? '' }];
      // Enter edit mode on the newly created card
      this.editingCharacterId = created.id;
    } catch (error) {
      console.error('Failed to create character:', error);
      alert('Failed to create character: ' + error);
    }
  }

  async onSidebarCharacterCreate(data: { name: string; desc: string }): Promise<void> {
    try {
      // Ensure panel is opened
      // Create character with the provided data
      const created = await this.projectService.createCharacter(this.projectId, data.name, data.desc);
      this.characters = [...this.characters, { id: created.id, name: created.name, desc: created.desc ?? '' }];
      
      // If we have a selected doc, attach the new character to it
      if (this.selectedDoc) {
        await this.projectService.attachCharacterToDoc(this.selectedDoc.id, created.id);
        this.docCharacterIds = new Set([...this.docCharacterIds, created.id]);
        
        // Update project header cache
        const current = this.projectHeaderDocCharactersCache.get(this.selectedDoc.id) || [];
        this.projectHeaderDocCharactersCache.set(this.selectedDoc.id, [...current, created.id]);
        
        // Refresh parent folder's character list (union of all docs)
        if (this.currentGroup) {
          await this.loadDocGroupCharacters(this.currentGroup.id);
        }
      }
      // If we have a selected group, attach the new character to it
      else if (this.selectedGroup) {
        await this.projectService.attachCharacterToDocGroup(this.selectedGroup.id, created.id);
        this.docGroupCharacterIds = new Set([...this.docGroupCharacterIds, created.id]);
      }
      this.changeDetector.markForCheck();
    } catch (error) {
      console.error('Failed to create character:', error);
      alert('Failed to create character: ' + error);
    }
  }

  async onSidebarCharacterNameChange(payload: { id: number; name: string }): Promise<void> {
    try {
      await this.projectService.updateCharacter(payload.id, { name: payload.name });
      const idx = this.characters.findIndex(c => c.id === payload.id);
      if (idx !== -1) {
        this.characters[idx] = { ...this.characters[idx], name: payload.name } as any;
        this.characters = [...this.characters];
      }
    } catch (error) {
      console.error('Failed to update character name:', error);
    }
  }

  async onSidebarCharacterDescChange(payload: { id: number; desc: string }): Promise<void> {
    try {
      await this.projectService.updateCharacter(payload.id, { desc: payload.desc });
      const idx = this.characters.findIndex(c => c.id === payload.id);
      if (idx !== -1) {
        this.characters[idx] = { ...this.characters[idx], desc: payload.desc } as any;
        this.characters = [...this.characters];
      }
    } catch (error) {
      console.error('Failed to update character description:', error);
    }
  }

  async onSidebarCharacterUpdate(payload: { id: number; name: string; desc: string }): Promise<void> {
    try {
      // Find existing character to preserve desc if not provided
      const existingChar = this.characters.find(c => c.id === payload.id);
      const updatedDesc = payload.desc || existingChar?.desc || '';
      
      await this.projectService.updateCharacter(payload.id, { name: payload.name, desc: updatedDesc });
      const idx = this.characters.findIndex(c => c.id === payload.id);
      if (idx !== -1) {
        this.characters[idx] = { ...this.characters[idx], name: payload.name, desc: updatedDesc } as any;
        this.characters = [...this.characters];
      }
      // Exit edit mode after successful save
      if (this.editingCharacterId === payload.id) {
        this.editingCharacterId = null;
      }
      this.changeDetector.markForCheck();
    } catch (error) {
      console.error('Failed to update character:', error);
    }
  }

  // Inline edit handler (name only)
  onInlineCharacterEdit(payload: { id: number; name: string }): void {
    this.onSidebarCharacterUpdate({ id: payload.id, name: payload.name, desc: '' });
  }

  // ===== Events handlers =====
  async onSidebarEventAdd(): Promise<void> {
    try {
      // Ensure panel is opened
      const created = await this.projectService.createEvent(this.projectId, 'New Event', '', null, null);
      this.events = [...this.events, { id: created.id, name: created.name, desc: created.desc ?? '', start_date: created.start_date ?? null, end_date: created.end_date ?? null } as any];
      this.editingEventId = created.id;
    } catch (error) {
      console.error('Failed to create event:', error);
      alert('Failed to create event: ' + error);
    }
  }

  async onSidebarEventCreate(data: { name: string; desc: string; start_date: string | null; end_date: string | null }): Promise<void> {
    try {
      // Ensure panel is opened
      // Create event with the provided data
      const created = await this.projectService.createEvent(this.projectId, data.name, data.desc, data.start_date, data.end_date);
      this.events = [...this.events, { id: created.id, name: created.name, desc: created.desc ?? '', start_date: created.start_date ?? null, end_date: created.end_date ?? null }];
      
      // If we have a selected doc, attach the new event to it
      if (this.selectedDoc) {
        await this.projectService.attachEventToDoc(this.selectedDoc.id, created.id);
        this.docEventIds = new Set([...this.docEventIds, created.id]);
        
        // Update project header cache
        const current = this.projectHeaderDocEventsCache.get(this.selectedDoc.id) || [];
        this.projectHeaderDocEventsCache.set(this.selectedDoc.id, [...current, created.id]);
        
        // Refresh parent folder's event list (union of all docs)
        if (this.currentGroup) {
          await this.loadDocGroupEvents(this.currentGroup.id);
        }
      }
      // If we have a selected group, attach the new event to it
      else if (this.selectedGroup) {
        await this.projectService.attachEventToDocGroup(this.selectedGroup.id, created.id);
        this.docGroupEventIds = new Set([...this.docGroupEventIds, created.id]);
      }
      this.changeDetector.markForCheck();
    } catch (error) {
      console.error('Failed to create event:', error);
      alert('Failed to create event: ' + error);
    }
  }

  async onSidebarEventUpdate(payload: { id: number; name: string; desc: string; start_date: string | null; end_date: string | null }): Promise<void> {
    try {
      // Find existing event to preserve fields if not provided
      const existingEvent = this.events.find(e => e.id === payload.id);
      const updatedDesc = payload.desc || existingEvent?.desc || '';
      const updatedStartDate = payload.start_date ?? existingEvent?.start_date ?? null;
      const updatedEndDate = payload.end_date ?? existingEvent?.end_date ?? null;
      
      await this.projectService.updateEvent(payload.id, { name: payload.name, desc: updatedDesc, start_date: updatedStartDate, end_date: updatedEndDate });
      const idx = this.events.findIndex(e => e.id === payload.id);
      if (idx !== -1) {
        this.events[idx] = { ...this.events[idx], name: payload.name, desc: updatedDesc, start_date: updatedStartDate, end_date: updatedEndDate } as any;
        this.events = [...this.events];
      }
      if (this.editingEventId === payload.id) {
        this.editingEventId = null;
      }
      this.changeDetector.markForCheck();
    } catch (error) {
      console.error('Failed to update event:', error);
    }
  }

  // Inline edit handler (name only)
  onInlineEventEdit(payload: { id: number; name: string }): void {
    this.onSidebarEventUpdate({ id: payload.id, name: payload.name, desc: '', start_date: null, end_date: null });
  }

  async onSidebarEventDelete(id: number): Promise<void> {
    console.log('[ProjectView] onSidebarEventDelete called with id:', id);
    try {
      await this.projectService.deleteEvent(id);
      console.log('[ProjectView] Event deleted successfully');
      this.events = this.events.filter(e => e.id !== id);
      
      // Track if we need to refresh folder list
      const wasInDocEvents = this.docEventIds.has(id);
      const wasInGroupEvents = this.docGroupEventIds.has(id);
      
      if (wasInDocEvents) {
        this.docEventIds.delete(id);
        this.docEventIds = new Set(this.docEventIds);
      }
      
      // Remove from folder selection if present
      if (wasInGroupEvents) {
        this.docGroupEventIds.delete(id);
        this.docGroupEventIds = new Set(this.docGroupEventIds);
      }
      
      // Refresh parent folder's event list if the event was used in any doc
      if (this.currentGroup && (wasInDocEvents || wasInGroupEvents)) {
        await this.loadDocGroupEvents(this.currentGroup.id);
      }
      
      // Trigger change detection to update the UI
      this.changeDetector.markForCheck();
    } catch (error) {
      console.error('Failed to delete event:', error);
      alert('Failed to delete event: ' + error);
    }
  }

  async onSidebarEventToggle(payload: { eventId: number; checked: boolean }): Promise<void> {
    if (!this.selectedDoc) return;
    const { eventId, checked } = payload;
    try {
      if (checked) {
        await this.projectService.attachEventToDoc(this.selectedDoc.id, eventId);
        this.docEventIds.add(eventId);
        // Update project header cache
        const current = this.projectHeaderDocEventsCache.get(this.selectedDoc.id) || [];
        if (!current.includes(eventId)) {
          this.projectHeaderDocEventsCache.set(this.selectedDoc.id, [...current, eventId]);
        }
      } else {
        await this.projectService.detachEventFromDoc(this.selectedDoc.id, eventId);
        this.docEventIds.delete(eventId);
        // Update project header cache
        const current = this.projectHeaderDocEventsCache.get(this.selectedDoc.id) || [];
        this.projectHeaderDocEventsCache.set(this.selectedDoc.id, current.filter(id => id !== eventId));
      }
      this.docEventIds = new Set(this.docEventIds);
      
      // Refresh parent folder's event list (union of all docs)
      if (this.currentGroup) {
        await this.loadDocGroupEvents(this.currentGroup.id);
      }
      this.changeDetector.markForCheck();
    } catch (error) {
      console.error('Failed to update event relation:', error);
    }
  }

  async onSidebarCharacterDelete(id: number): Promise<void> {
    console.log('[ProjectView] onSidebarCharacterDelete called with id:', id);
    try {
      await this.projectService.deleteCharacter(id);
      console.log('[ProjectView] Character deleted successfully');
      this.characters = this.characters.filter(c => c.id !== id);
      
      // Track if we need to refresh folder list
      const wasInDocCharacters = this.docCharacterIds.has(id);
      const wasInGroupCharacters = this.docGroupCharacterIds.has(id);
      
      // Ensure it is also removed from current doc selection
      if (wasInDocCharacters) {
        this.docCharacterIds.delete(id);
        this.docCharacterIds = new Set(this.docCharacterIds);
      }
      
      // Remove from folder selection if present
      if (wasInGroupCharacters) {
        this.docGroupCharacterIds.delete(id);
        this.docGroupCharacterIds = new Set(this.docGroupCharacterIds);
      }
      
      // Refresh parent folder's character list if the character was used in any doc
      if (this.currentGroup && (wasInDocCharacters || wasInGroupCharacters)) {
        await this.loadDocGroupCharacters(this.currentGroup.id);
      }
      
      // Trigger change detection to update the UI
      this.changeDetector.markForCheck();
    } catch (error) {
      console.error('Failed to delete character:', error);
      alert('Failed to delete character: ' + error);
    }
  }

  async onSidebarCharacterToggle(payload: { characterId: number; checked: boolean }): Promise<void> {
    if (!this.selectedDoc) return;
    const { characterId, checked } = payload;
    try {
      if (checked) {
        await this.projectService.attachCharacterToDoc(this.selectedDoc.id, characterId);
        this.docCharacterIds.add(characterId);
        // Update project header cache
        const current = this.projectHeaderDocCharactersCache.get(this.selectedDoc.id) || [];
        if (!current.includes(characterId)) {
          this.projectHeaderDocCharactersCache.set(this.selectedDoc.id, [...current, characterId]);
        }
      } else {
        await this.projectService.detachCharacterFromDoc(this.selectedDoc.id, characterId);
        this.docCharacterIds.delete(characterId);
        // Update project header cache
        const current = this.projectHeaderDocCharactersCache.get(this.selectedDoc.id) || [];
        this.projectHeaderDocCharactersCache.set(this.selectedDoc.id, current.filter(id => id !== characterId));
      }
      // Reassign to trigger OnPush consumers
      this.docCharacterIds = new Set(this.docCharacterIds);
      
      // Refresh parent folder's character list (union of all docs)
      if (this.currentGroup) {
        await this.loadDocGroupCharacters(this.currentGroup.id);
      }
      this.changeDetector.markForCheck();
    } catch (error) {
      console.error('Failed to update character relation:', error);
    }
  }

  async onSidebarDocGroupCharacterToggle(payload: { characterId: number; checked: boolean }): Promise<void> {
    if (!this.selectedGroup) return;
    const { characterId, checked } = payload;
    try {
      if (checked) {
        await this.projectService.attachCharacterToDocGroup(this.selectedGroup.id, characterId);
        this.docGroupCharacterIds.add(characterId);
      } else {
        await this.projectService.detachCharacterFromDocGroup(this.selectedGroup.id, characterId);
        this.docGroupCharacterIds.delete(characterId);
      }
      // Reassign to trigger OnPush consumers
      this.docGroupCharacterIds = new Set(this.docGroupCharacterIds);
    } catch (error) {
      console.error('Failed to update doc group character relation:', error);
    }
  }

  async onSidebarDocGroupEventToggle(payload: { eventId: number; checked: boolean }): Promise<void> {
    if (!this.selectedGroup) return;
    const { eventId, checked } = payload;
    try {
      if (checked) {
        await this.projectService.attachEventToDocGroup(this.selectedGroup.id, eventId);
        this.docGroupEventIds.add(eventId);
      } else {
        await this.projectService.detachEventFromDocGroup(this.selectedGroup.id, eventId);
        this.docGroupEventIds.delete(eventId);
      }
      // Reassign to trigger OnPush consumers
      this.docGroupEventIds = new Set(this.docGroupEventIds);
    } catch (error) {
      console.error('Failed to update doc group event relation:', error);
    }
  }

  // ===== Places sidebar handlers =====
  async onSidebarPlaceAdd(): Promise<void> {
    try {
      const created = await this.projectService.createPlace(this.projectId, 'New Place', '');
      this.places = [...this.places, { id: created.id, name: created.name, desc: created.desc ?? '' }];
      this.editingPlaceId = created.id;
    } catch (error) {
      console.error('Failed to create place:', error);
      alert('Failed to create place: ' + error);
    }
  }

  async onSidebarPlaceCreate(data: { name: string; desc: string }): Promise<void> {
    try {
      const created = await this.projectService.createPlace(this.projectId, data.name, data.desc);
      this.places = [...this.places, { id: created.id, name: created.name, desc: created.desc ?? '' }];
      
      if (this.selectedDoc) {
        await this.projectService.attachPlaceToDoc(this.selectedDoc.id, created.id);
        this.docPlaceIds = new Set([...this.docPlaceIds, created.id]);
        
        // Update project header cache
        const current = this.projectHeaderDocPlacesCache.get(this.selectedDoc.id) || [];
        this.projectHeaderDocPlacesCache.set(this.selectedDoc.id, [...current, created.id]);
        
        if (this.currentGroup) {
          await this.loadDocGroupPlaces(this.currentGroup.id);
        }
      } else if (this.selectedGroup) {
        await this.projectService.attachPlaceToDocGroup(this.selectedGroup.id, created.id);
        this.docGroupPlaceIds = new Set([...this.docGroupPlaceIds, created.id]);
      }
      this.changeDetector.markForCheck();
    } catch (error) {
      console.error('Failed to create place:', error);
      alert('Failed to create place: ' + error);
    }
  }

  async onSidebarPlaceUpdate(payload: { id: number; name: string; desc: string }): Promise<void> {
    try {
      // Find existing place to preserve desc if not provided
      const existingPlace = this.places.find(p => p.id === payload.id);
      const updatedDesc = payload.desc || existingPlace?.desc || '';
      
      await this.projectService.updatePlace(payload.id, { name: payload.name, desc: updatedDesc });
      const idx = this.places.findIndex(p => p.id === payload.id);
      if (idx !== -1) {
        this.places[idx] = { ...this.places[idx], name: payload.name, desc: updatedDesc };
        this.places = [...this.places];
      }
      if (this.editingPlaceId === payload.id) {
        this.editingPlaceId = null;
      }
      this.changeDetector.markForCheck();
    } catch (error) {
      console.error('Failed to update place:', error);
    }
  }

  // Inline edit handler (name only)
  onInlinePlaceEdit(payload: { id: number; name: string }): void {
    this.onSidebarPlaceUpdate({ id: payload.id, name: payload.name, desc: '' });
  }

  async onSidebarPlaceDelete(id: number): Promise<void> {
    console.log('[ProjectView] onSidebarPlaceDelete called with id:', id);
    try {
      await this.projectService.deletePlace(id);
      console.log('[ProjectView] Place deleted successfully');
      this.places = this.places.filter(p => p.id !== id);
      
      const wasInDocPlaces = this.docPlaceIds.has(id);
      const wasInGroupPlaces = this.docGroupPlaceIds.has(id);
      
      if (wasInDocPlaces) {
        this.docPlaceIds.delete(id);
        this.docPlaceIds = new Set(this.docPlaceIds);
      }
      
      if (wasInGroupPlaces) {
        this.docGroupPlaceIds.delete(id);
        this.docGroupPlaceIds = new Set(this.docGroupPlaceIds);
      }
      
      if (this.currentGroup && (wasInDocPlaces || wasInGroupPlaces)) {
        await this.loadDocGroupPlaces(this.currentGroup.id);
      }
      
      // Trigger change detection to update the UI
      this.changeDetector.markForCheck();
    } catch (error) {
      console.error('Failed to delete place:', error);
      alert('Failed to delete place: ' + error);
    }
  }

  async onSidebarPlaceToggle(payload: { placeId: number; checked: boolean }): Promise<void> {
    if (!this.selectedDoc) return;
    const { placeId, checked } = payload;
    try {
      if (checked) {
        await this.projectService.attachPlaceToDoc(this.selectedDoc.id, placeId);
        this.docPlaceIds.add(placeId);
        // Update project header cache
        const current = this.projectHeaderDocPlacesCache.get(this.selectedDoc.id) || [];
        if (!current.includes(placeId)) {
          this.projectHeaderDocPlacesCache.set(this.selectedDoc.id, [...current, placeId]);
        }
      } else {
        await this.projectService.detachPlaceFromDoc(this.selectedDoc.id, placeId);
        this.docPlaceIds.delete(placeId);
        // Update project header cache
        const current = this.projectHeaderDocPlacesCache.get(this.selectedDoc.id) || [];
        this.projectHeaderDocPlacesCache.set(this.selectedDoc.id, current.filter(id => id !== placeId));
      }
      this.docPlaceIds = new Set(this.docPlaceIds);
      
      if (this.currentGroup) {
        await this.loadDocGroupPlaces(this.currentGroup.id);
      }
      this.changeDetector.markForCheck();
    } catch (error) {
      console.error('Failed to update doc place relation:', error);
    }
  }

  async onSidebarDocGroupPlaceToggle(payload: { placeId: number; checked: boolean }): Promise<void> {
    if (!this.selectedGroup) return;
    const { placeId, checked } = payload;
    try {
      if (checked) {
        await this.projectService.attachPlaceToDocGroup(this.selectedGroup.id, placeId);
        this.docGroupPlaceIds.add(placeId);
      } else {
        await this.projectService.detachPlaceFromDocGroup(this.selectedGroup.id, placeId);
        this.docGroupPlaceIds.delete(placeId);
      }
      this.docGroupPlaceIds = new Set(this.docGroupPlaceIds);
    } catch (error) {
      console.error('Failed to update doc group place relation:', error);
    }
  }

  // ===== Reordering from sidebar (temporary local persistence) =====
  onSidebarCharactersReorder(orderIds: number[]): void {
    this.characters = this.applyOrder(this.characters, orderIds);
    try {
      localStorage.setItem(this.getCharactersOrderKey(this.projectId), JSON.stringify(orderIds));
    } catch {}
  }

  onSidebarEventsReorder(orderIds: number[]): void {
    this.events = this.applyOrder(this.events, orderIds);
    try {
      localStorage.setItem(this.getEventsOrderKey(this.projectId), JSON.stringify(orderIds));
    } catch {}
  }

  onSidebarPlacesReorder(orderIds: number[]): void {
    this.places = this.applyOrder(this.places, orderIds);
    try {
      localStorage.setItem(this.getPlacesOrderKey(this.projectId), JSON.stringify(orderIds));
    } catch {}
  }

  // Stable reorder helper: items present in orderIds are sorted accordingly; others keep relative order and are appended
  private applyOrder<T extends { id: number }>(items: T[], orderIds: number[]): T[] {
    if (!Array.isArray(orderIds) || orderIds.length === 0) return [...items];
    const idToItem = new Map(items.map(i => [i.id, i] as const));
    const inOrder: T[] = [];
    const seen = new Set<number>();
    for (const id of orderIds) {
      const item = idToItem.get(id);
      if (item) {
        inOrder.push(item);
        seen.add(id);
      }
    }
    const remainder = items.filter(i => !seen.has(i.id));
    return [...inOrder, ...remainder];
  }

  toggleLeftSidebar() {
    this.leftCollapsed = !this.leftCollapsed;
    this.saveLayoutState();
  }

  toggleRightSidebar() {
    this.rightCollapsed = !this.rightCollapsed;
    this.saveLayoutState();
  }

  toggleBothSidebars() {
    // If both are collapsed, expand both; otherwise collapse both
    if (this.leftCollapsed && this.rightCollapsed) {
      this.leftCollapsed = false;
      this.rightCollapsed = false;
    } else {
      this.leftCollapsed = true;
      this.rightCollapsed = true;
    }
    this.saveLayoutState();
  }

  toggleTimelineHeader() {
    this.timelineHeaderVisible = !this.timelineHeaderVisible;
    this.saveLayoutState();
  }

  startResizeLeft(width: number) {
    this.leftWidth = width;
    this.saveLayoutState();
  }

  startResizeRight(width: number) {
    this.rightWidth = width;
    this.saveLayoutState();
  }

  // Allow dragging from collapsed handles to expand sidebars
  startDragExpandLeft(event: MouseEvent) {
    event.preventDefault();
    const onMouseMove = (e: MouseEvent) => {
      // Expand and set width based on cursor X
      this.leftCollapsed = false;
      this.leftWidth = Math.max(200, Math.min(600, e.clientX));
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      this.saveLayoutState();
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  startDragExpandRight(event: MouseEvent) {
    event.preventDefault();
    const onMouseMove = (e: MouseEvent) => {
      // Expand and set width from right edge
      this.rightCollapsed = false;
      this.rightWidth = Math.max(250, window.innerWidth - e.clientX);
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      this.saveLayoutState();
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  saveLayoutState() {
    localStorage.setItem('cora-layout', JSON.stringify({
      leftWidth: this.leftWidth,
      rightWidth: this.rightWidth,
      leftCollapsed: this.leftCollapsed,
      rightCollapsed: this.rightCollapsed,
      timelineHeaderVisible: this.timelineHeaderVisible
    }));
  }

  loadLayoutState() {
    const saved = localStorage.getItem('cora-layout');
    if (saved) {
      const state = JSON.parse(saved);
      this.leftWidth = (state.leftWidth ?? 250);
      this.rightWidth = (state.rightWidth ?? 300);
      this.leftCollapsed = (state.leftCollapsed ?? false);
      this.rightCollapsed = (state.rightCollapsed ?? false);
      this.timelineHeaderVisible = !!(state.timelineHeaderVisible); // hidden by default
    }
  }

  goBack() {
    this.router.navigate(['/']);
  }

  onTimelineUpdated(timeline: Timeline) {
    this.timelineStart = timeline.start_date ?? null;
    this.timelineEnd = timeline.end_date ?? null;
    this.changeDetector.markForCheck();
  }

  async onDocTimelineClick(event: { docId: number; clickPosition: number }) {
    if (!this.timelineStart || !this.timelineEnd) {
      return;
    }

    // Calculate the date from click position
    const startMs = new Date(this.timelineStart).getTime();
    const endMs = new Date(this.timelineEnd).getTime();
    const duration = endMs - startMs;
    const clickMs = startMs + (duration * event.clickPosition / 100);
    const clickedDate = new Date(clickMs);
    const clickedDateStr = clickedDate.toISOString().split('T')[0];

    try {
      // Get existing timeline if any
      const existingTimeline = await this.timelineService.getTimelineByEntity('doc', event.docId);

      let startDate: string | null;
      let endDate: string | null;

      if (!existingTimeline || !existingTimeline.start_date || !existingTimeline.end_date) {
        // First click: set both start and end to the same date (creates a point)
        startDate = clickedDateStr;
        endDate = clickedDateStr;
      } else {
        // Timeline exists: extend it based on click position
        const existingStartMs = new Date(existingTimeline.start_date).getTime();
        const existingEndMs = new Date(existingTimeline.end_date).getTime();
        
        if (clickMs < existingStartMs) {
          // Click is before start: move start date
          startDate = clickedDateStr;
          endDate = existingTimeline.end_date;
        } else if (clickMs > existingEndMs) {
          // Click is after end: move end date
          startDate = existingTimeline.start_date;
          endDate = clickedDateStr;
        } else {
          // Click is in the middle: do nothing
          return;
        }
      }

      // Create or update timeline
      await this.timelineService.upsertTimeline('doc', event.docId, startDate, endDate);

      // Reload timelines in the timeline component
      if (this.projectTimelineComponent) {
        await this.projectTimelineComponent.loadDocTimelines();
        this.changeDetector.markForCheck();
      }
    } catch (error) {
      console.error('Error setting doc timeline:', error);
      await confirm(`Failed to set timeline: ${error}`, {
        title: 'Error',
        kind: 'error',
        okLabel: 'OK'
      });
    }
  }

  async onDocIntervalClick(event: { docId: number }) {
    // Clicking on existing interval does nothing - prevents accidental changes
    // User can extend the timeline by clicking before/after the interval
  }

  getWordCount(): number {
    if (!this.selectedDoc?.text) return 0;
    const words = this.selectedDoc.text.split(/\s+/).filter(w => w.trim().length > 0);
    return words.length;
  }

  // ==================== DRAFT LOCAL STORAGE & AUTO-SYNC ====================

  private getLocalDraftKey(draftId: number): string {
    return `cora-draft-${draftId}`;
  }

  private getLocalDraftContent(draftId: number): string | null {
    try {
      return localStorage.getItem(this.getLocalDraftKey(draftId));
    } catch {
      return null;
    }
  }

  private setLocalDraftContent(draftId: number, content: string): void {
    try {
      localStorage.setItem(this.getLocalDraftKey(draftId), content);
    } catch {
      console.error('Failed to save draft to localStorage');
    }
  }

  getDraftLocalContent(draftId: number): string {
    return this.draftLocalContent.get(draftId) || '';
  }

  onDraftChange(draftId: number, content: string, cursorPosition: number): void {
    // Track which draft is actively being edited for focus restoration
    this.focusedDraftId = draftId;
    // Update local memory cache immediately
    this.draftLocalContent.set(draftId, content);
    
    // Save to localStorage immediately
    this.setLocalDraftContent(draftId, content);
    
    // Set status to pending
    this.draftSyncStatus[draftId] = 'pending';
    // Cancel any pending clear of synced indicator
    const prevClear = this.draftSyncedClearTimeouts.get(draftId);
    if (prevClear) {
      clearTimeout(prevClear);
      this.draftSyncedClearTimeouts.delete(draftId);
    }
    
    // Clear existing timeout
    const existingTimeout = this.draftAutoSaveTimeouts.get(draftId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    // Debounce auto-save to backend (500ms)
    const timeout = setTimeout(() => {
      this.syncDraftToBackend(draftId, cursorPosition);
    }, 500);
    
    this.draftAutoSaveTimeouts.set(draftId, timeout);
  }

  onDraftBlur(draftId: number): void {
    // Clear focused state when leaving the textarea
    if (this.focusedDraftId === draftId) {
      this.focusedDraftId = null;
    }
    // Force immediate sync on blur
    const timeout = this.draftAutoSaveTimeouts.get(draftId);
    if (timeout) {
      clearTimeout(timeout);
      this.draftAutoSaveTimeouts.delete(draftId);
    }
    
    const status = this.draftSyncStatus[draftId];
    if (status === 'pending') {
      this.syncDraftToBackend(draftId);
    }
  }

  // ======== Index labels for headers ========
  getFolderIndexLabel(): string | null {
    const group = this.selectedGroup || this.currentGroup;
    if (!group) return null;
    const path = this.findGroupIndexPath(group.id);
    return path ? path.join('.') : null;
  }

  getDocIndexLabel(): string | null {
    const doc = this.selectedDoc;
    if (!doc) return null;
    const res = this.findDocIndexPath(doc.id);
    if (!res) return null;
    const { groupPath, docIndex } = res;
    return [...groupPath, docIndex + 1].join('.');
  }

  private findGroupIndexPath(targetId: number): number[] | null {
    const dfs = (groups: DocGroup[], prefix: number[]): number[] | null => {
      for (let i = 0; i < groups.length; i++) {
        const g = groups[i];
        const path = [...prefix, i + 1];
        if (g.id === targetId) return path;
        if (g.groups && g.groups.length) {
          const child = dfs(g.groups, path);
          if (child) return child;
        }
      }
      return null;
    };
    return dfs(this.docGroups, []);
  }

  private findDocIndexPath(docId: number): { groupPath: number[]; docIndex: number } | null {
    const dfs = (groups: DocGroup[], prefix: number[]): { groupPath: number[]; docIndex: number } | null => {
      for (let i = 0; i < groups.length; i++) {
        const g = groups[i];
        // Docs directly in this group
        const dIdx = g.docs.findIndex(d => d.id === docId);
        if (dIdx !== -1) {
          return { groupPath: [...prefix, i + 1], docIndex: dIdx };
        }
        if (g.groups && g.groups.length) {
          const child = dfs(g.groups, [...prefix, i + 1]);
          if (child) return child;
        }
      }
      return null;
    };
    return dfs(this.docGroups, []);
  }

  private async syncDraftToBackend(draftId: number, cursorPosition?: number): Promise<void> {
    const content = this.draftLocalContent.get(draftId);
    if (content === undefined) return;
    
    // Check if this is the currently focused draft
    const wasFocused = this.focusedDraftId === draftId;
    
    // Cancel any pending clear timers before changing status
    const prevClear = this.draftSyncedClearTimeouts.get(draftId);
    if (prevClear) {
      clearTimeout(prevClear);
      this.draftSyncedClearTimeouts.delete(draftId);
    }

    this.draftSyncStatus[draftId] = 'syncing';
    
    try {
      const draft = this.drafts.find(d => d.id === draftId);
      if (!draft) return;
      
      await this.projectService.updateDraft(draftId, draft.name, content);
      
      // Update the draft metadata from backend without overwriting content being edited
      const updated = await this.projectService.getDraft(draftId);
      if (updated) {
        const index = this.drafts.findIndex(d => d.id === draftId);
        if (index !== -1) {
          // Preserve current content from UI/local cache; update only metadata
          this.drafts[index].name = updated.name;
          this.drafts[index].updated_at = updated.updated_at;
          this.changeDetector.detectChanges();

          // Restore focus and cursor position after change detection
          if (wasFocused && cursorPosition !== undefined) {
            const textareas = document.querySelectorAll('.draft-textarea');
            const draftIndex = this.drafts.findIndex(d => d.id === draftId);
            if (draftIndex !== -1 && textareas[draftIndex]) {
              const textarea = textareas[draftIndex] as HTMLTextAreaElement;
              setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(cursorPosition, cursorPosition);
              }, 0);
            }
          }
        }
      }
      
      this.draftSyncStatus[draftId] = 'synced';
      // Auto-hide the checkmark after a short delay if no further edits occur
      const clearTimer = setTimeout(() => {
        // Only clear if status still 'synced' (i.e., user hasn't typed again)
        if (this.draftSyncStatus[draftId] === 'synced') {
          delete this.draftSyncStatus[draftId];
        }
        this.draftSyncedClearTimeouts.delete(draftId);
      }, 2500);
      this.draftSyncedClearTimeouts.set(draftId, clearTimer);
    } catch (error) {
      console.error('Failed to sync draft:', error);
      this.draftSyncStatus[draftId] = 'pending';
    }
  }

  async deleteDraft(draftId: number): Promise<void> {
    try {
      await this.projectService.deleteDraft(draftId);
      
      // Remove from local cache
      this.draftLocalContent.delete(draftId);
      delete this.draftSyncStatus[draftId];
      
      // Clear any pending timeouts
      const timeout = this.draftAutoSaveTimeouts.get(draftId);
      if (timeout) {
        clearTimeout(timeout);
        this.draftAutoSaveTimeouts.delete(draftId);
      }
      
      // Remove from drafts array
      this.drafts = this.drafts.filter(d => d.id !== draftId);
      // Update tree marker for the current doc
      if (this.selectedDoc) {
        if (this.drafts.length > 0) {
          this.docsWithDrafts.add(this.selectedDoc.id);
        } else {
          this.docsWithDrafts.delete(this.selectedDoc.id);
        }
      }
      // Clear selection if we deleted the selected draft
      if (this.selectedDraftId === draftId) {
        this.selectedDraftId = null;
        if (this.selectedDoc) {
          try { localStorage.removeItem(this.getDraftSelectionKey(this.selectedDoc.id)); } catch {}
        }
      }
    } catch (error) {
      console.error('Failed to delete draft:', error);
    }
  }

  // ==================== DOCUMENT EDITOR DRAFT HANDLERS ====================
  onDocumentDraftAdd(): void {
    this.createDraft();
  }

  onDocumentDraftSelect(draftId: number | null): void {
    this.selectedDraftId = draftId ?? null;
    // Only one draft type at a time: clear folder draft selection when a document draft is selected
    if (this.selectedDraftId != null) {
      this.selectedFolderDraftId = null;
    }
    if (this.selectedDoc) {
      const key = this.getDraftSelectionKey(this.selectedDoc.id);
      try {
        if (draftId == null) {
          localStorage.removeItem(key);
        } else {
          localStorage.setItem(key, String(draftId));
        }
      } catch {}
    }
  }

  onDocumentDraftChanged(event: { draftId: number; content: string; cursorPosition: number }): void {
    // Route to folder draft handler if external mode is active
    if (this.selectedFolderDraftId != null && event.draftId === this.selectedFolderDraftId) {
      this.onFolderDraftChange(event.draftId, event.content, event.cursorPosition);
    } else if (this.selectedProjectDraftId != null && event.draftId === this.selectedProjectDraftId) {
      this.onProjectDraftChange(event.draftId, event.content, event.cursorPosition);
    } else {
      this.onDraftChange(event.draftId, event.content, event.cursorPosition);
    }
  }

  onDocumentDraftBlurred(draftId: number): void {
    if (this.selectedFolderDraftId != null && draftId === this.selectedFolderDraftId) {
      this.onFolderDraftBlur(draftId);
    } else if (this.selectedProjectDraftId != null && draftId === this.selectedProjectDraftId) {
      this.onProjectDraftBlur(draftId);
    } else {
      this.onDraftBlur(draftId);
    }
  }

  async onDocumentDraftRenamed(event: { id: number; name: string }): Promise<void> {
    try {
      const { id, name } = event;
      // Use latest local content if present so we don't clobber unsaved text
      const content = this.draftLocalContent.get(id) ?? this.drafts.find(d => d.id === id)?.content ?? '';
      const updated = await this.projectService.updateDraft(id, name, content);
      // Update local array
      const idx = this.drafts.findIndex(d => d.id === id);
      if (idx !== -1) {
        this.drafts[idx] = { ...this.drafts[idx], name: updated.name, updated_at: updated.updated_at };
        this.drafts = [...this.drafts];
      }
    } catch (error: any) {
      console.error('Failed to rename draft:', error);
      alert('Failed to rename draft: ' + error);
    }
  }
}
