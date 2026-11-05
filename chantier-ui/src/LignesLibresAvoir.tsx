import React from 'react';
import { Button, Input, InputNumber, Select, Table } from 'antd';
import { MinusCircleOutlined, PlusCircleOutlined } from '@ant-design/icons';
import InputQuantite from './InputQuantite.tsx';
import {
    AvoirLigneLibre,
    TVA_OPTIONS_AVOIR,
    nouvelleLigneLibreAvoir,
    totalTTCLigneLibreAvoir,
} from './avoir-ligne-libre.ts';

interface LignesLibresAvoirProps {
    lignes: AvoirLigneLibre[];
    onChange: (lignes: AvoirLigneLibre[]) => void;
    // Client exonéré de TVA (professionnel de la mer) : ses lignes sont sans TVA, non modifiable
    exonere: boolean;
    tvaDefaut: number;
}

// Lignes saisies à la main sur un avoir généré depuis une facture
export default function LignesLibresAvoir({ lignes, onChange, exonere, tvaDefaut }: LignesLibresAvoirProps) {
    const modifier = (index: number, champ: keyof AvoirLigneLibre, valeur: string | number) =>
        onChange(lignes.map((ligne, i) => (i === index ? { ...ligne, [champ]: valeur } : ligne)));

    return (
        <>
            {lignes.length > 0 && (
                <Table
                    size="small"
                    style={{ marginBottom: 8 }}
                    pagination={false}
                    rowKey={(_, index) => String(index)}
                    dataSource={lignes}
                    columns={[
                        {
                            title: 'Désignation',
                            key: 'designation',
                            render: (_: unknown, ligne: AvoirLigneLibre, index: number) => (
                                <Input
                                    value={ligne.designation}
                                    onChange={(e) => modifier(index, 'designation', e.target.value)}
                                    placeholder="Ex: Main d'œuvre"
                                />
                            ),
                        },
                        {
                            title: 'Qté',
                            key: 'quantite',
                            width: 90,
                            render: (_: unknown, ligne: AvoirLigneLibre, index: number) => (
                                <InputQuantite
                                    aria-label="Quantité"
                                    value={ligne.quantite}
                                    onChange={(v) => modifier(index, 'quantite', v ?? 1)}
                                    style={{ width: '100%' }}
                                />
                            ),
                        },
                        {
                            title: 'P.U. HT',
                            key: 'prixUnitaireHT',
                            width: 140,
                            render: (_: unknown, ligne: AvoirLigneLibre, index: number) => (
                                <InputNumber
                                    aria-label="Prix unitaire HT"
                                    min={0}
                                    precision={2}
                                    value={ligne.prixUnitaireHT}
                                    onChange={(v) => modifier(index, 'prixUnitaireHT', v ?? 0)}
                                    addonAfter="€"
                                    style={{ width: '100%' }}
                                />
                            ),
                        },
                        {
                            title: 'TVA',
                            key: 'tva',
                            width: 100,
                            render: (_: unknown, ligne: AvoirLigneLibre, index: number) => (
                                <Select
                                    value={ligne.tva}
                                    onChange={(v) => modifier(index, 'tva', v)}
                                    options={TVA_OPTIONS_AVOIR}
                                    disabled={exonere}
                                    style={{ width: '100%' }}
                                />
                            ),
                        },
                        {
                            title: 'Total TTC',
                            key: 'totalTTC',
                            width: 120,
                            align: 'right' as const,
                            render: (_: unknown, ligne: AvoirLigneLibre) =>
                                `${totalTTCLigneLibreAvoir(ligne).toFixed(2)} EUR`,
                        },
                        {
                            title: '',
                            key: 'retirer',
                            width: 40,
                            render: (_: unknown, _ligne: AvoirLigneLibre, index: number) => (
                                <Button
                                    type="text"
                                    danger
                                    title="Retirer la ligne libre"
                                    icon={<MinusCircleOutlined />}
                                    onClick={() => onChange(lignes.filter((_l, i) => i !== index))}
                                />
                            ),
                        },
                    ]}
                />
            )}
            <Button
                type="dashed"
                icon={<PlusCircleOutlined />}
                onClick={() => onChange([...lignes, nouvelleLigneLibreAvoir(exonere ? 0 : tvaDefaut)])}
                style={{ marginBottom: 16 }}
            >
                Ajouter une ligne libre
            </Button>
        </>
    );
}
