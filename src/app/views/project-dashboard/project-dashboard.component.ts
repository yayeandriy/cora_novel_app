import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { listen } from '@tauri-apps/api/event';
import { open, save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { ProjectService } from '../../services/project.service';
import type { RecentFile, OpenProjectInfo } from '../../shared/models';

@Component({
  selector: 'app-project-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './project-dashboard.component.html',
  styleUrls: ['./project-dashboard.component.css'],
})
export class ProjectDashboardComponent implements OnInit, OnDestroy {
  recents = signal<RecentFile[]>([]);
  isLoading = signal(false);
  isCreating = signal(false);
  isOpening = signal(false);
  openError = signal<string | null>(null);

  private unlistenOpenFile?: () => void;

  constructor(
    private projectService: ProjectService,
    private router: Router,
  ) {}

  async ngOnInit() {
    this.isLoading.set(true);
    try {
      await this.loadRecents();
      // Listen for Finder-launched .cora opens while app is already running.
      this.unlistenOpenFile = await listen<string>('cora://open-file', async (event) => {
        await this.openByPath(event.payload);
      });
      // Also check if the app was launched by opening a file.
      const pending = await invoke<string | null>('get_pending_open_file');
      if (pending) {
        await this.openByPath(pending);
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  ngOnDestroy() {
    this.unlistenOpenFile?.();
  }

  async loadRecents() {
    try {
      const list = await this.projectService.recentsList();
      this.recents.set(list);
    } catch (e) {
      console.error('Failed to load recents:', e);
    }
  }

  async onNewProject() {
    if (this.isCreating()) return;
    this.isCreating.set(true);
    try {
      const icloudDocs = await this.getICloudDocumentsPath();
      const savePath = await save({
        title: 'Create New Project',
        defaultPath: icloudDocs ? `${icloudDocs}/Untitled.cora` : undefined,
        filters: [{ name: 'Cora Project', extensions: ['cora'] }],
      });
      if (!savePath) return;

      const stem = savePath.replace(/\\/g, '/').split('/').pop()?.replace(/\.cora$/, '') ?? 'Untitled';
      await this.projectService.fileNewProject(savePath, stem);
      this.navigateToProject();
    } catch (e) {
      console.error('Failed to create project:', e);
    } finally {
      this.isCreating.set(false);
    }
  }

  async onOpenProject() {
    const selected = await open({
      title: 'Open Project',
      multiple: false,
      filters: [{ name: 'Cora Project', extensions: ['cora'] }],
    });
    if (!selected) return;
    const path = Array.isArray(selected) ? selected[0] : selected;
    await this.openByPath(path);
  }

  async openByPath(path: string) {
    if (this.isOpening()) return; // prevent concurrent open calls
    this.openError.set(null);
    this.isOpening.set(true);
    try {
      await this.projectService.fileOpenProject(path);
      this.navigateToProject();
    } catch (e: any) {
      const msg = String(e);
      if (msg.includes('not found') || msg.includes('File not found')) {
        await this.projectService.recentsRemove(path);
        await this.loadRecents();
        this.openError.set(`File not found: ${path}`);
      } else {
        this.openError.set(msg);
        console.error('Failed to open project:', e);
      }
    } finally {
      this.isOpening.set(false);
    }
  }

  async onRemoveRecent(event: Event, path: string) {
    event.stopPropagation();
    await this.projectService.recentsRemove(path);
    await this.loadRecents();
  }

  navigateToProject() {
    this.router.navigate(['/project', 1]);
  }

  formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric'
      });
    } catch {
      return iso;
    }
  }

  pathBasename(path: string): string {
    return path.replace(/\\/g, '/').split('/').pop() ?? path;
  }

  pathDirname(path: string): string {
    const parts = path.replace(/\\/g, '/').split('/');
    parts.pop();
    const joined = parts.join('/');
    const homeParts = parts.slice(0, 3).join('/');
    return joined.replace(homeParts, '~');
  }

  private async getICloudDocumentsPath(): Promise<string | null> {
    try {
      return await invoke<string | null>('icloud_get_project_path');
    } catch {
      return null;
    }
  }
}
