package net.nanthrax.moussaillon.persistence;

import io.quarkus.panache.common.Sort;
import jakarta.persistence.Entity;

/**
 * Plan comptable de l'export des écritures (un par chantier) : codes des journaux et numéros des comptes
 * généraux, à aligner sur ceux du dossier du comptable. Les valeurs par défaut suivent le plan comptable général.
 */
@Entity
public class ParametresComptablesEntity extends PanacheEntityChantier {

    public String journalVentes = "VE";

    public String journalBanque = "BQ";

    public String journalCaisse = "CA";

    public String compteClients = "411000";

    // Main d'oeuvre (forfaits, services), hivernage et gardiennage
    public String comptePrestations = "706000";

    // Pièces, accessoires, bateaux, moteurs, hélices et remorques neufs
    public String compteMarchandises = "707000";

    // Bateaux, moteurs et articles d'occasion, vendus sans TVA
    public String compteOccasion = "707000";

    public String compteTvaCollectee = "445710";

    public String compteBanque = "512000";

    public String compteCaisse = "530000";

    /** Paramètres du chantier courant, ou ceux par défaut s'ils n'ont pas encore été enregistrés. */
    public static ParametresComptablesEntity courants() {
        ParametresComptablesEntity parametres = ParametresComptablesEntity.<ParametresComptablesEntity>findAll(Sort.ascending("id")).firstResult();
        return parametres != null ? parametres : new ParametresComptablesEntity();
    }

}
