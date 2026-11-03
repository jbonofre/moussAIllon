// Affiche « À vendre » d'une petite annonce : une page A4 à apposer sur le bateau.

import { escapeHtml, InvoicePrintSociete, urlAbsolue } from './invoiceTemplate.ts';

export interface AffichePrintBateau {
    name?: string;
    dateMeS?: string;
    heuresMoteur?: number;
    modele?: {
        designation?: string;
        longueurExterieure?: number;
        largeur?: number;
        nombrePassagersMax?: number;
        categorieCe?: string;
    };
    moteurs?: Array<{ designation?: string }>;
}

export interface AffichePrintAnnonce {
    titre?: string;
    description?: string;
    prix?: number;
    contact?: string;
    telephone?: string;
    photos?: string[];
    bateau?: AffichePrintBateau;
}

// Moteurs regroupés par modèle, ex : "2 x Yamaha F150 + Yamaha F6"
export const motorisation = (moteurs?: Array<{ designation?: string }>) => {
    const nombres = new Map<string, number>();
    (moteurs || []).forEach((m) => {
        if (m.designation) nombres.set(m.designation, (nombres.get(m.designation) || 0) + 1);
    });
    return Array.from(nombres, ([designation, nombre]) => nombre > 1 ? `${nombre} x ${designation}` : designation).join(' + ');
};

export const anneeMiseEnService = (dateMeS?: string) => dateMeS?.match(/^\d{4}/)?.[0];

const formatNombre = (value: number) => value.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

// Prix arrondi à l'euro quand il n'a pas de centimes : plus lisible de loin
export const formatPrixAffiche = (prix?: number) => {
    if (!prix) return 'Prix sur demande';
    const decimales = Number.isInteger(prix) ? 0 : 2;
    return prix.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: decimales, maximumFractionDigits: decimales });
};

export const caracteristiquesAffiche = (bateau?: AffichePrintBateau): Array<[string, string]> => {
    const modele = bateau?.modele;
    const rows: Array<[string, string | undefined]> = [
        ['Modèle', modele?.designation],
        ['Année', anneeMiseEnService(bateau?.dateMeS)],
        ['Longueur', modele?.longueurExterieure ? `${formatNombre(modele.longueurExterieure)} m` : undefined],
        ['Largeur', modele?.largeur ? `${formatNombre(modele.largeur)} m` : undefined],
        ['Motorisation', motorisation(bateau?.moteurs) || undefined],
        ['Heures moteur', bateau?.heuresMoteur != null ? `${formatNombre(bateau.heuresMoteur)} h` : undefined],
        ['Passagers', modele?.nombrePassagersMax ? String(modele.nombrePassagersMax) : undefined],
        ['Catégorie CE', modele?.categorieCe],
    ];
    return rows.filter((row): row is [string, string] => !!row[1]);
};

const AFFICHE_STYLES = `
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; }
    body { font-family: Arial, sans-serif; color: #1f1f1f; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .affiche { height: 276mm; display: flex; flex-direction: column; gap: 4mm; overflow: hidden; }
    .bandeau { background: #cf1322; color: #fff; text-align: center; font-size: 64px; font-weight: bold; letter-spacing: 6px; padding: 3mm 0; border-radius: 4px; flex-shrink: 0; }
    .titre { margin: 0; text-align: center; font-size: 30px; line-height: 1.2; flex-shrink: 0; }
    .photo-principale { flex: 1 1 0; min-height: 0; }
    .photo-principale img { width: 100%; height: 100%; object-fit: cover; border-radius: 4px; display: block; }
    .photos-secondaires { display: flex; gap: 3mm; height: 35mm; flex-shrink: 0; }
    .photos-secondaires img { flex: 1 1 0; min-width: 0; height: 100%; object-fit: cover; border-radius: 4px; }
    .prix { text-align: center; font-size: 56px; font-weight: bold; color: #cf1322; flex-shrink: 0; }
    .caracteristiques { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2mm 4mm; border-top: 2px solid #1f1f1f; border-bottom: 2px solid #1f1f1f; padding: 3mm 0; flex-shrink: 0; }
    .carac span { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #595959; }
    .carac strong { font-size: 16px; }
    .description { white-space: pre-wrap; font-size: 14px; line-height: 1.4; max-height: 40mm; overflow: hidden; flex-shrink: 0; }
    .sans-photo .description { flex: 1 1 0; max-height: none; min-height: 0; }
    .contact { text-align: center; flex-shrink: 0; }
    .contact-titre { font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #595959; }
    .contact-telephone { font-size: 40px; font-weight: bold; }
    .contact-email { font-size: 18px; }
    .societe { display: flex; align-items: center; justify-content: center; gap: 4mm; font-size: 12px; color: #595959; border-top: 1px solid #d9d9d9; padding-top: 3mm; flex-shrink: 0; }
    .societe img { max-height: 14mm; max-width: 40mm; object-fit: contain; }
`;

export const buildAfficheAnnonceHtml = (annonce: AffichePrintAnnonce, societe?: InvoicePrintSociete) => {
    const [photoPrincipale, ...autresPhotos] = annonce.photos || [];
    const caracteristiques = caracteristiquesAffiche(annonce.bateau);
    const description = annonce.description?.trim();
    // Sans contact sur l'annonce, les acheteurs sont renvoyés vers le chantier
    const telephone = annonce.telephone || societe?.telephone;
    const email = annonce.contact || societe?.email;
    const logo = societe?.images?.[0];
    const societeInfos = [societe?.nom, societe?.adresse?.replace(/\s*\n\s*/g, ', '), societe?.telephone].filter(Boolean) as string[];
    return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8" />
    <title>${escapeHtml(annonce.titre || 'À vendre')}</title>
    <style>${AFFICHE_STYLES}</style>
</head>
<body>
<div class="affiche${photoPrincipale ? '' : ' sans-photo'}">
    <div class="bandeau">À VENDRE</div>
    ${annonce.titre ? `<h1 class="titre">${escapeHtml(annonce.titre)}</h1>` : ''}
    ${photoPrincipale ? `<div class="photo-principale"><img src="${escapeHtml(urlAbsolue(photoPrincipale))}" alt="" /></div>` : ''}
    ${autresPhotos.length > 0 ? `<div class="photos-secondaires">${autresPhotos.slice(0, 3).map((url) => `<img src="${escapeHtml(urlAbsolue(url))}" alt="" />`).join('')}</div>` : ''}
    <div class="prix">${escapeHtml(formatPrixAffiche(annonce.prix))}</div>
    ${caracteristiques.length > 0 ? `<div class="caracteristiques">${caracteristiques.map(([label, value]) => `<div class="carac"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}</div>` : ''}
    ${description ? `<div class="description">${escapeHtml(description)}</div>` : ''}
    ${telephone || email ? `<div class="contact">
        <div class="contact-titre">Renseignements</div>
        ${telephone ? `<div class="contact-telephone">${escapeHtml(telephone)}</div>` : ''}
        ${email ? `<div class="contact-email">${escapeHtml(email)}</div>` : ''}
    </div>` : ''}
    ${logo || societeInfos.length > 0 ? `<div class="societe">
        ${logo ? `<img src="${escapeHtml(urlAbsolue(logo))}" alt="" />` : ''}
        <div>${societeInfos.map(escapeHtml).join(' - ')}</div>
    </div>` : ''}
</div>
</body>
</html>`;
};
