package net.nanthrax.moussaillon.services;

import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.context.control.ActivateRequestContext;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import net.nanthrax.moussaillon.persistence.AnnonceEntity;
import net.nanthrax.moussaillon.persistence.ChantierEntity;
import net.nanthrax.moussaillon.persistence.EmailTemplateEntity;
import net.nanthrax.moussaillon.persistence.ModuleApplication;
import net.nanthrax.moussaillon.persistence.PanacheEntityChantier;
import net.nanthrax.moussaillon.persistence.ProduitCatalogueEntity;
import net.nanthrax.moussaillon.persistence.ReferenceValeurEntity;
import net.nanthrax.moussaillon.persistence.SocieteAbonnementMoisEntity;
import net.nanthrax.moussaillon.persistence.SocieteEntity;
import net.nanthrax.moussaillon.persistence.SocietePaiementEntity;
import net.nanthrax.moussaillon.persistence.UserEntity;
import org.eclipse.microprofile.config.ConfigProvider;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.hibernate.Session;
import org.jboss.logging.Logger;

import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@ApplicationScoped
public class DataInitializer {

    private static final Logger LOG = Logger.getLogger(DataInitializer.class);

    // Référentiels créés pour un nouveau chantier (et pour un chantier qui n'en a aucun).
    private static final String[][] REFERENCES_PAR_DEFAUT = {
        {"CATEGORIE_PRODUIT", "Pièces Moteur"},
        {"CATEGORIE_PRODUIT", "Pièces Remorque"},
        {"CATEGORIE_PRODUIT", "Electronique"},
        {"CATEGORIE_PRODUIT", "Sécurité"},
        {"CATEGORIE_PRODUIT", "Equipement & Accessoires"},
        {"CATEGORIE_PRODUIT", "Loisirs"},
        {"TYPE_BATEAU", "Bateau à Moteur"},
        {"TYPE_BATEAU", "Voilier"},
        {"TYPE_BATEAU", "Catamaran"},
        {"TYPE_BATEAU", "Péniche"},
        {"TYPE_BATEAU", "Pêche"},
        {"TYPE_BATEAU", "Annexe"},
        {"TYPE_BATEAU", "Autre"},
        {"TYPE_MOTEUR", "Hors-bord"},
        {"TYPE_MOTEUR", "In-bord"},
        {"TYPE_MOTEUR", "Electrique"},
        {"TYPE_MOTEUR", "Diesel"},
    };

    @Inject
    Chantiers chantiers;

    @Inject
    ClientNomMigrator clientNomMigrator;

    @Inject
    VenteLignesMigrator venteLignesMigrator;

    // Chantier qui reçoit les données d'une base antérieure au multi-chantier.
    @ConfigProperty(name = "chantier.initial", defaultValue = "principal")
    String chantierInitial;

    /**
     * Au démarrage : réparations du schéma et passage multi-chantier (communs à tous les chantiers), puis
     * migrations des données de chaque chantier, chacun dans sa transaction.
     */
    @ActivateRequestContext
    void onStart(@Observes StartupEvent event) {
        List<AncienUtilisateur> anciensUtilisateurs = chantiers.enRacine(() -> {
            repairLegacySchema();
            clientNomMigrator.migrer();
            return SocieteEntity.getEntityManager().unwrap(Session.class).doReturningWork(this::passerEnMultiChantier);
        });
        if (!anciensUtilisateurs.isEmpty()) {
            String code = codeChantierInitial();
            chantiers.dans(code, () -> recreerUtilisateurs(anciensUtilisateurs));
            chantiers.enRacine(() -> SocieteEntity.getEntityManager().unwrap(Session.class).doWork(DataInitializer::supprimerAncienneTableUtilisateurs));
            LOG.infof("%d utilisateur(s) recopié(s) dans le chantier %s", anciensUtilisateurs.size(), code);
        }
        for (String code : chantiers.codes()) {
            try {
                chantiers.dans(code, this::migrerChantier);
            } catch (Exception e) {
                LOG.errorf(e, "Migration des données du chantier %s impossible", code);
            }
        }
    }

    /** Migrations idempotentes des données du chantier courant. */
    void migrerChantier() {
        // L'utilisateur admin a toujours accès au module Paramétrage.
        UserEntity admin = UserEntity.findByName(UserResource.ADMIN);
        if (admin != null) {
            admin.modules.add(ModuleApplication.PARAMETRAGE);
        }
        if (SocieteEntity.count() == 0) {
            ChantierEntity chantier = ChantierEntity.findById(ChantierContexte.courant());
            creerSociete(chantier != null ? chantier.nom : "A changer", chantier != null ? chantier.email : null);
        }
        if (ReferenceValeurEntity.count() == 0) {
            creerReferences();
        }
        try {
            migrerSuiviAbonnement();
        } catch (Exception e) {
            LOG.warn("Impossible de reconstituer le suivi mensuel de l'abonnement", e);
        }
        EmailTemplateResource.migrerModeleRelance();
        venteLignesMigrator.migrer();
    }

    /**
     * Données d'un nouveau chantier (chantier courant) : sa société, son premier utilisateur, qui a accès à tous
     * les modules, et les référentiels par défaut.
     */
    void initialiserChantier(String nomSociete, String emailSociete, String nomUtilisateur, String motDePasse, String emailUtilisateur) {
        creerSociete(nomSociete, emailSociete);
        UserEntity admin = new UserEntity();
        admin.name = nomUtilisateur;
        admin.modules.addAll(EnumSet.allOf(ModuleApplication.class));
        admin.password = PasswordUtil.hash(motDePasse);
        admin.email = emailUtilisateur;
        admin.persist();
        creerReferences();
    }

    private static void creerSociete(String nom, String email) {
        SocieteEntity societe = new SocieteEntity();
        societe.nom = nom;
        societe.siren = "A changer";
        societe.capital = 0;
        societe.adresse = "A changer";
        societe.email = email;
        societe.dateCreation = SocieteResource.horodatage();
        societe.persist();
    }

    private static void creerReferences() {
        int ordre = 10;
        String currentType = "";
        for (String[] entry : REFERENCES_PAR_DEFAUT) {
            if (!entry[0].equals(currentType)) {
                currentType = entry[0];
                ordre = 10;
            }
            ReferenceValeurEntity ref = new ReferenceValeurEntity();
            ref.type = entry[0];
            ref.valeur = entry[1];
            ref.ordre = ordre;
            ref.persist();
            ordre += 10;
        }
    }

    private String codeChantierInitial() {
        String code = ChantierEntity.normaliser(chantierInitial);
        if (!ChantierEntity.codeValide(code)) {
            throw new IllegalStateException("Code du chantier initial invalide (propriété chantier.initial) : " + chantierInitial);
        }
        return code;
    }

    /** Utilisateur de l'ancienne table UserEntity (clé primaire : son nom), à recopier dans son chantier. */
    record AncienUtilisateur(String name, String password, String email, Integer theme, Set<ModuleApplication> modules) {}

    /**
     * Passage multi-chantier d'une base mono-chantier, en SQL (les lignes sans chantier ne sont visibles d'aucun
     * chantier) : les contraintes d'unicité globales sont remplacées par des contraintes par chantier, et les
     * données existantes (lignes à affecter, voir {@link PanacheEntityChantier#A_AFFECTER}) sont affectées au
     * chantier initial (propriété chantier.initial),
     * créé pour l'occasion. Renvoie les utilisateurs de l'ancienne table UserEntity, à recopier dans ce chantier.
     */
    List<AncienUtilisateur> passerEnMultiChantier(Connection connection) throws SQLException {
        List<String> tables = tablesChantier(connection);
        supprimerUnicitesGlobales(connection, tables);
        List<AncienUtilisateur> anciensUtilisateurs = lireAnciensUtilisateurs(connection);
        List<String> tablesSansChantier = new ArrayList<>();
        for (String table : tables) {
            try (Statement query = connection.createStatement();
                 ResultSet rs = query.executeQuery("SELECT COUNT(*) FROM " + table + " WHERE chantier = '" + PanacheEntityChantier.A_AFFECTER + "'")) {
                if (rs.next() && rs.getLong(1) > 0) {
                    tablesSansChantier.add(table);
                }
            }
        }
        if (tablesSansChantier.isEmpty() && anciensUtilisateurs.isEmpty()) {
            return anciensUtilisateurs;
        }
        String code = codeChantierInitial();
        creerChantierInitial(connection, code);
        for (String table : tablesSansChantier) {
            try (PreparedStatement update = connection.prepareStatement("UPDATE " + table + " SET chantier = ? WHERE chantier = '" + PanacheEntityChantier.A_AFFECTER + "'")) {
                update.setString(1, code);
                int lignes = update.executeUpdate();
                LOG.infof("%s : %d ligne(s) affectée(s) au chantier %s", table, lignes, code);
            }
        }
        return anciensUtilisateurs;
    }

    /**
     * Crée le chantier initial s'il n'existe pas, au nom de la société existante. L'ancienne version « Free »
     * (variable ABONNEMENT_FREE) devient son abonnement gratuit.
     */
    private static void creerChantierInitial(Connection connection, String code) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement("SELECT COUNT(*) FROM ChantierEntity WHERE code = ?")) {
            query.setString(1, code);
            try (ResultSet rs = query.executeQuery()) {
                if (rs.next() && rs.getLong(1) > 0) {
                    return;
                }
            }
        }
        String nom = code;
        String email = null;
        try (Statement query = connection.createStatement();
             ResultSet rs = query.executeQuery("SELECT nom, email FROM SocieteEntity WHERE chantier = '" + PanacheEntityChantier.A_AFFECTER + "' ORDER BY id")) {
            if (rs.next() && rs.getString(1) != null && !rs.getString(1).isBlank()) {
                nom = rs.getString(1);
                email = rs.getString(2);
            }
        }
        boolean gratuit = ConfigProvider.getConfig().getOptionalValue("abonnement.free", Boolean.class).orElse(false);
        try (PreparedStatement insert = connection.prepareStatement(
            "INSERT INTO ChantierEntity (code, nom, email, dateCreation, accesSuspendu, gratuit) VALUES (?, ?, ?, ?, FALSE, ?)")) {
            insert.setString(1, code);
            insert.setString(2, nom);
            insert.setString(3, email);
            insert.setTimestamp(4, SocieteResource.horodatage());
            insert.setBoolean(5, gratuit);
            insert.executeUpdate();
        }
        LOG.infof("Données existantes affectées au chantier %s (%s)%s", code, nom, gratuit ? ", abonnement gratuit" : "");
    }

    /** Tables des données propres à un chantier (colonne chantier). */
    static List<String> tablesChantier(Connection connection) throws SQLException {
        List<String> tables = new ArrayList<>();
        try (Statement query = connection.createStatement();
             ResultSet rs = query.executeQuery(
                 "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.COLUMNS "
                     + "WHERE COLUMN_NAME = 'CHANTIER' AND TABLE_SCHEMA = 'PUBLIC' ORDER BY TABLE_NAME")) {
            while (rs.next()) {
                tables.add(rs.getString(1));
            }
        }
        return tables;
    }

    /**
     * Les contraintes d'unicité créées avant le multi-chantier (nom de fournisseur, type de modèle d'email, code de
     * plateforme d'annonces, valeur de référentiel) portaient sur toute la base : deux chantiers ne pourraient pas
     * avoir le même fournisseur. La mise à jour du schéma ajoute les contraintes par chantier sans supprimer les
     * anciennes : on supprime ici toute contrainte d'unicité d'une table de chantier qui ne porte pas sur le chantier.
     */
    static void supprimerUnicitesGlobales(Connection connection, List<String> tables) throws SQLException {
        Map<String, String> tableParContrainte = new HashMap<>();
        Map<String, Set<String>> colonnesParContrainte = new HashMap<>();
        try (Statement query = connection.createStatement();
             ResultSet rs = query.executeQuery(
                 "SELECT tc.CONSTRAINT_NAME, tc.TABLE_NAME, kcu.COLUMN_NAME "
                     + "FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc "
                     + "JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu "
                     + "ON kcu.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA AND kcu.CONSTRAINT_NAME = tc.CONSTRAINT_NAME "
                     + "WHERE tc.CONSTRAINT_TYPE = 'UNIQUE' AND tc.TABLE_SCHEMA = 'PUBLIC'")) {
            while (rs.next()) {
                String contrainte = rs.getString(1);
                tableParContrainte.put(contrainte, rs.getString(2));
                colonnesParContrainte.computeIfAbsent(contrainte, c -> new HashSet<>()).add(rs.getString(3));
            }
        }
        for (Map.Entry<String, Set<String>> contrainte : colonnesParContrainte.entrySet()) {
            String table = tableParContrainte.get(contrainte.getKey());
            if (!tables.contains(table) || contrainte.getValue().contains("CHANTIER")) {
                continue;
            }
            try (Statement alter = connection.createStatement()) {
                alter.executeUpdate("ALTER TABLE " + table + " DROP CONSTRAINT IF EXISTS \"" + contrainte.getKey() + "\"");
                LOG.infof("Contrainte d'unicité globale supprimée sur %s %s", table, contrainte.getValue());
            }
        }
    }

    /**
     * Utilisateurs de l'ancienne table UserEntity (avant le multi-chantier, leur nom en était la clé primaire), avec
     * leurs modules et, pour les plus anciens, les modules correspondant à leurs rôles.
     */
    static List<AncienUtilisateur> lireAnciensUtilisateurs(Connection connection) throws SQLException {
        List<AncienUtilisateur> utilisateurs = new ArrayList<>();
        if (!tableExiste(connection, "USERENTITY")) {
            return utilisateurs;
        }
        boolean roles = colonneExiste(connection, "USERENTITY", "ROLES");
        boolean modules = tableExiste(connection, "USERENTITY_MODULES");
        try (Statement query = connection.createStatement();
             ResultSet rs = query.executeQuery("SELECT name, password, email, theme" + (roles ? ", roles" : "") + " FROM UserEntity")) {
            while (rs.next()) {
                Object theme = rs.getObject(4);
                Set<ModuleApplication> modulesUtilisateur = EnumSet.noneOf(ModuleApplication.class);
                if (roles) {
                    modulesUtilisateur.addAll(modulesDepuisRoles(rs.getString(5)));
                }
                utilisateurs.add(new AncienUtilisateur(rs.getString(1), rs.getString(2), rs.getString(3),
                    theme instanceof Number nombre ? nombre.intValue() : null, modulesUtilisateur));
            }
        }
        if (modules) {
            Map<String, AncienUtilisateur> parNom = new HashMap<>();
            utilisateurs.forEach(utilisateur -> parNom.put(utilisateur.name(), utilisateur));
            try (Statement query = connection.createStatement();
                 ResultSet rs = query.executeQuery("SELECT UserEntity_name, modules FROM UserEntity_modules")) {
                while (rs.next()) {
                    AncienUtilisateur utilisateur = parNom.get(rs.getString(1));
                    ModuleApplication module = moduleOuNull(rs.getString(2));
                    if (utilisateur != null && module != null) {
                        utilisateur.modules().add(module);
                    }
                }
            }
        }
        return utilisateurs;
    }

    private static ModuleApplication moduleOuNull(String module) {
        try {
            return module == null ? null : ModuleApplication.valueOf(module.trim());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /** Recopie les anciens utilisateurs dans le chantier courant (ceux qui n'y sont pas déjà). */
    private static void recreerUtilisateurs(List<AncienUtilisateur> anciensUtilisateurs) {
        for (AncienUtilisateur ancien : anciensUtilisateurs) {
            if (ancien.name() == null || UserEntity.findByName(ancien.name()) != null) {
                continue;
            }
            UserEntity user = new UserEntity();
            user.name = ancien.name();
            user.password = ancien.password();
            user.email = ancien.email() != null ? ancien.email() : "";
            UserEntity.Theme[] themes = UserEntity.Theme.values();
            user.theme = ancien.theme() != null && ancien.theme() >= 0 && ancien.theme() < themes.length ? themes[ancien.theme()] : null;
            user.modules.addAll(ancien.modules());
            user.persist();
        }
    }

    private static void supprimerAncienneTableUtilisateurs(Connection connection) throws SQLException {
        try (Statement alter = connection.createStatement()) {
            alter.executeUpdate("DROP TABLE IF EXISTS UserEntity_modules");
            alter.executeUpdate("DROP TABLE IF EXISTS UserEntity");
        }
    }

    private static boolean tableExiste(Connection connection, String table) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = ? AND TABLE_SCHEMA = 'PUBLIC'")) {
            query.setString(1, table);
            try (ResultSet rs = query.executeQuery()) {
                return rs.next() && rs.getLong(1) > 0;
            }
        }
    }

    private static boolean colonneExiste(Connection connection, String table, String colonne) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ? AND COLUMN_NAME = ? AND TABLE_SCHEMA = 'PUBLIC'")) {
            query.setString(1, table);
            query.setString(2, colonne);
            try (ResultSet rs = query.executeQuery()) {
                return rs.next() && rs.getLong(1) > 0;
            }
        }
    }

    /**
     * Certaines bases H2 locales/volumes persistants ont accumulé, au fil des refactors,
     * des colonnes NOT NULL (ex. FRAIS, PRIXPUBLIC) qui n'existent plus sur ProduitCatalogueEntity.
     * La stratégie de schéma "update" n'ajoute que les colonnes manquantes et ne supprime jamais
     * les colonnes obsolètes, ce qui fait échouer toute création de produit (issue #439).
     * On supprime ici toute colonne NOT NULL de la table qui ne correspond plus à un champ de
     * l'entité. Ce nettoyage est un no-op sur une base à jour ou fraîchement créée.
     */
    private void repairLegacySchema() {
        try {
            dropOrphanNotNullColumns(ProduitCatalogueEntity.class, "ProduitCatalogueEntity");
        } catch (Exception e) {
            LOG.warn("Impossible de nettoyer les colonnes obsolètes de ProduitCatalogueEntity", e);
        }
        try {
            dropRappelsParVente();
        } catch (Exception e) {
            LOG.warn("Impossible de supprimer les anciennes colonnes de rappel de VenteEntity", e);
        }
        try {
            SocieteEntity.getEntityManager().unwrap(Session.class).doWork(DataInitializer::elargirColonnesTexte);
        } catch (Exception e) {
            LOG.warn("Impossible d'élargir les colonnes des textes mis en forme", e);
        }
        try {
            convertirEnumEnVarchar("EmailTemplateEntity", "type");
        } catch (Exception e) {
            LOG.warn("Impossible de convertir la colonne type de EmailTemplateEntity", e);
        }
        try {
            convertirEnumEnVarchar("SocietePaiementEntity", "type");
        } catch (Exception e) {
            LOG.warn("Impossible de convertir la colonne type de SocietePaiementEntity", e);
        }
        try {
            // Nouveau type de mouvement RECEPTION (réception des commandes fournisseur)
            convertirEnumEnVarchar("ProduitMouvementEntity", "type");
        } catch (Exception e) {
            LOG.warn("Impossible de convertir la colonne type de ProduitMouvementEntity", e);
        }
        try {
            SocieteEntity.getEntityManager().unwrap(Session.class).doWork(DataInitializer::convertirQuantitesEnDecimal);
        } catch (Exception e) {
            LOG.warn("Impossible de convertir les quantités en nombres à virgule", e);
        }
    }

    /** Colonnes des quantités (et du stock des produits) passées d'entiers à nombres à virgule. */
    static final String[][] COLONNES_QUANTITE = {
        { "VenteForfaitEntity", "quantite" },
        { "VenteServiceEntity", "quantite" },
        { "VenteProduitEntity", "quantite" },
        { "VenteBateauCatalogueEntity", "quantite" },
        { "VenteMoteurCatalogueEntity", "quantite" },
        { "VenteHeliceCatalogueEntity", "quantite" },
        { "VenteRemorqueCatalogueEntity", "quantite" },
        { "ForfaitProduitEntity", "quantite" },
        { "ServiceProduitEntity", "quantite" },
        { "PackageLigneEntity", "quantite" },
        { "AvoirLigneEntity", "quantite" },
        { "CommandeFournisseurLigneEntity", "quantite" },
        { "ProduitMouvementEntity", "quantite" },
        { "ProduitMouvementEntity", "stockApres" },
        { "ProduitCatalogueEntity", "stock" },
        { "ProduitCatalogueEntity", "stockMini" },
    };

    /**
     * Les quantités sont des nombres à virgule (5,5 L d'huile, issue #761). La stratégie de schéma "update"
     * ne change pas le type des colonnes existantes : restées en INTEGER, elles arrondiraient 5,5 à 6.
     * Les valeurs et les contraintes (NOT NULL) des colonnes sont conservées.
     */
    static void convertirQuantitesEnDecimal(Connection connection) throws SQLException {
        for (String[] colonne : COLONNES_QUANTITE) {
            String table = colonne[0];
            String nom = colonne[1];
            try (Statement query = connection.createStatement();
                 ResultSet rs = query.executeQuery(
                     "SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS "
                         + "WHERE TABLE_NAME = '" + table.toUpperCase(Locale.ROOT) + "' "
                         + "AND COLUMN_NAME = '" + nom.toUpperCase(Locale.ROOT) + "'")) {
                if (!rs.next() || !"INTEGER".equals(rs.getString(1))) {
                    continue;
                }
            }
            try (Statement alter = connection.createStatement()) {
                alter.executeUpdate("ALTER TABLE " + table + " ALTER COLUMN " + nom + " SET DATA TYPE DOUBLE PRECISION");
                LOG.infof("Colonne %s.%s convertie en nombre à virgule", table, nom);
            }
        }
    }

    /** Modules correspondant aux anciens rôles (liste séparée par des virgules). */
    static Set<ModuleApplication> modulesDepuisRoles(String roles) {
        Set<ModuleApplication> modules = EnumSet.noneOf(ModuleApplication.class);
        if (roles == null) {
            return modules;
        }
        for (String role : roles.split(",")) {
            switch (role.trim().toLowerCase(Locale.ROOT)) {
                case "admin" -> modules.addAll(EnumSet.allOf(ModuleApplication.class));
                case "vendeur" -> modules.add(ModuleApplication.VENTE);
                case "manager" -> modules.add(ModuleApplication.PARC);
                case "magasinier" -> modules.add(ModuleApplication.CATALOGUE);
                default -> { }
            }
        }
        return modules;
    }

    /**
     * H2 crée la colonne d'un enum en ENUM natif, figé sur les valeurs connues à sa création :
     * les valeurs ajoutées depuis y sont refusées. Pour les modèles d'email, le type PRET_A_RECUPERER
     * faisait échouer leur initialisation en bloc, laissant la base sans aucun modèle (dont celui des
     * relances) ; pour les paiements de l'abonnement, le type MODULES (ajout de modules).
     */
    private void convertirEnumEnVarchar(String table, String colonne) {
        EntityManager em = SocieteEntity.getEntityManager();
        em.unwrap(Session.class).doWork(connection -> {
            try (Statement query = connection.createStatement();
                 ResultSet rs = query.executeQuery(
                     "SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS "
                         + "WHERE TABLE_NAME = '" + table.toUpperCase(Locale.ROOT) + "' "
                         + "AND COLUMN_NAME = '" + colonne.toUpperCase(Locale.ROOT) + "'")) {
                if (!rs.next() || !"ENUM".equals(rs.getString(1))) {
                    return;
                }
            }
            try (Statement alter = connection.createStatement()) {
                alter.executeUpdate("ALTER TABLE " + table + " ALTER COLUMN " + colonne + " SET DATA TYPE VARCHAR(64)");
                LOG.infof("Colonne %s.%s convertie en VARCHAR", table, colonne);
            }
        });
    }

    /**
     * L'abonnement est désormais suivi mois par mois et n'est activé qu'au premier paiement : la date
     * d'activation, autrefois celle de la création du compte, est effacée pour un compte qui n'a jamais
     * payé. Pour un compte qui a payé, les mois payés avant ce suivi sont reconstitués à partir des
     * paiements.
     */
    private void migrerSuiviAbonnement() {
        SocieteEntity societe = SocieteEntity.courante();
        if (societe == null) {
            return;
        }
        if (societe.paiements.isEmpty()) {
            if (societe.abonnementActivationDate != null) {
                societe.abonnementActivationDate = null;
                societe.abonnementProchainPaiementDate = null;
                LOG.info("Abonnement jamais payé : il sera activé au premier paiement");
            }
            return;
        }
        if (societe.abonnementProchainPaiementDate == null || SocieteAbonnementMoisEntity.count("societe", societe) > 0) {
            return;
        }
        List<SocieteAbonnementMoisEntity> mois = moisDepuisPaiements(societe.paiements, societe.abonnementProchainPaiementDate);
        for (SocieteAbonnementMoisEntity m : mois) {
            m.societe = societe;
            m.persist();
        }
        LOG.infof("Suivi mensuel de l'abonnement reconstitué : %d mois payés", mois.size());
    }

    /**
     * Mois payés par les paiements mensuels et annuels, chaque paiement ayant couvert les mois précédant
     * l'échéance qui a suivi : on remonte depuis la prochaine échéance, du paiement le plus récent au plus
     * ancien. La période couverte est renseignée sur les paiements qui ne l'ont pas.
     */
    static List<SocieteAbonnementMoisEntity> moisDepuisPaiements(List<SocietePaiementEntity> paiements, Timestamp prochaineEcheance) {
        List<SocietePaiementEntity> recents = new ArrayList<>(paiements);
        recents.sort(Comparator.comparing((SocietePaiementEntity p) -> p.date, Comparator.nullsFirst(Comparator.naturalOrder()))
            .thenComparing(p -> p.id, Comparator.nullsFirst(Comparator.naturalOrder()))
            .reversed());
        List<SocieteAbonnementMoisEntity> mois = new ArrayList<>();
        Timestamp fin = prochaineEcheance;
        for (SocietePaiementEntity paiement : recents) {
            if (paiement.type != SocietePaiementEntity.Type.MENSUEL && paiement.type != SocietePaiementEntity.Type.ANNUEL) {
                continue;
            }
            int nombreMois = paiement.type == SocietePaiementEntity.Type.ANNUEL ? 12 : 1;
            if (paiement.periodeDebut == null) {
                paiement.periodeDebut = SocieteResource.plusMois(fin, -nombreMois);
                paiement.periodeFin = fin;
            }
            double part = SocieteResource.arrondi(paiement.montant / nombreMois);
            // Avant les modules, l'abonnement les comprenait tous.
            Set<ModuleApplication> modules = paiement.modules.isEmpty() ? EnumSet.allOf(ModuleApplication.class) : paiement.modules;
            for (int i = 0; i < nombreMois; i++) {
                SocieteAbonnementMoisEntity m = new SocieteAbonnementMoisEntity();
                m.fin = SocieteResource.plusMois(fin, -i);
                m.debut = SocieteResource.plusMois(fin, -i - 1);
                m.montant = i < nombreMois - 1 ? part : SocieteResource.arrondi(paiement.montant - part * (nombreMois - 1));
                m.nombreUtilisateurs = paiement.nombreUtilisateurs;
                m.nombreTechniciens = paiement.nombreTechniciens;
                m.nombreClients = paiement.nombreClients;
                m.modules.addAll(modules);
                m.payeLe = paiement.date;
                m.typePaiement = paiement.type;
                mois.add(m);
            }
            fin = SocieteResource.plusMois(fin, -nombreMois);
        }
        return mois;
    }

    /** Colonne de texte agrandie au démarrage. */
    record ColonneTexte(String table, String colonne, int longueur) {
    }

    /** Textes mis en forme : HTML des emails (modèle, étape de séquence, campagne ou envoi) et description des annonces. */
    static final List<ColonneTexte> COLONNES_TEXTE = List.of(
        new ColonneTexte("CampagneEntity", "contenu", EmailTemplateEntity.LONGUEUR_CONTENU),
        new ColonneTexte("EmailSequenceEtapeEntity", "contenu", EmailTemplateEntity.LONGUEUR_CONTENU),
        new ColonneTexte("EmailSequenceHistoriqueEntity", "contenu", EmailTemplateEntity.LONGUEUR_CONTENU),
        new ColonneTexte("EmailTemplateEntity", "contenu", EmailTemplateEntity.LONGUEUR_CONTENU),
        new ColonneTexte("RappelHistoriqueEntity", "contenu", EmailTemplateEntity.LONGUEUR_CONTENU),
        new ColonneTexte("AnnonceEntity", "description", AnnonceEntity.LONGUEUR_DESCRIPTION));

    /**
     * Les textes mis en forme dans l'éditeur (issue #757) dépassent vite la taille d'origine de leur colonne : 10000
     * caractères pour les emails, 255 pour l'historique des relances et la description des annonces. L'enregistrement
     * échouait. La stratégie de schéma "update" n'agrandit pas une colonne existante ; les valeurs et le NOT NULL sont
     * conservés.
     */
    static void elargirColonnesTexte(Connection connection) throws SQLException {
        for (ColonneTexte colonne : COLONNES_TEXTE) {
            try (PreparedStatement query = connection.prepareStatement(
                     "SELECT CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ? AND COLUMN_NAME = ?")) {
                query.setString(1, colonne.table().toUpperCase(Locale.ROOT));
                query.setString(2, colonne.colonne().toUpperCase(Locale.ROOT));
                try (ResultSet rs = query.executeQuery()) {
                    if (!rs.next() || rs.getLong(1) >= colonne.longueur()) {
                        continue;
                    }
                }
            }
            try (Statement alter = connection.createStatement()) {
                alter.executeUpdate("ALTER TABLE " + colonne.table() + " ALTER COLUMN " + colonne.colonne()
                        + " SET DATA TYPE VARCHAR(" + colonne.longueur() + ")");
                LOG.infof("Colonne %s.%s élargie à %d caractères", colonne.table(), colonne.colonne(), colonne.longueur());
            }
        }
    }

    /**
     * Les relances sont désormais paramétrées sur la société (issue #682) : les délais et drapeaux
     * de rappel portés par chaque vente disparaissent. Les drapeaux étant NOT NULL sans valeur par
     * défaut, les laisser en base ferait échouer la création des ventes.
     */
    private void dropRappelsParVente() {
        String[] colonnes = { "rappel1Jours", "rappel2Jours", "rappel3Jours", "rappel1Envoye", "rappel2Envoye", "rappel3Envoye" };
        EntityManager em = SocieteEntity.getEntityManager();
        em.unwrap(Session.class).doWork(connection -> {
            try (Statement alter = connection.createStatement()) {
                for (String colonne : colonnes) {
                    alter.executeUpdate("ALTER TABLE VenteEntity DROP COLUMN IF EXISTS " + colonne);
                }
            }
        });
    }

    private void dropOrphanNotNullColumns(Class<?> entityClass, String tableName) {
        // Champs de l'entité et de ses classes parentes (dont la colonne chantier).
        Set<String> expectedColumns = new HashSet<>();
        for (Class<?> type = entityClass; type != null && type != Object.class; type = type.getSuperclass()) {
            for (Field field : type.getDeclaredFields()) {
                if (Modifier.isStatic(field.getModifiers())) {
                    continue;
                }
                expectedColumns.add(field.getName().toLowerCase(Locale.ROOT));
            }
        }

        EntityManager em = ProduitCatalogueEntity.getEntityManager();
        em.unwrap(Session.class).doWork(connection -> {
            List<String> orphanColumns = new ArrayList<>();
            try (Statement query = connection.createStatement();
                 ResultSet rs = query.executeQuery(
                     "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
                         + "WHERE TABLE_NAME = '" + tableName.toUpperCase(Locale.ROOT) + "' AND IS_NULLABLE = 'NO'")) {
                while (rs.next()) {
                    String columnName = rs.getString("COLUMN_NAME");
                    if (!"ID".equals(columnName) && !expectedColumns.contains(columnName.toLowerCase(Locale.ROOT))) {
                        orphanColumns.add(columnName);
                    }
                }
            }
            try (Statement alter = connection.createStatement()) {
                for (String column : orphanColumns) {
                    alter.executeUpdate("ALTER TABLE " + tableName + " DROP COLUMN IF EXISTS \"" + column + "\"");
                    LOG.infof("Colonne obsolète supprimée sur %s : %s", tableName, column);
                }
            }
        });
    }

}
