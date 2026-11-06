import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Checkbox, Col, DatePicker, Form, Input, Row, Space, Statistic, Typography, message } from 'antd';
import { DownloadOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import MosaicTable from './MosaicTable.tsx';
import { fetchWithAuth } from './api.ts';
import { paginationConfig } from './pagination.ts';
import { formatDate, formatEuro } from './kpis-commun.tsx';

export interface Ecriture {
    numero: number;
    date: string;
    journal: string;
    journalLibelle: string;
    compte: string;
    compteLibelle: string;
    compteAuxiliaire?: string;
    compteAuxiliaireLibelle?: string;
    piece: string;
    libelle: string;
    debit: number;
    credit: number;
}

// Plan comptable de l'export : codes des journaux et comptes généraux du dossier du comptable
const JOURNAUX = [
    { name: 'journalVentes', label: 'Journal des ventes', aide: 'Factures et avoirs' },
    { name: 'journalBanque', label: 'Journal de banque', aide: 'Chèques, virements et cartes' },
    { name: 'journalCaisse', label: 'Journal de caisse', aide: 'Espèces' },
];

const COMPTES = [
    { name: 'compteClients', label: 'Clients', aide: 'Compte collectif, chaque client en compte auxiliaire' },
    { name: 'comptePrestations', label: 'Prestations', aide: "Main d'œuvre, hivernage et gardiennage" },
    { name: 'compteMarchandises', label: 'Marchandises', aide: 'Pièces, accessoires, bateaux et moteurs neufs' },
    { name: 'compteOccasion', label: "Ventes d'occasion", aide: "Bateaux, moteurs et articles d'occasion" },
    { name: 'compteTvaCollectee', label: 'TVA collectée', aide: 'TVA des factures et avoirs' },
    { name: 'compteBanque', label: 'Banque', aide: 'Règlements par chèque, virement ou carte' },
    { name: 'compteCaisse', label: 'Caisse', aide: 'Règlements en espèces' },
];

const REGLE_JOURNAL = { pattern: /^[A-Za-z0-9]{1,10}$/, message: '1 à 10 lettres ou chiffres' };
// Un compte du FEC commence par les 3 chiffres du plan comptable général
const REGLE_COMPTE = { pattern: /^[0-9]{3}[A-Za-z0-9]{0,17}$/, message: 'Les 3 chiffres du plan comptable, puis 17 lettres ou chiffres au plus' };

/** Mois précédent : la période que le comptable reçoit chaque mois. */
export const moisPrecedent = (): [dayjs.Dayjs, dayjs.Dayjs] => {
    const mois = dayjs().subtract(1, 'month');
    return [mois.startOf('month'), mois.endOf('month')];
};

const messageErreur = async (reponse: Response) => {
    try {
        const corps = await reponse.json();
        return corps.error || corps.message || `Erreur ${reponse.status}`;
    } catch {
        return `Erreur ${reponse.status}`;
    }
};

// Nom du fichier donné par le serveur (SIREN, « FEC », date de fin), à défaut construit ici
const nomFichier = (reponse: Response, fin: dayjs.Dayjs) =>
    /filename="([^"]+)"/.exec(reponse.headers.get('Content-Disposition') || '')?.[1] ?? `FEC${fin.format('YYYYMMDD')}.txt`;

export default function ExportComptable() {
    const [periode, setPeriode] = useState<[dayjs.Dayjs, dayjs.Dayjs]>(moisPrecedent);
    const [reglements, setReglements] = useState(false);
    const [ecritures, setEcritures] = useState<Ecriture[]>([]);
    const [loading, setLoading] = useState(false);
    const [telechargement, setTelechargement] = useState(false);
    const [enregistrement, setEnregistrement] = useState(false);
    const [parametresForm] = Form.useForm();

    const debut = periode[0].format('YYYY-MM-DD');
    const fin = periode[1].format('YYYY-MM-DD');
    const requete = `debut=${debut}&fin=${fin}&reglements=${reglements}`;

    const charger = useCallback(() => {
        setLoading(true);
        fetchWithAuth(`./export-comptable/ecritures?${requete}`)
            .then(async (r) => { if (!r.ok) throw new Error(await messageErreur(r)); return r.json(); })
            .then(setEcritures)
            .catch((e) => message.error('Erreur : ' + e.message))
            .finally(() => setLoading(false));
    }, [requete]);

    useEffect(() => { charger(); }, [charger]);

    useEffect(() => {
        fetchWithAuth('./export-comptable/parametres')
            .then(async (r) => { if (!r.ok) throw new Error(await messageErreur(r)); return r.json(); })
            .then((parametres) => parametresForm.setFieldsValue(parametres))
            .catch((e) => message.error('Erreur : ' + e.message));
    }, [parametresForm]);

    const telecharger = async () => {
        setTelechargement(true);
        try {
            const r = await fetchWithAuth(`./export-comptable/fec?${requete}`);
            if (!r.ok) throw new Error(await messageErreur(r));
            const url = URL.createObjectURL(await r.blob());
            const lien = document.createElement('a');
            lien.href = url;
            lien.download = nomFichier(r, periode[1]);
            document.body.appendChild(lien);
            lien.click();
            document.body.removeChild(lien);
            URL.revokeObjectURL(url);
        } catch (e: any) {
            message.error('Erreur : ' + e.message);
        } finally {
            setTelechargement(false);
        }
    };

    const enregistrer = async (values: Record<string, string>) => {
        setEnregistrement(true);
        try {
            const r = await fetchWithAuth('./export-comptable/parametres', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });
            if (!r.ok) throw new Error(await messageErreur(r));
            parametresForm.setFieldsValue(await r.json());
            message.success('Le plan comptable a été enregistré.');
            charger();
        } catch (e: any) {
            message.error('Erreur : ' + e.message);
        } finally {
            setEnregistrement(false);
        }
    };

    const totalDebit = ecritures.reduce((s, e) => s + e.debit, 0);
    const totalCredit = ecritures.reduce((s, e) => s + e.credit, 0);
    const nombrePieces = new Set(ecritures.map((e) => e.numero)).size;
    const lignes = useMemo(() => ecritures.map((e, index) => ({ ...e, cle: index })), [ecritures]);

    const columns = [
        { title: 'N°', dataIndex: 'numero', key: 'numero', align: 'right' as const },
        { title: 'Date', dataIndex: 'date', key: 'date', render: formatDate },
        { title: 'Journal', dataIndex: 'journal', key: 'journal' },
        { title: 'Compte', dataIndex: 'compte', key: 'compte', render: (v: string, e: Ecriture) => <span title={e.compteLibelle}>{v}</span> },
        { title: 'Compte auxiliaire', dataIndex: 'compteAuxiliaire', key: 'compteAuxiliaire',
            render: (v: string | undefined, e: Ecriture) => (v ? `${v} ${e.compteAuxiliaireLibelle ?? ''}` : '') },
        { title: 'Pièce', dataIndex: 'piece', key: 'piece' },
        { title: 'Libellé', dataIndex: 'libelle', key: 'libelle' },
        { title: 'Débit', dataIndex: 'debit', key: 'debit', align: 'right' as const, render: (v: number) => (v ? formatEuro(v) : '') },
        { title: 'Crédit', dataIndex: 'credit', key: 'credit', align: 'right' as const, render: (v: number) => (v ? formatEuro(v) : '') },
    ];

    const champ = (name: string, label: string, aide: string, regle: { pattern: RegExp; message: string }, longueur: number) => (
        <Col xs={24} md={12} lg={8} key={name}>
            <Form.Item name={name} label={label} extra={aide} rules={[{ required: true, message: 'Requis' }, regle]}>
                <Input maxLength={longueur} />
            </Form.Item>
        </Col>
    );

    return (
        <div>
            <Typography.Title level={3}>Export comptable</Typography.Title>
            <Card size="small" style={{ marginBottom: 16 }}>
                <Typography.Paragraph type="secondary">
                    Écritures des factures et avoirs émis sur la période (journal des ventes), à transmettre au comptable.
                    Le fichier est au format FEC (fichier des écritures comptables, article A 47 A-1 du livre des
                    procédures fiscales), que les logiciels comptables importent. Le chiffre d'affaires HT est ventilé
                    entre prestations, marchandises et ventes d'occasion selon les lignes des factures.
                </Typography.Paragraph>
                <Row gutter={[12, 12]} align="middle">
                    <Col xs={24} md={8}>
                        <DatePicker.RangePicker
                            style={{ width: '100%' }}
                            format="DD/MM/YYYY"
                            allowClear={false}
                            value={periode}
                            onChange={(v) => { if (v?.[0] && v[1]) setPeriode([v[0], v[1]]); }}
                        />
                    </Col>
                    <Col xs={24} md={10}>
                        <Checkbox checked={reglements} onChange={(e) => setReglements(e.target.checked)}>
                            Inclure les règlements (journaux de banque et de caisse)
                        </Checkbox>
                    </Col>
                    <Col>
                        <Space>
                            <Button title="Recharger" icon={<ReloadOutlined />} loading={loading} onClick={charger} />
                            <Button type="primary" icon={<DownloadOutlined />} loading={telechargement}
                                disabled={ecritures.length === 0} onClick={telecharger}>
                                Télécharger le FEC
                            </Button>
                        </Space>
                    </Col>
                </Row>
                {reglements && (
                    <Alert
                        style={{ marginTop: 12 }}
                        type="warning"
                        showIcon
                        title="N'exportez les règlements que si votre comptable ne saisit pas déjà la banque à partir des relevés : les encaissements seraient sinon comptés deux fois."
                    />
                )}
            </Card>
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} md={6}><Card size="small"><Statistic title="Pièces" value={nombrePieces} /></Card></Col>
                <Col xs={24} md={6}><Card size="small"><Statistic title="Écritures" value={ecritures.length} /></Card></Col>
                <Col xs={24} md={6}><Card size="small"><Statistic title="Total débit" value={formatEuro(totalDebit)} /></Card></Col>
                <Col xs={24} md={6}><Card size="small"><Statistic title="Total crédit" value={formatEuro(totalCredit)} /></Card></Col>
            </Row>
            <MosaicTable
                rowKey="cle"
                loading={loading}
                dataSource={lignes}
                columns={columns}
                pagination={paginationConfig(50)}
                bordered
            />
            <Card title="Plan comptable" size="small" style={{ marginTop: 16 }}>
                <Typography.Paragraph type="secondary">
                    Codes des journaux et numéros des comptes de l'export, à aligner sur le dossier du comptable.
                </Typography.Paragraph>
                <Form form={parametresForm} layout="vertical" onFinish={enregistrer}>
                    <Row gutter={16}>
                        {JOURNAUX.map(({ name, label, aide }) => champ(name, label, aide, REGLE_JOURNAL, 10))}
                    </Row>
                    <Row gutter={16}>
                        {COMPTES.map(({ name, label, aide }) => champ(name, label, aide, REGLE_COMPTE, 20))}
                    </Row>
                    <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={enregistrement}>
                        Enregistrer
                    </Button>
                </Form>
            </Card>
        </div>
    );
}
