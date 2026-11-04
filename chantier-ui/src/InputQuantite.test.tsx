import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Form } from 'antd';
import InputQuantite from './InputQuantite.tsx';

describe('InputQuantite', () => {
    it.each([['2.25', 2.25], ['2,25', 2.25], ['0.5', 0.5], ['3', 3]])('lit « %s » comme %s', (saisie, attendu) => {
        const onChange = jest.fn();
        render(<InputQuantite placeholder="Qte" onChange={onChange} />);
        fireEvent.change(screen.getByPlaceholderText('Qte'), { target: { value: saisie } });
        expect(onChange).toHaveBeenLastCalledWith(attendu);
    });

    it.each([[2.25, '2.25'], [5.5, '5.5'], [1, '1']])('affiche %s avec un point, sans zéros inutiles', (valeur, affiche) => {
        render(<InputQuantite placeholder="Qte" value={valeur} />);
        expect(screen.getByPlaceholderText('Qte')).toHaveValue(affiche);
    });

    it('avance de 0.25 avec les flèches', () => {
        const onChange = jest.fn();
        render(<InputQuantite placeholder="Qte" defaultValue={2} onChange={onChange} />);
        const input = screen.getByPlaceholderText('Qte');
        fireEvent.keyDown(input, { key: 'ArrowUp' });
        expect(onChange).toHaveBeenLastCalledWith(2.25);
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        expect(onChange).toHaveBeenLastCalledWith(1.75);
    });

    it('conserve la saisie en cours dans un formulaire, puis l\'affiche avec un point', () => {
        render(
            <Form initialValues={{ quantite: 1 }}>
                <Form.Item name="quantite"><InputQuantite placeholder="Qte" /></Form.Item>
            </Form>,
        );
        const input = screen.getByPlaceholderText('Qte');
        // Comme au clavier : chaque frappe déclenche keydown avant la saisie
        const taper = (touche: string, valeur: string) => {
            fireEvent.keyDown(input, { key: touche });
            fireEvent.change(input, { target: { value: valeur } });
        };
        fireEvent.focus(input);
        taper('.', '2.');
        expect(input).toHaveValue('2.');
        taper('2', '2.2');
        expect(input).toHaveValue('2.2');
        taper(',', '2,');
        expect(input).toHaveValue('2,');
        taper('5', '2,5');
        fireEvent.keyUp(input);
        fireEvent.blur(input);
        expect(input).toHaveValue('2.5');
    });
});
