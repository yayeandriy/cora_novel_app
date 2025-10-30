import { Injectable } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";
import type { Project, ProjectCreate, Doc, Character, Event, Draft, DraftCreate } from "../shared/models";

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

  // Doc Groups
  async listDocGroups(projectId: number): Promise<any[]> {
    return invoke<any[]>("doc_group_list", { projectId });
  }

  async createDocGroup(projectId: number, name: string, parentId?: number | null): Promise<any> {
    return invoke<any>("doc_group_create", { projectId, name, parentId: parentId ?? null });
  }

  async createDocGroupAfter(projectId: number, name: string, parentId: number | null, afterSortOrder: number): Promise<any> {
    return invoke<any>("doc_group_create_after", { projectId, name, parentId, afterSortOrder });
  }

  async deleteDocGroup(id: number): Promise<void> {
    return invoke<void>("doc_group_delete", { id });
  }

  async reorderDocGroup(id: number, direction: 'up' | 'down'): Promise<void> {
    return invoke<void>("doc_group_reorder", { id, direction });
  }

  async renameDocGroup(id: number, newName: string): Promise<void> {
    return invoke<void>("doc_group_rename", { id, newName });
  }

  // Docs
  async listDocs(projectId: number): Promise<Doc[]> {
    return invoke<Doc[]>("doc_list", { projectId });
  }

  async getDoc(id: number): Promise<Doc | null> {
    return invoke<Doc | null>("doc_get", { id });
  }

  async createDocNew(projectId: number, name: string, docGroupId?: number | null): Promise<Doc> {
    return invoke<Doc>("doc_create_new", { projectId, name, docGroupId: docGroupId ?? null });
  }

  async createDocAfter(projectId: number, name: string, docGroupId: number | null, afterSortOrder: number): Promise<Doc> {
    return invoke<Doc>("doc_create_after", { projectId, name, docGroupId, afterSortOrder });
  }

  async updateDocText(id: number, text: string): Promise<void> {
    return invoke<void>("doc_update_text", { id, text });
  }

  async updateDocNotes(id: number, notes: string): Promise<void> {
    return invoke<void>("doc_update_notes", { id, notes });
  }

  async deleteDoc(id: number): Promise<void> {
    return invoke<void>("doc_delete", { id });
  }

  async reorderDoc(id: number, direction: 'up' | 'down'): Promise<void> {
    return invoke<void>("doc_reorder", { id, direction });
  }

  async moveDocToGroup(docId: number, newGroupId?: number | null): Promise<void> {
    return invoke<void>("doc_move_to_group", { docId, newGroupId: newGroupId ?? null });
  }

  async renameDoc(id: number, newName: string): Promise<void> {
    return invoke<void>("doc_rename", { id, newName });
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

  // Drafts
  async createDraft(docId: number, name: string, content: string): Promise<Draft> {
    return invoke<Draft>("draft_create", { docId, payload: { name, content } });
  }

  async getDraft(id: number): Promise<Draft | null> {
    return invoke<Draft | null>("draft_get", { id });
  }

  async listDrafts(docId: number): Promise<Draft[]> {
    return invoke<Draft[]>("draft_list", { docId });
  }

  async updateDraft(id: number, name?: string, content?: string): Promise<Draft> {
    return invoke<Draft>("draft_update", { id, payload: { name: name ?? null, content: content ?? null } });
  }

  async deleteDraft(id: number): Promise<void> {
    return invoke<void>("draft_delete", { id });
  }

  async restoreDraftToDoc(draftId: number): Promise<void> {
    return invoke<void>("draft_restore", { draftId });
  }

  async deleteAllDrafts(docId: number): Promise<void> {
    return invoke<void>("draft_delete_all", { docId });
  }
}
