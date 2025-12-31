import { Component, signal, computed, ViewChild, ElementRef, AfterViewChecked, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ReactiveFormsModule, FormGroup, FormControl } from "@angular/forms";
import { ProjectService } from "../../services/project.service";
import type { Project, Doc, Archive } from "../../shared/models";
import { open } from "@tauri-apps/plugin-dialog";
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
  @ViewChild('newProjectInput') newProjectInput?: ElementRef<HTMLInputElement>;
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
  
  // For inline editing
  nameControl = new FormControl('');
  private shouldFocusInput = false;
  private routerSubscription: any;
  private isFirstNavigation = true;
  
  // Computed values
  hasProjects = computed(() => this.projects().length > 0);
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
      
      // Fetch stats and archives for each project in parallel
      await Promise.all([
        this.loadAllProjectStats(projectList),
        this.loadAllArchives(projectList)
      ]);
    } catch (error) {
      console.error('[Dashboard] Failed to load projects:', error);
    } finally {
      this.isLoading.set(false);
      console.log('[Dashboard] isLoading:', this.isLoading(), 'hasProjects:', this.hasProjects(), 'projects count:', this.projects().length);
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
    this.nameControl.reset();
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
  
  formatNumber(n: number): string {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
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
    
    // Simple context menu via confirm dialogs
    const action = prompt('Enter action: edit, delete, or cancel');
    if (action === 'edit') {
      this.editingId.set(p.id);
      this.showCreate.set(true);
      this.form.setValue({ 
        name: p.name, 
        desc: p.desc ?? null, 
        path: p.path ?? null 
      });
    } else if (action === 'delete') {
      if (confirm('Are you sure you want to delete this project?')) {
        this.svc.deleteProject(p.id).then(() => this.reload());
      }
    }
  }

  openProject(p: Project) {
    this.router.navigate(['/project', p.id]);
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
        title: 'Select exported project (ZIP file or folder with metadata.json)',
        filters: [
          { name: 'All Supported', extensions: ['zip'] },
          { name: 'ZIP Archive', extensions: ['zip'] }
        ]
      });
      if (!selected || Array.isArray(selected)) return;
      const imported = await this.svc.importProject(selected as string);
      await this.reload();
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
        directory: true,
        multiple: false,
        title: 'Select a project folder to import'
      });
      if (!selected || Array.isArray(selected)) return;
      const imported = await this.svc.importProject(selected as string);
      await this.reload();
      // Navigate to the newly imported project
      this.openProject(imported);
    } catch (err) {
      console.error('Failed to Import story:', err);
      alert('Failed to Import story: ' + err);
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
}
