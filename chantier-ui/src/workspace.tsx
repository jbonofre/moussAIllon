import { fetchWithAuth } from './api.ts';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Layout, Input, Col, Row, Image, Menu, Form, Modal, message, ConfigProvider, theme as antdTheme, Switch as AntSwitch } from 'antd';
import { UserOutlined, TeamOutlined, HomeOutlined, RocketOutlined, SettingOutlined, ToolOutlined, StockOutlined, NotificationOutlined, TruckOutlined, ReadOutlined, ShopOutlined, DeploymentUnitOutlined, DisconnectOutlined, DashboardOutlined, CalendarOutlined, FileDoneOutlined, CheckSquareOutlined, HourglassOutlined, ShoppingCartOutlined, MailOutlined, SendOutlined, BankOutlined, NodeIndexOutlined, DatabaseOutlined, DollarOutlined, AppstoreOutlined, SolutionOutlined } from '@ant-design/icons';
import { NavigationContext } from './navigation-context.tsx';
import Icon from '@ant-design/icons';
import { ReactComponent as BoatOutlined } from './boat.svg';
import { ReactComponent as EngineOutlined } from './moteur.svg';
import { ReactComponent as ParcOutlined } from './parc.svg';
import { ReactComponent as TailerOutlined } from './remorque.svg';
import { Result } from 'antd';
import GlobalSearch from './global-search.tsx';
import Home from './home.tsx';
import Clients from './clients.tsx';
import Produits from './catalogue-produits.tsx';
import CatalogueBateaux from './catalogue-bateaux.tsx';
import CatalogueMoteurs from './catalogue-moteurs.tsx';
import CatalogueHelices from './catalogue-helices.tsx';
import Fournisseurs from './fournisseurs.tsx';
import Societe from './societe.tsx';
import Utilisateurs from './utilisateurs.tsx';
import Forfaits from './forfaits.tsx';
import CatalogueRemorques from './catalogue-remorques.tsx';
import BateauxClients from './clients-bateaux.tsx';
import ClientsMoteurs from './clients-moteurs.tsx';
import RemorquesClients from './clients-remorques.tsx';
import Techniciens from './techniciens.tsx';
import MainOeuvres from './main-oeuvres.tsx';
import Vente from './vente.tsx';
import Planning from './planning.tsx';
import Comptoir from './comptoir.tsx';
import Dashboard from './dashboard.tsx';
import Annonces from './annonces.tsx';
import Campagnes from './campagnes.tsx';
import CommandesFournisseur from './commandes-fournisseur.tsx';
import Emails from './emails.tsx';
import SequenceEmails from './sequence-emails.tsx';
import ReferenceValeurs from './reference-valeurs.tsx';

export function demo() {
    message.warning("Vous êtes sur une version de démonstration de moussAIllon. Il n'est pas possible d'ajouter ou supprimer des éléments.")
}

type UserTheme = 'LIGHT' | 'DARK';

function hasRole(roles: string, role: string): boolean {
    if (!roles) return false;
    const roleList = Array.isArray(roles) ? roles : roles.split(',').map(r => r.trim());
    return roleList.includes('admin') || roleList.includes(role);
}

function SideMenu(props) {

    const [ collapsed, setCollapsed ] = useState(false);
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

    const roles = props.roles || '';

    const allMenuItems = [
      { key: '/', label: 'Accueil', icon: <HomeOutlined/> },
      { key: '/dashboard', label: 'Tableau de Bord', icon: <DashboardOutlined/> },
      { key: 'Vente', label: 'Vente', icon: <DollarOutlined/>, requiredRole: 'vendeur', children: [
        { key: '/comptoir', label: 'Comptoir', icon: <ShopOutlined/> },
        { key: '/prestations', label: 'Prestations', icon: <SolutionOutlined/> },
        { key: '/clients', label: 'Clients', icon: <TeamOutlined /> },
      ]},
      { key: 'parc', label: 'Parc', icon: <Icon component={ ParcOutlined } />, requiredRole: 'manager', children: [
        { key: '/clients/bateaux', label: 'Bateaux', icon: <Icon component={ BoatOutlined } />},
        { key: '/clients/moteurs', label: 'Moteurs', icon: <Icon component={ EngineOutlined } /> },
        { key: '/clients/remorques', label: 'Remorques', icon: <Icon component={ TailerOutlined } /> }
      ] },
      { key: 'catalogue', label: 'Catalogue', icon: <ReadOutlined/>, requiredRole: 'magasinier', children: [
        { key: '/catalogue/produits', label: 'Produits', icon: <AppstoreOutlined /> },
        { key: '/catalogue/bateaux', label: 'Bateaux', icon: <Icon component={ BoatOutlined } /> },
        { key: '/catalogue/moteurs', label: 'Moteurs', icon: <Icon component={ EngineOutlined } /> },
        { key: '/catalogue/helices', label: 'Hélices', icon: <DeploymentUnitOutlined /> },
        { key: '/catalogue/remorques', label: 'Remorques', icon: <Icon component={ TailerOutlined } /> },
        { key: '/main-oeuvres', label: "Main d'Oeuvres", icon: <HourglassOutlined/> },
        { key: '/forfaits', label: 'Forfaits', icon: <FileDoneOutlined/> },
        { key: '/catalogue/fournisseurs', label: 'Fournisseurs', icon: <TruckOutlined/> },
        { key: '/commandes-fournisseur', label: 'Commandes Fournisseur', icon: <ShoppingCartOutlined/> },
      ]},
      { key: 'atelier', label: 'Atelier', icon: <ToolOutlined/>, requiredRole: 'admin', children: [
        { key: '/techniciens', label: 'Equipe', icon: <TeamOutlined/> },
        { key: '/planning', label: 'Planning', icon: <CalendarOutlined/> },
      ] },
      { key: 'market', label: 'Marketing', icon: <RocketOutlined/>, requiredRole: 'admin', children: [
        { key: '/annonces', label: 'Petites annonces', icon: <NotificationOutlined/> },
        { key: '/campagnes', label: 'Campagnes', icon: <SendOutlined/> }
      ] },
      { key: 'parametrage', label: 'Paramétrage', icon: <SettingOutlined/>, requiredRole: 'admin', children: [
        { key: '/societe', label: 'Société', icon: <BankOutlined/> },
        { key: '/utilisateurs', label: 'Utilisateurs', icon: <UserOutlined/> },
        { key: '/emails', label: 'Emails', icon: <MailOutlined/> },
        { key: '/sequence-emails', label: 'Séquence emails', icon: <NodeIndexOutlined/> },
        { key: '/reference-valeurs', label: 'Valeurs de Référence', icon: <DatabaseOutlined/> }
      ] }
    ];

    const menuItems = allMenuItems.filter(item => !item.requiredRole || hasRole(roles, item.requiredRole));

    return(
        <div style={{ display: 'flex', position: 'relative' }}>
            <Layout.Sider
                className={props.theme === 'DARK' ? 'sidebar-dark' : 'sidebar-light'}
                theme={props.theme === 'DARK' ? 'dark' : 'light'}
                collapsible={true}
                collapsed={collapsed}
                onCollapse={newValue => setCollapsed(newValue)}
                width={siderWidth}
            >
                <Menu
                    theme={props.theme === 'DARK' ? 'dark' : 'light'}
                    items={menuItems}
                    selectedKeys={[props.currentPage]}
                    mode="inline"
                    onClick={({ key }) => { if (key.startsWith('/')) props.onNavigate(key); }}
                />
            </Layout.Sider>
            {!collapsed && (
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

    const roleLabels = { admin: 'Admin', manager: 'Manager', magasinier: 'Magasinier', vendeur: 'Vendeur' };
    const userRoles = props.roles ? (Array.isArray(props.roles) ? props.roles : props.roles.split(',').map(r => r.trim())) : [];
    const roleDisplay = userRoles.map(r => roleLabels[r] || r).join(', ');

    const menuUser = [
              { key: 'user', label: <span>{props.user} <span style={{ fontSize: '0.8em', opacity: 0.7 }}>({roleDisplay})</span></span>, icon: <UserOutlined />, children: [
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
            padding: "0 24px",
            margin: "16px 20px 8px",
            borderRadius: 14,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
        }}>
            <Row align="middle" justify="center" wrap={false} style={{ height: '100%' }}>
                <Col span={3}><Image src="/logo.png" preview={false} width={75}/></Col>
                <Col span={19}><GlobalSearch /></Col>
                <Col span={2}><Menu items={menuUser} onClick={(e) => {
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

function ProtectedRoute({ roles, requiredRole, children }) {
    if (requiredRole && !hasRole(roles, requiredRole)) {
        return <Result status="403" title="Accès refusé" subTitle="Vous n'avez pas les droits nécessaires pour accéder à cette page." />;
    }
    return children;
}

export default function Workspace(props) {
    const [ theme, setTheme ] = useState<UserTheme>('LIGHT');
    const [ currentPage, setCurrentPage ] = useState('/');
    const [ pageState, setPageState ] = useState<any>(null);

    const navigate = useCallback((page: string, state?: any) => {
        setPageState(state || null);
        setCurrentPage(page);
    }, []);

    useEffect(() => {
        fetchWithAuth(`/users/${encodeURIComponent(props.user)}`)
            .then((response) => {
                if (!response.ok) {
                    return null;
                }
                return response.json();
            })
            .then((userData) => {
                if (!userData || !userData.theme) {
                    return;
                }
                const nextTheme = userData.theme === 'DARK' ? 'DARK' : 'LIGHT';
                setTheme(nextTheme);
            })
            .catch(() => {
                // Keep default LIGHT theme when user preferences cannot be loaded.
            });
    }, [ props.user ]);

    const isDarkTheme = theme === 'DARK';

    const renderPage = () => {
        switch (currentPage) {
            case '/dashboard':
                return <Dashboard />;
            case '/clients':
                return <ProtectedRoute roles={props.roles} requiredRole="manager"><Clients /></ProtectedRoute>;
            case '/clients/bateaux':
                return <ProtectedRoute roles={props.roles} requiredRole="manager"><BateauxClients /></ProtectedRoute>;
            case '/clients/moteurs':
                return <ProtectedRoute roles={props.roles} requiredRole="manager"><ClientsMoteurs /></ProtectedRoute>;
            case '/clients/remorques':
                return <ProtectedRoute roles={props.roles} requiredRole="manager"><RemorquesClients /></ProtectedRoute>;
            case '/catalogue/produits':
                return <ProtectedRoute roles={props.roles} requiredRole="magasinier"><Produits /></ProtectedRoute>;
            case '/catalogue/bateaux':
                return <ProtectedRoute roles={props.roles} requiredRole="magasinier"><CatalogueBateaux /></ProtectedRoute>;
            case '/catalogue/moteurs':
                return <ProtectedRoute roles={props.roles} requiredRole="magasinier"><CatalogueMoteurs /></ProtectedRoute>;
            case '/catalogue/helices':
                return <ProtectedRoute roles={props.roles} requiredRole="magasinier"><CatalogueHelices /></ProtectedRoute>;
            case '/catalogue/remorques':
                return <ProtectedRoute roles={props.roles} requiredRole="magasinier"><CatalogueRemorques /></ProtectedRoute>;
            case '/catalogue/fournisseurs':
                return <ProtectedRoute roles={props.roles} requiredRole="magasinier"><Fournisseurs /></ProtectedRoute>;
            case '/commandes-fournisseur':
                return <ProtectedRoute roles={props.roles} requiredRole="magasinier"><CommandesFournisseur /></ProtectedRoute>;
            case '/societe':
                return <ProtectedRoute roles={props.roles} requiredRole="admin"><Societe /></ProtectedRoute>;
            case '/utilisateurs':
                return <ProtectedRoute roles={props.roles} requiredRole="admin"><Utilisateurs /></ProtectedRoute>;
            case '/emails':
                return <ProtectedRoute roles={props.roles} requiredRole="admin"><Emails /></ProtectedRoute>;
            case '/sequence-emails':
                return <ProtectedRoute roles={props.roles} requiredRole="admin"><SequenceEmails /></ProtectedRoute>;
            case '/prestations':
                return <ProtectedRoute roles={props.roles} requiredRole="vendeur"><Vente /></ProtectedRoute>;
            case '/comptoir':
                return <ProtectedRoute roles={props.roles} requiredRole="vendeur"><Comptoir /></ProtectedRoute>;
            case '/forfaits':
                return <ProtectedRoute roles={props.roles} requiredRole="admin"><Forfaits /></ProtectedRoute>;
            case '/techniciens':
                return <ProtectedRoute roles={props.roles} requiredRole="admin"><Techniciens /></ProtectedRoute>;
            case '/main-oeuvres':
                return <ProtectedRoute roles={props.roles} requiredRole="admin"><MainOeuvres /></ProtectedRoute>;
            case '/planning':
                return <ProtectedRoute roles={props.roles} requiredRole="admin"><Planning /></ProtectedRoute>;
            case '/annonces':
                return <ProtectedRoute roles={props.roles} requiredRole="admin"><Annonces /></ProtectedRoute>;
            case '/campagnes':
                return <ProtectedRoute roles={props.roles} requiredRole="admin"><Campagnes /></ProtectedRoute>;
            case '/reference-valeurs':
                return <ProtectedRoute roles={props.roles} requiredRole="admin"><ReferenceValeurs /></ProtectedRoute>;
            default:
                return <Home />;
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
              <Header user={props.user} roles={props.roles} setUser={props.setUser} theme={theme} setTheme={setTheme} />
              <Layout hasSider={true}>
                <SideMenu user={props.user} roles={props.roles} theme={theme} currentPage={currentPage} onNavigate={navigate} />
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
              </Layout.Footer>
            </Layout>
            </NavigationContext.Provider>
        </ConfigProvider>
    );

}
