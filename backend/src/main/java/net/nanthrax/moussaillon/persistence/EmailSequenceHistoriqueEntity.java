package net.nanthrax.moussaillon.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.ManyToOne;

import java.sql.Timestamp;

@Entity
public class EmailSequenceHistoriqueEntity extends PanacheEntityChantier {

    @Enumerated(EnumType.STRING)
    public EmailSequenceEtapeEntity.Cible cible;

    public Long cibleId;

    @ManyToOne
    public EmailSequenceEtapeEntity etape;

    public String destinataire;

    public String sujet;

    @Column(length = EmailTemplateEntity.LONGUEUR_CONTENU)
    public String contenu;

    public Timestamp dateEnvoi;

    public static boolean dejaSent(EmailSequenceEtapeEntity.Cible cible, long cibleId, long etapeId) {
        return count("cible = ?1 and cibleId = ?2 and etape.id = ?3", cible, cibleId, etapeId) > 0;
    }

}
