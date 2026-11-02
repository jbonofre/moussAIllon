import React from 'react';

type Couleur = 'mainOeuvre' | 'produit';

const COULEURS: Record<Couleur, { trait: string; fond: string }> = {
    mainOeuvre: { trait: '#1677ff', fond: 'rgba(22, 119, 255, 0.06)' },
    produit: { trait: '#52a31d', fond: 'rgba(82, 163, 29, 0.07)' },
};

// Bloc coloré regroupant les lignes de main d'œuvre ou de produits d'un service
export default function SectionLignes({ titre, couleur, compact, children }: {
    titre: string;
    couleur: Couleur;
    // Compense la marge basse des champs de ligne (formulaire non compact)
    compact?: boolean;
    children: React.ReactNode;
}) {
    const { trait, fond } = COULEURS[couleur];
    return (
        <div style={{ borderLeft: `4px solid ${trait}`, background: fond, borderRadius: 6, padding: '8px 12px', marginBottom: 8 }}>
            <div style={{ fontWeight: 600, color: trait, marginBottom: 8 }}>{titre}</div>
            <div style={compact ? { marginBottom: -16 } : undefined}>{children}</div>
        </div>
    );
}
