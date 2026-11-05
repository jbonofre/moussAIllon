// Code du chantier saisi à la connexion : une instance de moussAIllon héberge plusieurs chantiers.
// Il est mémorisé dans le navigateur, et un lien ?chantier=code (partagé par le chantier) le pré-remplit.
const CLE_CHANTIER = 'moussaillon-chantier';

export const ENTETE_CHANTIER = 'X-Chantier';

export function normaliserChantier(code: string | null | undefined): string {
    return (code || '').trim().toLowerCase();
}

/** Code à proposer à la connexion : celui du lien, sinon le dernier utilisé. */
export function codeChantierInitial(): string {
    const lien = new URLSearchParams(window.location.search).get('chantier');
    return normaliserChantier(lien || localStorage.getItem(CLE_CHANTIER));
}

export function chantierMemorise(): string {
    return normaliserChantier(localStorage.getItem(CLE_CHANTIER));
}

export function memoriserChantier(code: string) {
    localStorage.setItem(CLE_CHANTIER, normaliserChantier(code));
}

/** En-tête désignant le chantier des requêtes sans jeton (connexion) ; le jeton le désigne ensuite. */
export function enteteChantier(code?: string): Record<string, string> {
    const chantier = normaliserChantier(code ?? chantierMemorise());
    return chantier ? { [ENTETE_CHANTIER]: chantier } : {};
}
