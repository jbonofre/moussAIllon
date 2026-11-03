import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Form, Input } from 'antd';
import { LigneTriable, ListeTriable, PoigneeLigne } from './LignesTriables.tsx';

const HAUTEUR_LIGNE = 40;

// Le capteur clavier n'écoute les touches suivantes qu'au tour suivant de la boucle d'événements
const appuyer = async (cible: Element | Document, code: string) => {
    await act(async () => {
        fireEvent.keyDown(cible, { code });
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
};

function Lignes({ onLignes, disabled }: { onLignes: (lignes: Array<{ nom?: string }>) => void; disabled?: boolean }) {
    const [form] = Form.useForm();
    return (
        <Form form={form} initialValues={{ lignes: [{ nom: 'A' }, { nom: 'B' }, { nom: 'C' }, {}] }} onValuesChange={(_, all) => onLignes(all.lignes)}>
            <Form.List name="lignes">
                {(fields, { move }) => (
                    <ListeTriable
                        fields={fields}
                        move={move}
                        triable={(field) => !!form.getFieldValue(['lignes', field.name, 'nom'])}
                        disabled={disabled}
                    >
                        {fields.map((field) => (
                            <LigneTriable key={field.key} field={field}>
                                <PoigneeLigne />
                                <Form.Item name={[field.name, 'nom']} noStyle><Input /></Form.Item>
                            </LigneTriable>
                        ))}
                    </ListeTriable>
                )}
            </Form.List>
        </Form>
    );
}

describe('LignesTriables', () => {
    beforeEach(() => {
        // jsdom ne calcule aucune mise en page : chaque ligne est placée sous la précédente
        jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
            const rang = this.parentElement ? Array.from(this.parentElement.children).indexOf(this) : 0;
            const top = rang * HAUTEUR_LIGNE;
            return { x: 0, y: top, top, left: 0, right: 400, bottom: top + HAUTEUR_LIGNE, width: 400, height: HAUTEUR_LIGNE, toJSON: () => ({}) } as DOMRect;
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('affiche une poignée sur chaque ligne déplaçable, pas sur la ligne vide de saisie', () => {
        render(<Lignes onLignes={jest.fn()} />);
        expect(screen.getAllByLabelText('Déplacer la ligne')).toHaveLength(3);
    });

    it("n'affiche aucune poignée en lecture seule", () => {
        render(<Lignes onLignes={jest.fn()} disabled />);
        expect(screen.queryByLabelText('Déplacer la ligne')).not.toBeInTheDocument();
    });

    it('déplace une ligne au clavier', async () => {
        const onLignes = jest.fn();
        render(<Lignes onLignes={onLignes} />);
        const poignee = screen.getAllByLabelText('Déplacer la ligne')[0];
        poignee.focus();
        await appuyer(poignee, 'Space');
        await appuyer(document, 'ArrowDown');
        await appuyer(document, 'Space');
        await waitFor(() => expect(onLignes).toHaveBeenLastCalledWith([{ nom: 'B' }, { nom: 'A' }, { nom: 'C' }, {}]));
    });
});
