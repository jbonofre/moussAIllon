import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Empty, InputNumber, Popconfirm, Select, Space, Table, Typography, message } from 'antd';
import { ReloadOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { useNavigation } from './navigation-context.tsx';
import { formatEuro } from './kpis-commun.tsx';
import { LibelleArticle, TypeArticle, formatQuantite, requete } from './stock-commun.tsx';

const { Text } = Typography;

interface FournisseurPropose {
    fournisseurId: number;
    fournisseurNom: string;
    referenceFournisseur?: string | null;
    prixAchatHT: number;
    tva: number;
    nombreMinACommander: number;
}

interface ArticleAReapprovisionner {
    cle: string;
    type: TypeArticle;
    id: number;
    designation: string;
    ref?: string | null;
    categorie?: string | null;
    stock: number;
    seuil: number;
    reserve: number;
    disponible: number;
    enCommande: number;
    quantiteSuggeree: number;
    // Fournisseur proposé : le moins cher de l'article
    fournisseurId?: number | null;
    fournisseurs: FournisseurPropose[];
}

interface Fournisseur {
    id: number;
    nom: string;
}

interface CommandeCreee {
    id: number;
    reference: string;
    fournisseurNom: string;
    nombreLignes: number;
    montantHT: number;
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

// Articles à commander, regroupés en commandes fournisseur (une par fournisseur)
export default function Reapprovisionnement({ actif, onCommande }: { actif: boolean; onCommande: () => void }) {
    const { navigate } = useNavigation();
    const [articles, setArticles] = useState<ArticleAReapprovisionner[]>([]);
    const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
    const [loading, setLoading] = useState(false);
    const [quantites, setQuantites] = useState<Record<string, number | null>>({});
    const [choix, setChoix] = useState<Record<string, number | undefined>>({});
    // Articles décochés : ils restent dans la liste sans être commandés
    const [decoches, setDecoches] = useState<Set<string>>(new Set());
    const [creation, setCreation] = useState(false);
    const [creees, setCreees] = useState<CommandeCreee[]>([]);

    const load = useCallback(() => {
        setLoading(true);
        Promise.all([
            requete('./stock/reapprovisionnement').then((r) => r.json()),
            requete('./catalogue/fournisseurs').then((r) => r.json()).catch(() => []),
        ])
            .then(([aCommander, tous]: [ArticleAReapprovisionner[], Fournisseur[]]) => {
                setArticles(aCommander);
                setFournisseurs(tous);
                setQuantites(Object.fromEntries(aCommander.map((a) => [a.cle, a.quantiteSuggeree])));
                setChoix(Object.fromEntries(aCommander.map((a) => [a.cle, a.fournisseurId ?? undefined])));
                setDecoches(new Set());
            })
            .catch((e) => message.error('Erreur lors du chargement du réapprovisionnement : ' + e.message))
            .finally(() => setLoading(false));
    }, []);

    // Rechargé à chaque ouverture de l'onglet : le stock a pu changer entre-temps
    useEffect(() => {
        if (actif) load();
    }, [actif, load]);

    const tarif = (a: ArticleAReapprovisionner) => a.fournisseurs.find((f) => f.fournisseurId === choix[a.cle]);
    const commandable = (a: ArticleAReapprovisionner) => !!choix[a.cle] && (quantites[a.cle] ?? 0) > 0;
    const selection = articles.filter((a) => !decoches.has(a.cle) && commandable(a));
    const nombreFournisseurs = new Set(selection.map((a) => choix[a.cle])).size;

    const commander = async () => {
        setCreation(true);
        try {
            const lignes = selection.map((a) => ({ type: a.type, id: a.id, fournisseurId: choix[a.cle], quantite: quantites[a.cle] }));
            const resultat: CommandeCreee[] = await (await requete('./stock/reapprovisionnement', 'POST', { lignes })).json();
            setCreees(resultat);
            message.success(pluriel(resultat.length, 'commande fournisseur') + ' en brouillon');
            load();
            onCommande();
        } catch (e: any) {
            message.error('Erreur lors de la création des commandes : ' + e.message);
        } finally {
            setCreation(false);
        }
    };

    const colonnes = [
        {
            title: 'Article',
            key: 'article',
            render: (_: unknown, a: ArticleAReapprovisionner) => <LibelleArticle type={a.type} designation={a.designation} reference={a.ref} />,
        },
        { title: 'Stock', dataIndex: 'stock', key: 'stock', align: 'right' as const, render: formatQuantite },
        { title: 'Réservé', dataIndex: 'reserve', key: 'reserve', align: 'right' as const, render: formatQuantite },
        { title: 'En commande', dataIndex: 'enCommande', key: 'enCommande', align: 'right' as const, render: formatQuantite },
        { title: 'Seuil', dataIndex: 'seuil', key: 'seuil', align: 'right' as const, render: formatQuantite },
        {
            title: 'À commander',
            key: 'quantite',
            render: (_: unknown, a: ArticleAReapprovisionner) => (
                <InputNumber
                    aria-label={`Quantité ${a.designation}`}
                    min={0}
                    step={a.type === 'produit' ? 0.25 : 1}
                    precision={a.type === 'produit' ? undefined : 0}
                    decimalSeparator=","
                    value={quantites[a.cle]}
                    onChange={(v) => setQuantites((q) => ({ ...q, [a.cle]: v }))}
                    style={{ width: 100 }}
                />
            ),
        },
        {
            title: 'Fournisseur',
            key: 'fournisseur',
            render: (_: unknown, a: ArticleAReapprovisionner) => {
                const autres = fournisseurs.filter((f) => !a.fournisseurs.some((p) => p.fournisseurId === f.id));
                return (
                    <Select
                        aria-label={`Fournisseur ${a.designation}`}
                        placeholder="Choisir un fournisseur"
                        showSearch
                        optionFilterProp="label"
                        value={choix[a.cle]}
                        onChange={(v) => setChoix((c) => ({ ...c, [a.cle]: v }))}
                        style={{ width: 260 }}
                        options={[
                            {
                                label: "Fournisseurs de l'article",
                                options: a.fournisseurs.map((f) => ({
                                    value: f.fournisseurId,
                                    label: f.prixAchatHT > 0 ? `${f.fournisseurNom} (${formatEuro(f.prixAchatHT)})` : f.fournisseurNom,
                                })),
                            },
                            { label: 'Autres fournisseurs', options: autres.map((f) => ({ value: f.id, label: f.nom })) },
                        ].filter((groupe) => groupe.options.length > 0)}
                    />
                );
            },
        },
        {
            title: 'Montant HT',
            key: 'montant',
            align: 'right' as const,
            render: (_: unknown, a: ArticleAReapprovisionner) => {
                const prix = tarif(a)?.prixAchatHT ?? 0;
                return prix > 0 ? formatEuro(prix * (quantites[a.cle] ?? 0)) : <Text type="secondary">Prix à compléter</Text>;
            },
        },
    ];

    return (
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Alert
                type="info"
                showIcon
                title="Articles à réapprovisionner"
                description={'Articles dont le stock disponible (stock moins réservé), augmenté de ce qui est déjà en commande, '
                    + 'atteint le seuil d\'alerte ou ne couvre pas les réservations. La quantité suggérée ramène le stock à deux fois le seuil, '
                    + 'au moins au minimum de commande du fournisseur. Une commande en brouillon est créée par fournisseur, à vérifier avant envoi.'}
            />
            {creees.length > 0 && (
                <Alert
                    type="success"
                    showIcon
                    closable
                    onClose={() => setCreees([])}
                    title={pluriel(creees.length, 'commande fournisseur') + ' créée' + (creees.length > 1 ? 's' : '') + ' en brouillon'}
                    description={(
                        <ul style={{ margin: 0, paddingLeft: 20 }}>
                            {creees.map((c) => (
                                <li key={c.id}>
                                    <a onClick={() => navigate('/commandes-fournisseur', { commandeId: c.id })}>{c.reference}</a>
                                    {` : ${c.fournisseurNom}, ${pluriel(c.nombreLignes, 'article')}, ${formatEuro(c.montantHT)} HT`}
                                </li>
                            ))}
                        </ul>
                    )}
                />
            )}
            <Card
                title={`À commander (${articles.length})`}
                extra={(
                    <Space>
                        <Popconfirm
                            title={`Créer ${pluriel(nombreFournisseurs, 'commande')} pour ${pluriel(selection.length, 'article')} ?`}
                            onConfirm={commander}
                            okText="Créer"
                            cancelText="Annuler"
                            disabled={selection.length === 0}
                        >
                            <Button type="primary" icon={<ShoppingCartOutlined />} loading={creation} disabled={selection.length === 0}>
                                Créer les commandes ({selection.length})
                            </Button>
                        </Popconfirm>
                        <Button title="Recharger" icon={<ReloadOutlined />} loading={loading} onClick={load} />
                    </Space>
                )}
            >
                <Table
                    rowKey="cle"
                    loading={loading}
                    dataSource={articles}
                    columns={colonnes}
                    size="small"
                    scroll={{ x: 'max-content' }}
                    pagination={false}
                    locale={{ emptyText: <Empty description="Aucun article à réapprovisionner" /> }}
                    rowSelection={{
                        selectedRowKeys: selection.map((a) => a.cle),
                        getCheckboxProps: (a: ArticleAReapprovisionner) => ({ disabled: !commandable(a) }),
                        onChange: (keys) => {
                            const cochees = new Set(keys as string[]);
                            setDecoches(new Set(articles.filter((a) => commandable(a) && !cochees.has(a.cle)).map((a) => a.cle)));
                        },
                    }}
                />
            </Card>
        </Space>
    );
}
