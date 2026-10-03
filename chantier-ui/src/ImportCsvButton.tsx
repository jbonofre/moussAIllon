import React, { useState } from 'react';
import { Alert, Button, Upload, Modal, List, Space, Tag, message } from 'antd';
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
    // Import du catalogue : lignes reconnues comme bateau, moteur, hélice ou remorque
    bateaux?: number;
    moteurs?: number;
    helices?: number;
    remorques?: number;
    detection?: 'REGLES' | 'IA' | 'IA_PARTIELLE' | 'IA_ECHEC';
}

const detectionLabels: Record<string, string> = {
    IA: "Les nouvelles lignes ont été classées par l'IA.",
    REGLES: "Les nouvelles lignes ont été classées par mots-clés (IA non configurée).",
    IA_PARTIELLE: "L'IA n'a classé qu'une partie des nouvelles lignes : les autres ont été classées par mots-clés.",
    IA_ECHEC: "L'appel à l'IA a échoué : les nouvelles lignes ont été classées par mots-clés.",
};

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
                        {(result.bateaux || result.moteurs || result.helices || result.remorques) ? (
                            <Space wrap style={{ marginBottom: 12 }}>
                                {!!result.bateaux && <Tag color="cyan">Bateaux : {result.bateaux}</Tag>}
                                {!!result.moteurs && <Tag color="purple">Moteurs : {result.moteurs}</Tag>}
                                {!!result.helices && <Tag color="blue">Hélices : {result.helices}</Tag>}
                                {!!result.remorques && <Tag color="gold">Remorques : {result.remorques}</Tag>}
                            </Space>
                        ) : null}
                        {result.detection && (
                            <Alert
                                type={result.detection === 'IA' ? 'info' : 'warning'}
                                showIcon
                                title={detectionLabels[result.detection]}
                                style={{ marginBottom: 12 }}
                            />
                        )}
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
