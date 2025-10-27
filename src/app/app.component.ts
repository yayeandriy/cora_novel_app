import { Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { CommonModule } from "@angular/common";
import { FormsModule, ReactiveFormsModule, FormGroup, FormControl } from "@angular/forms";
import { ProjectService } from "./services/project.service";
import type { ProjectCreate, Project, DocForm, CharacterForm, EventForm } from "./shared/models";

@Component({
  selector: "app-root",
  imports: [RouterOutlet, CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css",
})
export class AppComponent {
  greetingMessage = "";

  // Admin UI state
  createdProject: Project | null = null;
  fetchedProject: Project | null = null;
  projects: Project[] = [];

  // Reactive forms (typed shape via shared DTOs). Methods still accept legacy
  // parameters for backward compatibility with tests.
  createProjectForm!: FormGroup;
  newDocForm!: FormGroup;
  newCharForm!: FormGroup;
  newEventForm!: FormGroup;

  constructor(private projectService: ProjectService) {}

  ngOnInit(): void {
    // initialize reactive forms
    this.createProjectForm = new FormGroup({
      name: new FormControl("") as FormControl<string | null>,
      desc: new FormControl(null) as FormControl<string | null>,
      path: new FormControl(null) as FormControl<string | null>,
    });

    this.newDocForm = new FormGroup({
      projectId: new FormControl<number | null>(null),
      path: new FormControl("") as FormControl<string | null>,
      name: new FormControl(null) as FormControl<string | null>,
      text: new FormControl(null) as FormControl<string | null>,
    });

    this.newCharForm = new FormGroup({
      projectId: new FormControl<number | null>(null),
      name: new FormControl("") as FormControl<string | null>,
      desc: new FormControl(null) as FormControl<string | null>,
    });

    this.newEventForm = new FormGroup({
      projectId: new FormControl<number | null>(null),
      name: new FormControl("") as FormControl<string | null>,
      desc: new FormControl(null) as FormControl<string | null>,
      date: new FormControl(null) as FormControl<string | null>,
    });
  }

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

  // Backward-compatible: if name provided we use legacy param style, otherwise
  // read from reactive form.
  async createProject(event?: SubmitEvent, name?: string, desc?: string, path?: string) {
    event?.preventDefault();
    const payload: ProjectCreate = name
      ? { name, desc: desc || null, path: path || null }
      : {
          name: this.createProjectForm.value.name ?? "",
          desc: this.createProjectForm.value.desc ?? null,
          path: this.createProjectForm.value.path ?? null,
        };
    try {
      const p = await this.projectService.createProject(payload);
      this.createdProject = p;
      await this.loadProjects();
      // reset form when used
      if (!name) this.createProjectForm.reset({ name: "", desc: null, path: null });
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
    const fv = this.newDocForm.value;
    if (!fv.projectId) return;
    try {
      await this.projectService.createDoc(fv.projectId, fv.path, fv.name, fv.text);
      this.newDocForm.reset({ projectId: null, path: "", name: null, text: null });
    } catch (e) {
      console.error(e);
    }
  }

  async createCharacter(event: SubmitEvent) {
    event.preventDefault();
    const fv = this.newCharForm.value;
    if (!fv.projectId) return;
    try {
      await this.projectService.createCharacter(fv.projectId, fv.name, fv.desc);
      this.newCharForm.reset({ projectId: null, name: "", desc: null });
    } catch (e) {
      console.error(e);
    }
  }

  async createEvent(event: SubmitEvent) {
    event.preventDefault();
    const fv = this.newEventForm.value;
    if (!fv.projectId) return;
    try {
      await this.projectService.createEvent(fv.projectId, fv.name, fv.desc, fv.date);
      this.newEventForm.reset({ projectId: null, name: "", desc: null, date: null });
    } catch (e) {
      console.error(e);
    }
  }
}
