package net.nanthrax.moussaillon.services;

import java.time.LocalDate;
import java.util.List;
import java.util.function.Supplier;

import jakarta.persistence.LockModeType;
import net.nanthrax.moussaillon.persistence.AvoirEntity;
import net.nanthrax.moussaillon.persistence.CompteurDocumentEntity;
import net.nanthrax.moussaillon.persistence.VenteEntity;

/**
 * Numéros des factures (FA26-000001) et des avoirs (AV-2026-00001), attribués à leur émission : chronologiques et
 * continus, par chantier et par année (article 242 nonies A de l'annexe II du CGI). Les devis, ordres de réparation
 * et factures en attente gardent un numéro provisoire, tiré de leur identifiant.
 */
public final class NumerotationDocuments {

    private NumerotationDocuments() {
    }

    /** Numéro de la prochaine facture émise. */
    public static String prochaineFacture() {
        int annee = LocalDate.now().getYear();
        String prefixe = String.format("FA%02d-", annee % 100);
        long numero = prochain("FA", annee, prefixe, () -> VenteEntity.getEntityManager()
            .createQuery("select v.numeroFacture from VenteEntity v where v.numeroFacture like ?1", String.class)
            .setParameter(1, prefixe + "%")
            .getResultList());
        return prefixe + String.format("%06d", numero);
    }

    /** Numéro du prochain avoir émis. */
    public static String prochainAvoir() {
        int annee = LocalDate.now().getYear();
        String prefixe = String.format("AV-%d-", annee);
        long numero = prochain("AV", annee, prefixe, () -> AvoirEntity.getEntityManager()
            .createQuery("select a.reference from AvoirEntity a where a.reference like ?1", String.class)
            .setParameter(1, prefixe + "%")
            .getResultList());
        return prefixe + String.format("%05d", numero);
    }

    private static long prochain(String serie, int annee, String prefixe, Supplier<List<String>> numerosAttribues) {
        CompteurDocumentEntity compteur = CompteurDocumentEntity.<CompteurDocumentEntity>find("serie = ?1 and annee = ?2", serie, annee)
            .withLock(LockModeType.PESSIMISTIC_WRITE)
            .firstResult();
        if (compteur == null) {
            compteur = new CompteurDocumentEntity();
            compteur.serie = serie;
            compteur.annee = annee;
            // Première émission de l'année depuis la mise en place du compteur : la série reprend après les numéros
            // déjà attribués (auparavant tirés de l'identifiant du document)
            compteur.dernier = dernierNumero(numerosAttribues.get(), prefixe);
            compteur.persist();
        }
        compteur.dernier++;
        return compteur.dernier;
    }

    static long dernierNumero(List<String> numeros, String prefixe) {
        long dernier = 0;
        for (String numero : numeros) {
            String suffixe = numero.substring(prefixe.length());
            if (!suffixe.isEmpty() && suffixe.chars().allMatch(Character::isDigit) && suffixe.length() < 18) {
                dernier = Math.max(dernier, Long.parseLong(suffixe));
            }
        }
        return dernier;
    }

}
