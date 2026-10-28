package net.nanthrax.moussaillon.persistence;

import java.sql.Timestamp;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.json.bind.annotation.JsonbProperty;
import jakarta.json.bind.annotation.JsonbTransient;
import jakarta.json.bind.annotation.JsonbTypeAdapter;
import jakarta.persistence.Entity;

@Entity
public class BanqueConnecteurEntity extends PanacheEntity {

    public String nom;

    public String banque;

    public String iban;

    public String bic;

    public String notes;

    @jakarta.persistence.Column(columnDefinition = "boolean default true")
    public boolean actif = true;

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp dernierRapprochement;

    // Nombre de règlements pointés lors du dernier rapprochement
    public int dernierNbRapproches;

    // MANUEL (import de relevé CSV) ou POWENS (synchronisation via l'agrégateur DSP2, ex. Crédit Agricole)
    public String fournisseur = "MANUEL";

    // Configuration Powens : jamais renvoyée au client
    @JsonbTransient
    public String powensDomain;

    @JsonbTransient
    public String powensClientId;

    @JsonbTransient
    public String powensClientSecret;

    @JsonbTransient
    public String powensUserToken;

    @JsonbTransient
    public Long powensConnectionId;

    @JsonbProperty("powensConfigure")
    public boolean isPowensConfigure() {
        return powensDomain != null && powensClientId != null && powensClientSecret != null;
    }

    @JsonbProperty("powensConnecte")
    public boolean isPowensConnecte() {
        return powensUserToken != null && powensConnectionId != null;
    }

}
