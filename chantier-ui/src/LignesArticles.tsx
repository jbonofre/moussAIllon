import React from 'react';
import { Button, Form, InputNumber, Select, Tag } from 'antd';
import type { FormInstance } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { FicheCataloguePopover } from './FicheCatalogueModal.tsx';

interface ProduitLigne {
    id: number;
    ref?: string;
    designation: string;
    prixVenteTTC?: number;
    stock?: number;
    stockMini?: number;
}

interface MainOeuvreLigne {
    id: number;
    reference?: string;
    nom: string;
    prixTTC?: number;
}

interface LignesArticlesProps {
    form: FormInstance;
    onValuesChange: (changedValues: Record<string, unknown>, allValues: Record<string, unknown>) => void;
    liste: 'mainOeuvres' | 'produits';
    produits: ProduitLigne[];
    mainOeuvres: MainOeuvreLigne[];
    onProduitSearch?: (value: string) => void;
    onProduitSaved?: (produit: any) => void;
    navigate?: (route: string) => void;
    // Création d'un article depuis une ligne vide
    onCreate?: (lineIndex: number) => void;
}

// Lignes de main d'œuvre ou de produits, présentées comme celles d'une transaction
export default function LignesArticles({
    form,
    onValuesChange,
    liste,
    produits,
    mainOeuvres,
    onProduitSearch,
    onProduitSaved,
    navigate,
    onCreate,
}: LignesArticlesProps) {
    const estProduit = liste === 'produits';
    const champ = estProduit ? 'produitId' : 'mainOeuvreId';
    const articles = estProduit
        ? produits.map((p) => ({ id: p.id, ref: p.ref, designation: p.designation, prix: p.prixVenteTTC, stock: p.stock, stockMini: p.stockMini }))
        : mainOeuvres.map((mo) => ({ id: mo.id, ref: mo.reference, designation: mo.nom, prix: mo.prixTTC, stock: undefined, stockMini: undefined }));
    const options = articles.map((a) => ({
        value: a.id,
        label: a.ref ? `${a.ref} - ${a.designation}` : a.designation,
        ref: a.ref || '-',
        designation: a.designation,
    }));
    // Le choix par la référence passe par le formulaire : mêmes calculs (prix, durée, ligne suivante) que par la désignation
    const choisirParReference = (index: number, id?: number) => {
        form.setFieldValue([liste, index, champ], id);
        onValuesChange({ [liste]: form.getFieldValue(liste) }, form.getFieldsValue());
    };
    return (
        <Form.List name={liste}>
            {(fields, { remove }) => (
                <>
                    {fields.map((field) => (
                        <Form.Item key={field.key} noStyle shouldUpdate>
                            {() => {
                                // Entêtes affichées une seule fois, au-dessus de la première ligne
                                const premiereLigne = field.name === 0;
                                const decalageEntete = premiereLigne ? 30 : 0;
                                const ligne = form.getFieldValue([liste, field.name]) || {};
                                const article = articles.find((a) => a.id === ligne[champ]);
                                const total = article
                                    ? Math.round(((article.prix || 0) * (ligne.quantite || 0) + Number.EPSILON) * 100) / 100
                                    : undefined;
                                const stock = article?.stock ?? 0;
                                const couleurStock = stock === 0 ? 'red' : (stock < (ligne.quantite || 0) || stock < (article?.stockMini ?? 0)) ? 'orange' : 'green';
                                return (
                                    <div className="ligne-article" style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                        <Form.Item label={premiereLigne ? 'Référence' : undefined} style={{ width: 120, flex: 'none', marginBottom: 8 }}>
                                            <Select
                                                allowClear
                                                showSearch
                                                value={ligne[champ] ?? null}
                                                options={options}
                                                optionLabelProp="ref"
                                                placeholder="Réf."
                                                filterOption={(input, option) => (option?.ref || '').toLowerCase().includes(input.toLowerCase())}
                                                onSearch={estProduit ? onProduitSearch : undefined}
                                                onChange={(id?: number) => choisirParReference(field.name, id)}
                                            />
                                        </Form.Item>
                                        <Form.Item
                                            name={[field.name, champ]}
                                            label={premiereLigne ? 'Désignation' : undefined}
                                            style={{ flex: '1 1 0', minWidth: 120, marginBottom: 8 }}
                                        >
                                            <Select
                                                allowClear
                                                showSearch
                                                options={options}
                                                optionLabelProp="designation"
                                                placeholder={estProduit ? 'Produit (réf., désignation)' : "Main d'œuvre (réf., nom)"}
                                                filterOption={(input, option) => (option?.label || '').toLowerCase().includes(input.toLowerCase())}
                                                onSearch={estProduit ? onProduitSearch : undefined}
                                                notFoundContent={null}
                                            />
                                        </Form.Item>
                                        <Form.Item label={premiereLigne ? 'PU TTC €' : undefined} style={{ width: 80, flex: 'none', marginBottom: 8 }}>
                                            <InputNumber value={article?.prix} disabled style={{ width: '100%' }} placeholder="P.U." />
                                        </Form.Item>
                                        <Form.Item
                                            name={[field.name, 'quantite']}
                                            label={premiereLigne ? 'Quantité' : undefined}
                                            style={{ width: 70, flex: 'none', marginBottom: 8 }}
                                        >
                                            <InputNumber min={estProduit ? 1 : 0.25} step={estProduit ? 1 : 0.25} style={{ width: '100%' }} placeholder="Qte" />
                                        </Form.Item>
                                        <Form.Item label={premiereLigne ? 'Total €' : undefined} style={{ width: 75, flex: 'none', marginBottom: 8 }}>
                                            <InputNumber value={total} disabled style={{ width: '100%' }} />
                                        </Form.Item>
                                        {estProduit && (
                                            <Form.Item label={premiereLigne ? 'Stock' : undefined} style={{ width: 50, flex: 'none', marginBottom: 8 }}>
                                                {article && (
                                                    <Tag color={couleurStock} style={{ marginRight: 0, minWidth: 40, textAlign: 'center', lineHeight: '30px', height: 32 }}>{stock}</Tag>
                                                )}
                                            </Form.Item>
                                        )}
                                        {/* Zone d'actions de largeur fixe : les colonnes restent alignées d'une ligne à l'autre */}
                                        <div style={{ width: estProduit ? 62 : 32, flex: 'none', marginTop: decalageEntete, display: 'flex', alignItems: 'center', gap: 6, minHeight: 32 }}>
                                            {estProduit && article && (
                                                <FicheCataloguePopover
                                                    type="produit"
                                                    itemId={article.id}
                                                    produits={produits}
                                                    navigate={navigate}
                                                    onProduitSaved={onProduitSaved}
                                                />
                                            )}
                                            {onCreate && !article && (
                                                <Button icon={<PlusOutlined />} title={estProduit ? 'Créer un produit' : "Créer une main d'oeuvre"} onClick={() => onCreate(field.name)} />
                                            )}
                                            {fields.length > 1 && (
                                                <Button style={{ marginLeft: 'auto' }} danger icon={<DeleteOutlined />} title="Supprimer la ligne" onClick={() => remove(field.name)} />
                                            )}
                                        </div>
                                    </div>
                                );
                            }}
                        </Form.Item>
                    ))}
                </>
            )}
        </Form.List>
    );
}
