import React, { useState } from 'react';
import { Button, Image, Layout, Space, Typography } from 'antd';
import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
import Login, { Administrateur } from './login.tsx';
import Chantiers from './chantiers.tsx';
import { CLE_ADMIN, CLE_JETON } from './api.ts';

import './app.css';

const { Header, Content } = Layout;

export default function App() {
    const [admin, setAdmin] = useState<Administrateur | null>(() => {
        const stored = localStorage.getItem(CLE_ADMIN);
        return stored && localStorage.getItem(CLE_JETON) ? JSON.parse(stored) : null;
    });

    const deconnexion = () => {
        localStorage.removeItem(CLE_JETON);
        localStorage.removeItem(CLE_ADMIN);
        setAdmin(null);
    };

    if (!admin) {
        return <Login setAdmin={setAdmin} />;
    }

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Header className="admin-header">
                <Space>
                    <Image src={process.env.PUBLIC_URL + '/logo.png'} preview={false} width={36} />
                    <Typography.Title level={4} style={{ margin: 0, color: '#fff' }}>
                        mouss<span style={{ color: '#69b1ff' }}>AI</span>llon · Administration
                    </Typography.Title>
                </Space>
                <Space>
                    <Typography.Text style={{ color: '#fff' }}>
                        <UserOutlined /> {admin.name}
                    </Typography.Text>
                    <Button icon={<LogoutOutlined />} onClick={deconnexion}>
                        Déconnexion
                    </Button>
                </Space>
            </Header>
            <Content style={{ padding: 24 }}>
                <Chantiers />
            </Content>
        </Layout>
    );
}
