import { Component, ElementRef, HostListener, inject, signal, viewChild } from '@angular/core';

import { SaveGameService } from '../core/save-game/save-game.service';

@Component({
  selector: 'app-file-handler',
  standalone: true,
  imports: [],
  templateUrl: './file-handler.component.html',
  styleUrl: './file-handler.component.scss',
  host: {
    '[class]': '"group"',
    '[class.is-dragging-over-body]': 'isDraggingOverBody()',
    '[class.is-dragging-over]': 'isDraggingOver()',
    role: 'button',
    tabindex: '0',
  },
})
export class FileHandlerComponent {
  isDraggingOverBody = signal<boolean>(false);
  isDraggingOver = signal<boolean>(false);
  input = viewChild<ElementRef>('input');
  #saveGameService = inject(SaveGameService);

  parseSaveGame($event: Event) {
    const files = ($event.target as HTMLInputElement).files;

    const file = files?.item(0);

    if (file) this.#saveGameService.parseSaveGame(file);
    this.#resetInput();
  }

  @HostListener('click', ['$event'])
  openFilePicker(event?: Event) {
    const input = this.input()?.nativeElement as HTMLInputElement | undefined;

    if (!input || event?.target === input) {
      return;
    }

    input.click();
  }

  @HostListener('keydown.enter', ['$event'])
  @HostListener('keydown.space', ['$event'])
  onKeyboardOpen(event: Event) {
    event.preventDefault();
    this.openFilePicker();
  }

  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDraggingOver.set(false);

    const { dataTransfer } = event;

    if (!dataTransfer) return;

    if (dataTransfer.items) {
      const files = [];
      for (let i = 0; i < dataTransfer.items.length; i++) {
        if (dataTransfer.items[i].kind === 'file') {
          files.push(dataTransfer.items[i].getAsFile());
        }
      }
      dataTransfer.items.clear();
      if (files.length === 1) this.#saveGameService.parseSaveGame(files[0]!);
    } else {
      const files = dataTransfer.files;
      dataTransfer.clearData();
      if (files.length === 1) this.#saveGameService.parseSaveGame(files[0]!);
    }
  }

  @HostListener('dragover')
  onDragOver() {
    this.isDraggingOver.set(true);
  }

  @HostListener('dragleave')
  onDragLeave() {
    this.isDraggingOver.set(false);
  }

  @HostListener('body:dragover', ['$event'])
  onBodyDragOver($event: DragEvent) {
    $event.preventDefault();
    this.isDraggingOverBody.set(true);
  }

  @HostListener('body:drop', ['$event'])
  @HostListener('body:dragleave', ['$event'])
  onBodyDragLeaveDrop($event: DragEvent) {
    $event.preventDefault();
    this.isDraggingOverBody.set(false);
  }

  #resetInput() {
    const input = this.input();
    if (input) input.nativeElement.value = '';
  }
}
