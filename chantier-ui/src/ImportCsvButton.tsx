import React, { useState } from 'react';
import { Button, Upload, Modal, List, Space, Tag, message } from 'antd';
import type { UploadProps } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import api from './api.ts';

interface ImportResult {
    total: number;
    created: number;
    updated: number;
    skipped: number;
    errors: number;
    errorDetails: string[];
}

interface ImportCsvButtonProps {
    endpoint: string;
    label?: string;
    onImported?: () => void;
}

const ImportCsvButton: React.FC<ImportCsvButtonProps> = ({ endpoint, label = 'Importer CSV', onImported }) => {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ImportResult | null>(null);

    const handleUpload: UploadProps['customRequest'] = async (options) => {
        const { file, onSuccess, onError } = options;
        const formData = new FormData();
        formData.append('file', file as File);
        setLoading(true);
        try {
            const res = await api.post(endpoint, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setResult(res.data);
            onSuccess?.(res.data);
            onImported?.();
        } catch (err) {
            message.error("Erreur lors de l'import du fichier CSV");
            onError?.(err as Error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Upload accept=".csv" showUploadList={false} customRequest={handleUpload}>
                <Button icon={<UploadOutlined />} loading={loading}>{label}</Button>
            </Upload>
            <Modal
                open={!!result}
                title="Résultat de l'import"
                onOk={() => setResult(null)}
                onCancel={() => setResult(null)}
                footer={<Button type="primary" onClick={() => setResult(null)}>Fermer</Button>}
            >
                {result && (
                    <>
                        <Space wrap style={{ marginBottom: 12 }}>
                            <Tag>Lignes lues : {result.total}</Tag>
                            <Tag color="green">Créés : {result.created}</Tag>
                            <Tag color="gold">Mis à jour : {result.updated}</Tag>
                            <Tag color="default">Ignorés : {result.skipped}</Tag>
                            <Tag color={result.errors ? 'red' : 'default'}>Erreurs : {result.errors}</Tag>
                        </Space>
                        {result.errorDetails && result.errorDetails.length > 0 && (
                            <List
                                size="small"
                                bordered
                                dataSource={result.errorDetails}
                                renderItem={(item) => <List.Item>{item}</List.Item>}
                                style={{ maxHeight: 300, overflowY: 'auto' }}
                            />
                        )}
                    </>
                )}
            </Modal>
        </>
    );
};

export default ImportCsvButton;
