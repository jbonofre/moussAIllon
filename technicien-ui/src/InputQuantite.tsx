import React from 'react';
import { InputNumber } from 'antd';
import type { InputNumberProps } from 'antd';

// Quantité affichée telle quelle (« 1 », « 2.25 ») : sans formateur, le pas de 0.25 l'afficherait avec deux
// décimales (« 1.00 »). Pendant la saisie, le texte tapé est conservé (« 2. » n'est pas ramené à « 2 »).
// Défini hors du composant : un formateur recréé à chaque rendu reformaterait la saisie en cours.
const formaterQuantite = (valeur: number | string | undefined, { userTyping, input }: { userTyping: boolean; input: string }) =>
    userTyping ? input : valeur === undefined || valeur === null ? '' : String(valeur);

// Saisie d'une quantité à virgule (5.5 L d'huile, 0.5 L pour une embase : issue #761), les flèches avançant de 0.25.
// La quantité s'affiche avec un point ; une virgule saisie est lue comme un point (sinon « 2,25 » serait lu 225).
const InputQuantite: React.FC<InputNumberProps<number>> = (props) => (
    <InputNumber<number> min={0.01} step={0.25} decimalSeparator="," formatter={formaterQuantite} {...props} />
);

export default InputQuantite;
