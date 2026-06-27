import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { CORAL_ISLAND_ENUMS } from '@coral-island/enums';
import { CardComponent } from '@coral-island/ui';
import { SaveGameService } from '../../core/save-game/save-game.service';
import {
  buildEnumEditValue,
  coercePrimitiveEditValue,
  describeExplorerNode,
  getExistingPathValue,
  getNumericPathValueOptions,
  listExplorerChildren,
  parseExplorerPath,
  SaveExplorerNode,
  searchExplorerNodes,
} from './save-explorer.model';

const ROOT_RENDER_LIMIT = 100;
const CHILD_RENDER_LIMIT = 200;
const SEARCH_RENDER_LIMIT = 100;
const SEARCH_VISIT_LIMIT = 250000;

@Component({
  selector: 'app-explorer',
  standalone: true,
  imports: [CardComponent, ReactiveFormsModule],
  templateUrl: './explorer.component.html',
  styleUrl: './explorer.component.scss',
})
export class ExplorerComponent {
  protected readonly searchControl = new FormControl('', { nonNullable: true });
  protected readonly searchQuery = signal('');
  protected readonly selectedPath = signal<string | null>(null);
  protected readonly editDraft = signal('');
  protected readonly editError = signal<string | null>(null);
  protected readonly editMessage = signal<string | null>(null);
  protected readonly expandedPaths = signal(new Set<string>(['root']));
  protected readonly childRenderLimit = CHILD_RENDER_LIMIT;
  protected readonly searchRenderLimit = SEARCH_RENDER_LIMIT;
  protected readonly saveGameService = inject(SaveGameService);

  readonly #destroyRef = inject(DestroyRef);
  readonly #enumTypes = new Set(Object.keys(CORAL_ISLAND_ENUMS));
  readonly #refresh = signal(0);

  protected readonly decodedData = this.saveGameService.decodedData;
  protected readonly visibleNodes = computed(() => {
    const data = this.decodedData();
    const query = this.searchQuery();
    this.#refresh();

    if (!data) {
      return [];
    }

    if (query.trim()) {
      return searchExplorerNodes(data, query, {
        enumTypes: this.#enumTypes,
        limit: SEARCH_RENDER_LIMIT,
        visitLimit: SEARCH_VISIT_LIMIT,
      });
    }

    const rootNodes = listExplorerChildren(data, '', -1, {
      enumTypes: this.#enumTypes,
      limit: ROOT_RENDER_LIMIT,
    });

    return this.#flattenExpandedNodes(data, rootNodes);
  });

  protected readonly selectedNode = computed(() => {
    const data = this.decodedData();
    const path = this.selectedPath();
    this.#refresh();

    if (!data || !path) {
      return null;
    }

    const result = getExistingPathValue(data, path);

    if (!result.exists) {
      return null;
    }

    return describeExplorerNode(result.value, path, this.#pathLabel(path), this.#pathDepth(path), this.#enumTypes);
  });

  constructor() {
    this.searchControl.valueChanges
      .pipe(debounceTime(150), distinctUntilChanged(), takeUntilDestroyed(this.#destroyRef))
      .subscribe((query) => this.searchQuery.set(query));

    effect(
      () => {
        const edit = this.selectedNode()?.edit;

        if (!edit) {
          this.editDraft.set('');
          return;
        }

        this.editDraft.set(String(edit.currentValue));
      },
      { allowSignalWrites: true },
    );
  }

  protected selectNode(node: SaveExplorerNode) {
    this.selectedPath.set(node.path);
    this.editError.set(null);
    this.editMessage.set(null);
  }

  protected toggleNode(node: SaveExplorerNode, event: Event) {
    event.stopPropagation();

    if (!this.canExpand(node)) {
      return;
    }

    this.expandedPaths.update((current) => {
      const next = new Set(current);

      if (next.has(node.path)) {
        next.delete(node.path);
      } else {
        next.add(node.path);
      }

      return next;
    });
  }

  protected canExpand(node: SaveExplorerNode): boolean {
    return !this.searchQuery().trim() && node.childCount > 0;
  }

  protected isExpanded(node: SaveExplorerNode): boolean {
    return this.expandedPaths().has(node.path);
  }

  protected enumOptions(node: SaveExplorerNode | null): readonly string[] {
    if (node?.edit?.kind !== 'enum') {
      return [];
    }

    return (CORAL_ISLAND_ENUMS as Record<string, readonly string[]>)[node.edit.enumType] ?? [];
  }

  protected applyEdit() {
    const node = this.selectedNode();

    if (!node?.edit) {
      return;
    }

    try {
      const nextValue =
        node.edit.kind === 'enum'
          ? buildEnumEditValue(node.edit.enumType, this.editDraft(), node.edit.currentValue)
          : coercePrimitiveEditValue(node.edit.kind, this.editDraft(), getNumericPathValueOptions(node.key));

      if (!this.saveGameService.setExisting(node.path, nextValue)) {
        this.editMessage.set(null);
        this.editError.set('This field could not be updated because the path no longer exists.');
        return;
      }

      this.#refresh.update((value) => value + 1);
      this.editError.set(null);
      this.editMessage.set('Updated in memory. Use export to download the modified save.');
    } catch (error) {
      this.editMessage.set(null);
      this.editError.set(error instanceof Error ? error.message : String(error));
    }
  }

  #flattenExpandedNodes(data: Record<string, any>, nodes: SaveExplorerNode[]): SaveExplorerNode[] {
    const visible: SaveExplorerNode[] = [];

    for (const node of nodes) {
      visible.push(node);

      if (!this.expandedPaths().has(node.path) || !node.childCount) {
        continue;
      }

      const childValue = getExistingPathValue(data, node.path);

      if (!childValue.exists) {
        continue;
      }

      const children = listExplorerChildren(childValue.value, node.path, node.depth, {
        enumTypes: this.#enumTypes,
        limit: CHILD_RENDER_LIMIT,
      });

      visible.push(...this.#flattenExpandedNodes(data, children));
    }

    return visible;
  }

  #pathLabel(path: string): string {
    const pathSegments = parseExplorerPath(path);
    const lastSegment = pathSegments[pathSegments.length - 1];

    if (!lastSegment) {
      return path;
    }

    return lastSegment.index === undefined ? lastSegment.key : `${lastSegment.key}[${lastSegment.index}]`;
  }

  #pathDepth(path: string): number {
    return Math.max(parseExplorerPath(path).length - 1, 0);
  }
}
