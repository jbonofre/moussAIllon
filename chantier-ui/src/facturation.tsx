import { fetchWithAuth } from './api.ts';
import MosaicTable from "./MosaicTable.tsx";
import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Button, Card, Checkbox, Descriptions, Divider, Popconfirm, Select, Space, Spin, Table, Tag, Tooltip, message } from 'antd';
import { CreditCardOutlined, DownloadOutlined, LinkOutlined, ReloadOutlined, StopOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { jsPDF } from 'jspdf';
import { MODULES, MODULE_LABEL, MODULE_PARAMETRAGE, trierModules } from './modules.ts';

const formatDate = (value: any) => (value ? dayjs(value).format('DD/MM/YYYY') : '—');

const formatMontant = (value: any) => (value != null
    ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
    : '—');

const arrondi = (montant: number) => Math.round(montant * 100) / 100;

const libellesModules = (modules: string[] = []) => trierModules(modules).map((m) => MODULE_LABEL[m] || m).join(', ');

// Réponse en erreur : le serveur en donne la raison quand il le peut
const verifier = async (r: Response) => {
    if (!r.ok) {
        const raison = await r.text().catch(() => '');
        throw new Error(raison || 'Erreur ' + r.status);
    }
    return r.json();
};

// MODULES : modules ajoutés en cours de période, payés tout de suite pour les mois déjà réglés
type PaiementType = 'MENSUEL' | 'ANNUEL' | 'MODULES';
type PaiementMode = 'VIREMENT' | 'CARTE' | 'STRIPE' | 'PAYPLUG';

const MODE_LABEL: Record<string, string> = {
    VIREMENT: 'Virement bancaire',
    CARTE: 'Carte bancaire',
    STRIPE: 'Stripe',
    PAYPLUG: 'PayPlug',
};

const TYPE_LABEL: Record<string, string> = { MENSUEL: 'Mensuel', ANNUEL: 'Annuel', MODULES: 'Ajout de modules' };
const TYPE_COLOR: Record<string, string> = { MENSUEL: 'blue', ANNUEL: 'gold', MODULES: 'purple' };

function downloadFacturePdf(paiement: any, societe: any) {
    // Période couverte enregistrée avec le paiement ; à défaut (anciens paiements), comptée depuis sa date
    const dateDebut = formatDate(paiement.periodeDebut ?? paiement.date);
    const dateFin = paiement.periodeFin
        ? formatDate(paiement.periodeFin)
        : dayjs(paiement.date).add(paiement.type === 'ANNUEL' ? 12 : 1, 'month').format('DD/MM/YYYY');
    const nomSociete = societe?.nom ?? 'moussAIllon';
    const montantStr = formatMontant(paiement.montant);

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const L = 20;   // left margin
    const R = pageW - 20; // right edge
    const lineH = 7;
    let y = 24;

    const sep = () => {
        doc.setDrawColor(210);
        doc.line(L, y, R, y);
        y += 8;
    };

    const row = (label: string, value: string, bold = false) => {
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.setFontSize(10);
        doc.text(label, L, y);
        doc.text(value, R, y, { align: 'right' });
        y += lineH;
    };

    // ── Titre ──────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text("Facture d'abonnement", L, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(nomSociete, L, y);
    doc.text(`N° ${paiement.id}`, R, y, { align: 'right' });
    y += 6;
    doc.text(`Émise le ${dayjs().format('DD/MM/YYYY')}`, R, y, { align: 'right' });
    doc.setTextColor(0);
    y += 12;

    sep();

    // ── Détail ─────────────────────────────────────────────
    row('Désignation', `Abonnement moussAIllon — ${TYPE_LABEL[paiement.type] ?? paiement.type}`);
    y += 2;
    row('Période couverte', dateDebut + ' au ' + dateFin);
    y += 2;
    if (paiement.montantActivation) {
        row("Frais d'activation", formatMontant(paiement.montantActivation));
        y += 2;
        row('Abonnement', formatMontant(arrondi(paiement.montant - paiement.montantActivation)));
        y += 2;
    }
    if (paiement.nombreUtilisateurs != null) {
        row('Utilisateurs', String(paiement.nombreUtilisateurs));
        y += 2;
        if (paiement.nombreTechniciens != null) {
            row('Techniciens', String(paiement.nombreTechniciens));
            y += 2;
            row('Clients (accès au portail)', String(paiement.nombreClients ?? 0));
            y += 2;
        }
        row(paiement.type === 'MODULES' ? 'Modules ajoutés' : 'Modules', libellesModules(paiement.modules));
        y += 2;
    }
    row('Mode de paiement', MODE_LABEL[paiement.mode] ?? paiement.mode);
    y += 2;
    row('Date de paiement', formatDate(paiement.date));
    y += 6;

    sep();

    // ── Total ──────────────────────────────────────────────
    doc.setFillColor(245, 245, 245);
    doc.rect(L, y - 4, R - L, lineH + 4, 'F');
    row('Total TTC', montantStr, true);
    y += 4;

    sep();

    // ── Pied de page ───────────────────────────────────────
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Document généré automatiquement par moussAIllon le ${dayjs().format('DD/MM/YYYY')}`, L, y);

    doc.save(`facture-abonnement-${paiement.id}.pdf`);
}

export default function Facturation(props: { onSocieteChange?: (societe: any) => void }) {

    const [societe, setSociete] = useState<any>(null);
    const [tarifs, setTarifs] = useState<any>(null);
    const [modulesSelectionnes, setModulesSelectionnes] = useState<string[]>([]);
    const [savingModules, setSavingModules] = useState(false);
    const [ouvertureEnLigne, setOuvertureEnLigne] = useState(false);
    const [paiementType, setPaiementType] = useState<PaiementType | null>(null);
    const [paiementMode, setPaiementMode] = useState<PaiementMode>('VIREMENT');
    const [signatureModalOpen, setSignatureModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const signatureDrawingRef = useRef(false);

    const fetchSociete = useCallback(() => {
        fetchWithAuth('./societe')
            .then(verifier)
            .then((data) => {
                setSociete(data);
                setModulesSelectionnes(data.modules || []);
            })
            .catch((e) => message.error('Erreur : ' + e.message));
    }, []);

    useEffect(() => { fetchSociete(); }, [fetchSociete]);

    // Informe l'espace de travail d'une limitation de l'accès levée (ou survenue), par exemple après l'activation
    const { onSocieteChange } = props;
    useEffect(() => {
        if (societe) onSocieteChange?.(societe);
    }, [societe, onSocieteChange]);

    useEffect(() => {
        fetchWithAuth('./societe/tarifs')
            .then((r) => { if (!r.ok) throw new Error('Erreur ' + r.status); return r.json(); })
            .then(setTarifs)
            .catch((e) => message.error('Erreur : ' + e.message));
    }, []);

    const initSignatureCanvas = useCallback(() => {
        setTimeout(() => {
            const canvas = signatureCanvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            let drawing = false;
            const getPos = (e: MouseEvent | TouchEvent) => {
                const rect = canvas.getBoundingClientRect();
                if ('touches' in e) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
                return { x: (e as MouseEvent).clientX - rect.left, y: (e as MouseEvent).clientY - rect.top };
            };
            const onStart = (e: MouseEvent | TouchEvent) => { e.preventDefault(); drawing = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); signatureDrawingRef.current = true; };
            const onMove = (e: MouseEvent | TouchEvent) => { if (!drawing) return; e.preventDefault(); const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
            const onEnd = () => { drawing = false; };
            canvas.addEventListener('mousedown', onStart);
            canvas.addEventListener('mousemove', onMove);
            canvas.addEventListener('mouseup', onEnd);
            canvas.addEventListener('mouseleave', onEnd);
            canvas.addEventListener('touchstart', onStart, { passive: false });
            canvas.addEventListener('touchmove', onMove, { passive: false });
            canvas.addEventListener('touchend', onEnd);
        }, 100);
    }, []);

    const clearSignatureCanvas = () => {
        const canvas = signatureCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        signatureDrawingRef.current = false;
    };

    const isExternalMode = (mode: PaiementMode) => mode === 'STRIPE' || mode === 'PAYPLUG';

    const getPaymentLink = (type: PaiementType, mode: PaiementMode): string | undefined => {
        // Les liens fixes ont le montant d'une échéance : pas celui d'un ajout de modules
        if (!societe || type === 'MODULES') return undefined;
        if (mode === 'STRIPE') return type === 'ANNUEL' ? societe.stripePaymentLinkAnnuel : societe.stripePaymentLinkMensuel;
        if (mode === 'PAYPLUG') return type === 'ANNUEL' ? societe.payplugPaymentLinkAnnuel : societe.payplugPaymentLinkMensuel;
        return undefined;
    };

    // Paiement en ligne au montant à payer (clé API de l'éditeur), ou à défaut par le lien fixe de la société
    const paiementEnLigneDisponible = (type: PaiementType, mode: PaiementMode): boolean =>
        !!tarifs?.paiementEnLigne?.[mode] || !!getPaymentLink(type, mode);

    const ouvrirPaiementEnLigne = () => {
        // Fenêtre ouverte tout de suite : ouverte après la réponse du serveur, elle serait bloquée par le navigateur
        const fenetre = window.open('', '_blank');
        if (fenetre) fenetre.opener = null;
        setOuvertureEnLigne(true);
        fetchWithAuth('./societe/paiement/en-ligne', {
            method: 'POST',
            body: JSON.stringify({ type: paiementType, mode: paiementMode, ...modulesDuPaiement() }),
        })
            .then(verifier)
            .then(({ url }) => {
                if (fenetre) {
                    fenetre.location.href = url;
                } else {
                    window.open(url, '_blank', 'noopener,noreferrer');
                }
            })
            .catch((e) => {
                fenetre?.close();
                message.error('Erreur : ' + e.message);
            })
            .finally(() => setOuvertureEnLigne(false));
    };

    const openPaiementModal = (type: PaiementType) => {
        setPaiementType(type);
        setPaiementMode('VIREMENT');
        signatureDrawingRef.current = false;
        setSignatureModalOpen(true);
        initSignatureCanvas();
    };

    const handleModeChange = (mode: PaiementMode) => {
        setPaiementMode(mode);
        if (!isExternalMode(mode)) {
            // Re-init canvas when switching back to a manual mode
            signatureDrawingRef.current = false;
            initSignatureCanvas();
        }
    };

    const handlePaiementConfirm = () => {
        if (!isExternalMode(paiementMode) && !signatureDrawingRef.current) {
            message.warning('La signature est requise pour valider le paiement');
            return;
        }
        const canvas = signatureCanvasRef.current;
        const signature = (!isExternalMode(paiementMode) && canvas)
            ? canvas.toDataURL('image/png')
            : 'external-payment';

        setSubmitting(true);
        fetchWithAuth('./societe/paiement', {
            method: 'POST',
            body: JSON.stringify({ type: paiementType, mode: paiementMode, signature, ...modulesDuPaiement() }),
        })
            .then(verifier)
            .then((data) => {
                setSociete(data);
                setModulesSelectionnes(data.modules || []);
                setSignatureModalOpen(false);
                message.success(paiementType === 'MODULES' ? 'Paiement enregistré : modules activés' : 'Paiement enregistré avec succès');
            })
            .catch((e) => message.error('Erreur : ' + e.message))
            .finally(() => setSubmitting(false));
    };

    const handleEnregistrerModules = () => {
        setSavingModules(true);
        fetchWithAuth('./societe/modules', {
            method: 'PUT',
            body: JSON.stringify(modulesSelectionnes),
        })
            .then(verifier)
            .then((data) => {
                setSociete(data);
                setModulesSelectionnes(data.modules || []);
                message.success('Modules souscrits enregistrés');
            })
            .catch((e) => message.error('Erreur : ' + e.message))
            .finally(() => setSavingModules(false));
    };

    const handleResilier = () => {
        fetchWithAuth('./societe/resilier', { method: 'POST' })
            .then(verifier)
            .then((data) => {
                setSociete(data);
                message.success('Abonnement résilié');
            })
            .catch((e) => message.error('Erreur : ' + e.message));
    };

    const handleReactiver = () => {
        fetchWithAuth('./societe/reactiver', { method: 'POST' })
            .then(verifier)
            .then((data) => {
                setSociete(data);
                message.success('Abonnement réactivé');
            })
            .catch((e) => message.error('Erreur : ' + e.message));
    };

    const getModeOptions = (type: PaiementType): { value: string; label: string; disabled?: boolean }[] => [
        { value: 'VIREMENT', label: 'Virement bancaire' },
        { value: 'CARTE', label: 'Carte bancaire' },
        {
            value: 'STRIPE',
            label: 'Stripe',
            disabled: !paiementEnLigneDisponible(type, 'STRIPE'),
        },
        {
            value: 'PAYPLUG',
            label: 'PayPlug',
            disabled: !paiementEnLigneDisponible(type, 'PAYPLUG'),
        },
    ];

    // Le premier paiement (mois ou année) active l'abonnement et comprend les frais d'activation
    const actif = !!societe?.abonnementActif;
    const fraisActivation = societe && !actif ? (societe.abonnementActivationMontant ?? 0) : 0;
    const montantMensuel = societe ? arrondi(societe.abonnementProchainPaiementMontant + fraisActivation) : undefined;
    const montantAnnuel = societe ? arrondi(societe.abonnementMontantAnnuel + fraisActivation) : undefined;
    const activationComprise = fraisActivation > 0 ? `, dont ${formatMontant(fraisActivation)} d'activation` : '';

    // Simulation du prix mensuel selon les modules cochés : utilisateurs, techniciens et clients ayant accès
    // au portail, chacun à son prix, plus le prix des modules.
    const prixModule = (module: string): number => tarifs?.prixModules?.[module] ?? 0;
    const effectifs = [
        { label: 'Utilisateurs', nombre: societe?.abonnementNombreUtilisateurs ?? 0, prix: tarifs?.prixUtilisateur ?? 0 },
        { label: 'Techniciens', nombre: societe?.abonnementNombreTechniciens ?? 0, prix: tarifs?.prixTechnicien ?? 0 },
        { label: 'Clients (accès au portail)', nombre: societe?.abonnementNombreClients ?? 0, prix: tarifs?.prixClient ?? 0 },
    ];
    const montantEffectifs = effectifs.reduce((total, e) => total + e.nombre * e.prix, 0);
    const montantModules = modulesSelectionnes.reduce((total, module) => total + prixModule(module), 0);
    const montantMensuelSimule = Math.round((montantEffectifs + montantModules) * 100) / 100;
    const moisFacturesAnnuel = tarifs?.moisFacturesAnnuel ?? 11;
    const modulesModifies = !!societe && trierModules(societe.modules).join() !== trierModules(modulesSelectionnes).join();
    const modulesRetires = trierModules((societe?.modules || []).filter((m: string) => !modulesSelectionnes.includes(m)));
    const modulesAjoutes = trierModules(modulesSelectionnes.filter((m) => !(societe?.modules || []).includes(m)));

    // Une fois l'abonnement activé, un module ajouté est payé tout de suite : le prix d'un mois entier pour
    // chaque mois payé non terminé (mois en cours compris) qui ne le comprend pas déjà.
    const moisPayesRestants = (societe?.abonnementMois || [])
        .filter((m: any) => m.statut === 'PAYE' && dayjs(m.fin).isAfter(dayjs()));
    const montantAjout = arrondi(moisPayesRestants.reduce((total: number, m: any) => total
        + modulesAjoutes.filter((a) => !(m.modules || []).includes(a)).reduce((t, a) => t + prixModule(a), 0), 0));
    const paiementAjoutRequis = actif && !societe?.versionFree && modulesAjoutes.length > 0;
    const ajoutEnRetard = paiementAjoutRequis && !societe?.abonnementAJour;
    const ajoutAPayer = paiementAjoutRequis && !ajoutEnRetard && montantAjout > 0;
    const modulesDuPaiement = () => (paiementType === 'MODULES' ? { modules: modulesSelectionnes } : {});

    const montantPaiement = paiementType === 'MODULES' ? montantAjout : paiementType === 'ANNUEL' ? montantAnnuel : montantMensuel;
    const labelPaiement = paiementType === 'MODULES'
        ? `Ajout de modules — ${formatMontant(montantAjout)}`
        : paiementType === 'ANNUEL'
            ? `Paiement annuel — ${formatMontant(montantAnnuel)} (1 mois offert${activationComprise})`
            : `Paiement mensuel — ${formatMontant(montantMensuel)}${fraisActivation > 0 ? ` (${activationComprise.slice(2)})` : ''}`;

    const paiementEnLigne = !!paiementType && paiementEnLigneDisponible(paiementType, paiementMode);

    const historiqueColumns = [
        {
            title: 'Date',
            dataIndex: 'date',
            width: 120,
            render: (v: string) => formatDate(v),
        },
        {
            title: 'Type',
            dataIndex: 'type',
            width: 160,
            render: (v: string, record: any) => (
                <Space size={4} wrap>
                    <Tag color={TYPE_COLOR[v] ?? 'default'}>{TYPE_LABEL[v] ?? v}</Tag>
                    {record.montantActivation ? <Tag color="cyan">Activation</Tag> : null}
                </Space>
            ),
        },
        {
            title: 'Période',
            key: 'periode',
            render: (_: unknown, record: any) => (record.periodeDebut
                ? `${formatDate(record.periodeDebut)} au ${formatDate(record.periodeFin)}`
                : '—'),
        },
        {
            title: 'Mode',
            dataIndex: 'mode',
            width: 160,
            render: (v: string) => MODE_LABEL[v] ?? v,
        },
        {
            title: 'Montant',
            dataIndex: 'montant',
            align: 'right' as const,
            render: (v: number) => formatMontant(v),
        },
        {
            title: '',
            key: 'actions',
            width: 60,
            render: (_: unknown, record: any) => (
                <Tooltip title="Télécharger la facture">
                    <Button
                        size="small"
                        icon={<DownloadOutlined />}
                        onClick={() => downloadFacturePdf(record, societe)}
                    />
                </Tooltip>
            ),
        },
    ];

    const STATUT_MOIS: Record<string, { label: string; color: string }> = {
        PAYE: { label: 'Payé', color: 'green' },
        A_PAYER: { label: 'À payer', color: 'orange' },
        IMPAYE: { label: 'Impayé', color: 'red' },
    };

    const moisColumns = [
        {
            title: 'Mois',
            key: 'mois',
            render: (_: unknown, record: any) => (
                <Space size={4} wrap>
                    {`${formatDate(record.debut)} au ${formatDate(record.fin)}`}
                    {!dayjs(record.debut).isAfter(dayjs()) && dayjs(record.fin).isAfter(dayjs()) && <Tag color="blue">En cours</Tag>}
                </Space>
            ),
        },
        { title: 'Utilisateurs', dataIndex: 'nombreUtilisateurs', width: 110, render: (v: any) => v ?? '—' },
        { title: 'Techniciens', dataIndex: 'nombreTechniciens', width: 110, render: (v: any) => v ?? '—' },
        { title: 'Clients (portail)', dataIndex: 'nombreClients', width: 130, render: (v: any) => v ?? '—' },
        { title: 'Modules', dataIndex: 'modules', render: (v: string[]) => libellesModules((v || []).filter((m) => m !== MODULE_PARAMETRAGE)) },
        { title: 'Montant', dataIndex: 'montant', align: 'right' as const, width: 120, render: (v: number) => formatMontant(v) },
        {
            title: 'Statut',
            dataIndex: 'statut',
            width: 220,
            render: (v: string, record: any) => (
                <Space size={4} wrap>
                    <Tag color={STATUT_MOIS[v]?.color ?? 'default'}>
                        {STATUT_MOIS[v]?.label ?? v}{v === 'PAYE' && record.payeLe ? ` le ${formatDate(record.payeLe)}` : ''}
                    </Tag>
                    {v === 'PAYE' && record.typePaiement && <Tag color={TYPE_COLOR[record.typePaiement]}>{TYPE_LABEL[record.typePaiement]}</Tag>}
                </Space>
            ),
        },
    ];

    if (!societe) return <Spin />;

    return (
        <>
            <Card title={
                <Space>
                    <CreditCardOutlined /> Facturation
                    {societe.versionFree && <Tag color="blue">Abonnement gratuit</Tag>}
                </Space>
            }>
                {societe.versionFree && (
                    <Alert
                        type="info"
                        showIcon
                        style={{ marginBottom: 16 }}
                        message="Abonnement gratuit : les accès ne sont jamais bloqués"
                        description="Accordé par l'éditeur de moussAIllon : ni un abonnement non activé, ni une échéance impayée, ni une résiliation ne bloquent l'accès à l'application, et les modules s'ajoutent sans paiement. Les paiements restent possibles."
                    />
                )}
                <Descriptions title="Abonnement" column={1} bordered size="small">
                    <Descriptions.Item label="Date d'activation">
                        {actif ? formatDate(societe.abonnementActivationDate) : 'Au premier paiement'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Montant d'activation">
                        {formatMontant(societe.abonnementActivationMontant)}
                        {!actif && ' — payé avec le premier mois ou la première année'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Prochaine échéance">
                        {actif ? formatDate(societe.abonnementProchainPaiementDate) : '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Montant mensuel">
                        {formatMontant(societe.abonnementProchainPaiementMontant)}
                    </Descriptions.Item>
                    {effectifs.map((e) => (
                        <Descriptions.Item key={e.label} label={e.label}>
                            {e.nombre}
                        </Descriptions.Item>
                    ))}
                    <Descriptions.Item label="Statut">
                        <Space direction="vertical" size={4}>
                            {societe.abonnementResilie
                                ? <Tag color="red">Résilié le {formatDate(societe.abonnementResiliationDate)}</Tag>
                                : actif
                                    ? <Tag color="green">Actif</Tag>
                                    : societe.versionFree
                                        ? <Tag color="orange">Non activé</Tag>
                                        : <Tag color="orange">Non activé : accès limité à la facturation jusqu'au premier paiement</Tag>}
                            {actif && societe.abonnementAJour && (
                                <Tag color="green">Payé jusqu'au {formatDate(societe.abonnementProchainPaiementDate)}</Tag>
                            )}
                            {societe.abonnementResilie && societe.abonnementBlocageDate && (societe.accesBloque
                                ? <Tag color="volcano">Accès bloqué depuis le {formatDate(societe.abonnementBlocageDate)}</Tag>
                                : <Tag color="orange">Accès bloqué à partir du {formatDate(societe.abonnementBlocageDate)} (fin de la période de rétractation de 14 jours)</Tag>)}
                            {societe.abonnementBlocageImpayeDate && (societe.accesBloqueImpaye
                                ? <Tag color="volcano">Échéance impayée : accès limité à la facturation depuis le {formatDate(societe.abonnementBlocageImpayeDate)}</Tag>
                                : <Tag color="orange">Échéance dépassée : accès limité à la facturation à partir du {formatDate(societe.abonnementBlocageImpayeDate)}</Tag>)}
                        </Space>
                    </Descriptions.Item>
                </Descriptions>

                <Divider>Modules souscrits</Divider>

                <Checkbox.Group
                    value={modulesSelectionnes}
                    onChange={(values) => setModulesSelectionnes(values as string[])}
                    disabled={societe.abonnementResilie}
                    style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                >
                    {MODULES.map((m) => (
                        <Checkbox key={m.value} value={m.value} disabled={m.value === MODULE_PARAMETRAGE}>
                            {m.label} — {m.value === MODULE_PARAMETRAGE ? 'inclus' : `${formatMontant(prixModule(m.value))} / mois`}
                        </Checkbox>
                    ))}
                </Checkbox.Group>

                <Descriptions column={1} bordered size="small" style={{ marginTop: 16 }}>
                    {effectifs.map((e) => (
                        <Descriptions.Item key={e.label} label={`${e.label} (${e.nombre} × ${formatMontant(e.prix)})`}>
                            {formatMontant(e.nombre * e.prix)}
                        </Descriptions.Item>
                    ))}
                    <Descriptions.Item label="Modules">
                        {formatMontant(montantModules)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Total mensuel">
                        <strong>{formatMontant(montantMensuelSimule)}</strong>
                        {' '}— soit {formatMontant(montantMensuelSimule * moisFacturesAnnuel)} à l'année (1 mois offert)
                    </Descriptions.Item>
                </Descriptions>

                {ajoutEnRetard && (
                    <Alert
                        type="warning"
                        showIcon
                        style={{ marginTop: 16 }}
                        message="Réglez d'abord les échéances en retard pour ajouter des modules."
                    />
                )}
                {ajoutAPayer && (
                    <Alert
                        type="info"
                        showIcon
                        style={{ marginTop: 16 }}
                        message={`Les modules ajoutés (${libellesModules(modulesAjoutes)}) sont payés tout de suite : ${formatMontant(montantAjout)}`}
                        description={`Prix d'un mois entier pour le mois en cours et chaque mois suivant déjà payé (${moisPayesRestants.length} mois). Ils sont activés dès le paiement.`}
                    />
                )}

                <Space style={{ marginTop: 16 }}>
                    {ajoutAPayer ? (
                        <Button type="primary" icon={<CreditCardOutlined />} onClick={() => openPaiementModal('MODULES')}>
                            Payer et activer les modules — {formatMontant(montantAjout)}
                        </Button>
                    ) : (
                        <Popconfirm
                            title="Retirer des modules ?"
                            description={`Les utilisateurs perdront l'accès aux modules retirés : ${libellesModules(modulesRetires)}.`}
                            disabled={modulesRetires.length === 0}
                            onConfirm={handleEnregistrerModules}
                            okText="Confirmer"
                            cancelText="Non"
                        >
                            <Button
                                type="primary"
                                disabled={!modulesModifies || ajoutEnRetard}
                                loading={savingModules}
                                onClick={modulesRetires.length === 0 ? handleEnregistrerModules : undefined}
                            >
                                Enregistrer les modules
                            </Button>
                        </Popconfirm>
                    )}
                    {modulesModifies && (
                        <Button onClick={() => setModulesSelectionnes(societe.modules || [])}>
                            Annuler les modifications
                        </Button>
                    )}
                </Space>

                <Divider>Paiement</Divider>

                <Space>
                    <Button
                        type="primary"
                        icon={<CreditCardOutlined />}
                        onClick={() => openPaiementModal('MENSUEL')}
                        disabled={societe.abonnementResilie || modulesModifies}
                    >
                        {actif ? 'Payer ce mois' : 'Activer au mois'} — {formatMontant(montantMensuel)}
                    </Button>
                    <Button
                        icon={<CreditCardOutlined />}
                        onClick={() => openPaiementModal('ANNUEL')}
                        disabled={societe.abonnementResilie || modulesModifies}
                    >
                        {actif ? "Payer l'année" : "Activer à l'année"} — {formatMontant(montantAnnuel)} (1 mois offert)
                    </Button>
                    {societe.abonnementResilie && (
                        <Button icon={<ReloadOutlined />} onClick={handleReactiver}>
                            Réactiver l'abonnement
                        </Button>
                    )}
                    {!societe.abonnementResilie && (
                        <Popconfirm
                            title="Résilier l'abonnement ?"
                            description="Les accès resteront actifs pendant une période de rétractation de 14 jours, durant laquelle l'abonnement pourra être réactivé à tout moment."
                            onConfirm={handleResilier}
                            okText="Confirmer"
                            cancelText="Non"
                        >
                            <Button danger icon={<StopOutlined />}>
                                Résilier l'abonnement
                            </Button>
                        </Popconfirm>
                    )}
                </Space>

                {!actif && (
                    <div style={{ marginTop: 8, color: '#8c8c8c' }}>
                        Le premier paiement comprend les frais d'activation ({formatMontant(fraisActivation)}) :
                        l'abonnement démarre à sa date, et les mois sont ensuite comptés à partir de celle-ci.
                    </div>
                )}

                <Divider>Suivi mois par mois</Divider>

                <MosaicTable
                    rowKey={(record: any) => `${record.id ?? 'a-payer'}-${record.debut}`}
                    dataSource={societe.abonnementMois ?? []}
                    columns={moisColumns}
                    pagination={{ pageSize: 12, hideOnSinglePage: true }}
                    bordered
                    size="small"
                    locale={{ emptyText: "Aucun mois d'abonnement : l'abonnement n'est pas activé" }}
                />

                <Divider>Historique des paiements</Divider>

                <MosaicTable
                    rowKey="id"
                    dataSource={societe.paiements ?? []}
                    columns={historiqueColumns}
                    pagination={false}
                    bordered
                    size="small"
                    locale={{ emptyText: 'Aucun paiement enregistré' }}
                />
            </Card>

            {signatureModalOpen && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                }}>
                    <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: 540, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
                        <h3 style={{ marginTop: 0 }}>{labelPaiement}</h3>
                        {paiementType === 'MODULES' && (
                            <p>
                                Modules ajoutés : {libellesModules(modulesAjoutes)}, pour {moisPayesRestants.length} mois payé(s).
                                {modulesRetires.length > 0 && ` Les utilisateurs perdront l'accès aux modules retirés : ${libellesModules(modulesRetires)}.`}
                            </p>
                        )}

                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>
                                Mode de paiement
                            </label>
                            <Select
                                value={paiementMode}
                                onChange={handleModeChange}
                                options={getModeOptions(paiementType!)}
                                style={{ width: '100%' }}
                            />
                        </div>

                        {isExternalMode(paiementMode) ? (
                            <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, padding: 16, marginBottom: 16 }}>
                                <p style={{ margin: '0 0 12px' }}>
                                    Cliquez sur le bouton ci-dessous pour accéder à la page de paiement {MODE_LABEL[paiementMode]}.
                                    Une fois le paiement effectué, revenez ici et cliquez sur <strong>Confirmer</strong>.
                                </p>
                                {paiementEnLigne ? (
                                    <Button
                                        type="default"
                                        icon={<LinkOutlined />}
                                        loading={ouvertureEnLigne}
                                        onClick={ouvrirPaiementEnLigne}
                                    >
                                        Payer via {MODE_LABEL[paiementMode]} — {formatMontant(montantPaiement)}
                                    </Button>
                                ) : (
                                    <span style={{ color: '#ff4d4f' }}>
                                        Paiement {MODE_LABEL[paiementMode]} non configuré.
                                    </span>
                                )}
                            </div>
                        ) : (
                            <>
                                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>
                                    Signature
                                </label>
                                <canvas
                                    ref={signatureCanvasRef}
                                    style={{
                                        width: '100%', height: 160,
                                        border: '1px solid #d9d9d9', borderRadius: 4,
                                        display: 'block', cursor: 'crosshair', touchAction: 'none',
                                    }}
                                />
                            </>
                        )}

                        <Space style={{ marginTop: 16, justifyContent: 'flex-end', width: '100%' }}>
                            {!isExternalMode(paiementMode) && (
                                <Button onClick={clearSignatureCanvas}>Effacer la signature</Button>
                            )}
                            <Button onClick={() => setSignatureModalOpen(false)}>Annuler</Button>
                            <Button
                                type="primary"
                                loading={submitting}
                                onClick={handlePaiementConfirm}
                                disabled={isExternalMode(paiementMode) && !paiementEnLigne}
                            >
                                Confirmer — {formatMontant(montantPaiement)}
                            </Button>
                        </Space>
                    </div>
                </div>
            )}
        </>
    );
}
