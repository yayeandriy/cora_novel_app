import { Component, signal, computed, ViewChild, ElementRef, AfterViewChecked } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ReactiveFormsModule, FormGroup, FormControl } from "@angular/forms";
import { ProjectService } from "../../services/project.service";
import type { Project, Doc, Archive } from "../../shared/models";
import { open } from "@tauri-apps/plugin-dialog";
import { Router } from "@angular/router";

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
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: "./project-dashboard.component.html",
  styleUrls: ["./project-dashboard.component.css"],
})
export class ProjectDashboardComponent implements AfterViewChecked {
  @ViewChild('newProjectInput') newProjectInput?: ElementRef<HTMLInputElement>;
  
  // Signals for reactive state
  projects = signal<Project[]>([]);
  projectStats = signal<Map<number, ProjectStats>>(new Map());
  archives = signal<Map<number, Archive>>(new Map()); // projectId -> Archive
  showCreate = signal(false);
  editingId = signal<number | null>(null);
  editingCellIndex = signal<number | null>(null);
  isLoading = signal(false);
  showImportMenu = signal(false);
  showArchivedProjects = signal(false);
  
  // For inline editing
  nameControl = new FormControl('');
  private shouldFocusInput = false;
  
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
    
    // Sort by grid_order, then by id as fallback
    return filtered.sort((a, b) => {
      const aOrder = a.grid_order ?? 999;
      const bOrder = b.grid_order ?? 999;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.id - b.id;
    });
  });
  
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
  }
  
  ngAfterViewChecked() {
    if (this.shouldFocusInput && this.newProjectInput) {
      this.newProjectInput.nativeElement.focus();
      this.shouldFocusInput = false;
    }
  }

  async ngOnInit() {
    await this.reload();
  }

  async reload() {
    this.isLoading.set(true);
    try {
      const projectList = await this.svc.listProjects();
      this.projects.set(projectList);
      
      // Fetch stats and archives for each project in parallel
      await Promise.all([
        this.loadAllProjectStats(projectList),
        this.loadAllArchives(projectList)
      ]);
    } finally {
      this.isLoading.set(false);
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
    
    // Separate projects with and without grid_order
    const projectsWithOrder = projects.filter(p => p.grid_order !== null && p.grid_order !== undefined);
    const projectsWithoutOrder = projects.filter(p => p.grid_order === null || p.grid_order === undefined);
    
    // Track which cells are occupied
    const occupiedCells = new Set<number>();
    const cellToProject = new Map<number, ProjectWithArchive>();
    
    // First, place projects that have a grid_order
    for (const p of projectsWithOrder) {
      if (p.grid_order! < totalCells) {
        occupiedCells.add(p.grid_order!);
        cellToProject.set(p.grid_order!, p);
      }
    }
    
    // Then, place projects without grid_order in first available cells
    let nextFreeCell = 0;
    for (const p of projectsWithoutOrder) {
      while (occupiedCells.has(nextFreeCell) && nextFreeCell < totalCells) {
        nextFreeCell++;
      }
      if (nextFreeCell < totalCells) {
        occupiedCells.add(nextFreeCell);
        cellToProject.set(nextFreeCell, p);
        nextFreeCell++;
      }
    }
    
    // Build the cells array
    for (let i = 0; i < totalCells; i++) {
      cells.push({
        index: i,
        project: cellToProject.get(i) || null
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
    
    if (!confirm('Are you sure you want to delete this project?')) {
      return;
    }
    
    await this.svc.deleteProject(id);
    await this.reload();
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
    this.showImportMenu.update(v => !v);
  }

  closeImportMenu() {
    this.showImportMenu.set(false);
  }

  async importFromFolder() {
    this.closeImportMenu();
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
    this.closeImportMenu();
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select a previously exported project folder (contains metadata.json)'
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
      console.error('Failed to import project:', err);
      alert('Failed to import project: ' + err);
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
    
    if (!confirm(`Archive "${project.name}"? It will be hidden from the dashboard.`)) {
      return;
    }
    
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

  async unarchiveProject(project: ProjectWithArchive, event: Event) {
    event.stopPropagation();
    
    if (!project.archiveId) return;
    
    if (!confirm(`Unarchive "${project.name}"?`)) {
      return;
    }
    
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
