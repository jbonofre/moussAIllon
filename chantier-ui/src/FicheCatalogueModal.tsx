import React, { useEffect, useState } from 'react';
import { Modal, Tabs, Descriptions, Tag, Image, Button, Spin, Rate, Space, Typography, List, Popover, message } from 'antd';
import { DownloadOutlined, FileOutlined, FilePdfOutlined, FileWordOutlined, FileExcelOutlined, EyeOutlined, InfoCircleOutlined } from '@ant-design/icons';
import api from './api.ts';
import FournisseurProduits from './fournisseur-produits.tsx';
import ProduitHistorique from './produit-historique.tsx';
import FournisseurBateaux from './fournisseur-bateaux.tsx';
import FournisseurMoteurs from './fournisseur-moteurs.tsx';
import FournisseurHelices from './fournisseur-helices.tsx';
import FournisseurRemorques from './fournisseur-remorques.tsx';

const { Text, Paragraph } = Typography;

export interface FicheCatalogueModalProps {
    open: boolean;
    onClose: () => void;
    type?: string;
    itemId?: number;
    produits?: any[];
    catalogueBateaux?: any[];
    catalogueMoteurs?: any[];
    catalogueHelices?: any[];
    catalogueRemorques?: any[];
    forfaits?: any[];
    services?: any[];
}

const formatEuro = (v?: number) => (v != null ? v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) : '-');

const parseDocument = (entry: string) => {
    const pipeIndex = entry.indexOf('|');
    if (pipeIndex > 0) {
        return { name: entry.substring(0, pipeIndex), url: entry.substring(pipeIndex + 1) };
    }
    const parts = entry.split('/');
    return { name: parts[parts.length - 1], url: entry };
};

const getFileIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.endsWith('.pdf')) return <FilePdfOutlined style={{ color: '#ff4d4f' }} />;
    if (lower.endsWith('.doc') || lower.endsWith('.docx')) return <FileWordOutlined style={{ color: '#1677ff' }} />;
    if (lower.endsWith('.xls') || lower.endsWith('.xlsx')) return <FileExcelOutlined style={{ color: '#52c41a' }} />;
    return <FileOutlined />;
};

const handleDownload = async (url: string) => {
    try {
        const res = await api.get(url, { responseType: 'blob' });
        const blob = new Blob([res.data], { type: res.headers['content-type'] });
        const blobUrl = window.URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
    } catch {
        message.error("Erreur lors du téléchargement du document");
    }
};

export default function FicheCatalogueModal({
    open,
    onClose,
    type,
    itemId,
    produits = [],
    catalogueBateaux = [],
    catalogueMoteurs = [],
    catalogueHelices = [],
    catalogueRemorques = [],
    forfaits = [],
    services = [],
}: FicheCatalogueModalProps) {
    const [itemDetails, setItemDetails] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open || !type || !itemId) {
            setItemDetails(null);
            return;
        }

        // Initialize with cached item if available
        let initial: any = null;
        let endpoint = '';

        if (type === 'produit') {
            initial = produits.find((p) => p.id === itemId);
            endpoint = `/catalogue/produits/${itemId}`;
        } else if (type === 'bateau') {
            initial = catalogueBateaux.find((b) => b.id === itemId);
            endpoint = `/catalogue/bateaux/${itemId}`;
        } else if (type === 'moteur') {
            initial = catalogueMoteurs.find((m) => m.id === itemId);
            endpoint = `/catalogue/moteurs/${itemId}`;
        } else if (type === 'helice') {
            initial = catalogueHelices.find((h) => h.id === itemId);
            endpoint = `/catalogue/helices/${itemId}`;
        } else if (type === 'remorque') {
            initial = catalogueRemorques.find((r) => r.id === itemId);
            endpoint = `/catalogue/remorques/${itemId}`;
        } else if (type === 'forfait') {
            initial = forfaits.find((f) => f.id === itemId);
            endpoint = `/forfaits/${itemId}`;
        } else if (type === 'service') {
            initial = services.find((s) => s.id === itemId);
            endpoint = `/services/${itemId}`;
        }

        setItemDetails(initial || null);

        if (endpoint) {
            setLoading(true);
            api.get(endpoint)
                .then((res) => {
                    if (res.data) {
                        setItemDetails(res.data);
                    }
                })
                .catch(() => {
                    // Silently keep cached data if fetch fails
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    }, [open, type, itemId, produits, catalogueBateaux, catalogueMoteurs, catalogueHelices, catalogueRemorques, forfaits, services]);

    if (!type || !itemId) return null;

    const item = itemDetails;
    const titleLabel =
        type === 'produit'
            ? 'Fiche produit'
            : type === 'bateau'
            ? 'Fiche bateau'
            : type === 'moteur'
            ? 'Fiche moteur'
            : type === 'helice'
            ? 'Fiche hélice'
            : type === 'remorque'
            ? 'Fiche remorque'
            : type === 'forfait'
            ? 'Fiche forfait'
            : 'Fiche service';

    const itemTitle = item?.designation || item?.nom || `Élément #${itemId}`;

    const renderImages = (images?: string[]) => {
        if (!images || images.length === 0) return null;
        return (
            <div style={{ marginBottom: 16 }}>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                    Photos ({images.length})
                </Text>
                <Image.PreviewGroup>
                    <Space wrap size={8}>
                        {images.map((img, idx) => (
                            <Image
                                key={idx}
                                src={img}
                                width={80}
                                height={80}
                                style={{ objectFit: 'cover', borderRadius: 6, border: '1px solid #d9d9d9' }}
                            />
                        ))}
                    </Space>
                </Image.PreviewGroup>
            </div>
        );
    };

    const renderDocuments = (documents?: string[]) => {
        if (!documents || documents.length === 0) return null;
        return (
            <div style={{ marginTop: 16 }}>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                    Documents ({documents.length})
                </Text>
                <List
                    size="small"
                    bordered
                    dataSource={documents}
                    renderItem={(doc) => {
                        const parsed = parseDocument(doc);
                        return (
                            <List.Item
                                actions={[
                                    <Button
                                        key="dl"
                                        size="small"
                                        type="link"
                                        icon={<DownloadOutlined />}
                                        onClick={() => handleDownload(parsed.url)}
                                    >
                                        Télécharger
                                    </Button>,
                                ]}
                            >
                                <Space>
                                    {getFileIcon(parsed.name)}
                                    <Text>{parsed.name}</Text>
                                </Space>
                            </List.Item>
                        );
                    }}
                />
            </div>
        );
    };

    const renderContent = () => {
        if (!item) {
            return (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                    <Spin spinning={loading} />
                </div>
            );
        }

        const tabs = [];

        if (type === 'produit') {
            const generalItems = [
                { key: 'des', label: 'Désignation', children: item.designation || '-' },
                { key: 'cat', label: 'Catégorie', children: <Tag color="blue">{item.categorie || '-'}</Tag> },
                { key: 'ref', label: 'Référence interne', children: item.ref || '-' },
                {
                    key: 'refs',
                    label: 'Réf. complémentaires',
                    children: item.refs && item.refs.length > 0 ? item.refs.join(', ') : '-',
                },
                {
                    key: 'annees',
                    label: 'Années',
                    children: item.anneeDebut && item.anneeFin ? `${item.anneeDebut} - ${item.anneeFin}` : '-',
                },
                {
                    key: 'eval',
                    label: 'Évaluation',
                    children: item.evaluation ? <Rate disabled allowHalf value={item.evaluation} /> : '-',
                },
                { key: 'emp', label: 'Emplacement', children: item.emplacement || '-' },
                {
                    key: 'stk',
                    label: 'Stock actuel',
                    children: (
                        <Tag color={item.stock > (item.stockMini || 0) ? 'green' : item.stock > 0 ? 'orange' : 'red'}>
                            {item.stock != null ? `${item.stock} en stock` : '-'}
                        </Tag>
                    ),
                },
                { key: 'stkMini', label: "Stock d'alerte", children: item.stockMini != null ? item.stockMini : '-' },
                { key: 'ht', label: 'Prix de vente HT', children: formatEuro(item.prixVenteHT) },
                { key: 'tva', label: 'TVA', children: item.tva != null ? `${item.tva}%` : '-' },
                { key: 'mtva', label: 'Montant TVA', children: formatEuro(item.montantTVA) },
                {
                    key: 'ttc',
                    label: 'Prix de vente TTC',
                    children: <strong style={{ color: '#1677ff' }}>{formatEuro(item.prixVenteTTC)}</strong>,
                },
            ];

            tabs.push({
                key: 'general',
                label: 'Informations générales',
                children: (
                    <div>
                        {renderImages(item.images)}
                        <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} items={generalItems} />
                        {item.description && (
                            <div style={{ marginTop: 16 }}>
                                <Text strong style={{ display: 'block', marginBottom: 4 }}>
                                    Description
                                </Text>
                                <Paragraph style={{ whiteSpace: 'pre-wrap', backgroundColor: '#fafafa', padding: 8, borderRadius: 6 }}>
                                    {item.description}
                                </Paragraph>
                            </div>
                        )}
                        {renderDocuments(item.documents)}
                    </div>
                ),
            });

            tabs.push({
                key: 'fournisseurs',
                label: 'Fournisseurs',
                children: <FournisseurProduits produitId={item.id} />,
            });

            tabs.push({
                key: 'historique',
                label: 'Historique & Mouvements',
                children: <ProduitHistorique produitId={item.id} />,
            });
        } else if (type === 'bateau') {
            const generalItems = [
                { key: 'des', label: 'Désignation', children: item.designation || '-' },
                { key: 'type', label: 'Type', children: item.type || '-' },
                {
                    key: 'annees',
                    label: 'Années',
                    children: item.anneeDebut && item.anneeFin ? `${item.anneeDebut} - ${item.anneeFin}` : '-',
                },
                { key: 'ce', label: 'Catégorie CE', children: item.categorieCe || '-' },
                { key: 'lExt', label: 'Longueur extérieure', children: item.longueurExterieure ? `${item.longueurExterieure} m` : '-' },
                { key: 'lCoq', label: 'Longueur coque', children: item.longueurCoque ? `${item.longueurCoque} m` : '-' },
                { key: 'larg', label: 'Largeur', children: item.largeur ? `${item.largeur} m` : '-' },
                { key: 'haut', label: 'Hauteur', children: item.hauteur ? `${item.hauteur} m` : '-' },
                { key: 'tEau', label: "Tirant d'eau", children: item.tirantEau ? `${item.tirantEau} m` : '-' },
                { key: 'tAir', label: "Tirant d'air", children: item.tirantAir ? `${item.tirantAir} m` : '-' },
                { key: 'poids', label: 'Poids à vide', children: item.poidsVide ? `${item.poidsVide} kg` : '-' },
                { key: 'charge', label: 'Charge max', children: item.chargeMax ? `${item.chargeMax} kg` : '-' },
                { key: 'pMoteur', label: 'Poids moteur max', children: item.poidsMoteurMax ? `${item.poidsMoteurMax} kg` : '-' },
                { key: 'puiss', label: 'Puissance max', children: item.puissanceMax ? `${item.puissanceMax}` : '-' },
                { key: 'arbre', label: "Longueur d'arbre", children: item.longueurArbre || '-' },
                { key: 'resCarb', label: 'Réservoir carburant', children: item.reservoirCarburant ? `${item.reservoirCarburant} L` : '-' },
                { key: 'resEau', label: 'Réservoir eau', children: item.reservoirEau ? `${item.reservoirEau} L` : '-' },
                { key: 'passagers', label: 'Passagers max', children: item.nombrePassagersMax || '-' },
                { key: 'ht', label: 'Prix de vente HT', children: formatEuro(item.prixVenteHT) },
                {
                    key: 'ttc',
                    label: 'Prix de vente TTC',
                    children: <strong style={{ color: '#1677ff' }}>{formatEuro(item.prixVenteTTC)}</strong>,
                },
            ];

            tabs.push({
                key: 'general',
                label: 'Informations générales',
                children: (
                    <div>
                        {renderImages(item.images)}
                        <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} items={generalItems} />
                        {item.description && (
                            <div style={{ marginTop: 16 }}>
                                <Text strong style={{ display: 'block', marginBottom: 4 }}>
                                    Description
                                </Text>
                                <Paragraph style={{ whiteSpace: 'pre-wrap', backgroundColor: '#fafafa', padding: 8, borderRadius: 6 }}>
                                    {item.description}
                                </Paragraph>
                            </div>
                        )}
                        {item.options && item.options.length > 0 && (
                            <div style={{ marginTop: 16 }}>
                                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                                    Options ({item.options.length})
                                </Text>
                                <List
                                    size="small"
                                    bordered
                                    dataSource={item.options}
                                    renderItem={(opt: any) => (
                                        <List.Item
                                            extra={<strong style={{ color: '#1677ff' }}>{formatEuro(opt.prixTTC)}</strong>}
                                        >
                                            <List.Item.Meta
                                                title={opt.nom}
                                                description={opt.description || undefined}
                                            />
                                        </List.Item>
                                    )}
                                />
                            </div>
                        )}
                        {renderDocuments(item.documents)}
                    </div>
                ),
            });

            tabs.push({
                key: 'fournisseurs',
                label: 'Fournisseurs',
                children: <FournisseurBateaux bateauId={item.id} />,
            });
        } else if (type === 'moteur') {
            const generalItems = [
                { key: 'des', label: 'Désignation', children: item.designation || '-' },
                { key: 'type', label: 'Type', children: item.type || '-' },
                {
                    key: 'puiss',
                    label: 'Puissance',
                    children: `${item.puissanceCv ? `${item.puissanceCv} CV` : ''} ${item.puissanceKw ? `(${item.puissanceKw} kW)` : ''}`.trim() || '-',
                },
                {
                    key: 'cyl',
                    label: 'Cylindres / Cylindrée',
                    children: `${item.cylindres ? `${item.cylindres} cyl.` : ''} ${item.cylindree ? `${item.cylindree} cm³` : ''}`.trim() || '-',
                },
                { key: 'dem', label: 'Démarrage', children: item.demarrage || '-' },
                { key: 'dir', label: 'Direction', children: item.direction || '-' },
                { key: 'arbre', label: "Longueur d'arbre", children: item.longueurArbre || '-' },
                { key: 'regime', label: 'Régime', children: item.regime || '-' },
                { key: 'huile', label: 'Huile recommandée', children: item.huileRecommandee || '-' },
                {
                    key: 'stk',
                    label: 'Stock',
                    children: (
                        <Tag color={item.stock > 0 ? 'green' : 'red'}>
                            {item.stock != null ? `${item.stock} en stock` : '-'}
                        </Tag>
                    ),
                },
                { key: 'emp', label: 'Emplacement', children: item.emplacement || '-' },
                { key: 'ht', label: 'Prix de vente HT', children: formatEuro(item.prixVenteHT) },
                {
                    key: 'ttc',
                    label: 'Prix de vente TTC',
                    children: <strong style={{ color: '#1677ff' }}>{formatEuro(item.prixVenteTTC)}</strong>,
                },
            ];

            tabs.push({
                key: 'general',
                label: 'Informations générales',
                children: (
                    <div>
                        {renderImages(item.images)}
                        <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} items={generalItems} />
                        {item.description && (
                            <div style={{ marginTop: 16 }}>
                                <Text strong style={{ display: 'block', marginBottom: 4 }}>
                                    Description
                                </Text>
                                <Paragraph style={{ whiteSpace: 'pre-wrap', backgroundColor: '#fafafa', padding: 8, borderRadius: 6 }}>
                                    {item.description}
                                </Paragraph>
                            </div>
                        )}
                        {renderDocuments(item.documents)}
                    </div>
                ),
            });

            tabs.push({
                key: 'fournisseurs',
                label: 'Fournisseurs',
                children: <FournisseurMoteurs moteurId={item.id} />,
            });
        } else if (type === 'helice') {
            const generalItems = [
                { key: 'des', label: 'Désignation', children: item.designation || '-' },
                { key: 'diam', label: 'Diamètre', children: item.diametre != null ? item.diametre : '-' },
                { key: 'pas', label: 'Pas', children: item.pas || '-' },
                { key: 'pales', label: 'Nombre de pales', children: item.pales != null ? item.pales : '-' },
                { key: 'cannelures', label: 'Cannelures', children: item.cannelures != null ? item.cannelures : '-' },
                {
                    key: 'annees',
                    label: 'Années',
                    children: item.anneeDebut && item.anneeFin ? `${item.anneeDebut} - ${item.anneeFin}` : '-',
                },
                { key: 'ht', label: 'Prix de vente HT', children: formatEuro(item.prixVenteHT) },
                {
                    key: 'ttc',
                    label: 'Prix de vente TTC',
                    children: <strong style={{ color: '#1677ff' }}>{formatEuro(item.prixVenteTTC)}</strong>,
                },
            ];

            tabs.push({
                key: 'general',
                label: 'Informations générales',
                children: (
                    <div>
                        {renderImages(item.images)}
                        <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} items={generalItems} />
                        {item.description && (
                            <div style={{ marginTop: 16 }}>
                                <Text strong style={{ display: 'block', marginBottom: 4 }}>
                                    Description
                                </Text>
                                <Paragraph style={{ whiteSpace: 'pre-wrap', backgroundColor: '#fafafa', padding: 8, borderRadius: 6 }}>
                                    {item.description}
                                </Paragraph>
                            </div>
                        )}
                        {renderDocuments(item.documents)}
                    </div>
                ),
            });

            tabs.push({
                key: 'fournisseurs',
                label: 'Fournisseurs',
                children: <FournisseurHelices heliceId={item.id} />,
            });
        } else if (type === 'remorque') {
            const generalItems = [
                { key: 'des', label: 'Désignation', children: item.designation || '-' },
                { key: 'ptac', label: 'PTAC', children: item.ptac ? `${item.ptac} kg` : '-' },
                { key: 'chargeAVide', label: 'Charge à vide', children: item.chargeAVide ? `${item.chargeAVide} kg` : '-' },
                { key: 'chargeUtile', label: 'Charge utile', children: item.chargeUtile ? `${item.chargeUtile} kg` : '-' },
                { key: 'longueur', label: 'Longueur', children: item.longueur ? `${item.longueur} m` : '-' },
                { key: 'largeur', label: 'Largeur', children: item.largeur ? `${item.largeur} m` : '-' },
                { key: 'lMaxBateau', label: 'Longueur max bateau', children: item.longueurMaxBateau ? `${item.longueurMaxBateau} m` : '-' },
                { key: 'largMaxBateau', label: 'Largeur max bateau', children: item.largeurMaxBateau ? `${item.largeurMaxBateau} m` : '-' },
                { key: 'fleche', label: 'Flèche', children: item.fleche || '-' },
                { key: 'chassis', label: 'Type châssis', children: item.typeChassis || '-' },
                { key: 'roues', label: 'Roues', children: item.roues || '-' },
                { key: 'equipement', label: 'Équipement', children: item.equipement || '-' },
                {
                    key: 'stk',
                    label: 'Stock',
                    children: (
                        <Tag color={item.stock > 0 ? 'green' : 'red'}>
                            {item.stock != null ? `${item.stock} en stock` : '-'}
                        </Tag>
                    ),
                },
                { key: 'emp', label: 'Emplacement', children: item.emplacement || '-' },
                { key: 'ht', label: 'Prix de vente HT', children: formatEuro(item.prixVenteHT) },
                {
                    key: 'ttc',
                    label: 'Prix de vente TTC',
                    children: <strong style={{ color: '#1677ff' }}>{formatEuro(item.prixVenteTTC)}</strong>,
                },
            ];

            tabs.push({
                key: 'general',
                label: 'Informations générales',
                children: (
                    <div>
                        {renderImages(item.images)}
                        <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} items={generalItems} />
                        {item.description && (
                            <div style={{ marginTop: 16 }}>
                                <Text strong style={{ display: 'block', marginBottom: 4 }}>
                                    Description
                                </Text>
                                <Paragraph style={{ whiteSpace: 'pre-wrap', backgroundColor: '#fafafa', padding: 8, borderRadius: 6 }}>
                                    {item.description}
                                </Paragraph>
                            </div>
                        )}
                        {renderDocuments(item.documents)}
                    </div>
                ),
            });

            tabs.push({
                key: 'fournisseurs',
                label: 'Fournisseurs',
                children: <FournisseurRemorques remorqueId={item.id} />,
            });
        } else if (type === 'forfait') {
            const generalItems = [
                { key: 'nom', label: 'Nom du forfait', children: item.nom || '-' },
                { key: 'duree', label: 'Durée estimée', children: item.dureeEstimee != null ? `${item.dureeEstimee}h` : '-' },
                { key: 'ht', label: 'Prix HT', children: formatEuro(item.prixHT) },
                {
                    key: 'ttc',
                    label: 'Prix TTC',
                    children: <strong style={{ color: '#1677ff' }}>{formatEuro(item.prixTTC)}</strong>,
                },
            ];

            tabs.push({
                key: 'general',
                label: 'Informations générales',
                children: (
                    <div>
                        <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} items={generalItems} />
                        {item.description && (
                            <div style={{ marginTop: 16 }}>
                                <Text strong style={{ display: 'block', marginBottom: 4 }}>
                                    Description
                                </Text>
                                <Paragraph style={{ whiteSpace: 'pre-wrap', backgroundColor: '#fafafa', padding: 8, borderRadius: 6 }}>
                                    {item.description}
                                </Paragraph>
                            </div>
                        )}
                    </div>
                ),
            });
        } else if (type === 'service') {
            const generalItems = [
                { key: 'nom', label: 'Nom du service', children: item.nom || '-' },
                { key: 'duree', label: 'Durée estimée', children: item.dureeEstimee != null ? `${item.dureeEstimee}h` : '-' },
                { key: 'ht', label: 'Prix HT', children: formatEuro(item.prixHT) },
                {
                    key: 'ttc',
                    label: 'Prix TTC',
                    children: <strong style={{ color: '#1677ff' }}>{formatEuro(item.prixTTC)}</strong>,
                },
            ];

            tabs.push({
                key: 'general',
                label: 'Informations générales',
                children: (
                    <div>
                        <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} items={generalItems} />
                        {item.description && (
                            <div style={{ marginTop: 16 }}>
                                <Text strong style={{ display: 'block', marginBottom: 4 }}>
                                    Description
                                </Text>
                                <Paragraph style={{ whiteSpace: 'pre-wrap', backgroundColor: '#fafafa', padding: 8, borderRadius: 6 }}>
                                    {item.description}
                                </Paragraph>
                            </div>
                        )}
                    </div>
                ),
            });
        }

        return <Tabs defaultActiveKey="general" items={tabs} />;
    };

    return (
        <Modal
            title={
                <Space>
                    <EyeOutlined style={{ color: '#1677ff' }} />
                    <span>
                        {titleLabel} : <strong>{itemTitle}</strong>
                    </span>
                </Space>
            }
            open={open}
            onCancel={onClose}
            footer={[
                <Button key="close" onClick={onClose}>
                    Fermer
                </Button>,
            ]}
            width="90vw"
            style={{ maxWidth: 850, top: 20 }}
            destroyOnHidden
        >
            <Spin spinning={loading && !itemDetails}>{renderContent()}</Spin>
        </Modal>
    );
}

export interface FicheCataloguePopoverProps {
    type?: string;
    itemId?: number;
    produits?: any[];
    catalogueBateaux?: any[];
    catalogueMoteurs?: any[];
    catalogueHelices?: any[];
    catalogueRemorques?: any[];
    forfaits?: any[];
    services?: any[];
    navigate?: (route: string) => void;
}

export function FicheCataloguePopover({
    type,
    itemId,
    produits = [],
    catalogueBateaux = [],
    catalogueMoteurs = [],
    catalogueHelices = [],
    catalogueRemorques = [],
    forfaits = [],
    services = [],
}: FicheCataloguePopoverProps) {
    const [modalOpen, setModalOpen] = useState(false);
    const [popoverOpen, setPopoverOpen] = useState(false);

    if (!type || !itemId) return null;

    let items: { label: string; value: React.ReactNode }[] = [];
    let titre = '';

    if (type === 'produit') {
        const p = produits.find((x) => x.id === itemId);
        if (!p) return null;
        titre = p.designation;
        items = [
            { label: 'Référence', value: p.ref || '-' },
            { label: 'Catégorie', value: p.categorie || '-' },
            { label: 'Stock', value: p.stock != null ? p.stock : '-' },
            { label: 'Emplacement', value: p.emplacement || '-' },
            { label: 'Prix TTC', value: formatEuro(p.prixVenteTTC) },
        ];
        if (p.description) items.push({ label: 'Description', value: p.description });
    } else if (type === 'bateau') {
        const b = catalogueBateaux.find((x) => x.id === itemId);
        if (!b) return null;
        titre = b.designation;
        items = [
            { label: 'Désignation', value: b.designation },
            { label: 'Prix TTC', value: formatEuro(b.prixVenteTTC) },
        ];
    } else if (type === 'moteur') {
        const m = catalogueMoteurs.find((x) => x.id === itemId);
        if (!m) return null;
        titre = m.designation;
        items = [
            { label: 'Désignation', value: m.designation },
            { label: 'Prix TTC', value: formatEuro(m.prixVenteTTC) },
        ];
    } else if (type === 'helice') {
        const h = catalogueHelices.find((x) => x.id === itemId);
        if (!h) return null;
        titre = h.designation;
        items = [
            { label: 'Désignation', value: h.designation },
            { label: 'Prix TTC', value: formatEuro(h.prixVenteTTC) },
        ];
    } else if (type === 'remorque') {
        const r = catalogueRemorques.find((x) => x.id === itemId);
        if (!r) return null;
        titre = r.designation;
        items = [
            { label: 'Désignation', value: r.designation },
            { label: 'Prix TTC', value: formatEuro(r.prixVenteTTC) },
        ];
    } else if (type === 'forfait') {
        const f = forfaits.find((x: any) => x.id === itemId);
        if (!f) return null;
        titre = f.nom;
        items = [
            { label: 'Prix TTC', value: formatEuro(f.prixTTC) },
            { label: 'Durée estimée', value: f.dureeEstimee != null ? `${f.dureeEstimee}h` : '-' },
        ];
        if (f.description) items.push({ label: 'Description', value: f.description });
    } else if (type === 'service') {
        const s = services.find((x: any) => x.id === itemId);
        if (!s) return null;
        titre = s.nom;
        items = [
            { label: 'Prix TTC', value: formatEuro(s.prixTTC) },
            { label: 'Durée estimée', value: s.dureeEstimee != null ? `${s.dureeEstimee}h` : '-' },
        ];
        if (s.description) items.push({ label: 'Description', value: s.description });
    } else {
        return null;
    }

    const content = (
        <div style={{ maxWidth: 280 }}>
            <Descriptions column={1} size="small" items={items.map((it, i) => ({ key: i, label: it.label, children: it.value }))} />
            <div style={{ marginTop: 8, textAlign: 'right' }}>
                <Button
                    type="link"
                    size="small"
                    onClick={() => {
                        setPopoverOpen(false);
                        setModalOpen(true);
                    }}
                >
                    Voir dans le catalogue
                </Button>
            </div>
        </div>
    );

    return (
        <>
            <Popover
                title={titre}
                content={content}
                trigger="click"
                placement="right"
                open={popoverOpen}
                onOpenChange={setPopoverOpen}
            >
                <Button icon={<InfoCircleOutlined />} title="Fiche produit" size="small" />
            </Popover>
            <FicheCatalogueModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                type={type}
                itemId={itemId}
                produits={produits}
                catalogueBateaux={catalogueBateaux}
                catalogueMoteurs={catalogueMoteurs}
                catalogueHelices={catalogueHelices}
                catalogueRemorques={catalogueRemorques}
                forfaits={forfaits}
                services={services}
            />
        </>
    );
}

