// Modules de l'application (groupes de fonctionnalités du menu), dans l'ordre du menu.
// La société souscrit des modules (Paramétrage > Facturation), puis chaque utilisateur
// se voit attribuer l'accès à certains d'entre eux.
export const MODULES = [
    { value: 'VENTE', label: 'Vente' },
    { value: 'PARC', label: 'Parc' },
    { value: 'CATALOGUE', label: 'Catalogue' },
    { value: 'ATELIER', label: 'Atelier' },
    { value: 'MARKETING', label: 'Marketing' },
    { value: 'COMPTABILITE', label: 'Comptabilité' },
    { value: 'PARAMETRAGE', label: 'Paramétrage' },
];

// Toujours souscrit et inclus dans l'abonnement.
export const MODULE_PARAMETRAGE = 'PARAMETRAGE';

export const MODULE_LABEL: Record<string, string> = Object.fromEntries(MODULES.map((m) => [m.value, m.label]));

export function hasModule(modules: string[] | undefined, module: string): boolean {
    return Array.isArray(modules) && modules.includes(module);
}

// Trie des codes de module dans l'ordre du menu.
export function trierModules(modules: string[] | undefined): string[] {
    const ordre = MODULES.map((m) => m.value);
    return [...(modules || [])].sort((a, b) => ordre.indexOf(a) - ordre.indexOf(b));
}
