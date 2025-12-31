import { Component, EventEmitter, Output, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-startup-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './startup-view.component.html',
  styleUrls: ['./startup-view.component.css']
})
export class StartupViewComponent implements AfterViewInit {
  @ViewChild('titleInput') titleInput?: ElementRef<HTMLInputElement>;
  @Output() createProject = new EventEmitter<string>();
  
  projectTitle = '';

  ngAfterViewInit() {
    // Auto-focus the input field when the component loads
    setTimeout(() => {
      this.titleInput?.nativeElement.focus();
    }, 100);
  }

  onSubmit() {
    const title = this.projectTitle.trim();
    if (title) {
      this.createProject.emit(title);
    }
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.onSubmit();
    }
  }
}
