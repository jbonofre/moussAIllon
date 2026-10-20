import type { TablePaginationConfig } from 'antd';

/** Nombre de lignes par page affiché par défaut sur les listes. */
export const DEFAULT_PAGE_SIZE = 20;

/** Nombres de lignes par page proposés sur toutes les listes. */
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/**
 * Pagination d'une liste avec choix du nombre de lignes par page.
 * La taille initiale est ajoutée aux choix proposés si elle n'y figure pas.
 */
export function paginationConfig(defaultPageSize = DEFAULT_PAGE_SIZE, extra: TablePaginationConfig = {}): TablePaginationConfig {
    const pageSizeOptions = Array.from(new Set([defaultPageSize, ...PAGE_SIZE_OPTIONS])).sort((a, b) => a - b);
    return { defaultPageSize, showSizeChanger: true, pageSizeOptions, ...extra };
}
