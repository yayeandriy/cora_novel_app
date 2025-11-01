import { Injectable } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";
import type { Timeline, TimelineCreate, TimelineUpdate } from "../shared/models";

@Injectable({ providedIn: "root" })
export class TimelineService {
  async createTimeline(payload: TimelineCreate): Promise<Timeline> {
    return invoke<Timeline>("timeline_create", { payload });
  }

  async getTimeline(id: number): Promise<Timeline | null> {
    return invoke<Timeline | null>("timeline_get", { id });
  }

  async getTimelineByEntity(entityType: 'project' | 'doc' | 'folder' | 'event', entityId: number): Promise<Timeline | null> {
    return invoke<Timeline | null>("timeline_get_by_entity", { entityType, entityId });
  }

  async listTimelines(): Promise<Timeline[]> {
    return invoke<Timeline[]>("timeline_list", {});
  }

  async updateTimeline(id: number, payload: TimelineUpdate): Promise<Timeline> {
    return invoke<Timeline>("timeline_update", { id, payload });
  }

  async deleteTimeline(id: number): Promise<void> {
    return invoke<void>("timeline_delete", { id });
  }

  async deleteTimelineByEntity(entityType: 'project' | 'doc' | 'folder' | 'event', entityId: number): Promise<void> {
    return invoke<void>("timeline_delete_by_entity", { entityType, entityId });
  }

  /**
   * Upsert timeline for an entity (creates if doesn't exist, updates if exists)
   */
  async upsertTimeline(entityType: 'project' | 'doc' | 'folder' | 'event', entityId: number, startDate?: string | null, endDate?: string | null): Promise<Timeline> {
    const payload: TimelineCreate = {
      entity_type: entityType,
      entity_id: entityId,
      start_date: startDate,
      end_date: endDate
    };
    return this.createTimeline(payload);
  }
}
