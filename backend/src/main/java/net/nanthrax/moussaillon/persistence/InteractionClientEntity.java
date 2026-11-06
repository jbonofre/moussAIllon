package net.nanthrax.moussaillon.persistence;

import jakarta.json.bind.annotation.JsonbProperty;
import jakarta.json.bind.annotation.JsonbTransient;
import jakarta.json.bind.annotation.JsonbTypeAdapter;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.ManyToOne;

import java.sql.Timestamp;

/**
 * Suivi commercial d'un client ou d'un prospect : un échange qui a eu lieu (appel, email, visite...),
 * ou une action commerciale à faire à une échéance (rappeler, envoyer une offre...), confiée à un utilisateur.
 */
@Entity
public class InteractionClientEntity extends PanacheEntityChantier {

    public enum Type {
        APPEL,
        EMAIL,
        VISITE,
        RENDEZ_VOUS,
        NOTE
    }

    public enum Statut {
        A_FAIRE,
        FAITE
    }

    @ManyToOne(optional = false)
    @JsonbTransient
    public ClientEntity client;

    @JsonbProperty("clientId")
    public Long getClientId() {
        return client != null ? client.id : null;
    }

    @JsonbProperty("clientNom")
    public String getClientNom() {
        return client != null ? client.nom : null;
    }

    // Coordonnées affichées dans la liste des actions, pour rappeler le client sans ouvrir sa fiche
    @JsonbProperty("clientTelephone")
    public String getClientTelephone() {
        return client != null ? client.telephone : null;
    }

    @JsonbProperty("clientEmail")
    public String getClientEmail() {
        return client != null ? client.email : null;
    }

    @JsonbProperty("clientStatut")
    public ClientEntity.Statut getClientStatut() {
        return client != null ? client.statut : null;
    }

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    public Type type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    public Statut statut;

    @Column(nullable = false)
    public String sujet;

    @Column(length = 10000)
    public String compteRendu;

    // Date de l'échange, ou échéance de l'action à faire
    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp date;

    // Action faite : date à laquelle elle a été marquée comme faite
    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp dateRealisation;

    // Utilisateur chargé de l'action, ou qui a eu l'échange
    public String utilisateur;

    public String creePar;

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp dateCreation;

}
