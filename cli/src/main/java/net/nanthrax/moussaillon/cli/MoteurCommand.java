package net.nanthrax.moussaillon.cli;

import jakarta.inject.Inject;
import jakarta.json.Json;
import jakarta.json.JsonObjectBuilder;
import picocli.CommandLine;

@CommandLine.Command(
        name = "moteurs",
        description = "Gestion du catalogue de moteurs",
        mixinStandardHelpOptions = true,
        subcommands = {
                MoteurCommand.List.class,
                MoteurCommand.Get.class,
                MoteurCommand.Search.class,
                MoteurCommand.Create.class,
                MoteurCommand.Update.class,
                MoteurCommand.Delete.class
        }
)
public class MoteurCommand {

    @CommandLine.Command(name = "list", description = "Lister tous les moteurs du catalogue")
    static class List implements Runnable {
        @Inject ApiClient api;

        @CommandLine.Option(names = "--json", description = "Afficher en JSON")
        boolean json;

        @Override
        public void run() {
            try {
                String response = api.get("/catalogue/moteurs");
                if (json) {
                    System.out.println(api.prettyPrint(response));
                } else {
                    System.out.println(api.formatTable(response, "id", "designation", "type", "puissance", "prixPublic", "stock"));
                }
            } catch (Exception e) {
                System.err.println("Erreur : " + e.getMessage());
            }
        }
    }

    @CommandLine.Command(name = "get", description = "Afficher un moteur par ID")
    static class Get implements Runnable {
        @Inject ApiClient api;

        @CommandLine.Parameters(index = "0", description = "ID du moteur")
        long id;

        @Override
        public void run() {
            try {
                System.out.println(api.prettyPrint(api.get("/catalogue/moteurs/" + id)));
            } catch (Exception e) {
                System.err.println("Erreur : " + e.getMessage());
            }
        }
    }

    @CommandLine.Command(name = "search", description = "Rechercher des moteurs")
    static class Search implements Runnable {
        @Inject ApiClient api;

        @CommandLine.Parameters(index = "0", description = "Terme de recherche")
        String query;

        @CommandLine.Option(names = "--json", description = "Afficher en JSON")
        boolean json;

        @Override
        public void run() {
            try {
                String response = api.get("/catalogue/moteurs/search?q=" + api.encodeQuery(query));
                if (json) {
                    System.out.println(api.prettyPrint(response));
                } else {
                    System.out.println(api.formatTable(response, "id", "designation", "type", "puissance", "prixPublic", "stock"));
                }
            } catch (Exception e) {
                System.err.println("Erreur : " + e.getMessage());
            }
        }
    }

    @CommandLine.Command(name = "create", description = "Ajouter un moteur au catalogue")
    static class Create implements Runnable {
        @Inject ApiClient api;

        @CommandLine.Option(names = "--designation", required = true, description = "Désignation")
        String designation;

        @CommandLine.Option(names = "--type", required = true, description = "Type de moteur")
        String type;

        @CommandLine.Option(names = "--puissance", description = "Puissance")
        String puissance;

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
                        .add("designation", designation)
                        .add("type", type);
                if (puissance != null) builder.add("puissance", puissance);
                if (prixPublic != null) builder.add("prixPublic", prixPublic);
                if (stock != null) builder.add("stock", stock);
                if (description != null) builder.add("description", description);
                String response = api.post("/catalogue/moteurs", builder.build().toString());
                System.out.println("Moteur créé :");
                System.out.println(api.prettyPrint(response));
            } catch (Exception e) {
                System.err.println("Erreur : " + e.getMessage());
            }
        }
    }

    @CommandLine.Command(name = "update", description = "Mettre à jour un moteur")
    static class Update implements Runnable {
        @Inject ApiClient api;

        @CommandLine.Parameters(index = "0", description = "ID du moteur")
        long id;

        @CommandLine.Option(names = "--designation", description = "Désignation")
        String designation;

        @CommandLine.Option(names = "--type", description = "Type")
        String type;

        @CommandLine.Option(names = "--puissance", description = "Puissance")
        String puissance;

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
                if (designation != null) builder.add("designation", designation);
                if (type != null) builder.add("type", type);
                if (puissance != null) builder.add("puissance", puissance);
                if (prixPublic != null) builder.add("prixPublic", prixPublic);
                if (stock != null) builder.add("stock", stock);
                if (description != null) builder.add("description", description);
                String response = api.mergeAndPut("/catalogue/moteurs/" + id, builder.build().toString());
                System.out.println("Moteur mis à jour :");
                System.out.println(api.prettyPrint(response));
            } catch (Exception e) {
                System.err.println("Erreur : " + e.getMessage());
            }
        }
    }

    @CommandLine.Command(name = "delete", description = "Supprimer un moteur du catalogue")
    static class Delete implements Runnable {
        @Inject ApiClient api;

        @CommandLine.Parameters(index = "0", description = "ID du moteur")
        long id;

        @Override
        public void run() {
            try {
                api.delete("/catalogue/moteurs/" + id);
                System.out.println("Moteur " + id + " supprimé.");
            } catch (Exception e) {
                System.err.println("Erreur : " + e.getMessage());
            }
        }
    }
}
