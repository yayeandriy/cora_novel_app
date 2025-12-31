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
  private adjectives: string[] = [];
  private nouns: string[] = [];

  async ngOnInit() {
    // Load adjectives and nouns from asset files
    try {
      const [adjectivesResponse, nounsResponse] = await Promise.all([
        fetch('assets/words/adjectives.txt'),
        fetch('assets/words/nouns.txt')
      ]);
      
      const adjectivesText = await adjectivesResponse.text();
      const nounsText = await nounsResponse.text();
      
      this.adjectives = adjectivesText.split('\n').filter(line => line.trim().length > 0);
      this.nouns = nounsText.split('\n').filter(line => line.trim().length > 0);
      
      // Generate a random title from adjective + noun
      if (this.adjectives.length > 0 && this.nouns.length > 0) {
        const randomAdjective = this.adjectives[Math.floor(Math.random() * this.adjectives.length)];
        const randomNoun = this.nouns[Math.floor(Math.random() * this.nouns.length)];
        // Remove any trailing numbers from words (e.g., "Hollow2" -> "Hollow")
        const cleanAdjective = randomAdjective.replace(/\d+$/, '');
        const cleanNoun = randomNoun.replace(/\d+$/, '');
        const title = `${cleanAdjective} ${cleanNoun}`;
        this.projectTitle = this.toSentenceCase(title);
      }
    } catch (error) {
      console.error('Failed to load words:', error);
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
