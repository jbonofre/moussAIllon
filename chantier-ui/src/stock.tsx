import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Empty, Form, Input, InputNumber, Modal, Radio, Row, Segmented, Select, Space, Statistic, Switch, Table, Tabs, Tag, Typography, message } from 'antd';
import { EditOutlined, HistoryOutlined, ReloadOutlined } from '@ant-design/icons';
import { paginationConfig } from './pagination.ts';
import { useNavigation } from './navigation-context.tsx';
import { formatEuro } from './kpis-commun.tsx';
import MouvementsStock, { MOTIF_LABEL, Mouvement } from './MouvementsStock.tsx';
import { ArticleStock, LibelleArticle, StatutStock, TYPES_ARTICLE, TypeArticle, formatQuantite, requete } from './stock-commun.tsx';
import Reapprovisionnement from './stock-reapprovisionnement.tsx';
import Inventaires from './stock-inventaires.tsx';

const { Text, Title } = Typography;

const STATUTS: Record<StatutStock, { label: string; color: string }> = {
    RUPTURE: { label: 'Rupture', color: 'red' },
    SOUS_SEUIL: { label: 'Sous le seuil', color: 'orange' },
    OK: { label: 'OK', color: 'green' },
};

type FiltreStatut = 'TOUS' | 'ALERTES' | StatutStock;

// Emplacements atelier et magasin d'un article, sur une ligne
const emplacements = (a: ArticleStock) => [a.emplacement, a.emplacementMagasin].filter((e) => e?.trim()).join(' / ');

const contient = (valeur: string | null | undefined, recherche: string) => (valeur ?? '').toLowerCase().includes(recherche);

// Ajustement manuel du stock d'un article, avec son motif
const AjustementModal = ({ article, onClose, onAjuste }: { article: ArticleStock | null; onClose: () => void; onAjuste: () => void }) => {
    const [form] = Form.useForm();
    const [enregistrement, setEnregistrement] = useState(false);
    const mode = Form.useWatch('mode', form);
    // Un bateau, un moteur ou une remorque se compte à l'unité
    const aVirgule = article?.type === 'produit';

    useEffect(() => {
        if (article) {
            form.setFieldsValue({ mode: 'nouveau', quantite: article.stock, motif: undefined, commentaire: '' });
        }
    }, [article, form]);

    const enregistrer = async (valeurs: { mode: 'nouveau' | 'variation'; quantite: number; motif: string; commentaire?: string }) => {
        if (!article) return;
        setEnregistrement(true);
        try {
            await requete('./stock/ajustement', 'POST', {
                type: article.type,
                id: article.id,
                nouveauStock: valeurs.mode === 'nouveau' ? valeurs.quantite : null,
                variation: valeurs.mode === 'variation' ? valeurs.quantite : null,
                motif: valeurs.motif,
                commentaire: valeurs.commentaire,
            });
            message.success(`Stock de ${article.designation} ajusté`);
            onAjuste();
        } catch (e: any) {
            message.error("Erreur lors de l'ajustement du stock : " + e.message);
        } finally {
            setEnregistrement(false);
        }
    };

    return (
        <Modal
            open={!!article}
            title={article ? `Ajuster le stock : ${article.designation}` : ''}
            okText="Ajuster"
            cancelText="Annuler"
            confirmLoading={enregistrement}
            onOk={() => form.submit()}
            onCancel={onClose}
            destroyOnHidden
        >
            {article && (
                <Form form={form} layout="vertical" onFinish={enregistrer}>
                    <Text type="secondary">Stock actuel : {formatQuantite(article.stock)}</Text>
                    <Form.Item name="mode" style={{ marginTop: 12, marginBottom: 12 }}>
                        <Radio.Group
                            optionType="button"
                            options={[{ value: 'nouveau', label: 'Nouveau stock' }, { value: 'variation', label: 'Entrée / sortie' }]}
                            onChange={(e) => form.setFieldValue('quantite', e.target.value === 'nouveau' ? article.stock : undefined)}
                        />
                    </Form.Item>
                    <Form.Item
                        name="quantite"
                        label={mode === 'variation' ? 'Quantité (négative pour une sortie)' : 'Nouveau stock'}
                        rules={[{ required: true, message: 'Quantité requise' }]}
                    >
                        <InputNumber
                            style={{ width: '100%' }}
                            min={mode === 'variation' ? undefined : 0}
                            step={aVirgule ? 0.25 : 1}
                            precision={aVirgule ? undefined : 0}
                            decimalSeparator=","
                        />
                    </Form.Item>
                    <Form.Item name="motif" label="Motif" rules={[{ required: true, message: 'Motif requis' }]}>
                        <Select
                            placeholder="Motif de l'ajustement"
                            options={Object.entries(MOTIF_LABEL).map(([value, label]) => ({ value, label }))}
                        />
                    </Form.Item>
                    <Form.Item name="commentaire" label="Commentaire">
                        <Input.TextArea rows={2} allowClear />
                    </Form.Item>
                </Form>
            )}
        </Modal>
    );
};

// Historique des mouvements de stock d'un article
const HistoriqueModal = ({ article, onClose }: { article: ArticleStock | null; onClose: () => void }) => {
    const [mouvements, setMouvements] = useState<Mouvement[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!article) return;
        setLoading(true);
        requete(`./stock/${article.type}/${article.id}/mouvements`)
            .then((r) => r.json())
            .then(setMouvements)
            .catch((e) => message.error("Erreur lors du chargement de l'historique : " + e.message))
            .finally(() => setLoading(false));
    }, [article]);

    return (
        <Modal
            open={!!article}
            title={article ? `Historique du stock : ${article.designation}` : ''}
            footer={null}
            width={1000}
            onCancel={onClose}
            destroyOnHidden
        >
            <MouvementsStock mouvements={mouvements} loading={loading} />
        </Modal>
    );
};

export default function Stock() {
    const { pageState } = useNavigation();
    const [articles, setArticles] = useState<ArticleStock[]>([]);
    const [loading, setLoading] = useState(false);
    const [onglet, setOnglet] = useState('etat');
    const [recherche, setRecherche] = useState('');
    const [type, setType] = useState<TypeArticle | undefined>();
    const [categorie, setCategorie] = useState<string | undefined>();
    const [emplacement, setEmplacement] = useState<string | undefined>();
    // Depuis les alertes du tableau de bord : les articles en rupture ou sous le seuil
    const [statut, setStatut] = useState<FiltreStatut>(pageState?.alertes ? 'ALERTES' : 'TOUS');
    // Par défaut, seuls les articles gérés en stock (en stock, avec un seuil, réservés ou en commande)
    const [toutLeCatalogue, setToutLeCatalogue] = useState(false);
    const [aAjuster, setAAjuster] = useState<ArticleStock | null>(null);
    const [historique, setHistorique] = useState<ArticleStock | null>(null);

    const load = useCallback(() => {
        setLoading(true);
        requete('./stock')
            .then((r) => r.json())
            .then(setArticles)
            .catch((e) => message.error('Erreur lors du chargement du stock : ' + e.message))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const suivis = useMemo(() => articles.filter((a) => a.suivi), [articles]);
    const categories = useMemo(
        () => Array.from(new Set(articles.map((a) => a.categorie?.trim()).filter((c): c is string => !!c))).sort((a, b) => a.localeCompare(b)),
        [articles],
    );
    const listeEmplacements = useMemo(
        () => Array.from(new Set(articles.flatMap((a) => [a.emplacement?.trim(), a.emplacementMagasin?.trim()]).filter((e): e is string => !!e)))
            .sort((a, b) => a.localeCompare(b)),
        [articles],
    );

    const filtres = useMemo(() => {
        const r = recherche.trim().toLowerCase();
        return (toutLeCatalogue ? articles : suivis).filter((a) => {
            if (type && a.type !== type) return false;
            if (categorie && a.categorie?.trim() !== categorie) return false;
            if (emplacement && a.emplacement?.trim() !== emplacement && a.emplacementMagasin?.trim() !== emplacement) return false;
            if (statut === 'ALERTES' && a.statut === 'OK') return false;
            if (statut !== 'TOUS' && statut !== 'ALERTES' && a.statut !== statut) return false;
            return !r || contient(a.designation, r) || contient(a.ref, r) || contient(a.categorie, r) || contient(emplacements(a), r);
        });
    }, [articles, suivis, toutLeCatalogue, type, categorie, emplacement, statut, recherche]);

    const valeurTotale = suivis.reduce((total, a) => total + a.valeur, 0);
    const ruptures = suivis.filter((a) => a.statut === 'RUPTURE').length;
    const sousLeSeuil = suivis.filter((a) => a.statut === 'SOUS_SEUIL').length;

    const quantite = (champ: keyof ArticleStock) => ({
        dataIndex: champ,
        key: champ,
        align: 'right' as const,
        render: (v: number) => formatQuantite(v),
        sorter: (a: ArticleStock, b: ArticleStock) => (a[champ] as number) - (b[champ] as number),
    });

    const colonnes = [
        {
            title: 'Article',
            key: 'article',
            sorter: (a: ArticleStock, b: ArticleStock) => a.designation.localeCompare(b.designation),
            render: (_: unknown, a: ArticleStock) => <LibelleArticle type={a.type} designation={a.designation} reference={a.ref} />,
        },
        { title: 'Catégorie', dataIndex: 'categorie', key: 'categorie', render: (v?: string) => v || '—' },
        { title: 'Emplacement', key: 'emplacement', render: (_: unknown, a: ArticleStock) => emplacements(a) || '—' },
        { title: 'Stock', ...quantite('stock') },
        { title: 'Seuil', ...quantite('seuil') },
        { title: 'Réservé', ...quantite('reserve') },
        { title: 'En commande', ...quantite('enCommande') },
        { title: 'Disponible', ...quantite('disponible') },
        {
            title: 'Coût unitaire HT',
            dataIndex: 'coutUnitaireHT',
            key: 'coutUnitaireHT',
            align: 'right' as const,
            render: (v: number) => (v > 0 ? formatEuro(v) : '—'),
        },
        {
            title: 'Valeur',
            dataIndex: 'valeur',
            key: 'valeur',
            align: 'right' as const,
            sorter: (a: ArticleStock, b: ArticleStock) => a.valeur - b.valeur,
            render: (v: number) => formatEuro(v),
        },
        {
            title: 'Statut',
            dataIndex: 'statut',
            key: 'statut',
            render: (v: StatutStock) => <Tag color={STATUTS[v].color}>{STATUTS[v].label}</Tag>,
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: unknown, a: ArticleStock) => (
                <Space>
                    <Button size="small" icon={<EditOutlined />} onClick={() => setAAjuster(a)}>Ajuster</Button>
                    <Button size="small" icon={<HistoryOutlined />} title="Historique" onClick={() => setHistorique(a)} />
                </Space>
            ),
        },
    ];

    const etat = (
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Row gutter={[16, 16]}>
                <Col xs={12} md={6}><Card><Statistic title="Valeur du stock (coût d'achat HT)" value={formatEuro(valeurTotale)} /></Card></Col>
                <Col xs={12} md={6}><Card><Statistic title="Articles suivis" value={suivis.length} /></Card></Col>
                <Col xs={12} md={6}>
                    <Card hoverable onClick={() => setStatut('RUPTURE')} style={{ cursor: 'pointer' }}>
                        <Statistic title="En rupture" value={ruptures} styles={{ content: { color: '#cf1322' } }} />
                    </Card>
                </Col>
                <Col xs={12} md={6}>
                    <Card hoverable onClick={() => setStatut('SOUS_SEUIL')} style={{ cursor: 'pointer' }}>
                        <Statistic title="Sous le seuil" value={sousLeSeuil} styles={{ content: { color: '#d46b08' } }} />
                    </Card>
                </Col>
            </Row>
            <Card
                title={`Articles (${filtres.length})`}
                extra={<Button title="Recharger" icon={<ReloadOutlined />} loading={loading} onClick={load} />}
            >
                <Space wrap style={{ marginBottom: 16 }}>
                    <Input.Search
                        placeholder="Désignation, référence, catégorie, emplacement"
                        allowClear
                        value={recherche}
                        onChange={(e) => setRecherche(e.target.value)}
                        style={{ width: 320 }}
                    />
                    <Select
                        placeholder="Type"
                        allowClear
                        value={type}
                        onChange={setType}
                        style={{ width: 140 }}
                        options={(Object.keys(TYPES_ARTICLE) as TypeArticle[]).map((t) => ({ value: t, label: TYPES_ARTICLE[t].label }))}
                    />
                    <Select
                        placeholder="Catégorie"
                        allowClear
                        showSearch
                        value={categorie}
                        onChange={setCategorie}
                        style={{ width: 200 }}
                        options={categories.map((c) => ({ value: c, label: c }))}
                    />
                    <Select
                        placeholder="Emplacement"
                        allowClear
                        showSearch
                        value={emplacement}
                        onChange={setEmplacement}
                        style={{ width: 200 }}
                        options={listeEmplacements.map((e) => ({ value: e, label: e }))}
                    />
                    <Segmented<FiltreStatut>
                        value={statut}
                        onChange={setStatut}
                        options={[
                            { value: 'TOUS', label: 'Tous' },
                            { value: 'ALERTES', label: 'À surveiller' },
                            { value: 'RUPTURE', label: 'Rupture' },
                            { value: 'SOUS_SEUIL', label: 'Sous le seuil' },
                            { value: 'OK', label: 'OK' },
                        ]}
                    />
                    <Space>
                        <Switch checked={toutLeCatalogue} onChange={setToutLeCatalogue} aria-label="Tout le catalogue" />
                        <Text>Tout le catalogue</Text>
                    </Space>
                </Space>
                <Table
                    rowKey="cle"
                    loading={loading}
                    dataSource={filtres}
                    columns={colonnes}
                    size="small"
                    scroll={{ x: 'max-content' }}
                    pagination={paginationConfig(50)}
                    locale={{ emptyText: <Empty description="Aucun article" /> }}
                    summary={() => (
                        <Table.Summary.Row>
                            <Table.Summary.Cell index={0} colSpan={9}><Text strong>Total</Text></Table.Summary.Cell>
                            <Table.Summary.Cell index={9} align="right">
                                <Text strong>{formatEuro(filtres.reduce((total, a) => total + a.valeur, 0))}</Text>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={10} colSpan={2} />
                        </Table.Summary.Row>
                    )}
                />
            </Card>
        </Space>
    );

    return (
        <div>
            <Title level={3}>Stock</Title>
            <Tabs
                activeKey={onglet}
                onChange={setOnglet}
                items={[
                    { key: 'etat', label: 'État du stock', children: etat },
                    { key: 'reapprovisionnement', label: 'Réapprovisionnement', children: <Reapprovisionnement actif={onglet === 'reapprovisionnement'} onCommande={load} /> },
                    {
                        key: 'inventaires',
                        label: 'Inventaires',
                        children: <Inventaires categories={categories} emplacements={listeEmplacements} onValide={load} />,
                    },
                ]}
            />
            <AjustementModal article={aAjuster} onClose={() => setAAjuster(null)} onAjuste={() => { setAAjuster(null); load(); }} />
            <HistoriqueModal article={historique} onClose={() => setHistorique(null)} />
        </div>
    );
}
