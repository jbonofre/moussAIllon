import { LARGEUR_CONTENU, largeurParDefaut, normaliserLien, typeApresConversion } from './editeur-email.ts';

describe("Éditeur d'email", () => {
    it('insère une image à sa taille, dans la limite de la colonne', () => {
        expect(largeurParDefaut(120)).toBe(120);
        expect(largeurParDefaut(4000)).toBe(LARGEUR_CONTENU);
        expect(largeurParDefaut(0)).toBe(0);
    });

    it('convertit le WebP en JPEG et laisse le GIF tel quel', () => {
        expect(typeApresConversion('image/png')).toBe('image/png');
        expect(typeApresConversion('image/jpeg')).toBe('image/jpeg');
        expect(typeApresConversion('image/webp')).toBe('image/jpeg');
        expect(typeApresConversion('image/gif')).toBeNull();
    });

    it('complète les liens sans protocole', () => {
        expect(normaliserLien('www.exemple.fr/offre')).toBe('https://www.exemple.fr/offre');
        expect(normaliserLien(' https://exemple.fr ')).toBe('https://exemple.fr');
        expect(normaliserLien('mailto:contact@exemple.fr')).toBe('mailto:contact@exemple.fr');
        expect(normaliserLien('/api/images/photo.png')).toBe('/api/images/photo.png');
        // Variable d'un modèle, remplacée à l'envoi
        expect(normaliserLien('{lienPaiement}')).toBe('{lienPaiement}');
        expect(normaliserLien('')).toBe('');
    });
});
