import { Routes } from "@angular/router";
import { ProjectDashboardComponent } from "./project-dashboard.component";
import { ProjectViewComponent } from "./project-view.component";

export const routes: Routes = [
  { path: '', component: ProjectDashboardComponent },
  { path: 'project/:id', component: ProjectViewComponent }
];
