import React from 'react';
import { Tag, Typography } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

// Mise en forme commune aux pages de KPIs (financiers, commerciaux, atelier)

export const formatEuro = (v?: number | null, decimales = 2) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(v ?? 0);
export const formatDate = (v?: string) => (v ? dayjs(v).format('DD/MM/YYYY') : '—');
export const formatMois = (mois: string) => dayjs(mois + '-01').format('MM/YYYY');
export const formatTaux = (v?: number | null) => (v == null ? '—' : `${v.toLocaleString('fr-FR')} %`);

// Évolution en % par rapport à N-1, null sans base de comparaison
export const evolution = (n: number, n1: number) => (Math.abs(n1) >= 0.005 ? Math.round(((n - n1) / Math.abs(n1)) * 1000) / 10 : null);

export const Evolution = ({ n, n1 }: { n: number; n1: number }) => {
    const pct = evolution(n, n1);
    if (pct === null) return <Typography.Text type="secondary">—</Typography.Text>;
    return (
        <Tag color={pct >= 0 ? 'green' : 'red'} icon={pct >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}>
            {pct > 0 ? '+' : ''}{pct.toLocaleString('fr-FR')} %
        </Tag>
    );
};

// Écart en points entre deux taux, null s'il en manque un
export const ecartPoints = (taux?: number | null, tauxN1?: number | null) =>
    taux == null || tauxN1 == null ? null : Math.round((taux - tauxN1) * 10) / 10;

export const EcartPoints = ({ taux, tauxN1 }: { taux?: number | null; tauxN1?: number | null }) => {
    const ecart = ecartPoints(taux, tauxN1);
    if (ecart === null) return <Typography.Text type="secondary">—</Typography.Text>;
    return <Tag color={ecart >= 0 ? 'green' : 'red'}>{ecart > 0 ? '+' : ''}{ecart.toLocaleString('fr-FR')} pts</Tag>;
};
