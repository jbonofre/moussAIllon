import React, { useState } from 'react';
import { Layout, Menu, Image, Button } from 'antd';
import {
    AimOutlined,
    KeyOutlined,
    ScheduleOutlined,
    UserOutlined,
    LogoutOutlined,
} from '@ant-design/icons';
import Login from './login.tsx';
import Planning from './planning.tsx';
import Objectifs from './objectifs.tsx';
import MobileApp from './mobile-app.tsx';
import ChangePasswordModal from './change-password-modal.tsx';
import useIsMobile from './use-is-mobile.tsx';

import './app.css';

const { Header, Content, Sider, Footer } = Layout;

interface Technicien {
    id: number;
    prenom?: string;
    nom: string;
    email?: string;
    telephone?: string;
    couleur?: string;
}

export default function App() {
    const [user, setUser] = useState<Technicien | null>(() => {
        const stored = localStorage.getItem('moussaillon-technicien-user');
        return stored ? JSON.parse(stored) : null;
    });
    const [passwordModalOpen, setPasswordModalOpen] = useState(false);
    const [section, setSection] = useState<'planning' | 'objectifs'>('planning');
    const isMobile = useIsMobile();

    const handleLogout = () => {
        localStorage.removeItem('moussaillon-technicien-token');
        localStorage.removeItem('moussaillon-technicien-user');
        setUser(null);
    };

    if (!user) {
        return <Login setUser={setUser} />;
    }

    if (isMobile) {
        return (
            <>
                <MobileApp user={user} onLogout={handleLogout} onChangePassword={() => setPasswordModalOpen(true)} />
                <ChangePasswordModal
                    technicienId={user.id}
                    open={passwordModalOpen}
                    onClose={() => setPasswordModalOpen(false)}
                />
            </>
        );
    }

    const technicienName = `${user.prenom || ''} ${user.nom}`.trim();

    return (
        <Layout className="layout">
            <Sider breakpoint="lg" collapsedWidth="0">
                <div className="logo">
                    <Image width={80} src={process.env.PUBLIC_URL + '/logo.png'} preview={false} />
                </div>
                <Menu
                    theme="dark"
                    mode="inline"
                    selectedKeys={[section]}
                    onClick={({ key }) => setSection(key as 'planning' | 'objectifs')}
                    items={[
                        { key: 'planning', icon: <ScheduleOutlined />, label: 'Mon planning' },
                        { key: 'objectifs', icon: <AimOutlined />, label: 'Mes objectifs' },
                    ]}
                />
            </Sider>
            <Layout style={{ background: '#f0f2f5' }}>
                <Header style={{
                    background: '#fff',
                    padding: '0 24px',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    height: 64,
                    margin: '16px 20px 0',
                    borderRadius: 14,
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                }}>
                    <span style={{ marginRight: 16, fontWeight: 500 }}>
                        <UserOutlined style={{ marginRight: 6 }} /> {technicienName}
                    </span>
                    <Button
                        icon={<KeyOutlined />}
                        onClick={() => setPasswordModalOpen(true)}
                        style={{ marginRight: 8 }}
                    >
                        Mot de passe
                    </Button>
                    <Button
                        icon={<LogoutOutlined />}
                        onClick={handleLogout}
                    >
                        Deconnexion
                    </Button>
                </Header>
                <Content style={{
                    margin: '20px',
                    padding: 28,
                    background: '#fff',
                    minHeight: 280,
                    borderRadius: 14,
                    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
                    animation: 'fadeInUp 0.3s ease-out',
                }}>
                    {section === 'planning'
                        ? <Planning technicienId={user.id} />
                        : <Objectifs technicienId={user.id} />}
                </Content>
                <Footer style={{ background: 'transparent', padding: '16px 50px' }}>
                    moussAIllon - Espace Technicien
                </Footer>
            </Layout>
            <ChangePasswordModal
                technicienId={user.id}
                open={passwordModalOpen}
                onClose={() => setPasswordModalOpen(false)}
            />
        </Layout>
    );
}
