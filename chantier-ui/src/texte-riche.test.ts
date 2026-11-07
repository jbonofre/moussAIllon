import { estHtml, htmlSur, htmlVersTexte, nettoyerSaisie, texteVersHtml } from './texte-riche.ts';

describe('Texte mis en forme', () => {
    it('distingue le texte brut du texte de l\'éditeur', () => {
        expect(estHtml('Moteur < 300 h & entretenu')).toBe(false);
        expect(estHtml('<p><strong>Très bon état</strong></p>')).toBe(true);
        expect(estHtml(undefined)).toBe(false);
    });

    it('reprend un texte brut dans l\'éditeur avec ses retours à la ligne', () => {
        expect(texteVersHtml('Très bon état\n\nMoteur < 300 h')).toBe('<p>Très bon état</p><p><br></p><p>Moteur &lt; 300 h</p>');
    });

    it('n\'affiche que les balises de mise en forme, sans attribut', () => {
        expect(htmlSur('<p class="x"><strong style="color:red">Gras</strong> <a href="javascript:alert(1)">lien</a></p>'))
            .toBe('<p><strong>Gras</strong> lien</p>');
        expect(htmlSur('<p>Texte<img src="x" onerror="alert(1)"><script>alert(2)</script></p>')).toBe('<p>Texte</p>');
    });

    it('donne le texte sans mise en forme pour la recherche', () => {
        expect(htmlVersTexte('<p>Très&nbsp;bon&nbsp;état</p><ul><li>GPS</li></ul>')).toBe('Très bon état\nGPS');
        expect(htmlVersTexte('Texte brut')).toBe('Texte brut');
    });

    it('enregistre des espaces ordinaires et une description vide pour un éditeur vidé', () => {
        expect(nettoyerSaisie('<p>Très&nbsp;bon&nbsp;&nbsp;état</p>')).toBe('<p>Très bon&nbsp; état</p>');
        expect(nettoyerSaisie('<p></p>')).toBe('');
        expect(nettoyerSaisie('<p><br></p>')).toBe('');
        expect(nettoyerSaisie('Texte brut')).toBe('Texte brut');
    });
});
