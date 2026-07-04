import { fetchWithAuth } from './api.ts';
import { useState, useEffect } from 'react';
import { Card, Space, Descriptions, Spin, message } from 'antd';
import { CreditCardOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const formatDate = (value) => (value ? dayjs(value).format('DD/MM/YYYY') : '—');

const formatMontant = (value) => (value != null
    ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
    : '—');

export default function Facturation() {

    const [ societe, setSociete ] = useState();

    useEffect(() => {
       fetchWithAuth('./societe')
       .then((response) => {
            if (!response.ok) {
                throw new Error('Erreur (code ' + response.status + ')');
            };
            return response.json();
       })
       .then(data => {
           setSociete(data);
       })
       .catch((error) => {
            message.error('Une erreur est survenue: ' + error.message);
            console.error(error)
       })
    }, []);

    if (!societe) {
        return(<Spin/>);
    }

    return(
      <Card title={<Space><CreditCardOutlined/> Facturation</Space>}>
          <Descriptions
              title="Abonnement"
              column={1}
              bordered
              size="small"
          >
              <Descriptions.Item label="Date d'activation (paiement one-shot)">
                  {formatDate(societe.abonnementActivationDate)}
              </Descriptions.Item>
              <Descriptions.Item label="Montant d'activation">
                  {formatMontant(societe.abonnementActivationMontant)}
              </Descriptions.Item>
              <Descriptions.Item label="Prochaine échéance">
                  {formatDate(societe.abonnementProchainPaiementDate)}
              </Descriptions.Item>
              <Descriptions.Item label="Montant à payer">
                  {formatMontant(societe.abonnementProchainPaiementMontant)}
              </Descriptions.Item>
          </Descriptions>
      </Card>
    );

}
