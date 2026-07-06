import React, { useState } from 'react';
import { Button, Modal, Upload, message, Spin, Descriptions, Tag, Space } from 'antd';
import { CameraOutlined, SearchOutlined } from '@ant-design/icons';
import api from './api.ts';

export type ProductType = 'bateau' | 'moteur' | 'remorque' | 'helice';

export type IdentifyResult = {
  marque?: string;
  modele?: string;
  type?: string;
  anneeDebut?: number;
  puissanceCv?: number;
  description?: string;
  immatriculation?: string;
  pas?: string | number;
  diametre?: number;
  materiau?: string;
  confidence?: string;
};

type Props = {
  productType: ProductType;
  onApply: (result: IdentifyResult) => void;
};

const CONFIDENCE_COLOR: Record<string, string> = {
  haute: 'success',
  moyenne: 'warning',
  faible: 'error',
};

const PRODUCT_LABEL: Record<ProductType, string> = {
  bateau: 'bateau',
  moteur: 'moteur',
  remorque: 'remorque',
  helice: 'hélice',
};

const AiPhotoIdentify: React.FC<Props> = ({ productType, onApply }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fileList, setFileList] = useState<any[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [result, setResult] = useState<IdentifyResult | null>(null);

  const handleBeforeUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setImages(prev => [...prev, base64]);
    };
    reader.readAsDataURL(file);
    return false;
  };

  const handleRemove = (file: any) => {
    const idx = fileList.findIndex(f => f.uid === file.uid);
    if (idx >= 0) {
      setImages(prev => prev.filter((_, i) => i !== idx));
    }
  };

  const handleAnalyze = async () => {
    if (images.length === 0) {
      message.warning('Ajoutez au moins une photo');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await api.post('/ai/identify', { images, type: productType });
      setResult(res.data);
    } catch {
      message.error("Erreur lors de l'identification par IA");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (result) {
      onApply(result);
      handleClose();
    }
  };

  const handleClose = () => {
    setOpen(false);
    setFileList([]);
    setImages([]);
    setResult(null);
  };

  const renderResult = () => {
    if (!result) return null;
    const items: { label: string; value: React.ReactNode }[] = [];
    if (result.marque) items.push({ label: 'Marque', value: result.marque });
    if (result.modele) items.push({ label: 'Modèle', value: result.modele });
    if (result.type) items.push({ label: 'Type', value: result.type });
    if (result.anneeDebut) items.push({ label: 'Année', value: result.anneeDebut });
    if (result.puissanceCv) items.push({ label: 'Puissance (CV)', value: result.puissanceCv });
    if (result.pas) items.push({ label: 'Pas', value: result.pas });
    if (result.diametre) items.push({ label: 'Diamètre (po)', value: result.diametre });
    if (result.materiau) items.push({ label: 'Matériau', value: result.materiau });
    if (result.description) items.push({ label: 'Description', value: result.description });
    if (result.confidence) {
      items.push({
        label: 'Fiabilité',
        value: <Tag color={CONFIDENCE_COLOR[result.confidence] ?? 'default'}>{result.confidence}</Tag>,
      });
    }

    return (
      <div style={{ marginTop: 16 }}>
        <Descriptions bordered size="small" column={2} title="Résultat de l'identification">
          {items.map(item => (
            <Descriptions.Item key={item.label} label={item.label}>
              {item.value}
            </Descriptions.Item>
          ))}
        </Descriptions>
        <Button
          type="primary"
          style={{ marginTop: 12 }}
          onClick={handleApply}
        >
          Appliquer au formulaire
        </Button>
      </div>
    );
  };

  return (
    <>
      <Button icon={<CameraOutlined />} onClick={() => setOpen(true)}>
        Identifier par photo
      </Button>
      <Modal
        open={open}
        title={`Identification du ${PRODUCT_LABEL[productType]} par photo (IA)`}
        onCancel={handleClose}
        footer={null}
        width={600}
        destroyOnHidden
      >
        <Spin spinning={loading}>
          <Upload
            multiple
            listType="picture-card"
            beforeUpload={handleBeforeUpload}
            onRemove={handleRemove}
            fileList={fileList}
            onChange={({ fileList: fl }) => setFileList(fl)}
            accept="image/*"
          >
            <div>
              <CameraOutlined />
              <div style={{ marginTop: 4 }}>Ajouter une photo</div>
            </div>
          </Upload>
          <Space style={{ marginTop: 12 }}>
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={handleAnalyze}
              disabled={images.length === 0}
            >
              Analyser
            </Button>
            {images.length > 0 && (
              <span style={{ color: '#888', fontSize: 12 }}>
                {images.length} photo{images.length > 1 ? 's' : ''} sélectionnée{images.length > 1 ? 's' : ''}
              </span>
            )}
          </Space>
          {renderResult()}
        </Spin>
      </Modal>
    </>
  );
};

export default AiPhotoIdentify;
