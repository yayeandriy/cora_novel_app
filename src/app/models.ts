export interface ProjectCreate {
  name: string;
  desc?: string | null;
  path?: string | null;
}

export interface Project {
  id: number;
  name: string;
  desc?: string | null;
  path?: string | null;
  timeline_start?: string | null;
  timeline_end?: string | null;
}

export interface Character {
  id: number;
  project_id: number;
  name: string;
  desc?: string | null;
}

export interface Event {
  id: number;
  project_id: number;
  name: string;
  desc?: string | null;
  date?: string | null;
}

export interface Doc {
  id: number;
  project_id: number;
  path: string;
  name?: string | null;
  timeline_id?: number | null;
  text?: string | null;
}
