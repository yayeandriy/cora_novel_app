import { Component, signal, computed, ViewChild, ElementRef, AfterViewChecked, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ReactiveFormsModule, FormGroup, FormControl } from "@angular/forms";
import { ProjectService } from "../../services/project.service";
import { SyncService } from "../../services/sync.service";
import { ICloudService } from "../../services/icloud.service";
import type { Project, Doc, Archive, ICloudDocInfo } from "../../shared/models";
import { open, ask } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { Router, NavigationEnd } from "@angular/router";
import { StartupViewComponent } from "../../components/startup-view/startup-view.component";
import { filter } from "rxjs";

interface ProjectStats {
  docCount: number;
  charCount: number;
  pageCount: number;
  wordCount: number;
  folderCount: number;
}

interface ProjectWithArchive extends Project {
  isArchived: boolean;
  archiveId?: number;
}

@Component({
  selector: "app-project-dashboard",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, StartupViewComponent],
  templateUrl: "./project-dashboard.component.html",
  styleUrls: ["./project-dashboard.component.css"],
})
export class ProjectDashboardComponent implements AfterViewChecked, OnDestroy {
  @ViewChild('newProjectInput') newProjectInput?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('importMenuContainer') importMenuContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('emptyCellImportContainer') emptyCellImportContainer?: ElementRef<HTMLDivElement>;
  
  // Signals for reactive state
  projects = signal<Project[]>([]);
  projectStats = signal<Map<number, ProjectStats>>(new Map());
  archives = signal<Map<number, Archive>>(new Map()); // projectId -> Archive
  showCreate = signal(false);
  editingId = signal<number | null>(null);
  editingCellIndex = signal<number | null>(null);
  isLoading = signal(false);
  showImportMenu = signal(false);
  importingCellIndex = signal<number | null>(null);
  showArchivedProjects = signal(false);
  confirmingArchive = signal<number | null>(null);
  confirmingDelete = signal<number | null>(null);
  icloudFiles = signal<ICloudDocInfo[]>([]);
  
  // Context menu state (right-click)
  showContextMenu = signal(false);
  contextMenuX = signal(0);
  contextMenuY = signal(0);
  contextMenuProjectId = signal<number | null>(null);

  // Card ellipsis (⋯) menu state
  cardMenuProjectId = signal<number | null>(null);
  cardMenuX = signal(0);
  cardMenuY = signal(0);
  
  // For inline editing
  nameControl = new FormControl('');
  private shouldFocusInput = false;
  private routerSubscription: any;
  private isFirstNavigation = true;
  
  // Random title generation
  private adjectives: string[] = [];
  private nouns: string[] = [];
  
  // Computed values
  hasProjects = computed(() => this.projects().length > 0 || this.icloudFiles().length > 0);
  projectsWithArchive = computed(() => {
    const archivesMap = this.archives();
    return this.projects().map(p => ({
      ...p,
      isArchived: archivesMap.has(p.id),
      archiveId: archivesMap.get(p.id)?.id
    }));
  });
  sortedProjects = computed(() => {
    const showArchived = this.showArchivedProjects();
    const withArchive = this.projectsWithArchive();
    
    // Filter based on archive status
    const filtered = showArchived 
      ? withArchive 
      : withArchive.filter(p => !p.isArchived);
    
    // Sort by id (chronological order - older projects first)
    return filtered.sort((a, b) => a.id - b.id);
  });
  
  // Check if there are any archived projects
  hasArchivedProjects = computed(() => {
    return this.projectsWithArchive().some(p => p.isArchived);
  });
  
  // Check if dock should be visible (has any buttons to show)
  shouldShowDock = computed(() => {
    return this.hasArchivedProjects();
  });
  
  // Dropdown positioning to prevent viewport clipping

  
  form: FormGroup;

  constructor(
    private svc: ProjectService,
    private syncService: SyncService,
    private icloudSvc: ICloudService,
    private router: Router
  ) {
    this.form = new FormGroup({
      name: new FormControl("") as FormControl<string | null>,
      desc: new FormControl(null) as FormControl<string | null>,
      path: new FormControl(null) as FormControl<string | null>,
    });

    // Subscribe to router events to reload when navigating back to dashboard
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        // Skip the first navigation (initial page load)
        if (this.isFirstNavigation) {
          this.isFirstNavigation = false;
          return;
        }
        
        if (event.url === '/' || event.url === '') {
          // Navigated back to dashboard - reload projects
          this.reload();
        }
      });
  }
  
  ngOnDestroy() {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }
  
  ngAfterViewChecked() {
    if (this.shouldFocusInput && this.newProjectInput) {
      this.newProjectInput.nativeElement.focus();
      this.shouldFocusInput = false;
    }
  }

  async ngOnInit() {
    // Load word lists for random title generation
    await this.loadWordLists();
    
    // Always load projects first
    await this.reload();

    // Then check if we should restore the last opened project (only on cold start)
    try {
      const alreadyRestored = sessionStorage.getItem('cora-restored-last-project');
      if (!alreadyRestored) {
        sessionStorage.setItem('cora-restored-last-project', '1');

        const lastRoute = localStorage.getItem('cora-last-route');
        const lastProjectIdStr = localStorage.getItem('cora-last-project-id');
        const lastProjectId = lastProjectIdStr ? Number(lastProjectIdStr) : NaN;

        if (lastRoute === 'project' && Number.isFinite(lastProjectId) && lastProjectId > 0) {
          // Check if the project still exists before navigating
          const projectExists = this.projects().some(p => p.id === lastProjectId);
          if (projectExists) {
            this.router.navigate(['/project', lastProjectId]);
            return;
          }
        }
      }
    } catch {
      // ignore
    }

    // Mark current location (useful if the app is closed on the dashboard)
    try { localStorage.setItem('cora-last-route', 'dashboard'); } catch {}
  }

  private async loadWordLists() {
    try {
      const [adjectivesResponse, nounsResponse] = await Promise.all([
        fetch('assets/words/adjectives.txt'),
        fetch('assets/words/nouns.txt')
      ]);
      
      const adjectivesText = await adjectivesResponse.text();
      const nounsText = await nounsResponse.text();
      
      this.adjectives = adjectivesText.split('\n').filter(line => line.trim().length > 0);
      this.nouns = nounsText.split('\n').filter(line => line.trim().length > 0);
    } catch (error) {
      console.error('Failed to load word lists:', error);
    }
  }
  
  private generateRandomTitle(): string {
    if (this.adjectives.length > 0 && this.nouns.length > 0) {
      const randomAdjective = this.adjectives[Math.floor(Math.random() * this.adjectives.length)];
      const randomNoun = this.nouns[Math.floor(Math.random() * this.nouns.length)];
      // Remove any trailing numbers from words (e.g., "Hollow2" -> "Hollow")
      const cleanAdjective = randomAdjective.replace(/\d+$/, '');
      const cleanNoun = randomNoun.replace(/\d+$/, '');
      const title = `${cleanAdjective} ${cleanNoun}`;
      return this.toSentenceCase(title);
    }
    return '';
  }
  
  private toSentenceCase(text: string): string {
    if (!text) return text;
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  }
  
  adjustTextareaHeight() {
    const textarea = this.newProjectInput?.nativeElement as HTMLTextAreaElement;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    }
  }

  async onStartupCreateProject(name: string) {
    try {
      const created = await this.svc.createProject({ name });
      await this.reload();
      this.router.navigate(['/project', created.id]);
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  }

  async reload() {
    this.isLoading.set(true);
    try {
      const projectList = await this.svc.listProjects();
      console.log('[Dashboard] Loaded projects:', projectList.length, projectList);
      this.projects.set(projectList);
      
      // Fetch stats, archives, and iCloud files in parallel
      await Promise.all([
        this.loadAllProjectStats(projectList),
        this.loadAllArchives(projectList),
        this.loadICloudFiles()
      ]);
    } catch (error) {
      console.error('[Dashboard] Failed to load projects:', error);
    } finally {
      this.isLoading.set(false);
      console.log('[Dashboard] isLoading:', this.isLoading(), 'hasProjects:', this.hasProjects(), 'projects count:', this.projects().length);
    }
  }

  /** Scan iCloud container and keep only files not already linked via a sync record. */
  private async loadICloudFiles() {
    try {
      const available = await this.icloudSvc.isAvailable();
      if (!available) { this.icloudFiles.set([]); return; }

      const [files, syncs] = await Promise.all([
        this.icloudSvc.scanDocuments(),
        this.syncService.listSyncs()
      ]);

      // Filter out .cora files that are already linked to a project via sync
      const linkedPaths = new Set(syncs.map(s => s.file_path));
      this.icloudFiles.set(files.filter(f => !linkedPaths.has(f.path)));
    } catch (err) {
      console.error('[Dashboard] Failed to load iCloud files:', err);
      this.icloudFiles.set([]);
    }
  }
  
  private async loadAllArchives(projectList: Project[]) {
    const archivesMap = new Map<number, Archive>();
    
    await Promise.all(projectList.map(async (project) => {
      try {
        const archives = await this.svc.listArchives(project.id);
        // Store the most recent archive (first one, since list is ordered by created_at DESC)
        if (archives.length > 0) {
          archivesMap.set(project.id, archives[0]);
        }
      } catch (err) {
        console.error(`Failed to load archives for project ${project.id}:`, err);
      }
    }));
    
    this.archives.set(archivesMap);
  }
  
  private async loadAllProjectStats(projectList: Project[]) {
    const statsMap = new Map<number, ProjectStats>();
    
    await Promise.all(projectList.map(async (project) => {
      try {
        const docs = await this.svc.listDocs(project.id);
        const folders = await this.svc.listDocGroups(project.id);
        
        // Only count docs that are in folders (have doc_group_id)
        const docsInFolders = docs.filter(d => d.doc_group_id != null);
        
        let totalChars = 0;
        let totalWords = 0;
        
        for (const doc of docsInFolders) {
          const text = doc.text || '';
          totalChars += text.length;
          totalWords += text.trim() ? text.trim().split(/\s+/).length : 0;
        }
        
        statsMap.set(project.id, {
          docCount: docsInFolders.length,
          charCount: totalChars,
          pageCount: Math.ceil(totalChars / 1800),
          wordCount: totalWords,
          folderCount: folders.length
        });
      } catch (err) {
        console.error(`Failed to load stats for project ${project.id}:`, err);
        statsMap.set(project.id, { docCount: 0, charCount: 0, pageCount: 0, wordCount: 0, folderCount: 0 });
      }
    }));
    
    this.projectStats.set(statsMap);
  }
  
  getStats(projectId: number): ProjectStats {
    return this.projectStats().get(projectId) || { docCount: 0, charCount: 0, pageCount: 0, wordCount: 0, folderCount: 0 };
  }
  
  getGridCells(): { index: number; project: ProjectWithArchive | null }[] {
    const totalCells = 12; // 4 columns x 3 rows
    const projects = this.sortedProjects();
    const cells: { index: number; project: ProjectWithArchive | null }[] = [];
    
    // Fill cells with projects in order, leave remaining cells empty
    for (let i = 0; i < totalCells; i++) {
      cells.push({
        index: i,
        project: projects[i] || null
      });
    }
    
    return cells;
  }
  
  startCreateAt(cellIndex: number) {
    this.editingCellIndex.set(cellIndex);
    this.showCreate.set(true);
    // Generate random title
    const randomTitle = this.generateRandomTitle();
    this.nameControl.setValue(randomTitle);
    this.shouldFocusInput = true;
  }
  
  async createQuick() {
    const name = this.nameControl.value?.trim();
    const cellIndex = this.editingCellIndex();
    
    if (!name) {
      this.cancelEdit();
      return;
    }
    
    await this.svc.createProject({ name, desc: null, path: null, grid_order: cellIndex });
    this.nameControl.reset();
    this.showCreate.set(false);
    this.editingCellIndex.set(null);
    await this.reload();
  }
  
  onInputBlur() {
    // Small delay to allow for Enter key to fire first
    setTimeout(() => {
      if (this.showCreate() && !this.nameControl.value?.trim()) {
        this.cancelEdit();
      }
    }, 150);
  }
  
  /**
   * Format large numbers with K/M suffixes for display
   * Numbers >= 2,000 are displayed as "2K", "1.5M", etc.
   */
  formatNumber(n: number): string {
    if (n >= 1_000_000) {
      const millions = n / 1_000_000;
      return millions >= 10 ? `${Math.round(millions)}M` : `${millions.toFixed(1).replace(/\.0$/, '')}M`;
    }
    if (n >= 2_000) {
      const thousands = n / 1000;
      return thousands >= 10 ? `${Math.round(thousands)}K` : `${thousands.toFixed(1).replace(/\.0$/, '')}K`;
    }
    return n.toLocaleString();
  }

  formatBytes(bytes: number): string {
    if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
    if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(0)} KB`;
    return `${bytes} B`;
  }

  formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      // Show relative time for recent updates
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
      
      // Show full date for older items
      return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  }

  async selectFolder() {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Project Folder",
      });
      
      if (selected) {
        this.form.patchValue({ path: selected });
      }
    } catch (err) {
      console.error("Failed to select folder:", err);
    }
  }

  async create() {
    const v = this.form.value;
    if (!v.name) return;
    
    const currentEditingId = this.editingId();
    if (currentEditingId) {
      // Update existing project
      await this.svc.updateProject(currentEditingId, { 
        name: v.name, 
        desc: v.desc ?? null, 
        path: v.path ?? null 
      });
      this.editingId.set(null);
    } else {
      // Create new project
      await this.svc.createProject({ 
        name: v.name, 
        desc: v.desc ?? null, 
        path: v.path ?? null 
      });
    }
    
    this.form.reset({ name: "", desc: null, path: null });
    await this.reload();
    this.showCreate.set(false);
  }

  toggleCreate() {
    this.showCreate.update(v => !v);
    this.editingId.set(null);
    if (this.showCreate()) {
      this.nameControl.reset();
      this.form.reset({ name: '', desc: null, path: null });
      this.shouldFocusInput = true;
    }
  }

  editProject(p: Project, event: Event) {
    event.stopPropagation();
    this.editingId.set(p.id);
    this.showCreate.set(true);
    this.form.setValue({ 
      name: p.name, 
      desc: p.desc ?? null, 
      path: p.path ?? null 
    });
  }

  async deleteProject(id: number, event: Event) {
    event.stopPropagation();
    this.confirmingDelete.set(id);
  }

  async confirmDeleteAction(id: number, event: Event) {
    event.stopPropagation();
    this.confirmingDelete.set(null);

    // If project has an iCloud sync file, delete it from iCloud too
    try {
      const allSyncs = await this.syncService.listSyncs();
      const projectSync = allSyncs.find(s => s.project_id === id);
      if (projectSync && this.icloudSvc.isICloudPath(projectSync.file_path)) {
        await this.icloudSvc.deleteFile(projectSync.file_path);
      }
    } catch (err) {
      console.warn('[Dashboard] Could not delete iCloud file on project delete:', err);
    }

    await this.svc.deleteProject(id);
    await this.reload();
  }

  cancelDelete(event: Event) {
    event.stopPropagation();
    this.confirmingDelete.set(null);
  }

  cancelEdit() {
    this.editingId.set(null);
    this.editingCellIndex.set(null);
    this.showCreate.set(false);
    this.nameControl.reset();
    this.form.reset({ name: '', desc: null, path: null });
  }

  onProjectContextMenu(p: Project, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    
    console.log('Context menu triggered for project:', p.id, 'at position:', event.clientX, event.clientY);
    
    // Show visual context menu
    this.contextMenuX.set(event.clientX);
    this.contextMenuY.set(event.clientY);
    this.contextMenuProjectId.set(p.id);
    this.showContextMenu.set(true);
    
    console.log('Context menu state:', {
      show: this.showContextMenu(),
      projectId: this.contextMenuProjectId(),
      x: this.contextMenuX(),
      y: this.contextMenuY()
    });
  }

  openProject(p: Project) {
    this.router.navigate(['/project', p.id]);
  }

  /**
   * Import an iCloud .cora file that isn't linked to any local project yet.
   * Automatically enables sync so future changes stay in iCloud.
   */
  async openICloudFile(file: ICloudDocInfo, event: Event) {
    event.stopPropagation();
    try {
      if (file.isPlaceholder) {
        // Trigger download and wait for it before importing
        await this.icloudSvc.ensureDownloaded(file.path);
      }
      const imported = await this.svc.importProject(file.path);
      // Link the imported project to the iCloud file via sync
      await this.syncService.initializeSync(imported.id, file.path, {
        syncDirection: 'db_to_file',
        autoSyncEnabled: true
      });
      await this.reload();
      this.openProject(imported);
    } catch (err) {
      console.error('[Dashboard] Failed to open iCloud file:', err);
    }
  }

  toggleImportMenu(event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    // Dock import button - for now just close any open import
    this.importingCellIndex.set(null);
    this.showImportMenu.set(false);
  }

  closeImportMenu() {
    this.showImportMenu.set(false);
  }

  closeEmptyCellImportMenu() {
    this.importingCellIndex.set(null);
  }

  closeAllMenus() {
    this.closeImportMenu();
    this.closeEmptyCellImportMenu();
    this.closeCardMenu();
  }

  toggleEmptyCellImportMenu(cellIndex: number, event: MouseEvent) {
    event.stopPropagation();
    this.importingCellIndex.update(v => v === cellIndex ? null : cellIndex);
    this.showImportMenu.set(false);
  }

  cancelImport(event: Event) {
    event.stopPropagation();
    this.importingCellIndex.set(null);
  }

  async importFromFolder() {
    this.closeAllMenus();
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select a folder to import (subfolders become chapters, .txt files become documents)'
      });
      if (!selected || Array.isArray(selected)) return;
      const imported = await this.svc.importProject(selected as string);
      await this.reload();
      // Navigate to the newly imported project
      this.openProject(imported);
    } catch (err) {
      console.error('Failed to import from folder:', err);
      alert('Failed to import from folder: ' + err);
    }
  }

  async importFromExport() {
    this.closeAllMenus();
    try {
      const selected = await open({
        multiple: false,
        title: 'Open project file',
        filters: [
          { name: 'Cora Project', extensions: ['cora'] }
        ]
      });
      if (!selected || Array.isArray(selected)) return;
      
      // Check if this file is already synced with a project
      const existingSync = await this.checkFileSync(selected as string);
      if (existingSync) {
        return; // Already navigated to existing project
      }
      
      // Import as new project
      const imported = await this.svc.importProject(selected as string);
      await this.reload();
      
      // Ask user if they want to sync this file with the new project
      const enableSync = await ask('Would you like to keep this file synced with your project? Changes will be automatically saved to this file.', {
        title: 'Enable Sync?',
        kind: 'info',
        okLabel: 'Enable Sync',
        cancelLabel: 'No, just import'
      });
      
      if (enableSync) {
        await this.syncService.initializeSync(imported.id, selected as string, {
          syncDirection: 'db_to_file',
          autoSyncEnabled: true
        });
      }
      
      // Navigate to the newly imported project
      this.openProject(imported);
    } catch (err) {
      console.error('Failed to import from export:', err);
      alert('Failed to import from export: ' + err);
    }
  }

  async importProject() {
    try {
      const selected = await open({
        directory: false,
        multiple: false,
        filters: [{ name: 'Cora Project', extensions: ['cora'] }],
        title: 'Open a project file'
      });
      if (!selected || Array.isArray(selected)) return;
      
      // Check if this file is already synced with a project
      const existingSync = await this.checkFileSync(selected as string);
      if (existingSync) {
        return; // Already navigated to existing project
      }
      
      // Import as new project
      const imported = await this.svc.importProject(selected as string);
      await this.reload();
      
      // Ask user if they want to sync this file with the new project
      const enableSync = await ask('Would you like to keep this file synced with your project? Changes will be automatically saved to this file.', {
        title: 'Enable Sync?',
        kind: 'info',
        okLabel: 'Enable Sync',
        cancelLabel: 'No, just import'
      });
      
      if (enableSync) {
        await this.syncService.initializeSync(imported.id, selected as string, {
          syncDirection: 'db_to_file',
          autoSyncEnabled: true
        });
      }
      
      // Navigate to the newly imported project
      this.openProject(imported);
    } catch (err) {
      console.error('Failed to open project:', err);
      alert('Failed to open project: ' + err);
    }
  }

  /**
   * Check if a file path is already synced with a project.
   * If it is, navigate to that project and return true.
   * If not, return false to allow import.
   */
  private async checkFileSync(filePath: string): Promise<boolean> {
    try {
      // Get all sync records
      const allSyncs = await this.syncService.listSyncs();
      
      // Find sync with matching file path
      const existingSync = allSyncs.find(sync => sync.file_path === filePath);
      
      if (existingSync) {
        // File is already synced - navigate to the existing project
        const project = await this.svc.getProject(existingSync.project_id);
        if (project) {
          await this.reload();
          this.openProject(project);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error checking file sync:', error);
      return false;
    }
  }

  timeAgo(p: Project) {
    // use timeline_start or fallback text
    const when = p.timeline_start ?? null;
    if (!when) return '1 day ago';
    try {
      const d = new Date(when);
      const diff = Date.now() - d.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      if (days <= 0) return 'today';
      if (days === 1) return '1 day ago';
      return `${days} days ago`;
    } catch {
      return '1 day ago';
    }
  }

  toggleShowArchived() {
    this.showArchivedProjects.update(v => !v);
  }

  onCardRightClick(event: MouseEvent, projectId: number) {
    event.preventDefault();
    event.stopPropagation();
    
    // Position the context menu at the click location
    this.contextMenuX.set(event.clientX);
    this.contextMenuY.set(event.clientY);
    this.contextMenuProjectId.set(projectId);
    this.showContextMenu.set(true);
  }
  
  closeContextMenu() {
    this.showContextMenu.set(false);
    this.contextMenuProjectId.set(null);
  }
  
  onContextMenuClickOutside(event: Event) {
    if (this.showContextMenu()) {
      this.closeContextMenu();
    }
  }
  
  async contextMenuDeleteArchive() {
    const projectId = this.contextMenuProjectId();
    if (!projectId) return;
    
    this.closeContextMenu();
    
    // Find the project
    const project = this.projects().find(p => p.id === projectId);
    if (!project) return;
    
    const projectWithArchive: ProjectWithArchive = {
      ...project,
      isArchived: this.archives().has(projectId),
      archiveId: this.archives().get(projectId)?.id
    };
    
    // Check if project is archived or has pages
    const stats = this.getStats(projectId);
    const isArchived = projectWithArchive.isArchived;
    
    if (isArchived || stats.pageCount > 0) {
      // Archive the project (or delete if already archived)
      if (isArchived) {
        // Already archived, so delete
        await this.deleteProject(projectId, new Event('click'));
      } else {
        // Archive it
        await this.archiveProject(projectWithArchive, new Event('click'));
      }
    } else {
      // Empty project, just delete
      await this.deleteProject(projectId, new Event('click'));
    }
  }
  
  async archiveProject(project: ProjectWithArchive, event: Event) {
    event.stopPropagation();
    this.confirmingArchive.set(project.id);
  }

  async confirmArchiveAction(project: ProjectWithArchive, event: Event) {
    event.stopPropagation();
    this.confirmingArchive.set(null);
    
    try {
      const now = new Date().toISOString();
      await this.svc.createArchive(project.id, {
        name: `Archive of ${project.name}`,
        desc: null,
        archived_at: now
      });

      // Move the iCloud .cora file into _Archived/ so it's still in iCloud but clearly archived
      try {
        const allSyncs = await this.syncService.listSyncs();
        const projectSync = allSyncs.find(s => s.project_id === project.id);
        if (projectSync && this.icloudSvc.isICloudPath(projectSync.file_path)) {
          const srcPath = projectSync.file_path;
          // Build destination: same directory + _Archived/<name>.cora
          const srcDir = srcPath.substring(0, srcPath.lastIndexOf('/'));
          const srcFile = srcPath.substring(srcPath.lastIndexOf('/') + 1);
          const destPath = `${srcDir}/_Archived/${srcFile}`;
          await this.icloudSvc.moveFile(srcPath, destPath);
          // Update sync record to the new path
          await this.syncService.updateSync(projectSync.id, { file_path: destPath });
        }
      } catch (err) {
        console.warn('[Dashboard] Could not move iCloud file on archive:', err);
      }
      await this.reload();
    } catch (err) {
      console.error('Failed to archive project:', err);
      alert('Failed to archive project: ' + err);
    }
  }

  cancelArchive(event: Event) {
    event.stopPropagation();
    this.confirmingArchive.set(null);
  }

  async unarchiveProject(project: ProjectWithArchive, event: Event) {
    event.stopPropagation();
    
    if (!project.archiveId) return;
    
    try {
      await this.svc.deleteArchive(project.archiveId);
      await this.reload();
    } catch (err) {
      console.error('Failed to unarchive project:', err);
      alert('Failed to unarchive project: ' + err);
    }
  }

  isArchived(project: Project): boolean {
    return this.archives().has(project.id);
  }

  openCardMenu(projectId: number, event: MouseEvent) {
    event.stopPropagation();
    // Toggle off if already open for same card
    if (this.cardMenuProjectId() === projectId) {
      this.cardMenuProjectId.set(null);
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.cardMenuX.set(rect.right);
    this.cardMenuY.set(rect.bottom + 4);
    this.cardMenuProjectId.set(projectId);
    this.closeContextMenu();
  }

  closeCardMenu() {
    this.cardMenuProjectId.set(null);
  }

  async cardMenuArchive(event: Event) {
    event.stopPropagation();
    const projectId = this.cardMenuProjectId();
    this.closeCardMenu();
    if (!projectId) return;

    const project = this.projects().find(p => p.id === projectId);
    if (!project) return;
    const projectWithArchive: ProjectWithArchive = {
      ...project,
      isArchived: this.archives().has(projectId),
      archiveId: this.archives().get(projectId)?.id
    };
    await this.archiveProject(projectWithArchive, event);
  }

  async cardMenuRevealInFinder(event: Event) {
    event.stopPropagation();
    const projectId = this.cardMenuProjectId();
    this.closeCardMenu();
    if (!projectId) return;

    try {
      const allSyncs = await this.syncService.listSyncs();
      const projectSync = allSyncs.find(s => s.project_id === projectId);
      if (projectSync?.file_path) {
        await revealItemInDir(projectSync.file_path);
      } else {
        // No sync file — reveal the app data directory as fallback
        const project = this.projects().find(p => p.id === projectId);
        if (project?.path) {
          await revealItemInDir(project.path);
        }
      }
    } catch (err) {
      console.error('[Dashboard] Reveal in Finder failed:', err);
    }
  }
}
