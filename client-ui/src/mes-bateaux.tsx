import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Spin, message, Checkbox, Button, Space, Image } from 'antd';
import { PictureOutlined, TagsOutlined } from '@ant-design/icons';
import api from './api.ts';

interface BateauClientEntity {
    id: number;
    name?: string;
    immatriculation?: string;
    numeroSerie?: string;
    dateMeS?: string;
    dateAchat?: string;
    dateFinDeGuarantie?: string;
    localisation?: string;
    images?: string[];
    modele?: { id: number; nom?: string; marque?: string };
    moteurs?: Array<{ id: number; nom?: string; marque?: string }>;
    equipements?: string[];
}

interface MesBateauxProps {
    clientId: number;
    onCreateAnnonce?: (photos: string[], bateauId?: number) => void;
}

const formatDate = (value?: string) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString('fr-FR');
};

export default function MesBateaux({ clientId, onCreateAnnonce }: MesBateauxProps) {
    const [bateaux, setBateaux] = useState<BateauClientEntity[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedImages, setSelectedImages] = useState<Record<number, Set<string>>>({});

    useEffect(() => {
        setLoading(true);
        api.get(`/portal/clients/${clientId}/bateaux`)
            .then((res) => setBateaux(res.data || []))
            .catch(() => message.error('Erreur lors du chargement des bateaux'))
            .finally(() => setLoading(false));
    }, [clientId]);

    const toggleImage = (bateauId: number, url: string) => {
        setSelectedImages((prev) => {
            const set = new Set(prev[bateauId] || []);
            if (set.has(url)) set.delete(url);
            else set.add(url);
            return { ...prev, [bateauId]: set };
        });
    };

    const toggleAll = (bateauId: number, images: string[]) => {
        setSelectedImages((prev) => {
            const current = prev[bateauId] || new Set();
            const allSelected = images.every((img) => current.has(img));
            return { ...prev, [bateauId]: allSelected ? new Set() : new Set(images) };
        });
    };

    const handleCreateAnnonce = (bateau: BateauClientEntity) => {
        const selected = selectedImages[bateau.id];
        if (!selected || selected.size === 0) {
            message.warning('Veuillez selectionner au moins une image');
            return;
        }
        onCreateAnnonce?.(Array.from(selected), bateau.id);
    };

    const columns = [
        { title: 'Nom', dataIndex: 'name', key: 'name' },
        { title: 'Immatriculation', dataIndex: 'immatriculation', key: 'immatriculation' },
        {
            title: 'Modele',
            key: 'modele',
            render: (_: unknown, record: BateauClientEntity) =>
                record.modele ? `${record.modele.marque || ''} ${record.modele.nom || ''}`.trim() || '-' : '-',
        },
        { title: 'N/S', dataIndex: 'numeroSerie', key: 'numeroSerie' },
        { title: 'Localisation', dataIndex: 'localisation', key: 'localisation' },
        {
            title: 'Date achat',
            dataIndex: 'dateAchat',
            key: 'dateAchat',
            render: (val: string) => formatDate(val),
        },
        {
            title: 'Fin de garantie',
            dataIndex: 'dateFinDeGuarantie',
            key: 'dateFinDeGuarantie',
            render: (val: string) => {
                const formatted = formatDate(val);
                if (!val || formatted === '-') return '-';
                const isExpired = new Date(val) < new Date();
                return <Tag color={isExpired ? 'red' : 'green'}>{formatted}</Tag>;
            },
        },
        {
            title: 'Moteurs',
            key: 'moteurs',
            render: (_: unknown, record: BateauClientEntity) =>
                (record.moteurs || []).map((m) => (
                    <Tag key={m.id}>{m.marque ? `${m.marque} ${m.nom || ''}` : m.nom || `#${m.id}`}</Tag>
                )),
        },
        {
            title: 'Équipements',
            key: 'equipements',
            render: (_: unknown, record: BateauClientEntity) =>
                (record.equipements || []).map((e, i) => (
                    <Tag key={i}>{e}</Tag>
                )),
        },
        {
            title: 'Images',
            key: 'images',
            width: 80,
            align: 'center' as const,
            render: (_: unknown, record: BateauClientEntity) => {
                const count = (record.images || []).length;
                return count > 0 ? <Tag icon={<PictureOutlined />}>{count}</Tag> : '-';
            },
        },
    ];

    const expandedRowRender = (record: BateauClientEntity) => {
        const images = record.images || [];
        if (images.length === 0) {
            return <p style={{ color: '#999', fontStyle: 'italic' }}>Aucune image disponible</p>;
        }
        const selected = selectedImages[record.id] || new Set();
        const allSelected = images.every((img) => selected.has(img));

        return (
            <div>
                <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Checkbox
                        checked={allSelected}
                        indeterminate={selected.size > 0 && !allSelected}
                        onChange={() => toggleAll(record.id, images)}
                    >
                        Tout selectionner ({selected.size}/{images.length})
                    </Checkbox>
                    {onCreateAnnonce && (
                        <Button
                            type="primary"
                            icon={<TagsOutlined />}
                            disabled={selected.size === 0}
                            onClick={() => handleCreateAnnonce(record)}
                        >
                            Creer une annonce avec {selected.size > 0 ? `${selected.size} photo(s)` : 'les photos'}
                        </Button>
                    )}
                </div>
                <Image.PreviewGroup>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {images.map((url, i) => (
                            <div
                                key={i}
                                onClick={(e) => {
                                    if (!(e.target as HTMLElement).closest('.ant-image-mask')) {
                                        toggleImage(record.id, url);
                                    }
                                }}
                                style={{
                                    position: 'relative',
                                    cursor: 'pointer',
                                    border: selected.has(url) ? '3px solid #1890ff' : '3px solid transparent',
                                    borderRadius: 8,
                                    overflow: 'hidden',
                                }}
                            >
                                <Image
                                    width={120}
                                    height={120}
                                    src={url}
                                    style={{ objectFit: 'cover', display: 'block' }}
                                    preview={{ mask: 'Agrandir' }}
                                />
                                <Checkbox
                                    checked={selected.has(url)}
                                    onChange={() => toggleImage(record.id, url)}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ position: 'absolute', top: 4, left: 4, zIndex: 1 }}
                                />
                            </div>
                        ))}
                    </div>
                </Image.PreviewGroup>
            </div>
        );
    };

    return (
        <Card title="Mes bateaux">
            <Spin spinning={loading}>
                <Table
                    rowKey="id"
                    dataSource={bateaux}
                    columns={columns}
                    pagination={{ pageSize: 10 }}
                    bordered
                    expandable={{
                        expandedRowRender,
                        rowExpandable: (record) => (record.images || []).length > 0,
                    }}
                />
            </Spin>
        </Card>
    );
}
