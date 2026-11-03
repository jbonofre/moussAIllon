import React from 'react';
import { Descriptions, Image, Space } from 'antd';
import { Reception, lignesReception, receptionRenseignee } from './reception.ts';

interface ReceptionResumeProps {
    reception?: Reception | null;
}

// Réception relevée par le chantier, présentée sur le devis/OR et avant la signature du bon pour accord
const ReceptionResume: React.FC<ReceptionResumeProps> = ({ reception }) => {
    if (!reception || !receptionRenseignee(reception)) return null;
    const informations = reception.informations?.trim();
    const photos = reception.photos || [];
    const items = [
        ...lignesReception(reception).map(([label, value]) => ({ key: label, label, children: value })),
        ...(informations ? [{
            key: 'informations',
            label: 'Informations',
            span: 2,
            children: <span style={{ whiteSpace: 'pre-wrap' }}>{informations}</span>,
        }] : []),
    ];
    return (
        <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>Bon de Réception :</div>
            {items.length > 0 && <Descriptions size="small" bordered column={2} items={items} />}
            {photos.length > 0 && (
                <Image.PreviewGroup>
                    <Space wrap style={{ marginTop: 8 }}>
                        {photos.map((url, index) => (
                            <Image key={`${url}-${index}`} src={url} alt={`Photo de réception ${index + 1}`} width={96} height={96} style={{ objectFit: 'cover' }} />
                        ))}
                    </Space>
                </Image.PreviewGroup>
            )}
        </div>
    );
};

export default ReceptionResume;
