import React, { useEffect, useState } from 'react';
import { Tooltip } from 'antd';
import { EuroCircleFilled } from '@ant-design/icons';
import api from './api.ts';

interface AnnonceActive {
    bateau?: { id: number };
    moteur?: { id: number };
}

export interface MaterielsAVendre {
    bateaux: Set<number>;
    moteurs: Set<number>;
    recharger: () => void;
}

/**
 * Bateaux et moteurs clients à vendre, c'est-à-dire liés à une petite annonce active.
 */
export function useMaterielsAVendre(): MaterielsAVendre {
    const [annonces, setAnnonces] = useState<AnnonceActive[]>([]);

    const recharger = () => {
        api.get<AnnonceActive[]>('/annonces/active')
            .then((res) => setAnnonces(res.data || []))
            .catch(() => setAnnonces([]));
    };

    useEffect(() => {
        recharger();
    }, []);

    const ids = (cle: 'bateau' | 'moteur') =>
        new Set(annonces.map((a) => a[cle]?.id).filter((id): id is number => id != null));
    return { bateaux: ids('bateau'), moteurs: ids('moteur'), recharger };
}

/** Icône « À vendre » affichée à côté du nom du matériel ; rien n'est affiché s'il n'est pas à vendre. */
export default function AVendreIcon({ aVendre }: { aVendre: boolean }) {
    if (!aVendre) {
        return null;
    }
    return (
        <Tooltip title="À vendre : petite annonce active">
            <EuroCircleFilled aria-label="À vendre" style={{ color: '#52c41a', fontSize: 16 }} />
        </Tooltip>
    );
}
