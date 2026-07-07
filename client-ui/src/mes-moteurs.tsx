import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Spin, message, Checkbox, Button, Image, Divider, Typography } from 'antd';
import { PictureOutlined, TagsOutlined } from '@ant-design/icons';
import api from './api.ts';
import ImageUpload from './ImageUpload.tsx';
import DocumentUpload from './DocumentUpload.tsx';

interface MoteurClientEntity {
    id: number;
    numeroSerie?: string;
    dateMeS?: string;
    dateAchat?: string;
    dateFinDeGuarantie?: string;
    images?: string[];
    documents?: string[];
    modele?: { id: number; nom?: string; marque?: string };
}

interface MesMoteursProps {
    clientId: number;
    onCreateAnnonce?: (photos: string[]) => void;
}

const formatDate = (value?: string) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString('fr-FR');
};

export default function MesMoteurs({ clientId, onCreateAnnonce }: MesMoteursProps) {
    const [moteurs, setMoteurs] = useState<MoteurClientEntity[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedImages, setSelectedImages] = useState<Record<number, Set<string>>>({});
    const [draftImages, setDraftImages] = useState<Record<number, string[]>>({});
    const [draftDocuments, setDraftDocuments] = useState<Record<number, string[]>>({});
    const [savingMedias, setSavingMedias] = useState<Record<number, boolean>>({});

    useEffect(() => {
        setLoading(true);
        api.get(`/portal/clients/${clientId}/moteurs`)
            .then((res) => setMoteurs(res.data || []))
            .catch(() => message.error('Erreur lors du chargement des moteurs'))
            .finally(() => setLoading(false));
    }, [clientId]);

    const toggleImage = (moteurId: number, url: string) => {
        setSelectedImages((prev) => {
            const set = new Set(prev[moteurId] || []);
            if (set.has(url)) set.delete(url);
            else set.add(url);
            return { ...prev, [moteurId]: set };
        });
    };

    const toggleAll = (moteurId: number, images: string[]) => {
        setSelectedImages((prev) => {
            const current = prev[moteurId] || new Set();
            const allSelected = images.every((img) => current.has(img));
            return { ...prev, [moteurId]: allSelected ? new Set() : new Set(images) };
        });
    };

    const handleCreateAnnonce = (moteur: MoteurClientEntity) => {
        const selected = selectedImages[moteur.id];
        if (!selected || selected.size === 0) {
            message.warning('Veuillez selectionner au moins une image');
            return;
        }
        onCreateAnnonce?.(Array.from(selected));
    };

    const handleSaveMedias = async (moteurId: number) => {
        setSavingMedias((prev) => ({ ...prev, [moteurId]: true }));
        const moteur = moteurs.find((m) => m.id === moteurId);
        const images = draftImages[moteurId] ?? moteur?.images ?? [];
        const documents = draftDocuments[moteurId] ?? moteur?.documents ?? [];
        try {
            await api.put(`/portal/clients/${clientId}/moteurs/${moteurId}/medias`, { images, documents });
            setMoteurs((prev) => prev.map((m) => m.id === moteurId ? { ...m, images, documents } : m));
            message.success('Médias sauvegardés');
        } catch {
            message.error('Erreur lors de la sauvegarde des médias');
        } finally {
            setSavingMedias((prev) => ({ ...prev, [moteurId]: false }));
        }
    };

    const columns = [
        { title: 'N/Serie', dataIndex: 'numeroSerie', key: 'numeroSerie' },
        {
            title: 'Modele',
            key: 'modele',
            render: (_: unknown, record: MoteurClientEntity) =>
                record.modele ? `${record.modele.marque || ''} ${record.modele.nom || ''}`.trim() || '-' : '-',
        },
        {
            title: 'Date achat',
            dataIndex: 'dateAchat',
            key: 'dateAchat',
            render: (val: string) => formatDate(val),
        },
        {
            title: 'Mise en service',
            dataIndex: 'dateMeS',
            key: 'dateMeS',
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
            title: 'Images',
            key: 'images',
            width: 80,
            align: 'center' as const,
            render: (_: unknown, record: MoteurClientEntity) => {
                const count = (record.images || []).length;
                return count > 0 ? <Tag icon={<PictureOutlined />}>{count}</Tag> : '-';
            },
        },
    ];

    const expandedRowRender = (record: MoteurClientEntity) => {
        const savedImages = record.images || [];
        const selected = selectedImages[record.id] || new Set();
        const allSelected = savedImages.length > 0 && savedImages.every((img) => selected.has(img));

        return (
            <div>
                <Typography.Text strong>Photos</Typography.Text>
                <div style={{ marginTop: 8 }}>
                    <ImageUpload
                        value={draftImages[record.id] ?? record.images ?? []}
                        onChange={(urls) => setDraftImages((prev) => ({ ...prev, [record.id]: urls }))}
                    />
                </div>

                <Divider style={{ margin: '12px 0' }} />
                <Typography.Text strong>Documents</Typography.Text>
                <div style={{ marginTop: 8 }}>
                    <DocumentUpload
                        value={draftDocuments[record.id] ?? record.documents ?? []}
                        onChange={(urls) => setDraftDocuments((prev) => ({ ...prev, [record.id]: urls }))}
                    />
                </div>

                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                        type="primary"
                        loading={savingMedias[record.id]}
                        onClick={() => handleSaveMedias(record.id)}
                    >
                        Sauvegarder les modifications
                    </Button>
                </div>

                {onCreateAnnonce && savedImages.length > 0 && (
                    <>
                        <Divider>Créer une annonce</Divider>
                        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Checkbox
                                checked={allSelected}
                                indeterminate={selected.size > 0 && !allSelected}
                                onChange={() => toggleAll(record.id, savedImages)}
                            >
                                Tout selectionner ({selected.size}/{savedImages.length})
                            </Checkbox>
                            <Button
                                type="primary"
                                icon={<TagsOutlined />}
                                disabled={selected.size === 0}
                                onClick={() => handleCreateAnnonce(record)}
                            >
                                Creer une annonce avec {selected.size > 0 ? `${selected.size} photo(s)` : 'les photos'}
                            </Button>
                        </div>
                        <Image.PreviewGroup>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {savedImages.map((url, i) => (
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
                    </>
                )}
            </div>
        );
    };

    return (
        <Card title="Mes moteurs">
            <Spin spinning={loading}>
                <Table
                    rowKey="id"
                    dataSource={moteurs}
                    columns={columns}
                    pagination={{ pageSize: 10 }}
                    bordered
                    expandable={{
                        expandedRowRender,
                        rowExpandable: () => true,
                    }}
                />
            </Spin>
        </Card>
    );
}
