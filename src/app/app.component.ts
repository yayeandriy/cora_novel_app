import { Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ProjectService, ProjectCreate, Project } from "./services/project.service";

@Component({
  selector: "app-root",
  imports: [RouterOutlet, CommonModule, FormsModule],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css",
})
export class AppComponent {
  greetingMessage = "";

  // Admin UI state
  createdProject: Project | null = null;
  fetchedProject: Project | null = null;
  projects: Project[] = [];

  // Forms for doc/char/event
  newDoc = { projectId: undefined as number | undefined, path: "", name: "", text: "" };
  newChar = { projectId: undefined as number | undefined, name: "", desc: "" };
  newEvent = { projectId: undefined as number | undefined, name: "", desc: "", date: "" };

  constructor(private projectService: ProjectService) {}

  greet(event: SubmitEvent, name: string): void {
    event.preventDefault();
    // keep the simple greet via invoke
    this.projectService.createProject; // noop to avoid unused
    // Use the original greet command
    (window as any).invoke?.("greet", { name })?.then((text: string) => {
      this.greetingMessage = text;
    }).catch(() => {
      // fallback to Tauri invoke import if available
    });
  }

  async createProject(event: SubmitEvent, name: string, desc?: string, path?: string) {
    event.preventDefault();
    const payload: ProjectCreate = { name, desc: desc || null, path: path || null };
    try {
      const p = await this.projectService.createProject(payload);
      this.createdProject = p;
      await this.loadProjects();
    } catch (e) {
      console.error("createProject error", e);
    }
  }

  async getProject(event: SubmitEvent, idStr: string) {
    event.preventDefault();
    const id = parseInt(idStr, 10);
    if (isNaN(id)) return;
    try {
      const p = await this.projectService.getProject(id);
      this.fetchedProject = p || null;
    } catch (e) {
      console.error("getProject error", e);
    }
  }

  async loadProjects() {
    try {
      this.projects = await this.projectService.listProjects();
    } catch (e) {
      console.error("loadProjects error", e);
    }
  }

  async deleteProject(id: number) {
    try {
      await this.projectService.deleteProject(id);
      this.projects = this.projects.filter((p) => p.id !== id);
    } catch (e) {
      console.error("deleteProject error", e);
    }
  }

  async updateProject(id: number, changes: Partial<ProjectCreate>) {
    try {
      const updated = await this.projectService.updateProject(id, changes);
      this.projects = this.projects.map((p) => (p.id === id ? updated : p));
    } catch (e) {
      console.error("updateProject error", e);
    }
  }

  async createDoc(event: SubmitEvent) {
    event.preventDefault();
    if (!this.newDoc.projectId) return;
    try {
      await this.projectService.createDoc(this.newDoc.projectId, this.newDoc.path, this.newDoc.name, this.newDoc.text);
    } catch (e) {
      console.error(e);
    }
  }

  async createCharacter(event: SubmitEvent) {
    event.preventDefault();
    if (!this.newChar.projectId) return;
    try {
      await this.projectService.createCharacter(this.newChar.projectId, this.newChar.name, this.newChar.desc);
    } catch (e) {
      console.error(e);
    }
  }

  async createEvent(event: SubmitEvent) {
    event.preventDefault();
    if (!this.newEvent.projectId) return;
    try {
      await this.projectService.createEvent(this.newEvent.projectId, this.newEvent.name, this.newEvent.desc, this.newEvent.date);
    } catch (e) {
      console.error(e);
    }
  }
}
