import React, { useState } from 'react';
import { Button, Form, Input } from 'antd';
import type { FormListFieldData } from 'antd';
import { DeleteOutlined, FileTextOutlined, PlusOutlined } from '@ant-design/icons';

// Une tâche de la checklist : seul le nom est affiché, la description (optionnelle) se déplie à la demande
function TacheLigne({ field, onRemove }: { field: FormListFieldData; onRemove: () => void }) {
    const [descriptionVisible, setDescriptionVisible] = useState(false);
    return (
        <div style={{ marginBottom: 4 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <Form.Item name={[field.name, 'nom']} style={{ flex: 1, marginBottom: 4 }}>
                    <Input allowClear placeholder="Nom de la tâche" />
                </Form.Item>
                <Button
                    type={descriptionVisible ? 'primary' : 'default'}
                    icon={<FileTextOutlined />}
                    title="Description (optionnelle)"
                    onClick={() => setDescriptionVisible((v) => !v)}
                />
                <Button danger icon={<DeleteOutlined />} title="Supprimer la tâche" onClick={onRemove} />
            </div>
            {descriptionVisible && (
                <Form.Item name={[field.name, 'description']} style={{ marginBottom: 4 }}>
                    <Input.TextArea rows={2} placeholder="Description (optionnelle)" />
                </Form.Item>
            )}
        </div>
    );
}

// Checklist rattachée à une ligne de main d'œuvre (champ `taches` de la ligne)
export default function ChecklistMainOeuvre({ name }: { name: number }) {
    return (
        <Form.List name={[name, 'taches']}>
            {(fields, { add, remove }) => (
                <div style={{ margin: '0 0 12px 24px', paddingLeft: 12, borderLeft: '2px solid #f0f0f0' }}>
                    {fields.map((field) => (
                        <TacheLigne key={field.key} field={field} onRemove={() => remove(field.name)} />
                    ))}
                    <Button type="link" size="small" icon={<PlusOutlined />} style={{ padding: 0 }} onClick={() => add({})}>
                        Ajouter une tâche à la checklist
                    </Button>
                </div>
            )}
        </Form.List>
    );
}
