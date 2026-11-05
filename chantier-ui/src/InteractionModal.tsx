import React, { useEffect, useRef, useState } from 'react';
import { Checkbox, Col, DatePicker, Form, Input, Modal, Row, Select, Space, message } from 'antd';
import dayjs from 'dayjs';
import { fetchWithAuth } from './api.ts';
import { Interaction, StatutInteraction, TYPES_INTERACTION, TypeInteraction, utilisateurConnecte } from './crm.tsx';

const FORMAT_DATE = 'YYYY-MM-DDTHH:mm:ss';

const requete = async (url: string, method: string, corps?: object) => {
    const r = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: corps ? JSON.stringify(corps) : undefined,
    });
    if (!r.ok) throw new Error((await r.text()) || 'Erreur ' + r.status);
    return r;
};

// Utilisateurs à qui confier une action
const useUtilisateurs = (actif: boolean) => {
    const [utilisateurs, setUtilisateurs] = useState<string[]>([]);
    useEffect(() => {
        if (!actif) return;
        fetchWithAuth('./interactions/utilisateurs')
            .then((r) => (r.ok ? r.json() : []))
            .then((data) => setUtilisateurs(Array.isArray(data) ? data : []))
            .catch(() => setUtilisateurs([]));
    }, [actif]);
    return utilisateurs;
};

const optionsTypes = TYPES_INTERACTION.map((t) => ({ value: t.value, label: <Space>{t.icon}{t.label}</Space> }));

interface ClientOption {
    id: number;
    nom: string;
}

interface InteractionModalProps {
    open: boolean;
    onClose: () => void;
    onSaved: () => void;
    // Échange à modifier ; sinon nouvel échange (FAITE) ou nouvelle action (A_FAIRE)
    interaction?: Interaction | null;
    statut?: StatutInteraction;
    // Client imposé (fiche client) ; sinon il est à choisir
    clientId?: number;
}

/** Saisie d'un échange avec un client, ou d'une action commerciale à faire. */
export function InteractionModal({ open, onClose, onSaved, interaction, statut = 'FAITE', clientId }: InteractionModalProps) {
    const [form] = Form.useForm();
    const [enregistrement, setEnregistrement] = useState(false);
    const [clients, setClients] = useState<ClientOption[]>([]);
    const recherche = useRef<ReturnType<typeof setTimeout> | null>(null);
    const utilisateurs = useUtilisateurs(open);
    const statutCourant: StatutInteraction = interaction?.statut ?? statut;
    const aFaire = statutCourant === 'A_FAIRE';

    useEffect(() => {
        if (!open) return;
        form.resetFields();
        if (interaction) {
            form.setFieldsValue({
                clientId: interaction.clientId,
                type: interaction.type,
                sujet: interaction.sujet,
                compteRendu: interaction.compteRendu,
                date: interaction.date ? dayjs(interaction.date) : dayjs(),
                utilisateur: interaction.utilisateur ?? undefined,
            });
            setClients([{ id: interaction.clientId, nom: interaction.clientNom }]);
        } else {
            form.setFieldsValue({
                clientId,
                type: 'APPEL',
                // Une action est à faire le lendemain par défaut, un échange vient d'avoir lieu
                date: aFaire ? dayjs().add(1, 'day').startOf('day').hour(9) : dayjs(),
                utilisateur: utilisateurConnecte() ?? undefined,
            });
        }
    }, [open, interaction, clientId, aFaire, form]);

    const chercherClients = (texte: string) => {
        if (recherche.current) clearTimeout(recherche.current);
        if (!texte.trim()) return;
        recherche.current = setTimeout(async () => {
            try {
                const r = await fetchWithAuth(`./clients/search?q=${encodeURIComponent(texte)}`);
                const data = await r.json();
                setClients(Array.isArray(data) ? data.map((c: ClientOption) => ({ id: c.id, nom: c.nom })) : []);
            } catch {
                // Recherche abandonnée
            }
        }, 300);
    };

    const enregistrer = async () => {
        const valeurs = await form.validateFields();
        const corps = {
            clientId: clientId ?? valeurs.clientId,
            type: valeurs.type as TypeInteraction,
            statut: statutCourant,
            sujet: valeurs.sujet,
            compteRendu: valeurs.compteRendu || null,
            date: valeurs.date ? valeurs.date.format(FORMAT_DATE) : null,
            utilisateur: valeurs.utilisateur ?? '',
        };
        setEnregistrement(true);
        try {
            if (interaction) {
                await requete(`./interactions/${interaction.id}`, 'PUT', corps);
            } else {
                await requete('./interactions', 'POST', corps);
            }
            message.success(aFaire ? 'Action enregistrée' : 'Échange enregistré');
            onSaved();
        } catch (e: any) {
            message.error("Erreur lors de l'enregistrement : " + e.message);
        } finally {
            setEnregistrement(false);
        }
    };

    let titre = aFaire ? 'Planifier une action' : 'Noter un échange';
    if (interaction) {
        titre = aFaire ? "Modifier l'action" : "Modifier l'échange";
    }

    return (
        <Modal
            open={open}
            title={titre}
            okText="Enregistrer"
            cancelText="Annuler"
            confirmLoading={enregistrement}
            onOk={enregistrer}
            onCancel={onClose}
            destroyOnHidden
        >
            <Form form={form} layout="vertical">
                {!clientId && (
                    <Form.Item name="clientId" label="Client ou prospect" rules={[{ required: true, message: 'Le client est requis' }]}>
                        <Select
                            showSearch
                            placeholder="Rechercher un client par son nom"
                            filterOption={false}
                            onSearch={chercherClients}
                            notFoundContent={null}
                            disabled={!!interaction}
                            options={clients.map((c) => ({ value: c.id, label: c.nom }))}
                        />
                    </Form.Item>
                )}
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item name="type" label="Type" rules={[{ required: true }]}>
                            <Select options={optionsTypes} />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="date" label={aFaire ? 'Échéance' : 'Date'} rules={[{ required: true, message: 'La date est requise' }]}>
                            <DatePicker showTime={{ format: 'HH:mm' }} format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                </Row>
                <Form.Item name="sujet" label={aFaire ? 'Action' : 'Sujet'} rules={[{ required: true, message: 'Le sujet est requis' }]}>
                    <Input placeholder={aFaire ? 'Ex : rappeler pour le devis d’hivernage' : 'Ex : demande de devis pour un carénage'} />
                </Form.Item>
                <Form.Item name="utilisateur" label={aFaire ? 'Responsable' : 'Par'}>
                    <Select allowClear options={utilisateurs.map((u) => ({ value: u, label: u }))} placeholder="Utilisateur" />
                </Form.Item>
                <Form.Item name="compteRendu" label={aFaire ? 'Détails' : 'Compte rendu'}>
                    <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} />
                </Form.Item>
            </Form>
        </Modal>
    );
}

interface TerminerActionModalProps {
    action: Interaction | null;
    onClose: () => void;
    onDone: () => void;
}

/** L'action est faite : compte rendu, et action de suivi à planifier si besoin. */
export function TerminerActionModal({ action, onClose, onDone }: TerminerActionModalProps) {
    const [form] = Form.useForm();
    const [enregistrement, setEnregistrement] = useState(false);
    const suivi = Form.useWatch('suivi', form);
    const utilisateurs = useUtilisateurs(!!action);

    useEffect(() => {
        if (!action) return;
        form.resetFields();
        form.setFieldsValue({
            compteRendu: action.compteRendu,
            suivi: false,
            typeSuivi: action.type,
            dateSuivi: dayjs().add(7, 'day').startOf('day').hour(9),
            utilisateurSuivi: action.utilisateur ?? utilisateurConnecte() ?? undefined,
        });
    }, [action, form]);

    const terminer = async () => {
        if (!action) return;
        const valeurs = await form.validateFields();
        setEnregistrement(true);
        try {
            await requete(`./interactions/${action.id}/terminer`, 'POST', { compteRendu: valeurs.compteRendu || null });
            if (valeurs.suivi) {
                await requete('./interactions', 'POST', {
                    clientId: action.clientId,
                    type: valeurs.typeSuivi,
                    statut: 'A_FAIRE',
                    sujet: valeurs.sujetSuivi,
                    date: valeurs.dateSuivi.format(FORMAT_DATE),
                    utilisateur: valeurs.utilisateurSuivi ?? '',
                });
            }
            message.success(valeurs.suivi ? 'Action faite, suivi planifié' : 'Action faite');
            onDone();
        } catch (e: any) {
            message.error("Erreur lors de l'enregistrement : " + e.message);
        } finally {
            setEnregistrement(false);
        }
    };

    return (
        <Modal
            open={!!action}
            title={action ? `Action faite : ${action.sujet}` : ''}
            okText="Marquer comme faite"
            cancelText="Annuler"
            confirmLoading={enregistrement}
            onOk={terminer}
            onCancel={onClose}
            destroyOnHidden
        >
            <Form form={form} layout="vertical">
                <Form.Item name="compteRendu" label="Compte rendu">
                    <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} placeholder="Ce qui a été dit ou convenu" />
                </Form.Item>
                <Form.Item name="suivi" valuePropName="checked">
                    <Checkbox>Planifier une action de suivi</Checkbox>
                </Form.Item>
                {suivi && (
                    <>
                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item name="typeSuivi" label="Type" rules={[{ required: true }]}>
                                    <Select options={optionsTypes} />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="dateSuivi" label="Échéance" rules={[{ required: true, message: "L'échéance est requise" }]}>
                                    <DatePicker showTime={{ format: 'HH:mm' }} format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Form.Item name="sujetSuivi" label="Action de suivi" rules={[{ required: true, message: "L'action est requise" }]}>
                            <Input placeholder="Ex : relancer pour la signature du devis" />
                        </Form.Item>
                        <Form.Item name="utilisateurSuivi" label="Responsable">
                            <Select allowClear options={utilisateurs.map((u) => ({ value: u, label: u }))} placeholder="Utilisateur" />
                        </Form.Item>
                    </>
                )}
            </Form>
        </Modal>
    );
}
