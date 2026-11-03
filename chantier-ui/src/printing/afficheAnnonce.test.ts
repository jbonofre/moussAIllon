import { buildAfficheAnnonceHtml, caracteristiquesAffiche, formatPrixAffiche, motorisation } from './afficheAnnonce.ts';

describe('afficheAnnonce', () => {
    // Le format fr-FR utilise des espaces insécables : on les normalise pour comparer
    const texte = (value: string) => value.replace(/\s/g, ' ');

    const affiche = (html: string) => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const contenu = (selector: string) => texte(doc.querySelector(selector)?.textContent || '').trim();
        return { doc, contenu };
    };

    const bateau = {
        dateMeS: '2018-05-12',
        heuresMoteur: 320,
        modele: { designation: 'Beneteau Flyer 7.7', longueurExterieure: 7.7, largeur: 2.54, nombrePassagersMax: 8, categorieCe: 'C' },
        moteurs: [{ designation: 'Yamaha F150' }, { designation: 'Yamaha F150' }, { designation: 'Yamaha F6' }],
    };

    it('regroupe les moteurs de même modèle', () => {
        expect(motorisation(bateau.moteurs)).toBe('2 x Yamaha F150 + Yamaha F6');
        expect(motorisation([{}])).toBe('');
        expect(motorisation(undefined)).toBe('');
    });

    it('arrondit le prix à l\'euro sauf s\'il a des centimes, et gère l\'absence de prix', () => {
        expect(texte(formatPrixAffiche(25000))).toBe('25 000 €');
        expect(texte(formatPrixAffiche(24999.5))).toBe('24 999,50 €');
        expect(formatPrixAffiche(0)).toBe('Prix sur demande');
        expect(formatPrixAffiche(undefined)).toBe('Prix sur demande');
    });

    it('ne liste que les caractéristiques renseignées', () => {
        expect(caracteristiquesAffiche(bateau).map(([label, value]) => [label, texte(value)])).toEqual([
            ['Modèle', 'Beneteau Flyer 7.7'],
            ['Année', '2018'],
            ['Longueur', '7,7 m'],
            ['Largeur', '2,54 m'],
            ['Motorisation', '2 x Yamaha F150 + Yamaha F6'],
            ['Heures moteur', '320 h'],
            ['Passagers', '8'],
            ['Catégorie CE', 'C'],
        ]);
        expect(caracteristiquesAffiche({ modele: { designation: 'Zodiac', longueurExterieure: 0 } })).toEqual([['Modèle', 'Zodiac']]);
        expect(caracteristiquesAffiche(undefined)).toEqual([]);
    });

    it('imprime l\'annonce avec ses photos et son contact', () => {
        const { doc, contenu } = affiche(buildAfficheAnnonceHtml({
            titre: 'Flyer 7.7 <révisé>',
            prix: 25000,
            description: 'Très bon état',
            telephone: '06 12 34 56 78',
            contact: 'vendeur@email.com',
            photos: ['/photos/1.jpg', '/photos/2.jpg'],
            bateau,
        }, { nom: 'Chantier', telephone: '02 00 00 00 00', email: 'chantier@email.com' }));
        expect(contenu('.titre')).toBe('Flyer 7.7 <révisé>');
        expect(contenu('.prix')).toBe('25 000 €');
        expect(contenu('.description')).toBe('Très bon état');
        expect(contenu('.contact-telephone')).toBe('06 12 34 56 78');
        expect(contenu('.contact-email')).toBe('vendeur@email.com');
        expect(doc.querySelector('.photo-principale img')?.getAttribute('src')).toBe(`${window.location.origin}/photos/1.jpg`);
        expect(doc.querySelectorAll('.photos-secondaires img')).toHaveLength(1);
        expect(doc.querySelector('.affiche')?.classList.contains('sans-photo')).toBe(false);
    });

    it('renvoie vers le chantier quand l\'annonce n\'a pas de contact', () => {
        const { doc, contenu } = affiche(buildAfficheAnnonceHtml(
            { titre: 'Zodiac', prix: 3000 },
            { nom: 'Chantier', adresse: '1 quai du port\n56000 Vannes', telephone: '02 00 00 00 00', email: 'chantier@email.com' },
        ));
        expect(contenu('.contact-telephone')).toBe('02 00 00 00 00');
        expect(contenu('.contact-email')).toBe('chantier@email.com');
        expect(contenu('.societe')).toBe('Chantier - 1 quai du port, 56000 Vannes - 02 00 00 00 00');
        expect(doc.querySelector('.affiche')?.classList.contains('sans-photo')).toBe(true);
        expect(doc.querySelector('.caracteristiques')).toBeNull();
    });
});
