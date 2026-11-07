import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ReactQuill, { Quill } from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { Button, Input, Modal, Popover, Space, Tooltip, Upload, message } from 'antd';
import { DeleteOutlined, InboxOutlined, LinkOutlined } from '@ant-design/icons';
import api from './api.ts';
import { ajouterInfobulles } from './EditeurTexte.tsx';
import { LARGEUR_CONTENU, LARGEUR_STOCKEE, STYLE_SEPARATEUR, largeurParDefaut, normaliserLien, typeApresConversion } from './editeur-email.ts';

const Delta: any = Quill.import('delta');

// Alignement en style (text-align) plutôt qu'en classe ql-align-* : les messageries n'ont pas la feuille de style de Quill
Quill.register(Quill.import('attributors/style/align') as any, true);

// Séparateur horizontal (<hr>), stylé dans la balise pour être rendu tel quel dans l'email
const BlockEmbed: any = Quill.import('blots/block/embed');
class Separateur extends BlockEmbed {
    static blotName = 'separateur';
    static tagName = 'HR';
    static create() {
        const node = super.create();
        node.setAttribute('style', STYLE_SEPARATEUR);
        return node;
    }
}
Quill.register(Separateur as any, true);
// Un lien saisi sans protocole (www.exemple.fr) ne doit pas devenir une adresse relative à l'application
const Lien: any = Quill.import('formats/link');
const sanitizeLien = Lien.sanitize.bind(Lien);
Lien.sanitize = (url: string) => sanitizeLien(normaliserLien(url));

const icones: any = Quill.import('ui/icons');
icones.separateur = '<svg viewBox="0 0 18 18"><line class="ql-stroke" x1="2" x2="16" y1="9" y2="9"></line></svg>';

const TYPES_IMAGE = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

const TAILLES = [
    { libelle: 'Petite', largeur: Math.round(LARGEUR_CONTENU / 4) },
    { libelle: 'Moyenne', largeur: Math.round(LARGEUR_CONTENU / 2) },
    { libelle: 'Grande', largeur: Math.round((LARGEUR_CONTENU * 3) / 4) },
    { libelle: 'Pleine largeur', largeur: LARGEUR_CONTENU },
];

/** Réduit une photo trop grande (et convertit le WebP, mal lu par Outlook) avant son envoi : elle part dans chaque email. */
async function preparerImage(fichier: File): Promise<File> {
    const type = typeApresConversion(fichier.type);
    if (!type) return fichier;
    try {
        const url = URL.createObjectURL(fichier);
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
        });
        URL.revokeObjectURL(url);
        if (image.naturalWidth <= LARGEUR_STOCKEE && type === fichier.type) return fichier;
        const echelle = Math.min(1, LARGEUR_STOCKEE / image.naturalWidth);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.naturalWidth * echelle);
        canvas.height = Math.round(image.naturalHeight * echelle);
        const contexte = canvas.getContext('2d');
        if (!contexte) return fichier;
        if (type === 'image/jpeg') {
            contexte.fillStyle = '#ffffff';
            contexte.fillRect(0, 0, canvas.width, canvas.height);
        }
        contexte.drawImage(image, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
        if (!blob) return fichier;
        const nom = fichier.name.replace(/\.[^.]*$/, '') + (type === 'image/png' ? '.png' : '.jpg');
        return new File([blob], nom, { type });
    } catch {
        return fichier;
    }
}

async function televerser(fichier: File): Promise<string> {
    const formData = new FormData();
    formData.append('files', await preparerImage(fichier));
    const res = await api.post('/images', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    return res.data[0];
}

/** Largeur naturelle d'une image (une fois chargée), 0 si elle ne se charge pas. */
function largeurNaturelle(url: string): Promise<number> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img.naturalWidth);
        img.onerror = () => resolve(0);
        img.src = url;
    });
}

interface ImageSelectionnee {
    element: HTMLImageElement;
    haut: number;
    gauche: number;
    largeur: number;
    hauteur: number;
}

interface EditeurEmailProps {
    id?: string;
    value?: string;
    onChange?: (valeur: string) => void;
    hauteur?: number;
}

/**
 * Éditeur des emails (campagnes, séquences, modèles) : texte mis en forme, couleurs, alignement, images et
 * séparateurs, dans une colonne de la largeur de l'email envoyé (rendu « newsletter »).
 */
export default function EditeurEmail({ id, value, onChange, hauteur = 300 }: EditeurEmailProps) {
    const quillRef = useRef<ReactQuill>(null);
    const conteneurRef = useRef<HTMLDivElement>(null);
    const barreRef = useRef<HTMLDivElement>(null);
    const positionInsertion = useRef(0);
    const imagesEnCours = useRef(new WeakSet<HTMLImageElement>());
    const [modaleImage, setModaleImage] = useState(false);
    const [urlImage, setUrlImage] = useState('');
    const [envoiImage, setEnvoiImage] = useState(false);
    const [selection, setSelection] = useState<ImageSelectionnee | null>(null);
    const [lienImage, setLienImage] = useState('');

    const editeur = () => quillRef.current?.getEditor();

    const insererImage = async (url: string, index: number) => {
        const quill = editeur();
        if (!quill) return;
        const largeur = largeurParDefaut(await largeurNaturelle(url));
        const attributs = largeur ? { width: String(largeur) } : undefined;
        quill.updateContents(new Delta().retain(index).insert({ image: url }, attributs), 'user');
        quill.setSelection(index + 1, 0, 'user');
    };

    const televerserEtInserer = async (fichiers: File[], index: number) => {
        setEnvoiImage(true);
        try {
            let position = index;
            for (const fichier of fichiers) {
                await insererImage(await televerser(fichier), position);
                position++;
            }
        } catch {
            message.error("Erreur lors de l'envoi de l'image");
        } finally {
            setEnvoiImage(false);
        }
    };

    // Les gestionnaires de Quill sont figés à sa création : ils passent par une référence vers les fonctions à jour
    const actions = useRef({ televerserEtInserer });
    actions.current = { televerserEtInserer };

    const modules = useMemo(() => ({
        toolbar: {
            container: [
                [{ header: [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ color: [] }, { background: [] }],
                [{ align: [] }],
                [{ list: 'ordered' }, { list: 'bullet' }],
                ['blockquote', 'link', 'image', 'separateur'],
                ['clean'],
            ],
            handlers: {
                image: function (this: any) {
                    positionInsertion.current = this.quill.getSelection(true)?.index ?? this.quill.getLength() - 1;
                    setUrlImage('');
                    setModaleImage(true);
                },
                separateur: function (this: any) {
                    const range = this.quill.getSelection(true);
                    const index = range ? range.index : this.quill.getLength() - 1;
                    this.quill.insertEmbed(index, 'separateur', true, 'user');
                    this.quill.setSelection(index + 1, 0, 'user');
                },
            },
        },
        // Images glissées ou collées : envoyées au serveur plutôt qu'intégrées en base64 dans le contenu
        uploader: {
            mimetypes: TYPES_IMAGE,
            handler: (range: { index: number }, fichiers: File[]) => {
                actions.current.televerserEtInserer(fichiers, range.index);
            },
        },
    }), []);

    // Une image collée depuis une page (base64) ou sans largeur est reprise : envoyée au serveur, largeur fixée
    const normaliserImages = useCallback(() => {
        const quill = editeur();
        if (!quill) return;
        quill.root.querySelectorAll('img').forEach((img: HTMLImageElement) => {
            if (imagesEnCours.current.has(img)) return;
            const integree = img.src.startsWith('data:');
            if (!integree && img.hasAttribute('width')) return;
            imagesEnCours.current.add(img);
            const remplacer = async () => {
                let url = img.getAttribute('src') || '';
                if (integree) {
                    const blob = await (await fetch(url)).blob();
                    url = await televerser(new File([blob], 'image', { type: blob.type }));
                }
                const largeur = img.getAttribute('width') || String(largeurParDefaut(await largeurNaturelle(url)) || '');
                const blot = Quill.find(img);
                if (!blot || !img.isConnected || blot instanceof Quill) return;
                const index = quill.getIndex(blot as any);
                if (integree) {
                    const lien = quill.getFormat(index, 1).link;
                    const attributs: Record<string, string> = {};
                    if (largeur) attributs.width = largeur;
                    if (img.alt) attributs.alt = img.alt;
                    if (typeof lien === 'string') attributs.link = lien;
                    quill.updateContents(new Delta().retain(index).delete(1).insert({ image: url }, attributs), 'user');
                } else if (largeur) {
                    quill.formatText(index, 1, 'width', largeur, 'user');
                }
            };
            remplacer().catch(() => message.error("Erreur lors de l'envoi d'une image collée"));
        });
    }, []);

    const placerBarreImage = useCallback((element: HTMLImageElement) => {
        const conteneur = conteneurRef.current;
        if (!conteneur) return;
        const cadre = conteneur.getBoundingClientRect();
        const image = element.getBoundingClientRect();
        setSelection({
            element,
            haut: image.top - cadre.top,
            gauche: image.left - cadre.left,
            largeur: image.width,
            hauteur: image.height,
        });
    }, []);

    useEffect(() => {
        const quill = editeur();
        const conteneur = conteneurRef.current;
        if (!quill || !conteneur) return;
        ajouterInfobulles(conteneur);
        const clic = (e: MouseEvent) => {
            const cible = e.target as HTMLElement;
            if (cible.tagName === 'IMG') {
                placerBarreImage(cible as HTMLImageElement);
            } else {
                setSelection(null);
            }
        };
        const defilement = () => setSelection(null);
        const clicAilleurs = (e: MouseEvent) => {
            const cible = e.target as HTMLElement;
            if (!conteneur.contains(cible) && !cible.closest('.editeur-email-popover')) setSelection(null);
        };
        const infobulle = (quill as any).theme?.tooltip?.textbox;
        infobulle?.setAttribute('data-link', 'https://www.exemple.fr');
        const changement = () => {
            normaliserImages();
            setSelection((courante) => (courante && !courante.element.isConnected ? null : courante));
        };
        quill.root.addEventListener('click', clic);
        // En capture : le défilement a lieu dans le conteneur de Quill, pas sur le nôtre
        conteneur.addEventListener('scroll', defilement, true);
        document.addEventListener('mousedown', clicAilleurs);
        quill.on('text-change', changement);
        normaliserImages();
        return () => {
            quill.root.removeEventListener('click', clic);
            conteneur.removeEventListener('scroll', defilement, true);
            document.removeEventListener('mousedown', clicAilleurs);
            quill.off('text-change', changement);
        };
    }, [normaliserImages, placerBarreImage]);

    // La barre reste dans le cadre de l'éditeur, même sous une image centrée ou alignée à droite
    useLayoutEffect(() => {
        const barre = barreRef.current;
        const conteneur = conteneurRef.current;
        if (!barre || !conteneur || !selection) return;
        const maximum = Math.max(0, conteneur.clientWidth - barre.offsetWidth);
        barre.style.left = `${Math.min(Math.max(0, selection.gauche), maximum)}px`;
    }, [selection]);

    const indexSelection = () => {
        const quill = editeur();
        if (!quill || !selection) return null;
        const blot = Quill.find(selection.element);
        if (!blot || blot instanceof Quill) return null;
        return { quill, index: quill.getIndex(blot as any) };
    };

    const redimensionner = (largeur: number) => {
        const cible = indexSelection();
        if (!cible || !selection) return;
        cible.quill.formatText(cible.index, 1, 'width', String(largeur), 'user');
        const element = selection.element;
        requestAnimationFrame(() => placerBarreImage(element));
    };

    const tailleOrigine = async () => {
        if (!selection) return;
        const largeur = largeurParDefaut(await largeurNaturelle(selection.element.src));
        if (largeur) redimensionner(largeur);
    };

    const appliquerLien = () => {
        const cible = indexSelection();
        if (!cible) return;
        const lien = lienImage.trim();
        cible.quill.formatText(cible.index, 1, 'link', lien || false, 'user');
        setSelection(null);
    };

    const supprimerImage = () => {
        const cible = indexSelection();
        if (!cible) return;
        cible.quill.deleteText(cible.index, 1, 'user');
        setSelection(null);
    };

    const insererDepuisUrl = async () => {
        const url = normaliserLien(urlImage.trim());
        if (!url) return;
        setModaleImage(false);
        await insererImage(url, positionInsertion.current);
    };

    const largeurCourante = selection ? Number(selection.element.getAttribute('width')) : 0;
    const lienCourant = selection?.element.closest('a')?.getAttribute('href') || '';

    return (
        <div ref={conteneurRef} className="editeur-email" style={{ position: 'relative' }}>
            <ReactQuill
                id={id}
                ref={quillRef}
                theme="snow"
                value={value}
                onChange={(valeur) => onChange?.(valeur)}
                modules={modules}
                style={{ height: hauteur, marginBottom: 42 }}
            />
            {selection && (
                <div
                    className="editeur-email-cadre-image"
                    style={{ top: selection.haut, left: selection.gauche, width: selection.largeur, height: selection.hauteur }}
                />
            )}
            {selection && (
                <div ref={barreRef} className="editeur-email-barre-image" style={{ top: selection.haut + selection.hauteur + 6 }}>
                    <Space size={4}>
                        {TAILLES.map((taille) => (
                            <Button
                                key={taille.largeur}
                                size="small"
                                type={largeurCourante === taille.largeur ? 'primary' : 'default'}
                                onClick={() => redimensionner(taille.largeur)}
                            >
                                {taille.libelle}
                            </Button>
                        ))}
                        <Button size="small" onClick={tailleOrigine}>Taille d'origine</Button>
                        <Popover
                            classNames={{ root: 'editeur-email-popover' }}
                            trigger="click"
                            title="Lien de l'image"
                            onOpenChange={(ouvert) => ouvert && setLienImage(lienCourant)}
                            content={(
                                <Space.Compact style={{ width: 320 }}>
                                    <Input
                                        placeholder="https://..."
                                        value={lienImage}
                                        onChange={(e) => setLienImage(e.target.value)}
                                        onPressEnter={appliquerLien}
                                        autoFocus
                                    />
                                    <Button type="primary" onClick={appliquerLien}>OK</Button>
                                </Space.Compact>
                            )}
                        >
                            <Tooltip title={lienCourant ? `Lien : ${lienCourant}` : 'Ajouter un lien sur l\'image'}>
                                <Button size="small" icon={<LinkOutlined />} type={lienCourant ? 'primary' : 'default'} />
                            </Tooltip>
                        </Popover>
                        <Tooltip title="Supprimer l'image">
                            <Button size="small" danger icon={<DeleteOutlined />} onClick={supprimerImage} />
                        </Tooltip>
                    </Space>
                </div>
            )}
            <Modal
                title="Insérer une image"
                open={modaleImage}
                onCancel={() => setModaleImage(false)}
                footer={null}
                destroyOnHidden
            >
                <Upload.Dragger
                    accept={TYPES_IMAGE.join(',')}
                    multiple
                    showUploadList={false}
                    disabled={envoiImage}
                    beforeUpload={(fichier, liste) => {
                        // Un seul envoi pour toute la sélection, déclenché sur le dernier fichier
                        if (fichier === liste[liste.length - 1]) {
                            setModaleImage(false);
                            televerserEtInserer(liste as File[], positionInsertion.current);
                        }
                        return Upload.LIST_IGNORE;
                    }}
                >
                    <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                    <p className="ant-upload-text">Cliquer ou glisser-déposer une image ici</p>
                    <p className="ant-upload-hint">JPG, PNG, GIF ou WebP. Les grandes photos sont réduites pour l'email.</p>
                </Upload.Dragger>
                <Space.Compact style={{ width: '100%', marginTop: 12 }}>
                    <Input
                        prefix={<LinkOutlined />}
                        placeholder="Ou l'adresse d'une image en ligne (https://...)"
                        value={urlImage}
                        onChange={(e) => setUrlImage(e.target.value)}
                        onPressEnter={insererDepuisUrl}
                    />
                    <Button type="primary" onClick={insererDepuisUrl} disabled={!urlImage.trim()}>Insérer</Button>
                </Space.Compact>
            </Modal>
        </div>
    );
}
