import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MosaicTable from './MosaicTable.tsx';
import { paginationConfig, ALL_ROWS } from './pagination.ts';

const columns = [{ title: 'Nom', dataIndex: 'nom', key: 'nom' }];
const lignes = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, nom: `Ligne ${i + 1}` }));

const choisirTaillePage = async (libelle: string) => {
    fireEvent.mouseDown(document.querySelector('.ant-pagination-options .ant-select') as HTMLElement);
    const option = await waitFor(() => {
        const found = Array.from(document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option'))
            .find((el) => el.textContent?.trim().split(' ')[0] === libelle);
        expect(found).toBeTruthy();
        return found as HTMLElement;
    });
    fireEvent.click(option);
};

beforeEach(() => localStorage.clear());

test('paginationConfig propose 10, 20, 50 ou tout', () => {
    const config = paginationConfig();
    expect(config).toMatchObject({ defaultPageSize: 20, pageSizeOptions: [10, 20, 50, ALL_ROWS] });
    expect((config.showSizeChanger as { options: { label: string }[] }).options.map((o) => o.label))
        .toEqual(['10 / page', '20 / page', '50 / page', 'Tout']);
    expect(paginationConfig(10).defaultPageSize).toBe(10);
});

test("l'utilisateur choisit le nombre de lignes, conservé en passant en mosaïque", async () => {
    render(<MosaicTable rowKey="id" columns={columns} dataSource={lignes} pagination={paginationConfig()} storageKey="test" />);

    // 20 lignes par page par défaut
    expect(screen.getByText('Ligne 20')).toBeInTheDocument();
    expect(screen.queryByText('Ligne 21')).not.toBeInTheDocument();

    await choisirTaillePage('10');
    await waitFor(() => expect(screen.queryByText('Ligne 11')).not.toBeInTheDocument());
    expect(screen.getByText('Ligne 10')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Mosaïque'));
    await waitFor(() => expect(document.querySelectorAll('.ant-card')).toHaveLength(10));

    await choisirTaillePage('50');
    await waitFor(() => expect(document.querySelectorAll('.ant-card')).toHaveLength(25));
    // Le sélecteur reste disponible même quand tout tient sur une page
    expect(document.querySelector('.ant-pagination-options .ant-select')).toBeInTheDocument();
});

test("le choix « Tout » affiche toutes les lignes, y compris depuis une page suivante en mosaïque", async () => {
    render(<MosaicTable rowKey="id" columns={columns} dataSource={lignes} pagination={paginationConfig(10)} storageKey="test-tout" />);

    fireEvent.click(screen.getByText('Mosaïque'));
    await waitFor(() => expect(document.querySelectorAll('.ant-card')).toHaveLength(10));
    fireEvent.click(document.querySelector('.ant-pagination-item-3') as HTMLElement);
    await waitFor(() => expect(document.querySelectorAll('.ant-card')).toHaveLength(5));

    fireEvent.click(screen.getByText('Liste'));
    await choisirTaillePage('Tout');
    await waitFor(() => expect(screen.getByText('Ligne 25')).toBeInTheDocument());
    expect(screen.getByText('Ligne 1')).toBeInTheDocument();
    expect(document.querySelector('.ant-pagination-options .ant-select')).toHaveTextContent('Tout');

    // De retour en mosaïque, la page 3 n'existe plus : toutes les lignes sont affichées
    fireEvent.click(screen.getByText('Mosaïque'));
    await waitFor(() => expect(document.querySelectorAll('.ant-card')).toHaveLength(25));
});
