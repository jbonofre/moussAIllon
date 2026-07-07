import React, { useState } from 'react';
import { Upload, message, Button, List, Input, Space } from 'antd';
import { DeleteOutlined, InboxOutlined, FileOutlined, FilePdfOutlined, FileWordOutlined, FileExcelOutlined, DownloadOutlined, LinkOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import api from './api.ts';

const { Dragger } = Upload;

interface DocumentUploadProps {
    value?: string[];
    onChange?: (urls: string[]) => void;
}

const parseDocument = (entry: string) => {
    const pipeIndex = entry.indexOf('|');
    if (pipeIndex > 0) {
        return { name: entry.substring(0, pipeIndex), url: entry.substring(pipeIndex + 1) };
    }
    const parts = entry.split('/');
    return { name: parts[parts.length - 1], url: entry };
};

const getFileIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.endsWith('.pdf')) return <FilePdfOutlined style={{ color: '#ff4d4f' }} />;
    if (lower.endsWith('.doc') || lower.endsWith('.docx')) return <FileWordOutlined style={{ color: '#1677ff' }} />;
    if (lower.endsWith('.xls') || lower.endsWith('.xlsx')) return <FileExcelOutlined style={{ color: '#52c41a' }} />;
    return <FileOutlined />;
};

const DocumentUpload: React.FC<DocumentUploadProps> = ({ value = [], onChange }) => {
    const [urlInput, setUrlInput] = useState('');

    const triggerChange = (urls: string[]) => {
        onChange?.(urls);
    };

    const handleDownload = async (url: string) => {
        try {
            const res = await api.get(url, { responseType: 'blob' });
            const blob = new Blob([res.data], { type: res.headers['content-type'] });
            const blobUrl = window.URL.createObjectURL(blob);
            window.open(blobUrl, '_blank');
        } catch {
            message.error("Erreur lors du téléchargement du document");
        }
    };

    const handleUpload: UploadProps['customRequest'] = async (options) => {
        const { file, onSuccess, onError } = options;
        const formData = new FormData();
        formData.append('files', file as File);
        try {
            const res = await api.post('/documents', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const urls: string[] = res.data;
            if (urls.length > 0) {
                triggerChange([...value, ...urls]);
            }
            onSuccess?.(res.data);
        } catch (err) {
            message.error("Erreur lors de l'upload du document");
            onError?.(err as Error);
        }
    };

    const handleRemove = (index: number) => {
        const newUrls = value.filter((_, i) => i !== index);
        triggerChange(newUrls);
    };

    return (
        <div>
            {value.length > 0 && (
                <List
                    size="small"
                    style={{ marginBottom: 12 }}
                    dataSource={value}
                    renderItem={(entry, index) => {
                        const doc = parseDocument(entry);
                        return (
                            <List.Item
                                actions={[
                                    <Button
                                        type="link"
                                        size="small"
                                        icon={<DownloadOutlined />}
                                        onClick={() => handleDownload(doc.url)}
                                    />,
                                    <Button
                                        type="text"
                                        size="small"
                                        danger
                                        icon={<DeleteOutlined />}
                                        onClick={() => handleRemove(index)}
                                    />,
                                ]}
                            >
                                <List.Item.Meta
                                    avatar={getFileIcon(doc.name)}
                                    title={doc.name}
                                />
                            </List.Item>
                        );
                    }}
                />
            )}
            <Dragger
                multiple
                showUploadList={false}
                customRequest={handleUpload}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.odt,.ods,.txt,.csv"
            >
                <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                </p>
                <p className="ant-upload-text">Cliquer ou glisser-déposer des documents ici</p>
                <p className="ant-upload-hint">Formats acceptés : PDF, DOC, DOCX, XLS, XLSX, ODT, ODS, TXT, CSV</p>
            </Dragger>
            <Space.Compact style={{ width: '100%', marginTop: 8 }}>
                <Input
                    prefix={<LinkOutlined />}
                    placeholder="Ou ajouter une URL de document"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onPressEnter={() => {
                        const trimmed = urlInput.trim();
                        if (trimmed) {
                            triggerChange([...value, trimmed]);
                            setUrlInput('');
                        }
                    }}
                />
                <Button onClick={() => {
                    const trimmed = urlInput.trim();
                    if (trimmed) {
                        triggerChange([...value, trimmed]);
                        setUrlInput('');
                    }
                }}>Ajouter</Button>
            </Space.Compact>
        </div>
    );
};

export default DocumentUpload;
