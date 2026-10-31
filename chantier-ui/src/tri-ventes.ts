/**
 * Ordre chronologique des ventes : par date (chaînes ISO), puis par identifiant pour départager
 * les ventes d'un même jour, la dernière créée étant la plus récente. Une vente sans date est la plus ancienne.
 * Les tableaux l'appliquent en ordre décroissant par défaut : du plus récent au plus ancien.
 */
export const comparerDatesVentes = (
    a: { id?: number; date?: string | null },
    b: { id?: number; date?: string | null }
) => (a.date || '').localeCompare(b.date || '') || (a.id || 0) - (b.id || 0);
