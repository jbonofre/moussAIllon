package net.nanthrax.moussaillon.persistence;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.json.bind.annotation.JsonbTypeAdapter;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;

import java.sql.Timestamp;
import java.util.regex.Pattern;

/**
 * Chantier hébergé par l'instance, géré depuis l'application d'administration. Commun à tous les chantiers
 * (pas de colonne chantier) : ses données (société, utilisateurs, ventes...) portent son code.
 */
@Entity
public class ChantierEntity extends PanacheEntityBase {

    public static final int LONGUEUR_CODE = 40;

    // Lettres minuscules, chiffres et tirets, commençant par une lettre ou un chiffre.
    private static final Pattern FORMAT_CODE = Pattern.compile("[a-z0-9][a-z0-9-]{1," + (LONGUEUR_CODE - 1) + "}");

    // Code saisi à la connexion (ou passé dans le lien ?chantier=code). Il ne change que depuis l'administration,
    // qui le remplace aussi dans toutes les données du chantier.
    @Id
    @Column(length = LONGUEUR_CODE)
    public String code;

    @Column(nullable = false)
    public String nom;

    // Contact du chantier pour l'éditeur.
    public String email;

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp dateCreation;

    // Accès coupé par l'administrateur : plus aucune connexion ni requête (chantier, client, technicien),
    // et plus aucun envoi automatique (relances, campagnes...).
    public boolean accesSuspendu;

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp accesSuspenduDate;

    // Abonnement gratuit : les accès ne sont jamais bloqués (abonnement non activé, impayé ou résilié)
    // et les modules s'ajoutent sans paiement.
    public boolean gratuit;

    // Fin de la période d'essai gratuite (chantier inscrit depuis l'espace chantier) : jusque-là, l'accès n'est
    // pas limité à la facturation sans abonnement activé. Un abonnement activé pendant l'essai démarre à cette date.
    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp essaiFin;

    public static boolean codeValide(String code) {
        return code != null && FORMAT_CODE.matcher(code).matches();
    }

    /** Code saisi par l'utilisateur, ramené au format des codes (minuscules, sans espaces autour). */
    public static String normaliser(String code) {
        return code == null ? null : code.trim().toLowerCase(java.util.Locale.ROOT);
    }

}
