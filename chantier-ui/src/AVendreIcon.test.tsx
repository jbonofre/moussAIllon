import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AVendreIcon, { useMaterielsAVendre } from './AVendreIcon.tsx';

const mockGet = jest.fn();

jest.mock('./api.ts', () => ({
    __esModule: true,
    default: {
        get: (...args: any[]) => mockGet(...args),
    },
}));

const Materiels = () => {
    const { bateaux, moteurs } = useMaterielsAVendre();
    return (
        <>
            <span data-testid="bateaux">{Array.from(bateaux).join(',')}</span>
            <span data-testid="moteurs">{Array.from(moteurs).join(',')}</span>
        </>
    );
};

test("l'icône n'apparaît que pour un matériel à vendre", () => {
    const { rerender } = render(<AVendreIcon aVendre={false} />);
    expect(screen.queryByLabelText('À vendre')).not.toBeInTheDocument();

    rerender(<AVendreIcon aVendre />);
    expect(screen.getByLabelText('À vendre')).toBeInTheDocument();
});

test('les bateaux et moteurs à vendre sont ceux des annonces actives', async () => {
    mockGet.mockResolvedValue({
        data: [
            { id: 1, bateau: { id: 10 } },
            { id: 2, moteur: { id: 20 } },
            { id: 3, bateau: { id: 11 }, moteur: { id: 21 } },
            { id: 4 },
        ],
    });
    render(<Materiels />);

    await waitFor(() => expect(screen.getByTestId('bateaux')).toHaveTextContent('10,11'));
    expect(screen.getByTestId('moteurs')).toHaveTextContent('20,21');
    expect(mockGet).toHaveBeenCalledWith('/annonces/active');
});
