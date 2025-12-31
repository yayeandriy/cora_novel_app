import { Component, EventEmitter, Output, ViewChild, ElementRef, AfterViewInit, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-startup-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './startup-view.component.html',
  styleUrls: ['./startup-view.component.css']
})
export class StartupViewComponent implements OnInit, AfterViewInit {
  @ViewChild('titleInput') titleInput?: ElementRef<HTMLTextAreaElement>;
  @Output() createProject = new EventEmitter<string>();
  
  projectTitle = '';
  private titles: string[] = [];

  async ngOnInit() {
    // Load titles from the asset file
    try {
      const response = await fetch('assets/novel_titles_10000.txt');
      const text = await response.text();
      this.titles = text.split('\n').filter(line => line.trim().length > 0);
      
      // Set a random title in sentence case
      if (this.titles.length > 0) {
        const randomIndex = Math.floor(Math.random() * this.titles.length);
        const title = this.titles[randomIndex];
        this.projectTitle = this.toSentenceCase(title);
      }
    } catch (error) {
      console.error('Failed to load novel titles:', error);
    }
  }

  private toSentenceCase(text: string): string {
    if (!text) return text;
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  }

  ngAfterViewInit() {
    // Auto-focus the input field when the component loads
    setTimeout(() => {
      const textarea = this.titleInput?.nativeElement;
      if (textarea) {
        this.adjustTextareaHeight();
        textarea.focus();
      }
    }, 100);
  }

  adjustTextareaHeight() {
    const textarea = this.titleInput?.nativeElement;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    }
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
