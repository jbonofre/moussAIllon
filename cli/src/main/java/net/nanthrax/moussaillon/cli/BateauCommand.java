package net.nanthrax.moussaillon.cli;

import jakarta.inject.Inject;
import jakarta.json.Json;
import jakarta.json.JsonObjectBuilder;
import picocli.CommandLine;

@CommandLine.Command(
        name = "bateaux",
        description = "Gestion du catalogue de bateaux",
        mixinStandardHelpOptions = true,
        subcommands = {
                BateauCommand.List.class,
                BateauCommand.Get.class,
                BateauCommand.Search.class,
                BateauCommand.Create.class,
                BateauCommand.Update.class,
                BateauCommand.Delete.class
        }
)
public class BateauCommand {

    @CommandLine.Command(name = "list", description = "Lister tous les bateaux du catalogue")
    static class List implements Runnable {
        @Inject ApiClient api;

        @CommandLine.Option(names = "--json", description = "Afficher en JSON")
        boolean json;

        @Override
        public void run() {
            try {
                String response = api.get("/catalogue/bateaux");
                if (json) {
                    System.out.println(api.prettyPrint(response));
                } else {
                    System.out.println(api.formatTable(response, "id", "marque", "modele", "type", "anneeDebut", "anneeFin", "prixPublic", "stock"));
                }
            } catch (Exception e) {
                System.err.println("Erreur : " + e.getMessage());
            }
        }
    }

    @CommandLine.Command(name = "get", description = "Afficher un bateau par ID")
    static class Get implements Runnable {
        @Inject ApiClient api;

        @CommandLine.Parameters(index = "0", description = "ID du bateau")
        long id;

        @Override
        public void run() {
            try {
                System.out.println(api.prettyPrint(api.get("/catalogue/bateaux/" + id)));
            } catch (Exception e) {
                System.err.println("Erreur : " + e.getMessage());
            }
        }
    }

    @CommandLine.Command(name = "search", description = "Rechercher des bateaux")
    static class Search implements Runnable {
        @Inject ApiClient api;

        @CommandLine.Parameters(index = "0", description = "Terme de recherche")
        String query;

        @CommandLine.Option(names = "--json", description = "Afficher en JSON")
        boolean json;

        @Override
        public void run() {
            try {
                String response = api.get("/catalogue/bateaux/search?q=" + api.encodeQuery(query));
                if (json) {
                    System.out.println(api.prettyPrint(response));
                } else {
                    System.out.println(api.formatTable(response, "id", "marque", "modele", "type", "anneeDebut", "anneeFin", "prixPublic", "stock"));
                }
            } catch (Exception e) {
                System.err.println("Erreur : " + e.getMessage());
            }
        }
    }

    @CommandLine.Command(name = "create", description = "Ajouter un bateau au catalogue")
    static class Create implements Runnable {
        @Inject ApiClient api;

        @CommandLine.Option(names = "--marque", required = true, description = "Marque")
        String marque;

        @CommandLine.Option(names = "--modele", required = true, description = "Modèle")
        String modele;

        @CommandLine.Option(names = "--type", required = true, description = "Type de bateau")
        String type;

        @CommandLine.Option(names = "--annee-debut", description = "Année début")
        Integer anneeDebut;

        @CommandLine.Option(names = "--annee-fin", description = "Année fin")
        Integer anneeFin;

        @CommandLine.Option(names = "--prix-public", description = "Prix public")
        Double prixPublic;

        @CommandLine.Option(names = "--stock", description = "Stock")
        Long stock;

        @CommandLine.Option(names = "--description", description = "Description")
        String description;

        @Override
        public void run() {
            try {
                JsonObjectBuilder builder = Json.createObjectBuilder()
                        .add("marque", marque)
                        .add("modele", modele)
                        .add("type", type);
                if (anneeDebut != null) builder.add("anneeDebut", anneeDebut);
                if (anneeFin != null) builder.add("anneeFin", anneeFin);
                if (prixPublic != null) builder.add("prixPublic", prixPublic);
                if (stock != null) builder.add("stock", stock);
                if (description != null) builder.add("description", description);
                String response = api.post("/catalogue/bateaux", builder.build().toString());
                System.out.println("Bateau créé :");
                System.out.println(api.prettyPrint(response));
            } catch (Exception e) {
                System.err.println("Erreur : " + e.getMessage());
            }
        }
    }

    @CommandLine.Command(name = "update", description = "Mettre à jour un bateau")
    static class Update implements Runnable {
        @Inject ApiClient api;

        @CommandLine.Parameters(index = "0", description = "ID du bateau")
        long id;

        @CommandLine.Option(names = "--marque", description = "Marque")
        String marque;

        @CommandLine.Option(names = "--modele", description = "Modèle")
        String modele;

        @CommandLine.Option(names = "--type", description = "Type de bateau")
        String type;

        @CommandLine.Option(names = "--annee-debut", description = "Année début")
        Integer anneeDebut;

        @CommandLine.Option(names = "--annee-fin", description = "Année fin")
        Integer anneeFin;

        @CommandLine.Option(names = "--prix-public", description = "Prix public")
        Double prixPublic;

        @CommandLine.Option(names = "--stock", description = "Stock")
        Long stock;

        @CommandLine.Option(names = "--description", description = "Description")
        String description;

        @Override
        public void run() {
            try {
                JsonObjectBuilder builder = Json.createObjectBuilder();
                if (marque != null) builder.add("marque", marque);
                if (modele != null) builder.add("modele", modele);
                if (type != null) builder.add("type", type);
                if (anneeDebut != null) builder.add("anneeDebut", anneeDebut);
                if (anneeFin != null) builder.add("anneeFin", anneeFin);
                if (prixPublic != null) builder.add("prixPublic", prixPublic);
                if (stock != null) builder.add("stock", stock);
                if (description != null) builder.add("description", description);
                String response = api.mergeAndPut("/catalogue/bateaux/" + id, builder.build().toString());
                System.out.println("Bateau mis à jour :");
                System.out.println(api.prettyPrint(response));
            } catch (Exception e) {
                System.err.println("Erreur : " + e.getMessage());
            }
        }
    }

    @CommandLine.Command(name = "delete", description = "Supprimer un bateau du catalogue")
    static class Delete implements Runnable {
        @Inject ApiClient api;

        @CommandLine.Parameters(index = "0", description = "ID du bateau")
        long id;

        @Override
        public void run() {
            try {
                api.delete("/catalogue/bateaux/" + id);
                System.out.println("Bateau " + id + " supprimé.");
            } catch (Exception e) {
                System.err.println("Erreur : " + e.getMessage());
            }
        }
    }
}
