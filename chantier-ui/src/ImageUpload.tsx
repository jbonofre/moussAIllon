import React, { useState } from 'react';
import { Upload, message, Button, Input, Space } from 'antd';
import { CloseOutlined, DeleteOutlined, InboxOutlined, LeftOutlined, LinkOutlined, RightOutlined, StarFilled, StarOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import api from './api.ts';

const { Dragger } = Upload;

interface ImageUploadProps {
    value?: string[];
    onChange?: (urls: string[]) => void;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ value = [], onChange }) => {
    const [urlInput, setUrlInput] = useState('');
    const [previewIndex, setPreviewIndex] = useState<number | null>(null);

    const triggerChange = (urls: string[]) => {
        onChange?.(urls);
    };

    const handleUpload: UploadProps['customRequest'] = async (options) => {
        const { file, onSuccess, onError } = options;
        const formData = new FormData();
        formData.append('files', file as File);
        try {
            const res = await api.post('/images', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const urls: string[] = res.data;
            if (urls.length > 0) {
                triggerChange([...value, ...urls]);
            }
            onSuccess?.(res.data);
        } catch (err) {
            message.error("Erreur lors de l'upload de l'image");
            onError?.(err as Error);
        }
    };

    const handleRemove = (index: number) => {
        const newUrls = value.filter((_, i) => i !== index);
        triggerChange(newUrls);
    };

    const handleSetAsCover = (index: number) => {
        if (index === 0) return;
        const newUrls = [value[index], ...value.filter((_, i) => i !== index)];
        triggerChange(newUrls);
    };

    const handleAddUrl = () => {
        const trimmed = urlInput.trim();
        if (trimmed) {
            triggerChange([...value, trimmed]);
            setUrlInput('');
        }
    };

    return (
        <div>
            {value.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    {value.map((url, index) => (
                        <div
                            key={index}
                            style={{
                                position: 'relative',
                                width: 104,
                                height: 104,
                                border: index === 0 ? '2px solid #1677ff' : '1px solid #d9d9d9',
                                borderRadius: 8,
                                overflow: 'hidden',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: '#fafafa',
                            }}
                        >
                            <img
                                src={url}
                                alt={`image-${index}`}
                                width={104}
                                height={104}
                                style={{ objectFit: 'cover', cursor: 'pointer' }}
                                onClick={() => setPreviewIndex(index)}
                            />
                            {index === 0 && (
                                <span
                                    style={{
                                        position: 'absolute',
                                        bottom: 2,
                                        left: 2,
                                        zIndex: 1,
                                        background: 'rgba(22,119,255,0.85)',
                                        color: '#fff',
                                        fontSize: 10,
                                        padding: '1px 6px',
                                        borderRadius: 4,
                                    }}
                                >
                                    Profil
                                </span>
                            )}
                            <Button
                                type="text"
                                size="small"
                                title={index === 0 ? 'Photo de profil' : 'Définir comme photo de profil'}
                                icon={index === 0
                                    ? <StarFilled style={{ color: '#ffd700', fontSize: 14 }} />
                                    : <StarOutlined style={{ color: '#fff', fontSize: 14 }} />}
                                onClick={(e) => { e.stopPropagation(); handleSetAsCover(index); }}
                                style={{
                                    position: 'absolute',
                                    top: 2,
                                    left: 2,
                                    zIndex: 1,
                                    background: 'rgba(0,0,0,0.5)',
                                    borderRadius: '50%',
                                    width: 24,
                                    height: 24,
                                    minWidth: 24,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            />
                            <Button
                                type="text"
                                size="small"
                                icon={<DeleteOutlined style={{ color: '#fff', fontSize: 14 }} />}
                                onClick={(e) => { e.stopPropagation(); handleRemove(index); }}
                                style={{
                                    position: 'absolute',
                                    top: 2,
                                    right: 2,
                                    zIndex: 1,
                                    background: 'rgba(0,0,0,0.5)',
                                    borderRadius: '50%',
                                    width: 24,
                                    height: 24,
                                    minWidth: 24,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            />
                        </div>
                    ))}
                </div>
            )}
            {previewIndex !== null && (
                <div
                    onClick={() => setPreviewIndex(null)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 2000,
                        background: 'rgba(0,0,0,0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <img
                        src={value[previewIndex]}
                        alt="preview"
                        onClick={(e) => e.stopPropagation()}
                        style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }}
                    />
                    <Button
                        type="text"
                        icon={<CloseOutlined style={{ color: '#fff', fontSize: 18 }} />}
                        onClick={() => setPreviewIndex(null)}
                        style={{ position: 'absolute', top: 16, right: 16 }}
                    />
                    {value.length > 1 && (
                        <>
                            <Button
                                type="text"
                                icon={<LeftOutlined style={{ color: '#fff', fontSize: 24 }} />}
                                onClick={(e) => { e.stopPropagation(); setPreviewIndex((previewIndex - 1 + value.length) % value.length); }}
                                style={{ position: 'absolute', left: 16 }}
                            />
                            <Button
                                type="text"
                                icon={<RightOutlined style={{ color: '#fff', fontSize: 24 }} />}
                                onClick={(e) => { e.stopPropagation(); setPreviewIndex((previewIndex + 1) % value.length); }}
                                style={{ position: 'absolute', right: 16 }}
                            />
                        </>
                    )}
                </div>
            )}
            <Dragger
                multiple
                showUploadList={false}
                customRequest={handleUpload}
                accept="image/*"
                style={{ marginBottom: 8 }}
            >
                <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                </p>
                <p className="ant-upload-text">Cliquer ou glisser-déposer des images ici</p>
                <p className="ant-upload-hint">Formats acceptés : JPG, PNG, GIF, WebP</p>
            </Dragger>
            <Space.Compact style={{ width: '100%', marginTop: 8 }}>
                <Input
                    prefix={<LinkOutlined />}
                    placeholder="Ou ajouter une URL d'image"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onPressEnter={handleAddUrl}
                />
                <Button onClick={handleAddUrl}>Ajouter</Button>
            </Space.Compact>
        </div>
    );
};

export default ImageUpload;
