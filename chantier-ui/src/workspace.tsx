import { fetchWithAuth } from './api.ts';
import { chantierMemorise } from './chantier.ts';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Layout, Input, Col, Row, Image, Menu, Form, Modal, message, ConfigProvider, Grid, theme as antdTheme, Switch as AntSwitch } from 'antd';
import { UserOutlined, TeamOutlined, HomeOutlined, RocketOutlined, SettingOutlined, ToolOutlined, StockOutlined, NotificationOutlined, TruckOutlined, ReadOutlined, ShopOutlined, DisconnectOutlined, CalendarOutlined, FileDoneOutlined, CheckSquareOutlined, HourglassOutlined, ShoppingCartOutlined, MailOutlined, SendOutlined, BankOutlined, NodeIndexOutlined, DatabaseOutlined, DollarOutlined, AppstoreOutlined, SolutionOutlined, RollbackOutlined, GiftOutlined, AuditOutlined, WalletOutlined, ApiOutlined, ReconciliationOutlined, FundOutlined, LineChartOutlined, BarChartOutlined, BellOutlined, ScheduleOutlined } from '@ant-design/icons';
import { NavigationContext } from './navigation-context.tsx';
import Icon from '@ant-design/icons';
import { ReactComponent as BoatOutlined } from './boat.svg';
import { ReactComponent as EngineOutlined } from './moteur.svg';
import { ReactComponent as ParcOutlined } from './parc.svg';
import { ReactComponent as TailerOutlined } from './remorque.svg';
import { Result } from 'antd';
import GlobalSearch from './global-search.tsx';
import { VERSION_LABEL } from './version.ts';
import Clients from './clients.tsx';
import Produits from './catalogue-produits.tsx';
import Fournisseurs from './fournisseurs.tsx';
import Societe from './societe.tsx';
import Facturation from './facturation.tsx';
import Reglements from './reglements.tsx';
import Connecteurs from './connecteurs.tsx';
import RapprochementBancaire from './rapprochement-bancaire.tsx';
import KpisFinanciers from './kpis-financiers.tsx';
import KpisCommerciaux from './kpis-commerciaux.tsx';
import KpisAtelier from './kpis-atelier.tsx';
import Utilisateurs from './utilisateurs.tsx';
import Forfaits from './forfaits.tsx';
import Packages from './packages.tsx';
import BateauxClients from './clients-bateaux.tsx';
import ClientsMoteurs from './clients-moteurs.tsx';
import RemorquesClients from './clients-remorques.tsx';
import Techniciens from './techniciens.tsx';
import MainOeuvres from './main-oeuvres.tsx';
import Vente from './vente.tsx';
import Avoirs from './avoirs.tsx';
import Relances from './relances.tsx';
import ActionsCommerciales from './actions-commerciales.tsx';
import Planning from './planning.tsx';
import Comptoir from './comptoir.tsx';
import Dashboard from './dashboard.tsx';
import Annonces from './annonces.tsx';
import Campagnes from './campagnes.tsx';
import CommandesFournisseur from './commandes-fournisseur.tsx';
import Stock from './stock.tsx';
import Emails from './emails.tsx';
import SequenceEmails from './sequence-emails.tsx';
import ReferenceValeurs from './reference-valeurs.tsx';
import ChatbotWidget from './home.tsx';
import { hasModule } from './modules.ts';

export function demo() {
    message.warning("Vous êtes sur une version de démonstration de moussAIllon. Il n'est pas possible d'ajouter ou supprimer des éléments.")
}

type UserTheme = 'LIGHT' | 'DARK';

// Chaque groupe du menu correspond à un module : seuls ceux auxquels l'utilisateur a accès sont affichés.
const MENU_ITEMS = [
  { key: '/dashboard', label: 'Accueil', icon: <HomeOutlined/> },
  { key: 'Vente', label: 'Vente', icon: <DollarOutlined/>, module: 'VENTE', children: [
    { key: '/comptoir', label: 'Comptoir', icon: <ShopOutlined/> },
    { key: '/prestations', label: 'Transactions/Prestations', icon: <SolutionOutlined/> },
    { key: '/avoirs', label: 'Avoirs', icon: <RollbackOutlined/> },
    { key: '/relances', label: 'Relances', icon: <BellOutlined/> },
    { key: '/clients', label: 'Clients', icon: <TeamOutlined /> },
    { key: '/actions-commerciales', label: 'Actions commerciales', icon: <ScheduleOutlined /> },
  ]},
  { key: 'parc', label: 'Parc', icon: <Icon component={ ParcOutlined } />, module: 'PARC', children: [
    { key: '/clients/bateaux', label: 'Bateaux', icon: <Icon component={ BoatOutlined } />},
    { key: '/clients/moteurs', label: 'Moteurs', icon: <Icon component={ EngineOutlined } /> },
    { key: '/clients/remorques', label: 'Remorques', icon: <Icon component={ TailerOutlined } /> }
  ] },
  { key: 'catalogue', label: 'Catalogue', icon: <ReadOutlined/>, module: 'CATALOGUE', children: [
    { key: '/catalogue/produits', label: 'Produits', icon: <AppstoreOutlined /> },
    { key: '/catalogue/packages', label: 'Packages', icon: <GiftOutlined /> },
    { key: '/main-oeuvres', label: "Main d'Oeuvres", icon: <HourglassOutlined/> },
    { key: '/forfaits', label: 'Forfaits', icon: <FileDoneOutlined/> },
    { key: '/catalogue/fournisseurs', label: 'Fournisseurs', icon: <TruckOutlined/> },
    { key: '/commandes-fournisseur', label: 'Commandes Fournisseur', icon: <ShoppingCartOutlined/> },
    { key: '/stock', label: 'Stock', icon: <StockOutlined/> },
  ]},
  { key: 'atelier', label: 'Atelier', icon: <ToolOutlined/>, module: 'ATELIER', children: [
    { key: '/techniciens', label: 'Equipe', icon: <TeamOutlined/> },
    { key: '/planning', label: 'Planning', icon: <CalendarOutlined/> },
    { key: '/kpis-atelier', label: 'KPIs atelier', icon: <BarChartOutlined/> },
  ] },
  { key: 'market', label: 'Marketing', icon: <RocketOutlined/>, module: 'MARKETING', children: [
    { key: '/annonces', label: 'Petites annonces', icon: <NotificationOutlined/> },
    { key: '/campagnes', label: 'Campagnes', icon: <SendOutlined/> },
    { key: '/sequence-emails', label: 'Séquence emails', icon: <NodeIndexOutlined/> },
    { key: '/kpis-commerciaux', label: 'KPIs commerciaux', icon: <LineChartOutlined/> }
  ] },
  { key: 'comptabilite', label: 'Comptabilité', icon: <AuditOutlined/>, module: 'COMPTABILITE', children: [
    { key: '/reglements', label: 'Règlements', icon: <WalletOutlined/> },
    { key: '/rapprochement-bancaire', label: 'Rapprochement bancaire', icon: <ReconciliationOutlined/> },
    { key: '/kpis-financiers', label: 'KPIs financiers', icon: <FundOutlined/> },
  ] },
  { key: 'parametrage', label: 'Paramétrage', icon: <SettingOutlined/>, module: 'PARAMETRAGE', children: [
    { key: '/societe', label: 'Société', icon: <BankOutlined/> },
    { key: '/facturation', label: 'Facturation', icon: <DollarOutlined/> },
    { key: '/utilisateurs', label: 'Utilisateurs', icon: <UserOutlined/> },
    { key: '/emails', label: 'Emails', icon: <MailOutlined/> },
    { key: '/connecteurs', label: 'Connecteurs', icon: <ApiOutlined/> },
    { key: '/reference-valeurs', label: 'Valeurs de Référence', icon: <DatabaseOutlined/> }
  ] }
];

// Module requis par chaque page, déduit du groupe du menu qui la contient.
const PAGE_MODULE: Record<string, string> = Object.fromEntries(
    MENU_ITEMS.flatMap(item => (item.children || []).map(child => [ child.key, item.module ]))
);

function SideMenu(props) {

    const [ collapsed, setCollapsed ] = useState(false);
    // Sous le breakpoint md, le menu est replié à largeur nulle et s'ouvre par-dessus le contenu
    const [ isMobile, setIsMobile ] = useState(false);
    const [ siderWidth, setSiderWidth ] = useState(() => {
        const saved = localStorage.getItem('siderWidth');
        return saved ? parseInt(saved, 10) : 200;
    });
    const isResizing = useRef(false);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isResizing.current = true;
        const onMouseMove = (e: MouseEvent) => {
            if (!isResizing.current) return;
            const newWidth = Math.min(Math.max(e.clientX, 120), 400);
            setSiderWidth(newWidth);
        };
        const onMouseUp = () => {
            isResizing.current = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }, []);

    useEffect(() => {
        localStorage.setItem('siderWidth', String(siderWidth));
    }, [siderWidth]);

    // Abonnement non activé ou impayé : seule la facturation reste accessible
    const items = props.accesLimite
        ? [ { key: '/facturation', label: 'Facturation', icon: <DollarOutlined/>, module: 'PARAMETRAGE' } ]
        : MENU_ITEMS;
    const menuItems = items
        .filter(item => !item.module || hasModule(props.modules, item.module))
        .map(({ module, ...item }) => item);

    return(
        <div style={{ display: 'flex', position: 'relative' }}>
            <Layout.Sider
                className={props.theme === 'DARK' ? 'sidebar-dark' : 'sidebar-light'}
                theme={props.theme === 'DARK' ? 'dark' : 'light'}
                collapsible={true}
                collapsed={collapsed}
                onCollapse={newValue => setCollapsed(newValue)}
                breakpoint="md"
                onBreakpoint={setIsMobile}
                collapsedWidth={isMobile ? 0 : 80}
                width={isMobile ? 240 : siderWidth}
                style={isMobile ? { position: 'absolute', top: 0, bottom: 0, insetInlineStart: 0, zIndex: 100 } : undefined}
            >
                <Menu
                    theme={props.theme === 'DARK' ? 'dark' : 'light'}
                    items={menuItems}
                    selectedKeys={[props.currentPage]}
                    mode="inline"
                    onClick={({ key }) => {
                        if (key.startsWith('/')) {
                            props.onNavigate(key);
                            if (isMobile) setCollapsed(true);
                        }
                    }}
                />
            </Layout.Sider>
            {!collapsed && !isMobile && (
                <div
                    className="sider-resize-handle"
                    onMouseDown={handleMouseDown}
                />
            )}
        </div>
    );

}

function Header(props) {

    const [ preferencesVisible, setPreferencesVisible ] = useState(false);
    const [ preferencesLoading, setPreferencesLoading ] = useState(false);
    const [ preferencesForm ] = Form.useForm();
    const [ selectedTheme, setSelectedTheme ] = useState<UserTheme>(props.theme || 'LIGHT');
    const [ formDirty, setFormDirty ] = useState(false);
    // Sous le breakpoint md, le logo est réduit et la recherche prend la place restante
    const isMobile = Grid.useBreakpoint().md === false;

    const handlePreferencesCancel = () => {
        if (formDirty) {
            Modal.confirm({
                title: "Modifications non enregistrées",
                content: "Vous avez des modifications non enregistrées. Voulez-vous vraiment fermer ?",
                okText: "Fermer",
                cancelText: "Annuler",
                onOk: () => {
                    setFormDirty(false);
                    preferencesForm.resetFields();
                    setPreferencesVisible(false);
                },
            });
        } else {
            preferencesForm.resetFields();
            setPreferencesVisible(false);
        }
    };

    const chantier = chantierMemorise();
    const menuUser = [
              { key: 'user', label: props.user, icon: <UserOutlined />, children: [
                ...(chantier ? [{ key: 'chantier', label: 'Chantier : ' + chantier, icon: <ShopOutlined/>, disabled: true }] : []),
                { key: 'preferences', label: 'Préférences', icon: <SettingOutlined/> },
                { key: 'deconnexion', label: 'Déconnexion', icon: <DisconnectOutlined/> }
              ]}
    ];

    return(
        <Layout.Header style={{
            height: "72px",
            lineHeight: '72px',
            background: props.theme === 'DARK' ? '#1f1f1f' : '#fff',
            color: props.theme === 'DARK' ? '#f5f5f5' : undefined,
            padding: isMobile ? "0 12px" : "0 24px",
            margin: "16px 20px 8px",
            borderRadius: 14,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
        }}>
            <Row align="middle" justify="center" wrap={false} gutter={isMobile ? 8 : 0} style={{ height: '100%' }}>
                <Col {...(isMobile ? { flex: 'none' } : { span: 3 })}><Image src={process.env.PUBLIC_URL + '/logo.png'} preview={false} width={isMobile ? 44 : 75}/></Col>
                <Col {...(isMobile ? { flex: 'auto' } : { span: 19 })}><GlobalSearch /></Col>
                <Col {...(isMobile ? { flex: '48px' } : { span: 2 })}><Menu items={menuUser} onClick={(e) => {
                    if (e.key === 'deconnexion') {
                        props.setUser(null);
                    }
                    if (e.key === 'preferences') {
                        setSelectedTheme(props.theme || 'LIGHT');
                        preferencesForm.setFieldsValue({
                            currentPassword: '',
                            newPassword: '',
                            confirmPassword: ''
                        });
                        setFormDirty(false);
                        setPreferencesVisible(true);
                    }
                }} /></Col>
            </Row>
            <Modal
                open={preferencesVisible}
                title="Préférences"
                okText="Enregistrer"
                cancelText="Fermer"
                confirmLoading={preferencesLoading}
                onOk={() => preferencesForm.submit()}
                onCancel={handlePreferencesCancel}
                destroyOnHidden
            >
                <Form
                    form={preferencesForm}
                    layout="vertical"
                    onValuesChange={() => setFormDirty(true)}
                    onFinish={(values) => {
                        const shouldChangePassword = !!values.newPassword;
                        const shouldChangeTheme = selectedTheme !== props.theme;

                        if (!shouldChangePassword && !shouldChangeTheme) {
                            message.info('Aucune modification à enregistrer.');
                            return;
                        }

                        setPreferencesLoading(true);

                        const updatePassword = () => {
                            if (!shouldChangePassword) {
                                return Promise.resolve();
                            }
                            return fetchWithAuth(`/users/${encodeURIComponent(props.user)}/change-password`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    currentPassword: values.currentPassword,
                                    newPassword: values.newPassword
                                })
                            }).then(async (response) => {
                                if (!response.ok) {
                                    const errorText = await response.text();
                                    throw new Error(errorText || ('Erreur (code ' + response.status + ')'));
                                }
                            });
                        };

                        const updateTheme = () => {
                            if (!shouldChangeTheme) {
                                return Promise.resolve();
                            }
                            return fetchWithAuth(`/users/${encodeURIComponent(props.user)}`)
                                .then(async (response) => {
                                    if (!response.ok) {
                                        const errorText = await response.text();
                                        throw new Error(errorText || ('Erreur (code ' + response.status + ')'));
                                    }
                                    return response.json();
                                })
                                .then((userData) => {
                                    return fetchWithAuth(`/users/${encodeURIComponent(props.user)}`, {
                                        method: 'PUT',
                                        headers: {
                                            'Content-Type': 'application/json'
                                        },
                                        body: JSON.stringify({
                                            ...userData,
                                            theme: selectedTheme
                                        })
                                    });
                                })
                                .then(async (response) => {
                                    if (!response.ok) {
                                        const errorText = await response.text();
                                        throw new Error(errorText || ('Erreur (code ' + response.status + ')'));
                                    }
                                });
                        };

                        Promise.all([ updatePassword(), updateTheme() ])
                            .then(() => {
                                if (shouldChangePassword && shouldChangeTheme) {
                                    message.success('Préférences mises à jour.');
                                } else if (shouldChangePassword) {
                                    message.success('Mot de passe mis à jour.');
                                } else {
                                    message.success('Thème mis à jour.');
                                }
                                if (shouldChangeTheme) {
                                    props.setTheme(selectedTheme);
                                }
                                setFormDirty(false);
                                preferencesForm.resetFields();
                                setPreferencesVisible(false);
                            })
                            .catch((error) => {
                                message.error('Une erreur est survenue: ' + error.message);
                            })
                            .finally(() => {
                                setPreferencesLoading(false);
                            });
                    }}
                >
                    <Form.Item
                        name="currentPassword"
                        label="Mot de passe actuel"
                        rules={[
                            ({ getFieldValue }) => ({
                                validator(_, value) {
                                    const hasNewPassword = !!getFieldValue('newPassword');
                                    if (!hasNewPassword || (value && value.trim())) {
                                        return Promise.resolve();
                                    }
                                    return Promise.reject(new Error('Le mot de passe actuel est requis pour modifier le mot de passe.'));
                                }
                            })
                        ]}
                    >
                        <Input.Password autoComplete="current-password" />
                    </Form.Item>
                    <Form.Item
                        name="newPassword"
                        label="Nouveau mot de passe"
                        rules={[
                            ({ getFieldValue }) => ({
                                validator(_, value) {
                                    const hasCurrentPassword = !!getFieldValue('currentPassword');
                                    if (!value && !hasCurrentPassword) {
                                        return Promise.resolve();
                                    }
                                    if (!value) {
                                        return Promise.reject(new Error('Le nouveau mot de passe est requis.'));
                                    }
                                    if (value.length < 6) {
                                        return Promise.reject(new Error('Le mot de passe doit contenir au moins 6 caractères.'));
                                    }
                                    return Promise.resolve();
                                }
                            })
                        ]}
                    >
                        <Input.Password autoComplete="new-password" />
                    </Form.Item>
                    <Form.Item
                        name="confirmPassword"
                        label="Confirmation du mot de passe"
                        dependencies={['newPassword']}
                        rules={[
                            ({ getFieldValue }) => ({
                                validator(_, value) {
                                    const nextPassword = getFieldValue('newPassword');
                                    if (!nextPassword && !value) {
                                        return Promise.resolve();
                                    }
                                    if (!value) {
                                        return Promise.reject(new Error('La confirmation du mot de passe est requise.'));
                                    }
                                    if (nextPassword === value) {
                                        return Promise.resolve();
                                    }
                                    return Promise.reject(new Error('La confirmation ne correspond pas au nouveau mot de passe.'));
                                }
                            })
                        ]}
                    >
                        <Input.Password autoComplete="new-password" />
                    </Form.Item>
                    <Form.Item label="Thème">
                        <AntSwitch
                            checked={selectedTheme === 'DARK'}
                            checkedChildren="Sombre"
                            unCheckedChildren="Clair"
                            onChange={(checked) => setSelectedTheme(checked ? 'DARK' : 'LIGHT')}
                        />
                    </Form.Item>
                </Form>
            </Modal>
        </Layout.Header>
    );

}

export default function Workspace(props) {
    const [ theme, setTheme ] = useState<UserTheme>('LIGHT');
    // Modules reçus à la connexion, rafraîchis depuis le serveur (ils ont pu changer depuis)
    const [ modules, setModules ] = useState<string[]>(props.modules || []);
    const [ currentPage, setCurrentPage ] = useState('/dashboard');
    const [ pageState, setPageState ] = useState<any>(null);
    // Abonnement non activé, ou échéance impayée depuis 2 mois ou plus : l'accès est limité à la facturation
    const [ accesLimite, setAccesLimite ] = useState<boolean>(!!props.accesLimiteFacturation);
    const [ abonnementActif, setAbonnementActif ] = useState<boolean>(props.abonnementActif !== false);

    const navigate = useCallback((page: string, state?: any) => {
        setPageState(state || null);
        setCurrentPage(page);
    }, []);

    const majAbonnement = useCallback((societe: any) => {
        setAccesLimite(!!societe.accesLimiteFacturation);
        setAbonnementActif(!!societe.abonnementActif);
    }, []);

    // L'abonnement a pu être activé, l'impayé survenir ou être réglé depuis la connexion
    useEffect(() => {
        fetchWithAuth('/societe')
            .then((response) => (response.ok ? response.json() : null))
            .then((societe) => {
                if (societe) {
                    majAbonnement(societe);
                }
            })
            .catch(() => {
                // Keep the state received at login.
            });
    }, [ majAbonnement ]);

    useEffect(() => {
        if (accesLimite) {
            navigate('/facturation');
        }
    }, [ accesLimite, navigate ]);

    // Retour du consentement bancaire Powens : on revient sur la page Connecteurs avec l'identifiant de connexion
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const connecteur = params.get('powens_connecteur');
        const connectionId = params.get('connection_id');
        if (connecteur) {
            window.history.replaceState({}, '', window.location.pathname);
            navigate('/connecteurs', { powensConnecteur: Number(connecteur), connectionId: connectionId ? Number(connectionId) : null, powensError: params.get('error') });
        }
    }, [navigate]);

    useEffect(() => {
        fetchWithAuth(`/users/${encodeURIComponent(props.user)}`)
            .then((response) => {
                if (!response.ok) {
                    return null;
                }
                return response.json();
            })
            .then((userData) => {
                if (!userData) {
                    return;
                }
                if (Array.isArray(userData.modules)) {
                    setModules(userData.modules);
                }
                if (userData.theme) {
                    setTheme(userData.theme === 'DARK' ? 'DARK' : 'LIGHT');
                }
            })
            .catch(() => {
                // Keep default LIGHT theme and login modules when user preferences cannot be loaded.
            });
    }, [ props.user ]);

    const isDarkTheme = theme === 'DARK';

    const renderPage = () => {
        const accueil = <Dashboard user={props.user} />;
        if (accesLimite) {
            if (!hasModule(modules, 'PARAMETRAGE')) {
                const raison = abonnementActif ? "L'abonnement est impayé depuis 2 mois ou plus." : "L'abonnement n'est pas activé.";
                return <Result status="403" title="Accès bloqué" subTitle={`${raison} Contactez un administrateur.`} />;
            }
            return (
                <>
                    <Alert
                        type="error"
                        showIcon
                        style={{ marginBottom: 16 }}
                        message="Accès limité à la facturation"
                        description={abonnementActif
                            ? "Une échéance de l'abonnement est impayée depuis 2 mois ou plus. Réglez les échéances en retard pour rétablir l'accès à l'application."
                            : "L'abonnement n'est pas activé. Activez-le en payant les frais d'activation avec le premier mois ou la première année pour accéder à l'application."}
                    />
                    <Facturation onSocieteChange={majAbonnement} />
                </>
            );
        }
        const module = PAGE_MODULE[currentPage];
        if (module && !hasModule(modules, module)) {
            return <Result status="403" title="Accès refusé" subTitle="Vous n'avez pas accès au module de cette page." />;
        }
        switch (currentPage) {
            case '/dashboard':
                return accueil;
            case '/clients':
                return <Clients />;
            case '/clients/bateaux':
                return <BateauxClients />;
            case '/clients/moteurs':
                return <ClientsMoteurs />;
            case '/clients/remorques':
                return <RemorquesClients />;
            case '/catalogue/produits':
                return <Produits />;
            case '/catalogue/packages':
                return <Packages />;
            case '/catalogue/fournisseurs':
                return <Fournisseurs />;
            case '/commandes-fournisseur':
                return <CommandesFournisseur />;
            case '/stock':
                return <Stock />;
            case '/societe':
                return <Societe />;
            case '/facturation':
                return <Facturation onSocieteChange={majAbonnement} />;
            case '/reglements':
                return <Reglements />;
            case '/connecteurs':
                return <Connecteurs />;
            case '/rapprochement-bancaire':
                return <RapprochementBancaire />;
            case '/kpis-financiers':
                return <KpisFinanciers />;
            case '/kpis-commerciaux':
                return <KpisCommerciaux />;
            case '/kpis-atelier':
                return <KpisAtelier />;
            case '/utilisateurs':
                return <Utilisateurs />;
            case '/emails':
                return <Emails />;
            case '/sequence-emails':
                return <SequenceEmails />;
            case '/prestations':
                return <Vente />;
            case '/comptoir':
                return <Comptoir />;
            case '/avoirs':
                return <Avoirs />;
            case '/relances':
                return <Relances />;
            case '/actions-commerciales':
                return <ActionsCommerciales />;
            case '/forfaits':
                return <Forfaits />;
            case '/techniciens':
                return <Techniciens />;
            case '/main-oeuvres':
                return <MainOeuvres />;
            case '/planning':
                return <Planning />;
            case '/annonces':
                return <Annonces />;
            case '/campagnes':
                return <Campagnes />;
            case '/reference-valeurs':
                return <ReferenceValeurs />;
            default:
                return accueil;
        }
    };

    return(
        <ConfigProvider theme={{
            algorithm: isDarkTheme ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
            token: {
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                borderRadius: 8,
                colorPrimary: '#1668dc',
            },
        }}>
            <NavigationContext.Provider value={{ navigate, pageState }}>
            <Layout style={{ minHeight: "100vh", background: isDarkTheme ? '#101010' : '#f0f2f5' }}>
              <Header user={props.user} setUser={props.setUser} theme={theme} setTheme={setTheme} />
              <Layout hasSider={true}>
                <SideMenu user={props.user} modules={modules} accesLimite={accesLimite} theme={theme} currentPage={currentPage} onNavigate={navigate} />
                <Layout.Content style={{
                    margin: "20px",
                    color: isDarkTheme ? '#f5f5f5' : undefined,
                    animation: 'fadeInUp 0.3s ease-out',
                }}>
                    {renderPage()}
                </Layout.Content>
              </Layout>
              <Layout.Footer style={{
                  background: isDarkTheme ? '#141414' : 'transparent',
                  color: isDarkTheme ? 'rgba(255,255,255,0.45)' : '#8c8c8c',
                  fontSize: '0.85em',
                  padding: '16px 50px',
              }}>
                  Copyright © 2025-2026 - NOSE Experts - Tous droits réservés
                  <span style={{ margin: '0 8px', opacity: 0.5 }}>·</span>
                  {VERSION_LABEL}
              </Layout.Footer>
            </Layout>
            {!accesLimite && <ChatbotWidget currentPage={currentPage} />}
            </NavigationContext.Provider>
        </ConfigProvider>
    );

}
