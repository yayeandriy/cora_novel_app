import { Injectable, signal, computed } from '@angular/core';

export interface UndoOperation {
  /** Short human-readable label, e.g. 'Chapter "One"' */
  label: string;
  undo: () => Promise<void>;
}

const MAX_STACK = 50;

@Injectable({ providedIn: 'root' })
export class UndoService {
  private stack: UndoOperation[] = [];

  private _size = signal(0);
  /** True when there is at least one operation that can be undone. */
  readonly canUndo = computed(() => this._size() > 0);

  /** Label of the next operation to undo, or null. */
  get topLabel(): string | null {
    return this.stack.length > 0 ? this.stack[this.stack.length - 1].label : null;
  }

  /** Push a new undoable operation onto the stack. */
  push(op: UndoOperation): void {
    this.stack.push(op);
    if (this.stack.length > MAX_STACK) {
      this.stack.shift();
    }
    this._size.set(this.stack.length);
  }

  /** Pop and return the most recent operation (caller must execute `.undo()`). */
  pop(): UndoOperation | undefined {
    const op = this.stack.pop();
    this._size.set(this.stack.length);
    return op;
  }

  /** Discard all stored operations (e.g. when switching projects). */
  clear(): void {
    this.stack = [];
    this._size.set(0);
  }
}
