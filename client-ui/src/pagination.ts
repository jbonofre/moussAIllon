import type { TablePaginationConfig } from 'antd';

/** Taille de page du choix « Tout » : toutes les lignes tiennent sur une seule page. */
export const ALL_ROWS = Number.MAX_SAFE_INTEGER;

/** Nombre de lignes par page affiché par défaut sur les listes. */
export const DEFAULT_PAGE_SIZE = 20;

/** Nombres de lignes par page proposés sur toutes les listes. */
export const PAGE_SIZE_OPTIONS = [10, 20, 50, ALL_ROWS];

const libelleTaille = (taille: number) => (taille === ALL_ROWS ? 'Tout' : `${taille} / page`);

/** Pagination d'une liste avec choix du nombre de lignes par page : 10, 20, 50 ou tout. */
export function paginationConfig(defaultPageSize: 10 | 20 | 50 = DEFAULT_PAGE_SIZE, extra: TablePaginationConfig = {}): TablePaginationConfig {
    return {
        defaultPageSize,
        pageSizeOptions: PAGE_SIZE_OPTIONS,
        // antd n'affiche que des nombres : les libellés (dont « Tout ») sont fournis au sélecteur.
        showSizeChanger: {
            options: PAGE_SIZE_OPTIONS.map((value) => ({ value, label: libelleTaille(value) })),
            showSearch: false,
        },
        ...extra,
    };
}
