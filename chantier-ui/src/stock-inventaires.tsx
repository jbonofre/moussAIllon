import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Checkbox, Col, Empty, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Statistic, Switch, Table, Tag, Typography, message } from 'antd';
import { ArrowLeftOutlined, CheckOutlined, DeleteOutlined, PlusOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import { paginationConfig } from './pagination.ts';
import { formatDate, formatEuro } from './kpis-commun.tsx';
import { LibelleArticle, TYPES_ARTICLE, TypeArticle, formatQuantite, requete } from './stock-commun.tsx';

const { Text } = Typography;

type StatutInventaire = 'EN_COURS' | 'VALIDE';

interface InventaireResume {
    id: number;
    reference: string;
    libelle: string;
    typeArticle?: TypeArticle | null;
    categorie?: string | null;
    emplacement?: string | null;
    statut: StatutInventaire;
    dateCreation?: string;
    dateValidation?: string | null;
    creePar?: string | null;
    validePar?: string | null;
    nombreLignes: number;
    nombreComptees: number;
    nombreEcarts: number;
    valeurEcarts: number;
}

interface LigneInventaire {
    id: number;
    typeArticle: TypeArticle;
    articleId: number;
    designation: string;
    ref?: string | null;
    categorie?: string | null;
    emplacement?: string | null;
    stockTheorique: number;
    stockCompte?: number | null;
    coutUnitaireHT: number;
}

interface Inventaire extends Omit<InventaireResume, 'nombreLignes' | 'nombreComptees' | 'nombreEcarts' | 'valeurEcarts'> {
    lignes: LigneInventaire[];
}

const STATUTS: Record<StatutInventaire, { label: string; color: string }> = {
    EN_COURS: { label: 'En cours', color: 'blue' },
    VALIDE: { label: 'Validé', color: 'green' },
};

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

const perimetre = (i: { typeArticle?: TypeArticle | null; categorie?: string | null; emplacement?: string | null }) => {
    const filtres = [
        i.typeArticle ? TYPES_ARTICLE[i.typeArticle]?.label ?? i.typeArticle : null,
        i.categorie,
        i.emplacement,
    ].filter(Boolean);
    return filtres.length > 0 ? filtres.join(' · ') : 'Tous les articles';
};

const ecartTexte = (ecart: number | null) => {
    if (ecart == null) return <Text type="secondary">—</Text>;
    if (ecart === 0) return <Text type="success">0</Text>;
    return <Text type={ecart < 0 ? 'danger' : 'warning'}>{ecart > 0 ? '+' : ''}{formatQuantite(ecart)}</Text>;
};

// Lancement d'un inventaire : son périmètre
const LancementModal = ({ open, categories, emplacements, onClose, onLance }: {
    open: boolean;
    categories: string[];
    emplacements: string[];
    onClose: () => void;
    onLance: (inventaire: Inventaire) => void;
}) => {
    const [form] = Form.useForm();
    const [lancement, setLancement] = useState(false);

    const lancer = async (valeurs: Record<string, unknown>) => {
        setLancement(true);
        try {
            const inventaire: Inventaire = await (await requete('./stock/inventaires', 'POST', valeurs)).json();
            message.success(`Inventaire ${inventaire.reference} lancé : ${pluriel(inventaire.lignes.length, 'article')} à compter`);
            form.resetFields();
            onLance(inventaire);
        } catch (e: any) {
            message.error("Erreur lors du lancement de l'inventaire : " + e.message);
        } finally {
            setLancement(false);
        }
    };

    return (
        <Modal
            open={open}
            title="Lancer un inventaire"
            okText="Lancer"
            cancelText="Annuler"
            confirmLoading={lancement}
            onOk={() => form.submit()}
            onCancel={onClose}
            destroyOnHidden
        >
            <Form form={form} layout="vertical" onFinish={lancer} initialValues={{ toutLeCatalogue: false }}>
                <Text type="secondary">
                    Le stock théorique des articles est figé au lancement. Sans filtre, tous les articles gérés en stock sont inventoriés ;
                    ceux d'un inventaire en cours en sont exclus.
                </Text>
                <Form.Item name="libelle" label="Libellé" style={{ marginTop: 12 }}>
                    <Input placeholder="Inventaire du jour" allowClear />
                </Form.Item>
                <Form.Item name="typeArticle" label="Type d'article">
                    <Select
                        allowClear
                        placeholder="Tous"
                        options={(Object.keys(TYPES_ARTICLE) as TypeArticle[]).map((t) => ({ value: t, label: TYPES_ARTICLE[t].label }))}
                    />
                </Form.Item>
                <Form.Item name="categorie" label="Catégorie">
                    <Select allowClear showSearch placeholder="Toutes" options={categories.map((c) => ({ value: c, label: c }))} />
                </Form.Item>
                <Form.Item name="emplacement" label="Emplacement (atelier ou magasin)">
                    <Select allowClear showSearch placeholder="Tous" options={emplacements.map((e) => ({ value: e, label: e }))} />
                </Form.Item>
                <Form.Item name="toutLeCatalogue" valuePropName="checked">
                    <Checkbox>Inclure les articles sans stock ni seuil d'alerte</Checkbox>
                </Form.Item>
            </Form>
        </Modal>
    );
};

// Comptage d'un inventaire, puis sa validation
const DetailInventaire = ({ initial, onRetour, onValide }: { initial: Inventaire; onRetour: () => void; onValide: () => void }) => {
    const [inventaire, setInventaire] = useState<Inventaire>(initial);
    // Quantités saisies depuis le dernier enregistrement (null : l'article n'est plus compté)
    const [saisie, setSaisie] = useState<Record<number, number | null>>({});
    const [recherche, setRecherche] = useState('');
    const [nonComptes, setNonComptes] = useState(false);
    const [enCours, setEnCours] = useState(false);
    const modifiable = inventaire.statut === 'EN_COURS';
    const modifie = Object.keys(saisie).length > 0;

    const compte = useCallback((l: LigneInventaire) => (l.id in saisie ? saisie[l.id] : l.stockCompte ?? null), [saisie]);
    const ecart = (l: LigneInventaire) => {
        const c = compte(l);
        return c == null ? null : c - l.stockTheorique;
    };

    const comptees = inventaire.lignes.filter((l) => compte(l) != null);
    const avecEcart = comptees.filter((l) => ecart(l) !== 0);
    const valeurEcarts = avecEcart.reduce((total, l) => total + (ecart(l) ?? 0) * l.coutUnitaireHT, 0);

    const lignes = useMemo(() => {
        const r = recherche.trim().toLowerCase();
        return inventaire.lignes.filter((l) => {
            if (nonComptes && compte(l) != null) return false;
            return !r || [l.designation, l.ref, l.categorie, l.emplacement].some((v) => (v ?? '').toLowerCase().includes(r));
        });
    }, [inventaire, recherche, nonComptes, compte]);

    const enregistrer = async () => {
        const comptages = Object.entries(saisie).map(([ligneId, stockCompte]) => ({ ligneId: Number(ligneId), stockCompte }));
        const r = await requete(`./stock/inventaires/${inventaire.id}/comptage`, 'PUT', comptages);
        const misAJour: Inventaire = await r.json();
        setInventaire(misAJour);
        setSaisie({});
        return misAJour;
    };

    const action = async (traitement: () => Promise<void>, erreur: string) => {
        setEnCours(true);
        try {
            await traitement();
        } catch (e: any) {
            message.error(erreur + ' : ' + e.message);
        } finally {
            setEnCours(false);
        }
    };

    const sauver = () => action(async () => {
        await enregistrer();
        message.success('Comptage enregistré');
    }, "Erreur lors de l'enregistrement du comptage");

    const valider = () => action(async () => {
        if (modifie) {
            await enregistrer();
        }
        const valide: Inventaire = await (await requete(`./stock/inventaires/${inventaire.id}/valider`, 'POST')).json();
        setInventaire(valide);
        message.success(`Inventaire ${valide.reference} validé : écarts appliqués au stock`);
        onValide();
    }, "Erreur lors de la validation de l'inventaire");

    const abandonner = () => action(async () => {
        await requete(`./stock/inventaires/${inventaire.id}`, 'DELETE');
        message.success(`Inventaire ${inventaire.reference} abandonné`);
        onRetour();
    }, "Erreur lors de l'abandon de l'inventaire");

    const retour = () => {
        if (!modifie) {
            onRetour();
            return;
        }
        Modal.confirm({
            title: 'Comptage non enregistré',
            content: 'Les quantités saisies depuis le dernier enregistrement seront perdues. Revenir à la liste ?',
            okText: 'Revenir',
            cancelText: 'Annuler',
            onOk: onRetour,
        });
    };

    const colonnes = [
        {
            title: 'Article',
            key: 'article',
            render: (_: unknown, l: LigneInventaire) => <LibelleArticle type={l.typeArticle} designation={l.designation} reference={l.ref} />,
        },
        { title: 'Emplacement', dataIndex: 'emplacement', key: 'emplacement', render: (v?: string) => v || '—' },
        { title: 'Théorique', dataIndex: 'stockTheorique', key: 'stockTheorique', align: 'right' as const, render: formatQuantite },
        {
            title: 'Compté',
            key: 'compte',
            render: (_: unknown, l: LigneInventaire) => (modifiable ? (
                <InputNumber
                    aria-label={`Compté ${l.designation}`}
                    min={0}
                    step={l.typeArticle === 'produit' ? 0.25 : 1}
                    precision={l.typeArticle === 'produit' ? undefined : 0}
                    decimalSeparator=","
                    value={compte(l)}
                    onChange={(v) => setSaisie((s) => ({ ...s, [l.id]: v ?? null }))}
                    style={{ width: 110 }}
                />
            ) : (compte(l) != null ? formatQuantite(compte(l)) : <Text type="secondary">Non compté</Text>)),
        },
        { title: 'Écart', key: 'ecart', align: 'right' as const, render: (_: unknown, l: LigneInventaire) => ecartTexte(ecart(l)) },
        {
            title: "Valeur de l'écart",
            key: 'valeurEcart',
            align: 'right' as const,
            render: (_: unknown, l: LigneInventaire) => {
                const e = ecart(l);
                return e && l.coutUnitaireHT > 0 ? formatEuro(e * l.coutUnitaireHT) : '—';
            },
        },
    ];

    return (
        <Card
            title={(
                <Space wrap>
                    <Button icon={<ArrowLeftOutlined />} title="Retour aux inventaires" onClick={retour} />
                    <span>{inventaire.reference} · {inventaire.libelle}</span>
                    <Tag color={STATUTS[inventaire.statut].color}>{STATUTS[inventaire.statut].label}</Tag>
                </Space>
            )}
            extra={modifiable && (
                <Space wrap>
                    <Button icon={<SaveOutlined />} disabled={!modifie} loading={enCours} onClick={sauver}>Enregistrer le comptage</Button>
                    <Popconfirm
                        title="Valider l'inventaire ?"
                        description={`Les écarts de ${pluriel(avecEcart.length, 'article')} seront appliqués au stock ; les articles non comptés restent inchangés. L'inventaire ne sera plus modifiable.`}
                        onConfirm={valider}
                        okText="Valider"
                        cancelText="Annuler"
                        disabled={comptees.length === 0}
                    >
                        <Button type="primary" icon={<CheckOutlined />} loading={enCours} disabled={comptees.length === 0}>Valider l'inventaire</Button>
                    </Popconfirm>
                    <Popconfirm title="Abandonner l'inventaire ?" description="Rien ne sera appliqué au stock." onConfirm={abandonner} okText="Abandonner" cancelText="Annuler">
                        <Button danger icon={<DeleteOutlined />}>Abandonner</Button>
                    </Popconfirm>
                </Space>
            )}
        >
            <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                <Text type="secondary">
                    {perimetre(inventaire)} · lancé le {formatDate(inventaire.dateCreation)}{inventaire.creePar ? ` par ${inventaire.creePar}` : ''}
                    {inventaire.dateValidation ? ` · validé le ${formatDate(inventaire.dateValidation)}${inventaire.validePar ? ` par ${inventaire.validePar}` : ''}` : ''}
                </Text>
                {modifiable && (
                    <Alert
                        type="info"
                        showIcon
                        title="Saisissez les quantités comptées"
                        description={'Enregistrez le comptage au fil de l\'eau. À la validation, l\'écart de chaque article compté (compté moins théorique) '
                            + 'est appliqué à son stock courant : les ventes et réceptions survenues pendant le comptage restent prises en compte.'}
                    />
                )}
                <Row gutter={[16, 16]}>
                    <Col xs={12} md={6}><Statistic title="Articles" value={inventaire.lignes.length} /></Col>
                    <Col xs={12} md={6}><Statistic title="Comptés" value={comptees.length} /></Col>
                    <Col xs={12} md={6}><Statistic title="Écarts" value={avecEcart.length} /></Col>
                    <Col xs={12} md={6}><Statistic title="Valeur des écarts" value={formatEuro(valeurEcarts)} /></Col>
                </Row>
                <Space wrap>
                    <Input.Search
                        placeholder="Désignation, référence, emplacement"
                        allowClear
                        value={recherche}
                        onChange={(e) => setRecherche(e.target.value)}
                        style={{ width: 300 }}
                    />
                    <Space>
                        <Switch checked={nonComptes} onChange={setNonComptes} aria-label="Non comptés seulement" />
                        <Text>Non comptés seulement</Text>
                    </Space>
                </Space>
                <Table
                    rowKey="id"
                    dataSource={lignes}
                    columns={colonnes}
                    size="small"
                    scroll={{ x: 'max-content' }}
                    pagination={paginationConfig(50)}
                />
            </Space>
        </Card>
    );
};

export default function Inventaires({ categories, emplacements, onValide }: { categories: string[]; emplacements: string[]; onValide: () => void }) {
    const [inventaires, setInventaires] = useState<InventaireResume[]>([]);
    const [loading, setLoading] = useState(false);
    const [lancement, setLancement] = useState(false);
    const [ouvert, setOuvert] = useState<Inventaire | null>(null);

    const load = useCallback(() => {
        setLoading(true);
        requete('./stock/inventaires')
            .then((r) => r.json())
            .then(setInventaires)
            .catch((e) => message.error('Erreur lors du chargement des inventaires : ' + e.message))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const ouvrir = async (id: number) => {
        try {
            setOuvert(await (await requete(`./stock/inventaires/${id}`)).json());
        } catch (e: any) {
            message.error("Erreur lors du chargement de l'inventaire : " + e.message);
        }
    };

    if (ouvert) {
        return (
            <DetailInventaire
                key={ouvert.id}
                initial={ouvert}
                onRetour={() => { setOuvert(null); load(); }}
                onValide={() => { load(); onValide(); }}
            />
        );
    }

    const colonnes = [
        {
            title: 'Référence',
            dataIndex: 'reference',
            key: 'reference',
            render: (v: string, i: InventaireResume) => <a onClick={() => ouvrir(i.id)}>{v}</a>,
        },
        { title: 'Libellé', dataIndex: 'libelle', key: 'libelle' },
        { title: 'Périmètre', key: 'perimetre', render: (_: unknown, i: InventaireResume) => perimetre(i) },
        {
            title: 'Lancé le',
            key: 'dateCreation',
            render: (_: unknown, i: InventaireResume) => `${formatDate(i.dateCreation)}${i.creePar ? ` (${i.creePar})` : ''}`,
        },
        {
            title: 'Statut',
            key: 'statut',
            render: (_: unknown, i: InventaireResume) => (
                <Space orientation="vertical" size={0}>
                    <Tag color={STATUTS[i.statut].color}>{STATUTS[i.statut].label}</Tag>
                    {i.dateValidation && <Text type="secondary" style={{ fontSize: 12 }}>le {formatDate(i.dateValidation)}</Text>}
                </Space>
            ),
        },
        { title: 'Comptés', key: 'comptes', render: (_: unknown, i: InventaireResume) => `${i.nombreComptees} / ${i.nombreLignes}` },
        { title: 'Écarts', dataIndex: 'nombreEcarts', key: 'nombreEcarts', align: 'right' as const },
        {
            title: 'Valeur des écarts',
            dataIndex: 'valeurEcarts',
            key: 'valeurEcarts',
            align: 'right' as const,
            render: (v: number) => <Text type={v < 0 ? 'danger' : undefined}>{formatEuro(v)}</Text>,
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: unknown, i: InventaireResume) => (
                <Button size="small" onClick={() => ouvrir(i.id)}>{i.statut === 'EN_COURS' ? 'Compter' : 'Consulter'}</Button>
            ),
        },
    ];

    return (
        <Card
            title={`Inventaires (${inventaires.length})`}
            extra={(
                <Space>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setLancement(true)}>Lancer un inventaire</Button>
                    <Button title="Recharger" icon={<ReloadOutlined />} loading={loading} onClick={load} />
                </Space>
            )}
        >
            <Table
                rowKey="id"
                loading={loading}
                dataSource={inventaires}
                columns={colonnes}
                size="small"
                scroll={{ x: 'max-content' }}
                pagination={paginationConfig()}
                locale={{ emptyText: <Empty description="Aucun inventaire" /> }}
            />
            <LancementModal
                open={lancement}
                categories={categories}
                emplacements={emplacements}
                onClose={() => setLancement(false)}
                onLance={(inventaire) => { setLancement(false); setOuvert(inventaire); load(); }}
            />
        </Card>
    );
}
