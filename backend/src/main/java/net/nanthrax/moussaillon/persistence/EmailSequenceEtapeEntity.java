package net.nanthrax.moussaillon.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;

import java.util.List;

@Entity
public class EmailSequenceEtapeEntity extends PanacheEntityChantier {

    public enum Cible {
        CLIENT,
        BATEAU,
        MOTEUR,
        REMORQUE
    }

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    public Cible cible = Cible.CLIENT;

    @Column(nullable = false)
    public int ordre;

    @Column(nullable = false)
    public int delaiJours;

    @Column(nullable = false)
    public String sujet;

    @Column(nullable = false, length = 10000)
    public String contenu;

    public String description;

    public boolean actif = true;

    public static List<EmailSequenceEtapeEntity> listActivesByCible(Cible cible) {
        return list("actif = true and cible = ?1 order by ordre", cible);
    }

    public static List<EmailSequenceEtapeEntity> listAllOrdered() {
        return list("order by cible, ordre");
    }

    public static List<EmailSequenceEtapeEntity> listByCible(Cible cible) {
        return list("cible = ?1 order by ordre", cible);
    }

}
