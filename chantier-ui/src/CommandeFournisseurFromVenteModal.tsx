import React, { useEffect, useMemo, useState } from 'react';
import {
    Modal,
    Form,
    Input,
    InputNumber,
    Select,
    Button,
    Table,
    Tag,
    Space,
    Typography,
    Divider,
    Alert,
    Row,
    Col,
    Card,
    Checkbox,
    Spin,
    message,
    notification,
    Tooltip
} from 'antd';
import {
    ShoppingCartOutlined,
    CheckCircleOutlined,
    ExclamationCircleOutlined,
    PlusOutlined,
    AppstoreOutlined,
    DeploymentUnitOutlined,
    ArrowRightOutlined,
    WarningOutlined,
    ShopOutlined
} from '@ant-design/icons';
import api from './api.ts';
import { useNavigation } from './navigation-context.tsx';

const { Text } = Typography;

export interface FournisseurItemDTO {
    fournisseurId: number;
    fournisseurNom: string;
    reference?: string;
    prixAchatHT: number;
    tva: number;
    portForfaitaire?: number;
    portParUnite?: number;
    nombreMinACommander?: number;
}

export interface VenteArticleFournisseurDTO {
    articleKey: string;
    type: string;
    id: number;
    designation: string;
    reference?: string;
    quantiteVente: number;
    stockActuel: number;
    stockMini: number;
    besoinStock: number;
    fournisseurs: FournisseurItemDTO[];
}

export interface FournisseurSuggerDTO {
    fournisseurId: number;
    fournisseurNom: string;
    nombreArticles: number;
}

export interface FournisseurSimpleDTO {
    id: number;
    nom: string;
    email?: string;
    telephone?: string;
}

export interface PrepareCommandeFromVenteDTO {
    venteId: number;
    clientNom?: string;
    numeroFacture?: string;
    comptoir: boolean;
    dateVente?: string;
    articles: VenteArticleFournisseurDTO[];
    fournisseursSuggeres: FournisseurSuggerDTO[];
    tousFournisseurs: FournisseurSimpleDTO[];
}

interface EditableArticleLine {
    articleKey: string;
    type: string;
    id: number;
    designation: string;
    reference?: string;
    quantiteVente: number;
    stockActuel: number;
    stockMini: number;
    besoinStock: number;
    fournisseurs: FournisseurItemDTO[];
    checked: boolean;
    quantite: number;
    prixUnitaireHT: number;
    tva: number;
    fournisseurRef?: string;
    suppliedByCurrent: boolean;
}

export interface CommandeFournisseurFromVenteModalProps {
    open: boolean;
    venteId: number | null;
    venteNumero?: string;
    clientNom?: string;
    initialArticleKey?: string;
    onClose: () => void;
    onSuccess: (createdOrder: any) => void;
}

const typeLabels: Record<string, { label: string; color: string }> = {
    produit: { label: 'Produit', color: 'blue' },
    bateau: { label: 'Bateau', color: 'cyan' },
    moteur: { label: 'Moteur', color: 'volcano' },
    helice: { label: 'Hélice', color: 'purple' },
    remorque: { label: 'Remorque', color: 'gold' },
};

const formatEuro = (v?: number) => `${(v || 0).toFixed(2)} €`;

export default function CommandeFournisseurFromVenteModal({
    open,
    venteId,
    venteNumero,
    clientNom,
    initialArticleKey,
    onClose,
    onSuccess
}: CommandeFournisseurFromVenteModalProps) {
    const { navigate } = useNavigation();
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [prepareData, setPrepareData] = useState<PrepareCommandeFromVenteDTO | null>(null);
    const [selectedFournisseurId, setSelectedFournisseurId] = useState<number | null>(null);
    const [lines, setLines] = useState<EditableArticleLine[]>([]);

    // Form fields for order details
    const [reference, setReference] = useState('');
    const [referenceFournisseur, setReferenceFournisseur] = useState('');
    const [status, setStatus] = useState<string>('EN_ATTENTE');
    const [portTotal, setPortTotal] = useState<number>(0);
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (!open || !venteId) {
            setPrepareData(null);
            setSelectedFournisseurId(null);
            setLines([]);
            setReference('');
            setReferenceFournisseur('');
            setStatus('EN_ATTENTE');
            setPortTotal(0);
            setNotes('');
            return;
        }

        let isMounted = true;
        setLoading(true);

        api.get(`/commandes-fournisseur/prepare-from-vente/${venteId}`)
            .then((res) => {
                if (!isMounted) return;
                const data: PrepareCommandeFromVenteDTO = res.data;
                setPrepareData(data);

                // Determine initial supplier
                let initialSupId: number | null = null;
                if (initialArticleKey) {
                    const targetArt = data.articles?.find(a => a.articleKey === initialArticleKey);
                    if (targetArt && targetArt.fournisseurs && targetArt.fournisseurs.length > 0) {
                        initialSupId = targetArt.fournisseurs[0].fournisseurId;
                    }
                }
                if (!initialSupId) {
                    if (data.fournisseursSuggeres && data.fournisseursSuggeres.length > 0) {
                        initialSupId = data.fournisseursSuggeres[0].fournisseurId;
                    } else if (data.tousFournisseurs && data.tousFournisseurs.length > 0) {
                        initialSupId = data.tousFournisseurs[0].id;
                    }
                }
                setSelectedFournisseurId(initialSupId);

                // Build editable lines
                const initialLines: EditableArticleLine[] = (data.articles || []).map((art) => {
                    const match = initialSupId ? art.fournisseurs.find(f => f.fournisseurId === initialSupId) : undefined;
                    const isTarget = initialArticleKey ? art.articleKey === initialArticleKey : undefined;
                    const checked = isTarget !== undefined ? isTarget : (match !== undefined);
                    const qty = art.besoinStock > 0 ? art.besoinStock : (art.quantiteVente || 1);

                    return {
                        articleKey: art.articleKey,
                        type: art.type,
                        id: art.id,
                        designation: art.designation,
                        reference: art.reference,
                        quantiteVente: art.quantiteVente,
                        stockActuel: art.stockActuel,
                        stockMini: art.stockMini,
                        besoinStock: art.besoinStock,
                        fournisseurs: art.fournisseurs || [],
                        checked,
                        quantite: qty,
                        prixUnitaireHT: match ? match.prixAchatHT : 0,
                        tva: match ? (match.tva ?? 20) : 20,
                        fournisseurRef: match?.reference,
                        suppliedByCurrent: !!match
                    };
                });
                setLines(initialLines);

                // Pre-fill notes
                const refVente = data.numeroFacture ? `facture ${data.numeroFacture}` : `vente #${data.venteId}`;
                setNotes(`Commande fournisseur liée à la ${refVente}${data.clientNom ? ` (Client : ${data.clientNom})` : ''}`);

                // Check default shipping
                if (initialSupId) {
                    let port = 0;
                    for (const art of data.articles || []) {
                        const m = art.fournisseurs?.find(f => f.fournisseurId === initialSupId);
                        if (m?.portForfaitaire && m.portForfaitaire > port) {
                            port = m.portForfaitaire;
                        }
                    }
                    setPortTotal(port);
                }
            })
            .catch((err) => {
                message.error('Impossible de charger les données de la vente pour la commande fournisseur.');
                console.error(err);
                onClose();
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [open, venteId, initialArticleKey]);

    // When user changes supplier selection
    const handleFournisseurChange = (fournisseurId: number) => {
        setSelectedFournisseurId(fournisseurId);

        let highestPort = 0;
        const updatedLines = lines.map((line) => {
            const match = line.fournisseurs.find(f => f.fournisseurId === fournisseurId);
            if (match?.portForfaitaire && match.portForfaitaire > highestPort) {
                highestPort = match.portForfaitaire;
            }

            if (match) {
                return {
                    ...line,
                    checked: true,
                    prixUnitaireHT: match.prixAchatHT,
                    tva: match.tva ?? 20,
                    fournisseurRef: match.reference,
                    suppliedByCurrent: true
                };
            } else {
                return {
                    ...line,
                    checked: false,
                    fournisseurRef: undefined,
                    suppliedByCurrent: false
                };
            }
        });

        setLines(updatedLines);
        if (highestPort > 0) {
            setPortTotal(highestPort);
        }
    };

    const updateLine = (articleKey: string, patch: Partial<EditableArticleLine>) => {
        setLines(prev => prev.map(l => l.articleKey === articleKey ? { ...l, ...patch } : l));
    };

    // Bulk selection handlers
    const selectAll = () => {
        setLines(prev => prev.map(l => ({ ...l, checked: true })));
    };

    const deselectAll = () => {
        setLines(prev => prev.map(l => ({ ...l, checked: false })));
    };

    const selectShortagesOnly = () => {
        setLines(prev => prev.map(l => ({ ...l, checked: l.besoinStock > 0 })));
    };

    const selectCurrentSupplierOnly = () => {
        setLines(prev => prev.map(l => ({ ...l, checked: l.suppliedByCurrent })));
    };

    // Totals
    const checkedLines = useMemo(() => lines.filter(l => l.checked), [lines]);
    const totalHT = useMemo(() => {
        return Math.round(checkedLines.reduce((acc, l) => acc + (l.quantite * l.prixUnitaireHT), 0) * 100) / 100;
    }, [checkedLines]);

    const totalTVA = useMemo(() => {
        return Math.round(checkedLines.reduce((acc, l) => acc + (l.quantite * l.prixUnitaireHT * (l.tva / 100)), 0) * 100) / 100;
    }, [checkedLines]);

    const totalTTC = useMemo(() => {
        return Math.round((totalHT + totalTVA + (portTotal || 0)) * 100) / 100;
    }, [totalHT, totalTVA, portTotal]);

    const selectedSupplier = useMemo(() => {
        if (!selectedFournisseurId || !prepareData) return null;
        return prepareData.tousFournisseurs.find(f => f.id === selectedFournisseurId) || null;
    }, [selectedFournisseurId, prepareData]);

    const handleSubmit = async () => {
        if (!selectedFournisseurId) {
            message.warning('Veuillez sélectionner un fournisseur.');
            return;
        }

        if (checkedLines.length === 0) {
            message.warning('Veuillez sélectionner au moins un article à commander.');
            return;
        }

        for (const line of checkedLines) {
            if (!line.quantite || line.quantite <= 0) {
                message.warning(`Veuillez saisir une quantité valide pour "${line.designation}".`);
                return;
            }
        }

        setSubmitting(true);
        try {
            const payload = {
                fournisseurId: selectedFournisseurId,
                reference: reference.trim() || undefined,
                referenceFournisseur: referenceFournisseur.trim() || undefined,
                status: status || 'EN_ATTENTE',
                portTotal: portTotal || 0,
                notes: notes.trim() || undefined,
                lignes: checkedLines.map(l => ({
                    type: l.type,
                    id: l.id,
                    quantite: l.quantite,
                    prixUnitaireHT: l.prixUnitaireHT,
                    tva: l.tva
                }))
            };

            const response = await api.post(`/commandes-fournisseur/from-vente/${venteId}`, payload);
            const created = response.data;

            message.success('Commande fournisseur créée avec succès.');

            notification.success({
                message: 'Commande fournisseur créée',
                description: (
                    <div>
                        <p>
                            La commande <strong>{created.reference || 'CF'}</strong> a été créée et associée à cette vente.
                        </p>
                        <Button
                            type="primary"
                            size="small"
                            icon={<ArrowRightOutlined />}
                            onClick={() => {
                                notification.destroy();
                                navigate('/commandes-fournisseur');
                            }}
                        >
                            Accéder aux commandes fournisseur
                        </Button>
                    </div>
                ),
                duration: 6
            });

            onSuccess(created);
            onClose();
        } catch (err: any) {
            const errorMsg = err.response?.data?.message || err.message || 'Erreur lors de la création de la commande fournisseur.';
            message.error(errorMsg);
            console.error(err);
        } finally {
            setSubmitting(false);
        }
    };

    const columns = [
        {
            title: '',
            key: 'checked',
            width: 45,
            align: 'center' as const,
            render: (_: unknown, record: EditableArticleLine) => (
                <Checkbox
                    checked={record.checked}
                    onChange={(e) => updateLine(record.articleKey, { checked: e.target.checked })}
                />
            )
        },
        {
            title: 'Type',
            key: 'type',
            width: 95,
            render: (_: unknown, record: EditableArticleLine) => {
                const conf = typeLabels[record.type] || { label: record.type, color: 'default' };
                return <Tag color={conf.color}>{conf.label}</Tag>;
            }
        },
        {
            title: 'Désignation',
            key: 'designation',
            render: (_: unknown, record: EditableArticleLine) => (
                <div>
                    <strong>{record.designation}</strong>
                    {record.reference && <div style={{ fontSize: 12, color: '#8c8c8c' }}>Réf interne : {record.reference}</div>}
                    {record.fournisseurRef && (
                        <div style={{ fontSize: 12, color: '#1677ff' }}>Réf fournisseur : {record.fournisseurRef}</div>
                    )}
                    {!record.suppliedByCurrent && (
                        <Tag color="warning" style={{ marginTop: 2 }}>Non lié à ce fournisseur</Tag>
                    )}
                </div>
            )
        },
        {
            title: 'Stock / Vente',
            key: 'stock',
            width: 170,
            render: (_: unknown, record: EditableArticleLine) => {
                const stock = record.stockActuel;
                const isShortage = stock <= 0 || stock < record.quantiteVente;
                return (
                    <Space direction="vertical" size={2}>
                        <div>
                            Stock actuel : <Tag color={stock <= 0 ? 'red' : isShortage ? 'orange' : 'green'}>{stock}</Tag>
                        </div>
                        <div style={{ fontSize: 12, color: '#595959' }}>
                            Quantité vendue : <strong>{record.quantiteVente}</strong>
                        </div>
                        {record.besoinStock > 0 && (
                            <Tag color="error" style={{ fontSize: 11 }}>
                                Besoin estimé : {record.besoinStock}
                            </Tag>
                        )}
                    </Space>
                );
            }
        },
        {
            title: 'Quantité à commander',
            key: 'quantite',
            width: 170,
            render: (_: unknown, record: EditableArticleLine) => (
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <InputNumber
                        min={1}
                        step={1}
                        value={record.quantite}
                        disabled={!record.checked}
                        onChange={(val) => updateLine(record.articleKey, { quantite: Number(val) || 1 })}
                        style={{ width: '100%' }}
                    />
                    <Space size={4}>
                        {record.besoinStock > 0 && (
                            <Tooltip title="Commander le besoin de stock">
                                <Button
                                    size="small"
                                    type="dashed"
                                    disabled={!record.checked}
                                    style={{ fontSize: 11, padding: '0 6px' }}
                                    onClick={() => updateLine(record.articleKey, { quantite: record.besoinStock })}
                                >
                                    Besoin ({record.besoinStock})
                                </Button>
                            </Tooltip>
                        )}
                        <Tooltip title="Commander la quantité totale de la vente">
                            <Button
                                size="small"
                                type="dashed"
                                disabled={!record.checked}
                                style={{ fontSize: 11, padding: '0 6px' }}
                                onClick={() => updateLine(record.articleKey, { quantite: record.quantiteVente })}
                            >
                                Vente ({record.quantiteVente})
                            </Button>
                        </Tooltip>
                    </Space>
                </Space>
            )
        },
        {
            title: 'P.U. Achat HT',
            key: 'prixUnitaireHT',
            width: 130,
            render: (_: unknown, record: EditableArticleLine) => (
                <InputNumber
                    min={0}
                    step={0.01}
                    precision={2}
                    addonAfter="€"
                    value={record.prixUnitaireHT}
                    disabled={!record.checked}
                    onChange={(val) => updateLine(record.articleKey, { prixUnitaireHT: Number(val) || 0 })}
                    style={{ width: '100%' }}
                />
            )
        },
        {
            title: 'TVA',
            key: 'tva',
            width: 95,
            render: (_: unknown, record: EditableArticleLine) => (
                <InputNumber
                    min={0}
                    max={100}
                    step={0.1}
                    addonAfter="%"
                    value={record.tva}
                    disabled={!record.checked}
                    onChange={(val) => updateLine(record.articleKey, { tva: Number(val) || 0 })}
                    style={{ width: '100%' }}
                />
            )
        },
        {
            title: 'Total HT',
            key: 'totalHT',
            width: 110,
            align: 'right' as const,
            render: (_: unknown, record: EditableArticleLine) => {
                if (!record.checked) return <span style={{ color: '#bfbfbf' }}>-</span>;
                const total = Math.round(record.quantite * record.prixUnitaireHT * 100) / 100;
                return <strong>{formatEuro(total)}</strong>;
            }
        }
    ];

    const hasNoArticles = prepareData && (!prepareData.articles || prepareData.articles.length === 0);

    return (
        <Modal
            title={
                <Space>
                    <ShoppingCartOutlined style={{ color: '#722ed1' }} />
                    <span>Créer une commande fournisseur depuis la vente</span>
                    {venteNumero ? <Tag color="blue">{venteNumero}</Tag> : (venteId ? <Tag color="blue">#{venteId}</Tag> : null)}
                </Space>
            }
            open={open}
            onCancel={onClose}
            width="90vw"
            style={{ maxWidth: 1200, top: 20 }}
            maskClosable={false}
            destroyOnHidden
            footer={[
                <Button key="cancel" onClick={onClose} disabled={submitting}>
                    Annuler
                </Button>,
                <Button
                    key="submit"
                    type="primary"
                    icon={<ShoppingCartOutlined />}
                    loading={submitting}
                    disabled={loading || hasNoArticles || checkedLines.length === 0 || !selectedFournisseurId}
                    onClick={handleSubmit}
                >
                    Créer la commande fournisseur ({checkedLines.length} article{checkedLines.length > 1 ? 's' : ''})
                </Button>
            ]}
        >
            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                    <Spin size="large" tip="Préparation de la commande fournisseur..." />
                </div>
            ) : hasNoArticles ? (
                <Alert
                    type="info"
                    showIcon
                    message="Aucun article dans cette vente"
                    description="Cette vente ne comporte pas d'articles catalogue (produits, bateaux, moteurs, hélices, remorques) pouvant être commandés auprès d'un fournisseur."
                    style={{ margin: '20px 0' }}
                />
            ) : (
                <div style={{ maxHeight: 'calc(80vh - 120px)', overflowY: 'auto', paddingRight: 8 }}>
                    {/* Header context card */}
                    <Card size="small" style={{ marginBottom: 16, backgroundColor: '#fafafa' }}>
                        <Row gutter={16} align="middle">
                            <Col span={16}>
                                <Space direction="vertical" size={2}>
                                    <Space wrap>
                                        <strong>Vente {prepareData?.comptoir ? 'comptoir' : 'atelier'} :</strong>
                                        <span>#{prepareData?.venteId}</span>
                                        {prepareData?.numeroFacture && <Tag color="purple">Facture {prepareData.numeroFacture}</Tag>}
                                        {prepareData?.dateVente && <span style={{ color: '#8c8c8c' }}>({prepareData.dateVente})</span>}
                                    </Space>
                                    <div>
                                        Client : <strong>{prepareData?.clientNom || 'Client comptoir'}</strong>
                                    </div>
                                </Space>
                            </Col>
                            <Col span={8} style={{ textAlign: 'right' }}>
                                <Tag color={lines.some(l => l.besoinStock > 0) ? 'red' : 'green'}>
                                    {lines.filter(l => l.besoinStock > 0).length} article(s) en rupture
                                </Tag>
                            </Col>
                        </Row>
                    </Card>

                    {/* Supplier Selection */}
                    <Card title="1. Choix du fournisseur" size="small" style={{ marginBottom: 16 }}>
                        {prepareData?.fournisseursSuggeres && prepareData.fournisseursSuggeres.length > 0 && (
                            <div style={{ marginBottom: 12 }}>
                                <Text type="secondary" style={{ marginRight: 8 }}>
                                    Fournisseurs suggérés pour cette vente :
                                </Text>
                                <Space wrap>
                                    {prepareData.fournisseursSuggeres.map(s => {
                                        const isSelected = selectedFournisseurId === s.fournisseurId;
                                        return (
                                            <Button
                                                key={s.fournisseurId}
                                                size="small"
                                                type={isSelected ? 'primary' : 'default'}
                                                icon={<ShopOutlined />}
                                                onClick={() => handleFournisseurChange(s.fournisseurId)}
                                            >
                                                {s.fournisseurNom} ({s.nombreArticles} article{s.nombreArticles > 1 ? 's' : ''})
                                            </Button>
                                        );
                                    })}
                                </Space>
                            </div>
                        )}

                        <Row gutter={16} align="middle">
                            <Col span={14}>
                                <Select
                                    placeholder="Sélectionner le fournisseur"
                                    showSearch
                                    style={{ width: '100%' }}
                                    value={selectedFournisseurId}
                                    onChange={handleFournisseurChange}
                                    filterOption={(input, option) =>
                                        (option?.label as string || '').toLowerCase().includes(input.toLowerCase())
                                    }
                                    options={(prepareData?.tousFournisseurs || []).map(f => {
                                        const suggestion = prepareData?.fournisseursSuggeres?.find(s => s.fournisseurId === f.id);
                                        const badge = suggestion ? ` (${suggestion.nombreArticles} art.)` : '';
                                        return {
                                            value: f.id,
                                            label: `${f.nom}${badge}`
                                        };
                                    })}
                                />
                            </Col>
                            {selectedSupplier && (
                                <Col span={10}>
                                    <Space split={<Divider type="vertical" />}>
                                        {selectedSupplier.email && <small>{selectedSupplier.email}</small>}
                                        {selectedSupplier.telephone && <small>{selectedSupplier.telephone}</small>}
                                    </Space>
                                </Col>
                            )}
                        </Row>
                    </Card>

                    {/* Articles selection */}
                    <Card
                        title="2. Articles à commander"
                        size="small"
                        style={{ marginBottom: 16 }}
                        extra={
                            <Space size={8} wrap>
                                <Button size="small" onClick={selectAll}>Tout cocher</Button>
                                <Button size="small" onClick={deselectAll}>Tout décocher</Button>
                                <Button size="small" onClick={selectCurrentSupplierOnly}>Fournisseur actif</Button>
                                <Button size="small" type="dashed" danger onClick={selectShortagesOnly}>
                                    Ruptures uniquement
                                </Button>
                            </Space>
                        }
                    >
                        <Table
                            rowKey="articleKey"
                            dataSource={lines}
                            columns={columns}
                            pagination={false}
                            size="small"
                            bordered
                            rowClassName={(record) => (!record.checked ? 'row-unchecked' : (record.besoinStock > 0 ? 'row-shortage' : ''))}
                        />
                    </Card>

                    {/* Order metadata and totals */}
                    <Row gutter={16}>
                        <Col span={14}>
                            <Card title="3. Détails de la commande" size="small">
                                <Row gutter={12}>
                                    <Col span={12}>
                                        <Form.Item label="Référence commande" style={{ marginBottom: 12 }}>
                                            <Input
                                                placeholder="Auto-générée (ex: CF-2026-0001)"
                                                value={reference}
                                                onChange={(e) => setReference(e.target.value)}
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item label="Réf. devis / fournisseur" style={{ marginBottom: 12 }}>
                                            <Input
                                                placeholder="Optionnel"
                                                value={referenceFournisseur}
                                                onChange={(e) => setReferenceFournisseur(e.target.value)}
                                            />
                                        </Form.Item>
                                    </Col>
                                </Row>

                                <Row gutter={12}>
                                    <Col span={12}>
                                        <Form.Item label="Statut initial" style={{ marginBottom: 12 }}>
                                            <Select
                                                value={status}
                                                onChange={setStatus}
                                                options={[
                                                    { value: 'EN_ATTENTE', label: 'En attente / Brouillon' },
                                                    { value: 'ENVOYEE', label: 'Envoyée au fournisseur' },
                                                ]}
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item label="Frais de port HT" style={{ marginBottom: 12 }}>
                                            <InputNumber
                                                min={0}
                                                step={0.5}
                                                precision={2}
                                                addonAfter="€"
                                                value={portTotal}
                                                onChange={(v) => setPortTotal(Number(v) || 0)}
                                                style={{ width: '100%' }}
                                            />
                                        </Form.Item>
                                    </Col>
                                </Row>

                                <Form.Item label="Notes / Instructions" style={{ marginBottom: 0 }}>
                                    <Input.TextArea
                                        rows={2}
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Notes ou consignes particulières pour la commande"
                                    />
                                </Form.Item>
                            </Card>
                        </Col>

                        <Col span={10}>
                            <Card title="Récapitulatif" size="small" style={{ height: '100%', backgroundColor: '#fafafa' }}>
                                <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                                    <Row justify="space-between">
                                        <Col><Text type="secondary">Fournisseur :</Text></Col>
                                        <Col><strong>{selectedSupplier?.nom || '-'}</strong></Col>
                                    </Row>
                                    <Row justify="space-between">
                                        <Col><Text type="secondary">Articles sélectionnés :</Text></Col>
                                        <Col>
                                            <Tag color={checkedLines.length > 0 ? 'blue' : 'default'}>
                                                {checkedLines.length} / {lines.length}
                                            </Tag>
                                        </Col>
                                    </Row>
                                    <Divider style={{ margin: '8px 0' }} />
                                    <Row justify="space-between">
                                        <Col><Text>Total HT :</Text></Col>
                                        <Col><strong>{formatEuro(totalHT)}</strong></Col>
                                    </Row>
                                    <Row justify="space-between">
                                        <Col><Text>Total TVA :</Text></Col>
                                        <Col>{formatEuro(totalTVA)}</Col>
                                    </Row>
                                    <Row justify="space-between">
                                        <Col><Text>Frais de port :</Text></Col>
                                        <Col>{formatEuro(portTotal)}</Col>
                                    </Row>
                                    <Divider orientation="horizontal" style={{ margin: '8px 0' }} />
                                    <Row justify="space-between" align="middle">
                                        <Col><Text strong style={{ fontSize: 16 }}>Total TTC :</Text></Col>
                                        <Col>
                                            <span style={{ fontSize: 18, fontWeight: 'bold', color: '#1677ff' }}>
                                                {formatEuro(totalTTC)}
                                            </span>
                                        </Col>
                                    </Row>
                                </Space>
                            </Card>
                        </Col>
                    </Row>
                </div>
            )}
        </Modal>
    );
}
