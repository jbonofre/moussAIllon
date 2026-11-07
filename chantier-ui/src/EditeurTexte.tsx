import React, { useEffect, useMemo, useRef } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { estHtml, htmlSur, texteVersHtml } from './texte-riche.ts';

const INFOBULLES: Record<string, string> = {
    '.ql-header': 'Titre',
    '.ql-bold': 'Gras',
    '.ql-italic': 'Italique',
    '.ql-underline': 'Souligné',
    '.ql-strike': 'Barré',
    '.ql-color': 'Couleur du texte',
    '.ql-background': 'Couleur de fond du texte',
    '.ql-align': 'Alignement',
    '.ql-list[value="ordered"]': 'Liste numérotée',
    '.ql-list[value="bullet"]': 'Liste à puces',
    '.ql-blockquote': 'Citation',
    '.ql-link': 'Lien',
    '.ql-image': 'Insérer une image',
    '.ql-separateur': 'Insérer un séparateur',
    '.ql-clean': 'Effacer la mise en forme',
};

/** Infobulles en français sur les boutons de la barre d'outils de Quill. */
export function ajouterInfobulles(conteneur: HTMLElement) {
    Object.entries(INFOBULLES).forEach(([selecteur, titre]) => {
        conteneur.querySelectorAll(`.ql-toolbar ${selecteur}`).forEach((bouton) => bouton.setAttribute('title', titre));
    });
}

const MODULES = {
    toolbar: [
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['clean'],
    ],
};
// Formats acceptés, y compris au collage : ni couleur, ni titre, ni lien, ni image
const FORMATS = ['bold', 'italic', 'underline', 'strike', 'list'];

interface EditeurTexteProps {
    id?: string;
    value?: string;
    onChange?: (valeur: string) => void;
    placeholder?: string;
    hauteur?: number;
}

/** Éditeur de texte mis en forme (gras, italique, souligné, barré, listes), pour la description des annonces. */
export default function EditeurTexte({ id, value, onChange, placeholder, hauteur = 160 }: EditeurTexteProps) {
    const conteneurRef = useRef<HTMLDivElement>(null);
    // Un texte brut (saisi avant l'éditeur) garde ses retours à la ligne
    const valeur = useMemo(() => (value && !estHtml(value) ? texteVersHtml(value) : value || ''), [value]);

    useEffect(() => {
        if (conteneurRef.current) ajouterInfobulles(conteneurRef.current);
    }, []);

    return (
        <div ref={conteneurRef} className="editeur-texte">
            <ReactQuill
                id={id}
                theme="snow"
                value={valeur}
                modules={MODULES}
                formats={FORMATS}
                placeholder={placeholder}
                // Seules les saisies remontent : le chargement du texte ne marque pas le formulaire comme modifié
                onChange={(html, _delta, source) => {
                    if (source === 'user') onChange?.(html);
                }}
                style={{ height: hauteur, marginBottom: 42 }}
            />
        </div>
    );
}

/** Affichage d'un texte de l'éditeur (mise en forme conservée) ou d'un texte brut (retours à la ligne conservés). */
export function TexteFormate({ texte, vide }: { texte?: string | null; vide?: React.ReactNode }) {
    if (!texte) return <>{vide}</>;
    if (!estHtml(texte)) return <div style={{ whiteSpace: 'pre-wrap' }}>{texte}</div>;
    return <div className="texte-riche" dangerouslySetInnerHTML={{ __html: htmlSur(texte) }} />;
}
