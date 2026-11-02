import React from 'react';
import { Form, InputNumber } from 'antd';

const mise = {
    layout: 'horizontal' as const,
    labelCol: { flex: '0 0 150px' },
    wrapperCol: { flex: '0 0 130px' },
    labelAlign: 'right' as const,
    colon: false,
    style: { marginBottom: 8, width: 280 },
};

// Montants d'un service, en colonne et en gras, comme les totaux d'une transaction
export default function MontantsService({ terme = 'Prix' }: { terme?: 'Prix' | 'Montant' }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <div style={{ width: 280 }}>
                <Form.Item name="prixHT" label={<strong>{terme} HT (EUR)</strong>} {...mise}>
                    <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="tva" label={<strong>TVA (%)</strong>} {...mise}>
                    <InputNumber min={0} max={100} step={0.01} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="montantTVA" label={<strong>Montant TVA</strong>} {...mise}>
                    <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="prixTTC" label={<strong>{terme} TTC</strong>} {...mise}>
                    <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
                </Form.Item>
            </div>
        </div>
    );
}
