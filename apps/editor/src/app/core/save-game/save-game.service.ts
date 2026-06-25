import { computed, Injectable, Signal, signal } from '@angular/core';
import { decode_save, encode_save, inspect_save } from '@coral/save-parser';

type SaveCompatibility = 'tested' | 'newerUntested' | 'olderUntested';

export type SaveInspection = {
  outerVersion: number;
  compatibility: SaveCompatibility;
  exportAllowed: boolean;
  warning?: string;
  compressedLen: number;
  innerLen: number;
  chunkCount: number;
};

@Injectable({
  providedIn: 'root',
})
export class SaveGameService {
  readonly status = signal<'NOT_STARTED' | 'PROCESSING' | 'SUCCESS' | 'ERROR' | 'EXPORTING'>('NOT_STARTED');
  readonly decodedData = signal<undefined | null | Record<string, any>>(null);
  readonly inspection = signal<SaveInspection | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly canExport = computed(() => !!this.decodedData() && !!this.inspection()?.exportAllowed);
  readonly #rawData = signal<null | { name: string; content: ArrayBuffer }>(null);

  parseSaveGame(saveFile: File) {
    const reader = new FileReader();
    reader.addEventListener('loadend', (event) => {
      try {
        const target = event.target?.result as ArrayBuffer | undefined;
        if (!target) {
          throw new Error('Unable to read save file.');
        }

        const inspection = inspect_save(target) as SaveInspection;
        const binarySave = decode_save(target);

        this.#rawData.set({ content: target, name: saveFile.name });
        this.inspection.set(inspection);
        this.decodedData.set(binarySave);
        this.errorMessage.set(null);
        this.status.set('SUCCESS');
      } catch (e) {
        this.#rawData.set(null);
        this.inspection.set(null);
        this.decodedData.set(null);
        this.errorMessage.set(e instanceof Error ? e.message : String(e));
        this.status.set('ERROR');
        console.error(e);
      }
    });
    this.status.set('PROCESSING');
    this.errorMessage.set(null);
    reader.readAsArrayBuffer(saveFile);
  }

  get(path: string): Signal<any> {
    return computed(() => {
      const data = this.decodedData();
      return path.split('.').reduce((a, b) => a?.[b], data);
    });
  }

  set(desc: string, value: any) {
    let obj = this.decodedData();
    let arr = desc ? desc.split('.') : [];

    while (arr.length && obj) {
      let comp = arr.shift()!;
      let match = new RegExp('(.+)\\[([0-9]*)\\]').exec(comp);

      // handle arrays
      if (match !== null && match.length == 3) {
        let arrayData = {
          arrName: match[1],
          arrIndex: match[2],
        };
        if (obj[arrayData.arrName] !== undefined) {
          if (typeof value !== 'undefined' && arr.length === 0) {
            obj[arrayData.arrName][arrayData.arrIndex] = value;
          }
          obj = obj[arrayData.arrName][arrayData.arrIndex];
        } else {
          obj = undefined;
        }

        continue;
      }

      // handle regular things
      if (typeof value !== 'undefined') {
        if (obj[comp] === undefined) {
          obj[comp] = {};
        }

        if (arr.length === 0) {
          obj[comp] = value;
        }
      }

      obj = obj[comp];
    }

    return obj;
  }

  save() {
    const rawData = this.#rawData();

    if (!rawData || !this.canExport()) {
      this.errorMessage.set('Export is disabled because this save has not passed compatibility validation.');
      return;
    }

    try {
      this.status.set('EXPORTING');
      const fileData = encode_save(rawData.content, this.decodedData());
      this.#downloadBlob(fileData, rawData.name, 'application/octet-stream');
      this.status.set('SUCCESS');
      this.errorMessage.set(null);
    } catch (e) {
      this.status.set('ERROR');
      this.errorMessage.set(e instanceof Error ? e.message : String(e));
      console.error(e);
    }
  }

  #downloadURL(url: string, fileName: string) {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.style.display = 'none';
    a.click();
    a.remove();
  }

  #downloadBlob(data: Uint8Array, fileName: string, mimeType: string) {
    const blob = new Blob([data], {
      type: mimeType,
    });

    const url = window.URL.createObjectURL(blob);

    this.#downloadURL(url, fileName);

    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  }
}
