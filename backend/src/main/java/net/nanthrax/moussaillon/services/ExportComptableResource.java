package net.nanthrax.moussaillon.services;

import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import net.nanthrax.moussaillon.persistence.AvoirEntity;
import net.nanthrax.moussaillon.persistence.ClientEntity;
import net.nanthrax.moussaillon.persistence.ParametresComptablesEntity;
import net.nanthrax.moussaillon.persistence.SocieteEntity;
import net.nanthrax.moussaillon.persistence.VenteBateauCatalogueEntity;
import net.nanthrax.moussaillon.persistence.VenteEntity;
import net.nanthrax.moussaillon.persistence.VenteForfaitEntity;
import net.nanthrax.moussaillon.persistence.VenteHeliceCatalogueEntity;
import net.nanthrax.moussaillon.persistence.VenteMoteurCatalogueEntity;
import net.nanthrax.moussaillon.persistence.VentePaiementEntity;
import net.nanthrax.moussaillon.persistence.VenteProduitEntity;
import net.nanthrax.moussaillon.persistence.VenteRemorqueCatalogueEntity;
import net.nanthrax.moussaillon.persistence.VenteServiceEntity;

/**
 * Export des écritures comptables d'une période, pour le comptable :
 * <ul>
 *   <li>journal des ventes : factures émises à leur date d'émission et avoirs émis, le chiffre d'affaires HT (remise
 *   globale déduite, comme dans les KPIs financiers) ventilé entre prestations, marchandises et occasion au prorata
 *   des lignes de la facture ;</li>
 *   <li>en option, journaux de banque et de caisse : règlements des factures (hors avoirs utilisés en règlement, déjà
 *   portés au compte du client par l'avoir) et remboursements d'avoirs. À ne pas exporter si le comptable importe
 *   déjà les relevés bancaires, sous peine de compter les encaissements deux fois.</li>
 * </ul>
 * Le fichier suit le format du fichier des écritures comptables (FEC, article A 47 A-1 du livre des procédures
 * fiscales), que les logiciels comptables savent importer : une première ligne nommant les 18 zones, puis une ligne
 * par compte mouvementé, zones séparées par une tabulation, dates AAAAMMJJ, montants avec une virgule décimale, en
 * UTF-8. Les lignes d'une même écriture partagent son numéro, en séquence continue dans l'ordre chronologique, et le
 * compte clients porte le client en compte auxiliaire. Ce n'est qu'un extrait de la période : le FEC de l'exercice,
 * remis à l'administration fiscale, reste produit par le logiciel du comptable.
 */
@Path("/export-comptable")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
public class ExportComptableResource {

    // Zones du FEC, dans l'ordre imposé (article A 47 A-1, VII)
    static final List<String> ZONES_FEC = List.of("JournalCode", "JournalLib", "EcritureNum", "EcritureDate", "CompteNum",
        "CompteLib", "CompAuxNum", "CompAuxLib", "PieceRef", "PieceDate", "EcritureLib", "Debit", "Credit", "EcritureLet",
        "DateLet", "ValidDate", "Montantdevise", "Idevise");
    private static final DateTimeFormatter DATE_FEC = DateTimeFormatter.BASIC_ISO_DATE;
    private static final String JOURNAL_VENTES = "Journal des ventes";
    private static final String JOURNAL_BANQUE = "Journal de banque";
    private static final String JOURNAL_CAISSE = "Journal de caisse";

    /** Ligne d'écriture : un montant au débit ou au crédit d'un compte. */
    public static class Ecriture {
        // Numéro de l'écriture, commun à ses lignes
        public int numero;
        public LocalDate date;
        public String journal;
        public String journalLibelle;
        public String compte;
        public String compteLibelle;
        public String compteAuxiliaire;
        public String compteAuxiliaireLibelle;
        public String piece;
        public String libelle;
        public double debit;
        public double credit;
    }

    @GET
    @Path("parametres")
    public ParametresComptablesEntity parametres() {
        return ParametresComptablesEntity.courants();
    }

    @PUT
    @Path("parametres")
    @Consumes(MediaType.APPLICATION_JSON)
    @Transactional
    public ParametresComptablesEntity modifierParametres(ParametresComptablesEntity parametres) {
        if (parametres == null) {
            throw requeteInvalide("Les paramètres comptables sont requis");
        }
        ParametresComptablesEntity entity = ParametresComptablesEntity.courants();
        entity.journalVentes = journal(parametres.journalVentes, "du journal des ventes");
        entity.journalBanque = journal(parametres.journalBanque, "du journal de banque");
        entity.journalCaisse = journal(parametres.journalCaisse, "du journal de caisse");
        entity.compteClients = compte(parametres.compteClients, "Le compte clients");
        entity.comptePrestations = compte(parametres.comptePrestations, "Le compte des prestations");
        entity.compteMarchandises = compte(parametres.compteMarchandises, "Le compte des marchandises");
        entity.compteOccasion = compte(parametres.compteOccasion, "Le compte des ventes d'occasion");
        entity.compteTvaCollectee = compte(parametres.compteTvaCollectee, "Le compte de TVA collectée");
        entity.compteBanque = compte(parametres.compteBanque, "Le compte de banque");
        entity.compteCaisse = compte(parametres.compteCaisse, "Le compte de caisse");
        if (!entity.isPersistent()) {
            entity.persist();
        }
        return entity;
    }

    /** Écritures de la période, du premier au dernier jour inclus. */
    @GET
    @Path("ecritures")
    public List<Ecriture> ecritures(@QueryParam("debut") String debut, @QueryParam("fin") String fin,
                                    @QueryParam("reglements") boolean reglements) {
        LocalDate premierJour = date(debut, "de début");
        LocalDate dernierJour = date(fin, "de fin");
        verifierPeriode(premierJour, dernierJour);
        return ecrituresPeriode(premierJour, dernierJour, reglements);
    }

    /** Écritures de la période au format FEC, nommées comme un FEC : SIREN, « FEC », date du dernier jour. */
    @GET
    @Path("fec")
    @Produces(MediaType.TEXT_PLAIN)
    public Response fec(@QueryParam("debut") String debut, @QueryParam("fin") String fin,
                        @QueryParam("reglements") boolean reglements) {
        LocalDate premierJour = date(debut, "de début");
        LocalDate dernierJour = date(fin, "de fin");
        verifierPeriode(premierJour, dernierJour);
        byte[] fichier = formatFec(ecrituresPeriode(premierJour, dernierJour, reglements)).getBytes(StandardCharsets.UTF_8);
        SocieteEntity societe = SocieteEntity.courante();
        String siren = societe != null && societe.siren != null ? societe.siren.replaceAll("\\s", "") : "";
        String nom = siren + "FEC" + dernierJour.format(DATE_FEC) + ".txt";
        return Response.ok(fichier)
            .header("Content-Disposition", "attachment; filename=\"" + nom + "\"")
            .header("Content-Type", "text/plain; charset=UTF-8")
            .build();
    }

    static List<Ecriture> ecrituresPeriode(LocalDate premierJour, LocalDate dernierJour, boolean reglements) {
        ParametresComptablesEntity parametres = ParametresComptablesEntity.courants();
        Timestamp debut = Timestamp.valueOf(premierJour.atStartOfDay());
        Timestamp finExclue = Timestamp.valueOf(dernierJour.plusDays(1).atStartOfDay());

        // Une écriture par document (facture, avoir, règlement), ses lignes équilibrées
        List<List<Ecriture>> pieces = new ArrayList<>();
        String dateFacture = "coalesce(v.dateFacturePrete, v.dateFacturePayee, v.date)";
        List<VenteEntity> factures = VenteEntity.list("from VenteEntity v where v.numeroFacture like ?1 and "
            + dateFacture + " >= ?2 and " + dateFacture + " < ?3", "FA%", debut, finExclue);
        for (VenteEntity facture : factures) {
            pieces.add(facture(facture, parametres));
        }
        String dateAvoir = "coalesce(a.dateEmission, a.dateCreation)";
        List<AvoirEntity> avoirs = AvoirEntity.list("from AvoirEntity a where a.status in ?1 and "
            + dateAvoir + " >= ?2 and " + dateAvoir + " < ?3",
            List.of(AvoirEntity.Status.EMIS, AvoirEntity.Status.REMBOURSE), debut, finExclue);
        for (AvoirEntity avoir : avoirs) {
            pieces.add(avoir(avoir, parametres));
        }
        if (reglements) {
            reglements(pieces, parametres, debut, finExclue);
        }

        // Écritures numérotées en séquence continue, dans l'ordre chronologique (sans brouillard, la date de validation
        // est celle de l'écriture)
        pieces.removeIf(List::isEmpty);
        pieces.sort(Comparator.<List<Ecriture>, LocalDate>comparing(e -> e.get(0).date)
            .thenComparing(e -> e.get(0).journal)
            .thenComparing(e -> e.get(0).piece));
        List<Ecriture> ecritures = new ArrayList<>();
        int numero = 0;
        for (List<Ecriture> piece : pieces) {
            numero++;
            for (Ecriture ecriture : piece) {
                ecriture.numero = numero;
                ecritures.add(ecriture);
            }
        }
        return ecritures;
    }

    /** Facture : le client au débit du TTC, le chiffre d'affaires HT et la TVA collectée au crédit. */
    static List<Ecriture> facture(VenteEntity vente, ParametresComptablesEntity parametres) {
        double ttc = arrondi(vente.prixVenteTTC);
        double ht = arrondi(KpiFinancierResource.caHT(vente));
        Piece piece = new Piece(parametres, jour(KpiFinancierResource.dateFacture(vente)), parametres.journalVentes,
            JOURNAL_VENTES, libelle("Facture", vente.client), vente.numeroFacture);
        piece.client(vente.client, ttc);
        repartir(ht, poidsParCompte(vente, parametres), parametres.comptePrestations)
            .forEach((compte, montant) -> piece.mouvement(compte, -montant));
        piece.mouvement(parametres.compteTvaCollectee, -arrondi(ttc - ht));
        return piece.ecritures;
    }

    /**
     * Avoir : écriture inverse d'une facture. Son montant HT est ventilé comme la facture d'origine,
     * ou en prestations s'il n'est rattaché à aucune facture.
     */
    static List<Ecriture> avoir(AvoirEntity avoir, ParametresComptablesEntity parametres) {
        LocalDate date = jour(avoir.dateEmission != null ? avoir.dateEmission : avoir.dateCreation);
        double ttc = arrondi(avoir.montantTTC);
        double ht = arrondi(avoir.montantHT > 0 ? avoir.montantHT : avoir.montantTTC / (1 + avoir.tva / 100.0));
        Map<String, Double> poids = avoir.vente != null ? poidsParCompte(avoir.vente, parametres) : Map.of();
        Piece piece = new Piece(parametres, date, parametres.journalVentes, JOURNAL_VENTES, libelle("Avoir", avoir.client),
            reference(avoir));
        piece.client(avoir.client, -ttc);
        repartir(ht, poids, parametres.comptePrestations).forEach(piece::mouvement);
        piece.mouvement(parametres.compteTvaCollectee, arrondi(ttc - ht));
        return piece.ecritures;
    }

    /**
     * Règlements de la période, comme les encaissements des KPIs financiers : paiements des ventes (un avoir utilisé
     * en règlement n'est pas un encaissement), ventes payées sans règlement saisi à leur date de paiement,
     * remboursements d'avoirs (la part de l'avoir qui n'a pas servi à régler une facture).
     */
    private static void reglements(List<List<Ecriture>> pieces, ParametresComptablesEntity parametres,
                                   Timestamp debut, Timestamp finExclue) {
        String datePaiement = "coalesce(p.date, v.dateFacturePayee, v.date)";
        List<Object[]> paiements = VenteEntity.getEntityManager().createQuery(
                "select v, p from VenteEntity v join v.paiements p where (p.mode is null or p.mode <> ?1) and "
                    + datePaiement + " >= ?2 and " + datePaiement + " < ?3", Object[].class)
            .setParameter(1, VentePaiementEntity.Mode.AVOIR).setParameter(2, debut).setParameter(3, finExclue)
            .getResultList();
        for (Object[] ligne : paiements) {
            VenteEntity vente = (VenteEntity) ligne[0];
            VentePaiementEntity paiement = (VentePaiementEntity) ligne[1];
            Timestamp date = paiement.date != null ? paiement.date : datePaiement(vente);
            String mode = paiement.mode != null ? paiement.mode.name() : null;
            pieces.add(encaissement(parametres, jour(date), mode, vente, paiement.montant));
        }

        String datePayee = "coalesce(v.dateFacturePayee, v.date)";
        List<VenteEntity> payeesSansReglement = VenteEntity.list("from VenteEntity v where v.status = ?1 and v.paiements is empty and "
            + datePayee + " >= ?2 and " + datePayee + " < ?3", VenteEntity.Status.FACTURE_PAYEE, debut, finExclue);
        for (VenteEntity vente : payeesSansReglement) {
            String mode = vente.modePaiement != null ? vente.modePaiement.name() : null;
            pieces.add(encaissement(parametres, jour(datePaiement(vente)), mode, vente, vente.prixVenteTTC));
        }

        String dateRemboursement = "coalesce(a.dateRemboursement, a.dateEmission, a.dateCreation)";
        List<AvoirEntity> rembourses = AvoirEntity.list("from AvoirEntity a where a.status = ?1 and "
            + dateRemboursement + " >= ?2 and " + dateRemboursement + " < ?3", AvoirEntity.Status.REMBOURSE, debut, finExclue);
        for (AvoirEntity avoir : rembourses) {
            Timestamp date = avoir.dateRemboursement != null ? avoir.dateRemboursement
                : avoir.dateEmission != null ? avoir.dateEmission : avoir.dateCreation;
            boolean especes = avoir.modeRemboursement == AvoirEntity.ModeRemboursement.ESPÈCES;
            Piece piece = tresorerie(parametres, jour(date), especes, libelle("Remboursement", avoir.client), reference(avoir));
            double montant = arrondi(avoir.montantTTC - avoir.montantUtilise);
            piece.client(avoir.client, montant);
            piece.mouvement(especes ? parametres.compteCaisse : parametres.compteBanque, -montant);
            pieces.add(piece.ecritures);
        }
    }

    // Encaissement d'une vente : en caisse pour les espèces, en banque sinon (chèque, virement, carte)
    private static List<Ecriture> encaissement(ParametresComptablesEntity parametres, LocalDate date, String mode,
                                               VenteEntity vente, double montant) {
        boolean especes = VentePaiementEntity.Mode.ESPÈCES.name().equals(mode);
        String piece = vente.numeroFacture != null ? vente.numeroFacture : "V" + vente.id;
        Piece reglement = tresorerie(parametres, date, especes, libelle(libelleMode(mode), vente.client), piece);
        reglement.mouvement(especes ? parametres.compteCaisse : parametres.compteBanque, arrondi(montant));
        reglement.client(vente.client, -arrondi(montant));
        return reglement.ecritures;
    }

    private static Piece tresorerie(ParametresComptablesEntity parametres, LocalDate date, boolean especes,
                                    String libelle, String reference) {
        return especes
            ? new Piece(parametres, date, parametres.journalCaisse, JOURNAL_CAISSE, libelle, reference)
            : new Piece(parametres, date, parametres.journalBanque, JOURNAL_BANQUE, libelle, reference);
    }

    private static Timestamp datePaiement(VenteEntity vente) {
        return vente.dateFacturePayee != null ? vente.dateFacturePayee : vente.date;
    }

    private static String libelleMode(String mode) {
        if (mode == null) {
            return "Règlement";
        }
        return switch (mode) {
            case "CHEQUE" -> "Chèque";
            case "VIREMENT" -> "Virement";
            case "CARTE" -> "Carte";
            case "ESPÈCES" -> "Espèces";
            default -> "Règlement";
        };
    }

    /**
     * Montant HT des lignes de la vente cumulé par compte de produits : main d'oeuvre, hivernage et gardiennage en
     * prestations, articles neufs en marchandises, articles d'occasion à part.
     */
    static Map<String, Double> poidsParCompte(VenteEntity vente, ParametresComptablesEntity parametres) {
        Map<Object, Double> poids = KpiFinancierResource.poidsLignes(vente);
        Map<String, Double> parCompte = new LinkedHashMap<>();
        for (VenteForfaitEntity vf : vente.venteForfaits) {
            cumuler(parCompte, parametres.comptePrestations, poids.get(vf));
        }
        for (VenteServiceEntity vs : vente.venteServices) {
            cumuler(parCompte, parametres.comptePrestations, poids.get(vs));
        }
        for (VenteProduitEntity vp : vente.venteProduits) {
            if (vp.produit == null) continue;
            String compte = KpiFinancierResource.hivernageOuGardiennage(vp.produit)
                ? parametres.comptePrestations : compteArticle(parametres, vp.produit.occasion);
            cumuler(parCompte, compte, poids.get(vp));
        }
        for (VenteBateauCatalogueEntity vb : vente.venteBateauxCatalogue) {
            if (vb.bateau == null) continue;
            cumuler(parCompte, compteArticle(parametres, vb.bateau.occasion), poids.get(vb));
        }
        for (VenteMoteurCatalogueEntity vm : vente.venteMoteursCatalogue) {
            if (vm.moteur == null) continue;
            cumuler(parCompte, compteArticle(parametres, vm.moteur.occasion), poids.get(vm));
        }
        for (VenteHeliceCatalogueEntity vh : vente.venteHelicesCatalogue) {
            if (vh.helice == null) continue;
            cumuler(parCompte, compteArticle(parametres, vh.helice.occasion), poids.get(vh));
        }
        for (VenteRemorqueCatalogueEntity vr : vente.venteRemorquesCatalogue) {
            if (vr.remorque == null) continue;
            cumuler(parCompte, compteArticle(parametres, vr.remorque.occasion), poids.get(vr));
        }
        return parCompte;
    }

    private static String compteArticle(ParametresComptablesEntity parametres, boolean occasion) {
        return occasion ? parametres.compteOccasion : parametres.compteMarchandises;
    }

    private static void cumuler(Map<String, Double> parCompte, String compte, Double poids) {
        if (poids != null && poids > 0) {
            parCompte.merge(compte, poids, Double::sum);
        }
    }

    /**
     * Répartit un montant entre les comptes au prorata de leur poids, au centime : l'écart d'arrondi revient au compte
     * le plus important, pour que l'écriture reste équilibrée. Sans poids, tout va au compte par défaut.
     */
    static Map<String, Double> repartir(double montant, Map<String, Double> poids, String compteParDefaut) {
        double total = poids.values().stream().mapToDouble(Double::doubleValue).sum();
        Map<String, Double> parts = new LinkedHashMap<>();
        if (total <= 0) {
            parts.put(compteParDefaut, montant);
            return parts;
        }
        String principal = null;
        double reparti = 0;
        for (Map.Entry<String, Double> compte : poids.entrySet()) {
            double part = arrondi(montant * compte.getValue() / total);
            parts.put(compte.getKey(), part);
            reparti += part;
            if (principal == null || compte.getValue() > poids.get(principal)) {
                principal = compte.getKey();
            }
        }
        parts.put(principal, arrondi(parts.get(principal) + montant - reparti));
        return parts;
    }

    /** Fichier au format FEC : la ligne des noms de zones, puis une ligne par compte mouvementé. */
    static String formatFec(List<Ecriture> ecritures) {
        StringBuilder fichier = new StringBuilder(String.join("\t", ZONES_FEC)).append("\r\n");
        for (Ecriture ecriture : ecritures) {
            // Pièce justificative datée du jour de l'écriture, validée à cette date (pas de brouillard)
            String date = ecriture.date.format(DATE_FEC);
            List<String> zones = List.of(
                texte(ecriture.journal), texte(ecriture.journalLibelle), String.valueOf(ecriture.numero), date,
                texte(ecriture.compte), texte(ecriture.compteLibelle),
                texte(ecriture.compteAuxiliaire), texte(ecriture.compteAuxiliaireLibelle),
                texte(ecriture.piece), date, texte(ecriture.libelle),
                montant(ecriture.debit), montant(ecriture.credit),
                // Lettrage et devise : non utilisés
                "", "", date, "", "");
            fichier.append(String.join("\t", zones)).append("\r\n");
        }
        return fichier.toString();
    }

    // Texte d'une zone, sans tabulation ni fin de ligne qui la couperaient
    private static String texte(String valeur) {
        return valeur == null ? "" : valeur.replaceAll("[\\t\\r\\n]+", " ").trim();
    }

    // Montant au centime, virgule décimale et sans séparateur de milliers ; zéro dans la colonne non mouvementée
    private static String montant(double montant) {
        return String.format(Locale.ROOT, "%.2f", montant).replace('.', ',');
    }

    // Intitulés des comptes, selon le plan comptable général
    private static String intituleCompte(ParametresComptablesEntity parametres, String compte) {
        if (compte.equals(parametres.compteClients)) return "Clients";
        if (compte.equals(parametres.comptePrestations)) return "Prestations de services";
        if (compte.equals(parametres.compteMarchandises)) return "Ventes de marchandises";
        if (compte.equals(parametres.compteOccasion)) return "Ventes de biens d'occasion";
        if (compte.equals(parametres.compteTvaCollectee)) return "TVA collectée";
        if (compte.equals(parametres.compteBanque)) return "Banques";
        if (compte.equals(parametres.compteCaisse)) return "Caisse";
        return compte;
    }

    /** Lignes d'une même écriture : une par compte, au débit si le montant est positif, au crédit sinon. */
    private static class Piece {
        final ParametresComptablesEntity parametres;
        final LocalDate date;
        final String journal;
        final String journalLibelle;
        final String libelle;
        final String reference;
        final List<Ecriture> ecritures = new ArrayList<>();

        Piece(ParametresComptablesEntity parametres, LocalDate date, String journal, String journalLibelle,
              String libelle, String reference) {
            this.parametres = parametres;
            this.date = date;
            this.journal = journal;
            this.journalLibelle = journalLibelle;
            this.libelle = libelle;
            this.reference = reference;
        }

        Ecriture mouvement(String compte, double montant) {
            if (Math.abs(montant) < 0.005) {
                return null;
            }
            Ecriture ecriture = new Ecriture();
            ecriture.date = date;
            ecriture.journal = journal;
            ecriture.journalLibelle = journalLibelle;
            ecriture.compte = compte;
            ecriture.compteLibelle = intituleCompte(parametres, compte);
            ecriture.piece = reference;
            ecriture.libelle = libelle;
            ecriture.debit = montant > 0 ? montant : 0;
            ecriture.credit = montant < 0 ? -montant : 0;
            ecritures.add(ecriture);
            return ecriture;
        }

        // Compte clients, le client en compte auxiliaire
        void client(ClientEntity client, double montant) {
            Ecriture ecriture = mouvement(parametres.compteClients, montant);
            if (ecriture != null && client != null && client.id != null) {
                ecriture.compteAuxiliaire = compteAuxiliaire(client);
                ecriture.compteAuxiliaireLibelle = client.nom;
            }
        }
    }

    /** Compte auxiliaire d'un client : « C » suivi de son identifiant. */
    static String compteAuxiliaire(ClientEntity client) {
        return String.format("C%06d", client.id);
    }

    private static String libelle(String operation, ClientEntity client) {
        return operation + " " + (client != null && client.nom != null ? client.nom : "client divers");
    }

    private static String reference(AvoirEntity avoir) {
        return avoir.reference != null ? avoir.reference : "AV" + avoir.id;
    }

    private static LocalDate jour(Timestamp date) {
        return date.toLocalDateTime().toLocalDate();
    }

    private static double arrondi(double montant) {
        return Math.round(montant * 100.0) / 100.0;
    }

    private static LocalDate date(String valeur, String libelle) {
        if (valeur == null || valeur.isBlank()) {
            throw requeteInvalide("La date " + libelle + " est requise");
        }
        try {
            return LocalDate.parse(valeur);
        } catch (DateTimeParseException e) {
            throw requeteInvalide("La date " + libelle + " est invalide (format attendu : AAAA-MM-JJ)");
        }
    }

    private static void verifierPeriode(LocalDate premierJour, LocalDate dernierJour) {
        if (dernierJour.isBefore(premierJour)) {
            throw requeteInvalide("La date de fin doit suivre la date de début");
        }
    }

    private static String journal(String code, String libelle) {
        String valeur = code == null ? "" : code.trim().toUpperCase(Locale.ROOT);
        if (!valeur.matches("[A-Z0-9]{1,10}")) {
            throw requeteInvalide("Le code " + libelle + " doit compter de 1 à 10 lettres ou chiffres");
        }
        return valeur;
    }

    // Numéro de compte du FEC : ses trois premiers caractères sont les chiffres du plan comptable général
    private static String compte(String numero, String libelle) {
        String valeur = numero == null ? "" : numero.trim().toUpperCase(Locale.ROOT);
        if (!valeur.matches("[0-9]{3}[A-Z0-9]{0,17}")) {
            throw requeteInvalide(libelle + " doit commencer par les 3 chiffres du plan comptable (20 caractères au plus)");
        }
        return valeur;
    }

    private static WebApplicationException requeteInvalide(String message) {
        return new WebApplicationException(Response.status(Response.Status.BAD_REQUEST)
            .entity(Map.of("error", message)).type(MediaType.APPLICATION_JSON).build());
    }

}
