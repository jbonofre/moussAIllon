package net.nanthrax.moussaillon.cli;

import jakarta.inject.Inject;
import jakarta.json.Json;
import jakarta.json.JsonObjectBuilder;
import picocli.CommandLine;

@CommandLine.Command(
        name = "clients",
        description = "Gestion des clients",
        mixinStandardHelpOptions = true,
        subcommands = {
                ClientCommand.List.class,
                ClientCommand.Get.class,
                ClientCommand.Search.class,
                ClientCommand.Create.class,
                ClientCommand.Update.class,
                ClientCommand.Delete.class
        }
)
public class ClientCommand {

    @CommandLine.Command(name = "list", description = "Lister tous les clients")
    static class List implements Runnable {
        @Inject ApiClient api;

        @CommandLine.Option(names = "--json", description = "Afficher en JSON")
        boolean json;

        @Override
        public void run() {
            try {
                String response = api.get("/clients");
                if (json) {
                    System.out.println(api.prettyPrint(response));
                } else {
                    System.out.println(api.formatTable(response, "id", "type", "nom", "email", "telephone"));
                }
            } catch (Exception e) {
                System.err.println("Erreur : " + e.getMessage());
            }
        }
    }

    @CommandLine.Command(name = "get", description = "Afficher un client par ID")
    static class Get implements Runnable {
        @Inject ApiClient api;

        @CommandLine.Parameters(index = "0", description = "ID du client")
        long id;

        @Override
        public void run() {
            try {
                System.out.println(api.prettyPrint(api.get("/clients/" + id)));
            } catch (Exception e) {
                System.err.println("Erreur : " + e.getMessage());
            }
        }
    }

    @CommandLine.Command(name = "search", description = "Rechercher des clients")
    static class Search implements Runnable {
        @Inject ApiClient api;

        @CommandLine.Parameters(index = "0", description = "Terme de recherche")
        String query;

        @CommandLine.Option(names = "--json", description = "Afficher en JSON")
        boolean json;

        @Override
        public void run() {
            try {
                String response = api.get("/clients/search?q=" + api.encodeQuery(query));
                if (json) {
                    System.out.println(api.prettyPrint(response));
                } else {
                    System.out.println(api.formatTable(response, "id", "type", "nom", "email", "telephone"));
                }
            } catch (Exception e) {
                System.err.println("Erreur : " + e.getMessage());
            }
        }
    }

    @CommandLine.Command(name = "create", description = "Créer un client")
    static class Create implements Runnable {
        @Inject ApiClient api;

        @CommandLine.Option(names = "--nom", required = true, description = "Nom du client")
        String nom;

        @CommandLine.Option(names = "--type", required = true, description = "Type (particulier, professionnel)")
        String type;

        @CommandLine.Option(names = "--email", description = "Email")
        String email;

        @CommandLine.Option(names = "--telephone", description = "Téléphone")
        String telephone;

        @CommandLine.Option(names = "--adresse", description = "Adresse")
        String adresse;

        @Override
        public void run() {
            try {
                JsonObjectBuilder builder = Json.createObjectBuilder()
                        .add("nom", nom)
                        .add("type", type);
                if (email != null) builder.add("email", email);
                if (telephone != null) builder.add("telephone", telephone);
                if (adresse != null) builder.add("adresse", adresse);
                String response = api.post("/clients", builder.build().toString());
                System.out.println("Client créé :");
                System.out.println(api.prettyPrint(response));
            } catch (Exception e) {
                System.err.println("Erreur : " + e.getMessage());
            }
        }
    }

    @CommandLine.Command(name = "update", description = "Mettre à jour un client")
    static class Update implements Runnable {
        @Inject ApiClient api;

        @CommandLine.Parameters(index = "0", description = "ID du client")
        long id;

        @CommandLine.Option(names = "--nom", description = "Nom du client")
        String nom;

        @CommandLine.Option(names = "--type", description = "Type (particulier, professionnel)")
        String type;

        @CommandLine.Option(names = "--email", description = "Email")
        String email;

        @CommandLine.Option(names = "--telephone", description = "Téléphone")
        String telephone;

        @CommandLine.Option(names = "--adresse", description = "Adresse")
        String adresse;

        @Override
        public void run() {
            try {
                JsonObjectBuilder builder = Json.createObjectBuilder();
                if (nom != null) builder.add("nom", nom);
                if (type != null) builder.add("type", type);
                if (email != null) builder.add("email", email);
                if (telephone != null) builder.add("telephone", telephone);
                if (adresse != null) builder.add("adresse", adresse);
                String response = api.mergeAndPut("/clients/" + id, builder.build().toString());
                System.out.println("Client mis à jour :");
                System.out.println(api.prettyPrint(response));
            } catch (Exception e) {
                System.err.println("Erreur : " + e.getMessage());
            }
        }
    }

    @CommandLine.Command(name = "delete", description = "Supprimer un client")
    static class Delete implements Runnable {
        @Inject ApiClient api;

        @CommandLine.Parameters(index = "0", description = "ID du client")
        long id;

        @Override
        public void run() {
            try {
                api.delete("/clients/" + id);
                System.out.println("Client " + id + " supprimé.");
            } catch (Exception e) {
                System.err.println("Erreur : " + e.getMessage());
            }
        }
    }
}
