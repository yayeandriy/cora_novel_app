import { AfterViewInit, Directive, ElementRef, HostListener, Input } from '@angular/core';

@Directive({
  selector: '[persistTextareaHeight]'
  , standalone: true
})
export class PersistTextareaHeightDirective implements AfterViewInit {
  @Input('persistTextareaHeight') key!: string;

  private lastSavedHeight = '';

  constructor(private el: ElementRef<HTMLTextAreaElement>) {}

  ngAfterViewInit(): void {
    // Load saved height if available
    const k = this.keySafe();
    try {
      const saved = k ? localStorage.getItem(k) : null;
      if (saved) {
        this.el.nativeElement.style.height = saved;
        this.lastSavedHeight = saved;
      } else {
        // initialize last height from current computed height
        this.lastSavedHeight = this.currentHeight();
      }
    } catch {
      // ignore storage errors (private mode, etc.)
      this.lastSavedHeight = this.currentHeight();
    }
  }

  @HostListener('document:mouseup')
  onGlobalMouseUp(): void {
    // Save on mouse up anywhere (covers resize handle release outside the element)
    this.maybeSave();
  }

  @HostListener('blur')
  onBlur(): void {
    this.maybeSave();
  }

  @HostListener('touchend')
  onTouchEnd(): void {
    this.maybeSave();
  }

  private maybeSave(): void {
    const k = this.keySafe();
    if (!k) return;
    const h = this.currentHeight();
    if (h && h !== this.lastSavedHeight) {
      try {
        localStorage.setItem(k, h);
        this.lastSavedHeight = h;
      } catch {
        // ignore storage errors
      }
    }
  }

  private currentHeight(): string {
    const el = this.el.nativeElement as HTMLTextAreaElement;
    // Prefer explicit style height; fallback to offsetHeight
    const styleH = el.style.height?.trim();
    if (styleH) return styleH;
    const px = `${el.offsetHeight}px`;
    return px;
  }

  private keySafe(): string | null {
    const k = (this.key || '').trim();
    return k ? k : null;
  }
}
