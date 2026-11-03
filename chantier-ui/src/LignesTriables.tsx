import React, { createContext, useContext } from 'react';
import type { FormListFieldData } from 'antd';
import { HolderOutlined } from '@ant-design/icons';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import type { Announcements, DragEndEvent, Modifier, UniqueIdentifier } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';

// Lignes d'un Form.List réordonnées par glisser-déposer : chaque ligne se déplace par sa poignée,
// pour que la saisie dans ses champs reste possible.

const idLigne = (field: FormListFieldData) => `ligne-${field.key}`;

// Identifiants des lignes déplaçables de la liste
const ListeContext = createContext<string[]>([]);

const LigneContext = createContext<Partial<Pick<ReturnType<typeof useSortable>, 'attributes' | 'listeners' | 'setActivatorNodeRef'>> & { triable: boolean }>({ triable: false });

const verticalSeulement: Modifier = ({ transform }) => ({ ...transform, x: 0 });

const indexLigne = (fields: FormListFieldData[], id: UniqueIdentifier) => fields.findIndex((field) => idLigne(field) === id);

const annonces: Announcements = {
    onDragStart: () => 'Ligne saisie.',
    onDragOver: () => undefined,
    onDragEnd: ({ over }) => (over ? 'Ligne déplacée.' : 'Ligne relâchée.'),
    onDragCancel: () => 'Déplacement annulé.',
};

interface ListeTriableProps {
    fields: FormListFieldData[];
    move: (from: number, to: number) => void;
    // Ligne déplaçable : la ligne vide de saisie, en fin de liste, reste à sa place
    triable?: (field: FormListFieldData) => boolean;
    disabled?: boolean;
    children: React.ReactNode;
}

export function ListeTriable({ fields, move, triable = () => true, disabled, children }: ListeTriableProps) {
    const sensors = useSensors(
        // Un léger déplacement est requis : un simple clic sur la poignée ne déclenche rien
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );
    const ids = disabled ? [] : fields.filter(triable).map(idLigne);
    const onDragEnd = ({ active, over }: DragEndEvent) => {
        if (!over || active.id === over.id) return;
        const from = indexLigne(fields, active.id);
        const to = indexLigne(fields, over.id);
        if (from >= 0 && to >= 0) move(from, to);
    };
    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[verticalSeulement]}
            onDragEnd={onDragEnd}
            accessibility={{
                announcements: annonces,
                screenReaderInstructions: { draggable: 'Appuyez sur Espace pour saisir la ligne, sur les flèches pour la déplacer, puis sur Espace pour la déposer ou Échap pour annuler.' },
            }}
        >
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                <ListeContext.Provider value={ids}>{children}</ListeContext.Provider>
            </SortableContext>
        </DndContext>
    );
}

export function LigneTriable({ field, children }: { field: FormListFieldData; children: React.ReactNode }) {
    const ids = useContext(ListeContext);
    const id = idLigne(field);
    // Une ligne seule n'a nulle part où aller
    const triable = ids.length > 1 && ids.includes(id);
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !triable });
    const style: React.CSSProperties = {
        transform: transform ? `translate3d(0, ${transform.y}px, 0)` : undefined,
        transition,
        position: 'relative',
        zIndex: isDragging ? 10 : undefined,
        opacity: isDragging ? 0.85 : undefined,
    };
    return (
        <LigneContext.Provider value={{ triable, attributes, listeners, setActivatorNodeRef }}>
            <div ref={setNodeRef} style={style}>{children}</div>
        </LigneContext.Provider>
    );
}

// Poignée en tête de ligne ; sa place est réservée même sans poignée, pour garder les colonnes alignées
export function PoigneeLigne({ style }: { style?: React.CSSProperties }) {
    const { triable, attributes, listeners, setActivatorNodeRef } = useContext(LigneContext);
    return (
        <div style={{ width: 16, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 32, ...style }}>
            {triable && (
                <span
                    ref={setActivatorNodeRef}
                    {...attributes}
                    {...listeners}
                    aria-label="Déplacer la ligne"
                    title="Glisser pour déplacer la ligne"
                    style={{ cursor: 'grab', color: '#8c8c8c', touchAction: 'none', lineHeight: 0 }}
                >
                    <HolderOutlined />
                </span>
            )}
        </div>
    );
}
