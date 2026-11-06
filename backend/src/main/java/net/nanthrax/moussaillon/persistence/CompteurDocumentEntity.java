package net.nanthrax.moussaillon.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * Dernier numéro attribué d'une série de documents (factures, avoirs) pour une année, propre à chaque chantier :
 * les factures et les avoirs sont numérotés de façon chronologique et continue (article 242 nonies A de l'annexe II
 * du CGI). Le compteur est verrouillé par la transaction qui attribue le numéro, jusqu'à sa fin.
 */
@Entity
@Table(uniqueConstraints = @UniqueConstraint(columnNames = {"chantier", "serie", "annee"}))
public class CompteurDocumentEntity extends PanacheEntityChantier {

    @Column(nullable = false, length = 8)
    public String serie;

    public int annee;

    public long dernier;

}
