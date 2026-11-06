import React from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider } from 'antd';
import frFR from 'antd/locale/fr_FR';
import App from './app.tsx';
import './index.css';

const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(
    <ConfigProvider locale={frFR}>
        <App />
    </ConfigProvider>
);
