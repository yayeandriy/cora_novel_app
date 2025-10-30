import { Routes } from "@angular/router";
import { ProjectDashboardComponent } from "./views/project-dashboard/project-dashboard.component";
import { ProjectViewComponent } from "./views/project-view/project-view.component";

export const routes: Routes = [
  { path: '', component: ProjectDashboardComponent },
  { path: 'project/:id', component: ProjectViewComponent }
];
