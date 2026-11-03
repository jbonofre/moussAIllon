import React, { useCallback, useEffect, useState } from 'react';
import { Button, Form, Input, Modal, Popconfirm, Popover, Select, Space, Switch, Table, Tag, Typography, message } from 'antd';
import { ExportOutlined, KeyOutlined, ReloadOutlined, SettingOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from './api.ts';
import { formatsFlux, PlateformeAnnonce, PlateformeConfig, plateformes } from './plateformes-annonces.ts';

interface Ligne {
    plateforme: PlateformeAnnonce;
    config?: PlateformeConfig;
}

// Plateformes d'annonces alimentées par un flux NautiX : activation, URL à transmettre et suivi des lectures
export default function PlateformesAnnonces() {
    const [configs, setConfigs] = useState<PlateformeConfig[]>([]);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState<Ligne | null>(null);
    const [form] = Form.useForm();

    const load = useCallback(() => {
        setLoading(true);
        api.get<PlateformeConfig[]>('/plateformes-annonces')
            .then((res) => setConfigs(res.data || []))
            .catch(() => message.error('Erreur lors du chargement des plateformes'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const lignes: Ligne[] = plateformes
        .filter((p) => p.flux)
        .map((plateforme) => ({ plateforme, config: configs.find((c) => c.code === plateforme.key) }));

    const openForm = (ligne: Ligne) => {
        setEditing(ligne);
        form.setFieldsValue({
            actif: ligne.config?.actif ?? true,
            format: ligne.config?.format ?? formatsFlux[0].value,
            notes: ligne.config?.notes,
        });
    };

    const save = async () => {
        const values = await form.validateFields();
        try {
            await api.put(`/plateformes-annonces/${editing!.plateforme.key.toLowerCase()}`, { ...values, actif: !!values.actif });
            message.success(`${editing!.plateforme.label} enregistrée`);
            setEditing(null);
            load();
        } catch {
            message.error("Erreur lors de l'enregistrement");
        }
    };

    const regenererJeton = async (ligne: Ligne) => {
        try {
            await api.post(`/plateformes-annonces/${ligne.plateforme.key.toLowerCase()}/jeton`);
            message.success(`Nouvelle URL de flux pour ${ligne.plateforme.label} : transmettez-la à la plateforme`);
            load();
        } catch {
            message.error('Erreur lors de la régénération du jeton');
        }
    };

    const columns = [
        {
            title: 'Plateforme',
            key: 'plateforme',
            render: (_: unknown, l: Ligne) => <Tag color={l.plateforme.color}>{l.plateforme.label}</Tag>,
        },
        {
            title: 'Statut',
            key: 'statut',
            render: (_: unknown, l: Ligne) => !l.config
                ? <Tag>Non configurée</Tag>
                : l.config.actif ? <Tag color="green">Flux actif</Tag> : <Tag color="orange">Désactivée</Tag>,
        },
        {
            title: 'Format',
            key: 'format',
            render: (_: unknown, l: Ligne) => l.config ? formatsFlux.find((f) => f.value === l.config!.format)?.label || l.config.format : '—',
        },
        {
            title: 'Annonces dans le flux',
            key: 'nombreAnnonces',
            render: (_: unknown, l: Ligne) => l.config ? l.config.nombreAnnonces ?? 0 : '—',
        },
        {
            title: 'Dernière lecture',
            key: 'derniereLecture',
            render: (_: unknown, l: Ligne) => {
                if (!l.config) return '—';
                return l.config.derniereLecture
                    ? dayjs(l.config.derniereLecture).format('DD/MM/YYYY HH:mm')
                    : <Typography.Text type="secondary">Jamais lu par la plateforme</Typography.Text>;
            },
        },
        {
            title: 'URL du flux',
            key: 'urlFlux',
            render: (_: unknown, l: Ligne) => l.config?.urlFlux
                ? <Typography.Text copyable={{ text: l.config.urlFlux }} ellipsis style={{ maxWidth: 280 }}>{l.config.urlFlux}</Typography.Text>
                : '—',
        },
        {
            title: 'Avertissements',
            key: 'avertissements',
            render: (_: unknown, l: Ligne) => {
                const avertissements = l.config?.avertissements || [];
                if (avertissements.length === 0) return l.config ? <Tag color="green">Aucun</Tag> : '—';
                return (
                    <Popover
                        title="À corriger pour une diffusion complète"
                        content={<ul style={{ margin: 0, paddingLeft: 18, maxWidth: 480 }}>{avertissements.map((a) => <li key={a}>{a}</li>)}</ul>}
                    >
                        <Tag color="warning" icon={<WarningOutlined />} style={{ cursor: 'pointer' }}>{avertissements.length}</Tag>
                    </Popover>
                );
            },
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: unknown, l: Ligne) => (
                <Space>
                    <Button title="Configurer" icon={<SettingOutlined />} onClick={() => openForm(l)} />
                    {l.config?.urlFlux && (
                        <Button title="Ouvrir le flux" icon={<ExportOutlined />} href={l.config.urlFlux} target="_blank" rel="noopener noreferrer" />
                    )}
                    {l.config && (
                        <Popconfirm
                            title="Régénérer le jeton ?"
                            description="L'URL actuelle cessera de fonctionner : il faudra transmettre la nouvelle à la plateforme."
                            okText="Régénérer"
                            cancelText="Annuler"
                            onConfirm={() => regenererJeton(l)}
                        >
                            <Button title="Régénérer le jeton" icon={<KeyOutlined />} />
                        </Popconfirm>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <div>
            <Space style={{ width: '100%', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
                    Les annonces actives cochées pour une plateforme sont publiées dans un flux XML (format NautiX)
                    que la plateforme vient lire, en général une fois par jour. Transmettez l'URL du flux à votre
                    interlocuteur sur la plateforme (compte professionnel requis) ; la date de dernière lecture
                    confirme que la diffusion est effective.
                </Typography.Paragraph>
                <Button title="Recharger" icon={<ReloadOutlined />} loading={loading} onClick={load} />
            </Space>
            <Table rowKey={(l) => l.plateforme.key} loading={loading} dataSource={lignes} columns={columns} pagination={false} bordered />

            <Modal
                open={!!editing}
                title={`Flux ${editing?.plateforme.label ?? ''}`}
                okText="Enregistrer"
                cancelText="Annuler"
                onOk={save}
                onCancel={() => setEditing(null)}
                destroyOnHidden
            >
                {editing?.plateforme.infoFlux && (
                    <Typography.Paragraph type="secondary">{editing.plateforme.infoFlux}</Typography.Paragraph>
                )}
                <Form form={form} layout="vertical">
                    <Form.Item name="actif" label="Flux actif" valuePropName="checked"><Switch /></Form.Item>
                    <Form.Item name="format" label="Format du flux"><Select options={formatsFlux} /></Form.Item>
                    <Form.Item name="notes" label="Notes" extra="Ex. identifiant du compte professionnel, interlocuteur, date de mise en place">
                        <Input.TextArea rows={3} />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
