// Texte mis en forme (gras, italique, souligné, barré, listes) des descriptions d'annonces, à garder en accord avec
// TexteRiche côté serveur et avec l'original de ce fichier dans chantier-ui.

/** Balises de mise en forme conservées, sans attribut. */
const BALISES = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li'];
const BALISE_HTML = new RegExp(`</?(${BALISES.join('|')})(\\s[^>]*)?/?>`, 'i');
// Éléments retirés avec leur contenu
const INTERDITS = ['script', 'style', 'template', 'iframe', 'object', 'textarea'];

/** Vrai si le texte vient de l'éditeur ; un texte sans balise (saisi avant l'éditeur) est du texte brut. */
export function estHtml(texte?: string | null): boolean {
    return !!texte && BALISE_HTML.test(texte);
}

function echapper(texte: string): string {
    return texte.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Texte brut repris dans l'éditeur : une ligne par paragraphe, les lignes vides conservées. */
export function texteVersHtml(texte: string): string {
    return texte.split(/\r?\n/).map((ligne) => `<p>${ligne ? echapper(ligne) : '<br>'}</p>`).join('');
}

function copier(source: Node, cible: Node) {
    source.childNodes.forEach((noeud) => {
        if (noeud.nodeType === Node.TEXT_NODE) {
            cible.appendChild(document.createTextNode(noeud.textContent || ''));
        } else if (noeud.nodeType === Node.ELEMENT_NODE) {
            const nom = (noeud as Element).tagName.toLowerCase();
            if (INTERDITS.includes(nom)) return;
            if (BALISES.includes(nom)) {
                const element = document.createElement(nom);
                copier(noeud, element);
                cible.appendChild(element);
            } else {
                copier(noeud, cible);
            }
        }
    });
}

/** HTML affichable : seules les balises de mise en forme, sans attribut (le texte d'un client est affiché au chantier). */
export function htmlSur(html: string): string {
    const document_ = new DOMParser().parseFromString(html, 'text/html');
    const conteneur = document.createElement('div');
    copier(document_.body, conteneur);
    return conteneur.innerHTML;
}

/** Texte sans mise en forme (recherche, aperçus). */
export function htmlVersTexte(texte?: string | null): string {
    if (!texte) return '';
    if (!estHtml(texte)) return texte;
    const document_ = new DOMParser().parseFromString(texte.replace(/<\/(p|li)>|<br\s*\/?>/gi, '$&\n'), 'text/html');
    return (document_.body.textContent || '').replace(/ /g, ' ').trim();
}

/**
 * Valeur enregistrée : les espaces insécables que l'éditeur (Quill 2.0.3) met entre tous les mots redeviennent des
 * espaces, sinon le texte ne passe plus à la ligne ; un éditeur vidé donne une description vide.
 */
export function nettoyerSaisie(texte?: string | null): string | undefined {
    if (!texte || !estHtml(texte)) return texte ?? undefined;
    const html = texte.replace(/&nbsp;(?!&nbsp;)/g, ' ');
    return htmlVersTexte(html) ? html : '';
}
