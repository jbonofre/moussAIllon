import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import LignesLibresAvoir from './LignesLibresAvoir.tsx';
import { AvoirLigneLibre } from './avoir-ligne-libre.ts';

const Saisie = ({ exonere = false, onChange }: { exonere?: boolean; onChange: (lignes: AvoirLigneLibre[]) => void }) => {
    const [lignes, setLignes] = useState<AvoirLigneLibre[]>([]);
    return (
        <LignesLibresAvoir
            lignes={lignes}
            onChange={(nouvelles) => { setLignes(nouvelles); onChange(nouvelles); }}
            exonere={exonere}
            tvaDefaut={20}
        />
    );
};

describe('LignesLibresAvoir', () => {
    it('saisit une demi-heure de main d\'œuvre et en calcule le total TTC', () => {
        const onChange = jest.fn();
        render(<Saisie onChange={onChange} />);

        fireEvent.click(screen.getByText('Ajouter une ligne libre'));
        fireEvent.change(screen.getByPlaceholderText("Ex: Main d'œuvre"), { target: { value: "Main d'œuvre" } });
        fireEvent.change(screen.getByLabelText('Quantité'), { target: { value: '0,5' } });
        fireEvent.change(screen.getByLabelText('Prix unitaire HT'), { target: { value: '60' } });

        expect(screen.getByText('36.00 EUR')).toBeInTheDocument();
        expect(onChange).toHaveBeenLastCalledWith([{ designation: "Main d'œuvre", quantite: 0.5, prixUnitaireHT: 60, tva: 20 }]);
    });

    it('retire une ligne libre', () => {
        const onChange = jest.fn();
        render(<Saisie onChange={onChange} />);

        fireEvent.click(screen.getByText('Ajouter une ligne libre'));
        fireEvent.click(screen.getByTitle('Retirer la ligne libre'));

        expect(onChange).toHaveBeenLastCalledWith([]);
        expect(screen.queryByPlaceholderText("Ex: Main d'œuvre")).not.toBeInTheDocument();
    });

    it('saisit sans TVA, non modifiable, pour un client exonéré', () => {
        const onChange = jest.fn();
        render(<Saisie exonere onChange={onChange} />);

        fireEvent.click(screen.getByText('Ajouter une ligne libre'));

        expect(onChange).toHaveBeenLastCalledWith([{ designation: '', quantite: 1, prixUnitaireHT: 0, tva: 0 }]);
        expect(document.querySelector('.ant-select-disabled')).toBeInTheDocument();
    });
});
