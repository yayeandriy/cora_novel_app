import { Injectable } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";
import type { Project, ProjectCreate, Doc, Character, Event } from "../shared/models";

@Injectable({ providedIn: "root" })
export class ProjectService {
  async createProject(payload: ProjectCreate): Promise<Project> {
    // Normalize optional fields so the invoke payload is consistent
    const normalized = { name: payload.name, desc: payload.desc ?? null, path: payload.path ?? null };
    return invoke<Project>("project_create", { payload: normalized });
  }

  async getProject(id: number): Promise<Project | null> {
    return invoke<Project | null>("project_get", { id });
  }

  async listProjects(): Promise<Project[]> {
    return invoke<Project[]>("project_list", {});
  }

  async deleteProject(id: number): Promise<boolean> {
    return invoke<boolean>("project_delete", { id });
  }

  async updateProject(id: number, changes: Partial<ProjectCreate>): Promise<Project> {
    return invoke<Project>("project_update", { id, changes });
  }

  // Basic stubs for docs/characters/events
  async createDoc(projectId: number, path: string, name?: string | null, text?: string | null): Promise<Doc> {
    const payload = { project_id: projectId, path, name: name ?? null, text: text ?? null };
    return invoke<Doc>("doc_create", payload);
  }

  async createCharacter(projectId: number, name: string, desc?: string | null): Promise<Character> {
    const payload = { project_id: projectId, name, desc: desc ?? null };
    return invoke<Character>("character_create", payload);
  }

  async createEvent(projectId: number, name: string, desc?: string | null, date?: string | null): Promise<Event> {
    const payload = { project_id: projectId, name, desc: desc ?? null, date: date ?? null };
    return invoke<Event>("event_create", payload);
  }
}
