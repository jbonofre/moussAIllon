import React from 'react';
import { Popover, Progress } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import { alertesVente, progressionChecklist } from './progression-checklist.ts';

interface ProgressionVenteProps {
    vente?: Parameters<typeof progressionChecklist>[0];
    width?: number | string;
}

// Barre de progression d'une vente « En cours » : points de checklist faits ou non faits / total
export default function ProgressionVente({ vente, width }: ProgressionVenteProps) {
    const progression = progressionChecklist(vente);
    if (!progression) {
        return null;
    }
    return (
        <div style={{ width }} title={`${progression.traites} point(s) sur ${progression.total} traité(s)`}>
            <Progress percent={progression.pourcentage} size="small" />
        </div>
    );
}

interface PopoverProgressionVenteProps extends ProgressionVenteProps {
    children: React.ReactElement;
}

// Au survol de l'élément (ex. le tag « En cours » d'une table) : progression de la checklist,
// détail des incidents et points non faits. Une icône d'alerte signale ces derniers.
export function PopoverProgressionVente({ vente, children }: PopoverProgressionVenteProps) {
    const progression = progressionChecklist(vente);
    const { incidents, pointsNonFaits } = alertesVente(vente);
    const alerte = incidents.length > 0 || pointsNonFaits.length > 0;
    if (!progression && !alerte) {
        return children;
    }
    const content = (
        <div style={{ width: 280, maxWidth: '100%' }}>
            {progression && <ProgressionVente vente={vente} />}
            {incidents.length > 0 && (
                <div style={{ marginTop: 8 }}>
                    <strong><WarningOutlined style={{ color: '#faad14' }} /> Incidents</strong>
                    {incidents.map((incident, index) => (
                        <div key={index}>
                            • {incident.prestation}
                            {incident.date ? ` (${new Date(incident.date).toLocaleDateString('fr-FR')})` : ''}
                            {incident.details ? ` : ${incident.details}` : ''}
                        </div>
                    ))}
                </div>
            )}
            {pointsNonFaits.length > 0 && (
                <div style={{ marginTop: 8 }}>
                    <strong><WarningOutlined style={{ color: '#faad14' }} /> Points non faits</strong>
                    {pointsNonFaits.map((point, index) => (
                        <div key={index}>• {point.prestation} — {point.nom}{point.motif ? ` : ${point.motif}` : ''}</div>
                    ))}
                </div>
            )}
        </div>
    );
    return (
        <Popover content={content} title="Suivi de la prestation">
            <span>
                {children}
                {alerte && <WarningOutlined style={{ color: '#faad14' }} />}
            </span>
        </Popover>
    );
}
