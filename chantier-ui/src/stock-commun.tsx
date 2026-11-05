import React from 'react';
import { Space, Tag, Typography } from 'antd';
import { fetchWithAuth } from './api.ts';

const { Text } = Typography;

// Articles suivis en stock (les hélices ne sont pas gérées en stock)
export type TypeArticle = 'produit' | 'bateau' | 'moteur' | 'remorque';

// Mêmes libellés et couleurs que le catalogue
export const TYPES_ARTICLE: Record<TypeArticle, { label: string; color: string }> = {
    produit: { label: 'Article', color: 'orange' },
    bateau: { label: 'Bateau', color: 'cyan' },
    moteur: { label: 'Moteur', color: 'purple' },
    remorque: { label: 'Remorque', color: 'gold' },
};

export type StatutStock = 'RUPTURE' | 'SOUS_SEUIL' | 'OK';

export interface ArticleStock {
    cle: string;
    type: TypeArticle;
    id: number;
    designation: string;
    ref?: string | null;
    categorie?: string | null;
    emplacement?: string | null;
    emplacementMagasin?: string | null;
    stock: number;
    seuil: number;
    reserve: number;
    disponible: number;
    enCommande: number;
    coutUnitaireHT: number;
    valeur: number;
    prixVenteHT: number;
    occasion: boolean;
    suivi: boolean;
    statut: StatutStock;
}

// Quantité à virgule affichée à la française : « 5,5 »
export const formatQuantite = (v?: number | null) =>
    (v ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 3 });

// Type, désignation et référence d'un article
export const LibelleArticle = ({ type, designation, reference }: { type: TypeArticle; designation: string; reference?: string | null }) => (
    <Space orientation="vertical" size={0}>
        <Space size={4}>
            <Tag color={TYPES_ARTICLE[type]?.color}>{TYPES_ARTICLE[type]?.label ?? type}</Tag>
            <span>{designation}</span>
        </Space>
        {reference && <Text type="secondary" style={{ fontSize: 12 }}>Réf. {reference}</Text>}
    </Space>
);

// Appel à l'API : l'erreur porte le message renvoyé par le serveur
export const requete = async (url: string, method = 'GET', corps?: unknown) => {
    const r = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: corps !== undefined ? JSON.stringify(corps) : undefined,
    });
    if (!r.ok) throw new Error((await r.text()) || 'Erreur ' + r.status);
    return r;
};
