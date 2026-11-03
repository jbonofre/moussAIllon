package net.nanthrax.moussaillon.services;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.containsString;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;
import static org.hamcrest.CoreMatchers.nullValue;
import static org.hamcrest.CoreMatchers.startsWith;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasItem;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;

import org.junit.jupiter.api.Test;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.path.xml.XmlPath;

@QuarkusTest
public class FluxAnnonceResourceTest {

    // Boat24 est réservée à ces tests : les autres tests publient sur Leboncoin
    private static String activerBoat24() {
        String urlFlux = given()
            .contentType("application/json")
            .body("{\"actif\":true,\"format\":\"NAUTIX\",\"notes\":\"Compte pro 1234\"}")
            .when().put("/plateformes-annonces/boat24")
            .then().statusCode(200).extract().path("urlFlux");
        return urlFlux.substring(urlFlux.indexOf("token=") + "token=".length());
    }

    private static int creerAnnonce(String body) {
        return given()
            .contentType("application/json")
            .body(body)
            .when().post("/annonces")
            .then().statusCode(200).extract().path("id");
    }

    private static void publier(int id, String plateforme) {
        given()
            .contentType("application/json")
            .body("{\"plateforme\":\"" + plateforme + "\"}")
            .when().post("/annonces/" + id + "/publier")
            .then().statusCode(200);
    }

    private static XmlPath lireFlux(String jeton) {
        String xml = given()
            .queryParam("token", jeton)
            .when().get("/flux/annonces/boat24.xml")
            .then()
            .statusCode(200)
            .contentType(containsString("application/xml"))
            .extract().asString();
        return new XmlPath(xml);
    }

    @Test
    void testConfigurerPlateforme() {
        given()
            .contentType("application/json")
            .body("{\"actif\":true,\"format\":\"NAUTIX\",\"notes\":\"Compte pro 1234\"}")
            .when().put("/plateformes-annonces/boat24")
            .then()
            .statusCode(200)
            .body("code", is("BOAT24"))
            .body("actif", is(true))
            .body("notes", is("Compte pro 1234"))
            .body("urlFlux", startsWith("https://chantier.example.com/api/flux/annonces/boat24.xml?token="))
            .body("jeton", nullValue())
            // Adresse de test sans code postal ni ville
            .body("avertissements", hasItem("L'adresse de la société doit se terminer par le code postal et la ville (ex. 56000 Vannes)"));
    }

    @Test
    void testConfigurerPlateformeInconnue() {
        given()
            .contentType("application/json")
            .body("{\"actif\":true}")
            .when().put("/plateformes-annonces/ebay")
            .then()
            .statusCode(400);

        given()
            .contentType("application/json")
            .body("{\"actif\":true,\"format\":\"OPENMARINE\"}")
            .when().put("/plateformes-annonces/boat24")
            .then()
            .statusCode(400);
    }

    @Test
    void testFluxNautix() {
        String jeton = activerBoat24();
        int bateauId = given()
            .contentType("application/json")
            .body("{\"name\":\"Ar Vag\",\"numeroSerie\":\"FR-QSB12345\",\"dateMeS\":\"2019-04-01\",\"heuresMoteur\":250.5,"
                + "\"localisation\":\"Port de Vannes\",\"localisationGps\":\"47.65,-2.76\",\"modele\":{\"id\":100},"
                + "\"moteurs\":[{\"id\":100},{\"id\":100}],"
                + "\"numerosSerieMoteurs\":[{\"moteurId\":100,\"numeroSerie\":\"SN-1\"},{\"moteurId\":100,\"numeroSerie\":\"SN-2\"}],"
                + "\"proprietaires\":[{\"id\":100}]}")
            .when().post("/bateaux")
            .then().statusCode(201).extract().path("id");
        int annonceId = creerAnnonce("{\"titre\":\"Quicksilver 505 <révisé>\",\"description\":\"Très bon état\\nMoteur < 300 h\","
            + "\"prix\":18500.0,\"bateau\":{\"id\":" + bateauId + "},\"client\":{\"id\":100},"
            + "\"photos\":[\"/api/images/a.jpg\",\"https://cdn.example.com/b.png\",\"/api/images/c.heic\"]}");
        publier(annonceId, "BOAT24");

        XmlPath flux = lireFlux(jeton);
        assertEquals("1.4", flux.getString("nautix.@version"));
        assertEquals("MS Plaisance", flux.getString("nautix.account.account_name"));
        String advert = "nautix.account.adverts.advert.find { it.@id == '" + annonceId + "' }";
        assertEquals("sale", flux.getString(advert + ".@purpose"));
        assertEquals("1", flux.getString(advert + ".advert_data.office_id"));
        assertEquals("<b>Quicksilver 505 &lt;révisé&gt;</b><br><br>Très bon état<br>Moteur &lt; 300 h",
                flux.getString(advert + ".advert_data.marketing_description.text"));
        assertEquals("used", flux.getString(advert + ".sale_data.sale_class"));
        assertEquals("18500", flux.getString(advert + ".sale_data.price"));
        assertEquals("fixed", flux.getString(advert + ".sale_data.price.@type"));
        assertEquals("Port de Vannes", flux.getString(advert + ".sale_data.location"));
        assertEquals("47.65", flux.getString(advert + ".sale_data.location.@lat"));
        assertEquals("power-daycruiser", flux.getString(advert + ".boat_data.boat_types.type"));
        assertEquals("Quicksilver 505", flux.getString(advert + ".boat_data.model"));
        assertEquals("Ar Vag", flux.getString(advert + ".boat_data.boat_name"));
        assertEquals("2019", flux.getString(advert + ".boat_data.year_built"));
        assertEquals("5.05", flux.getString(advert + ".boat_data.dimensions.loa"));
        assertEquals("FR-QSB12345", flux.getString(advert + ".boat_data.hull.hin"));
        assertEquals("2", flux.getString(advert + ".boat_data.drive.number_of_engines"));
        assertEquals("outboard", flux.getString(advert + ".boat_data.drive.propulsion"));
        assertEquals(2, flux.getList(advert + ".engine_data.engine").size());
        assertEquals("SN-1", flux.getString(advert + ".engine_data.engine[0].serial_number"));
        assertEquals("SN-2", flux.getString(advert + ".engine_data.engine[1].serial_number"));
        assertEquals("Mercury 115 EFI", flux.getString(advert + ".engine_data.engine[0].model"));
        assertEquals("115", flux.getString(advert + ".engine_data.engine[0].power"));
        assertEquals("251", flux.getString(advert + ".engine_data.engine[0].hours"));
        // La photo .heic n'est pas un format accepté par NautiX
        assertEquals(2, flux.getList(advert + ".media.images.image").size());
        assertEquals("https://chantier.example.com/api/images/a.jpg", flux.getString(advert + ".media.images.image[0]"));
        assertEquals("https://cdn.example.com/b.png", flux.getString(advert + ".media.images.image[1]"));
    }

    @Test
    void testFluxNeContientQueLesAnnoncesActivesDiffuseesSurLaPlateforme() {
        String jeton = activerBoat24();
        int diffusee = creerAnnonce("{\"titre\":\"Diffusee Boat24\",\"prix\":1000.0}");
        publier(diffusee, "BOAT24");
        int autrePlateforme = creerAnnonce("{\"titre\":\"Diffusee Leboncoin\",\"prix\":1000.0}");
        publier(autrePlateforme, "LEBONCOIN");
        int vendue = creerAnnonce("{\"titre\":\"Vendue\",\"prix\":1000.0,\"status\":\"VENDU\"}");
        publier(vendue, "BOAT24");

        XmlPath flux = lireFlux(jeton);
        List<String> ids = flux.getList("nautix.account.adverts.advert.@id");
        assertTrue(ids.contains(String.valueOf(diffusee)));
        assertFalse(ids.contains(String.valueOf(autrePlateforme)));
        assertFalse(ids.contains(String.valueOf(vendue)));

        // Retirée de Boat24 : elle sort du flux, la plateforme la supprimera à la prochaine lecture
        given()
            .contentType("application/json")
            .body("{\"plateforme\":\"BOAT24\"}")
            .when().post("/annonces/" + diffusee + "/depublier")
            .then().statusCode(200);
        ids = lireFlux(jeton).getList("nautix.account.adverts.advert.@id");
        assertFalse(ids.contains(String.valueOf(diffusee)));
    }

    @Test
    void testFluxRefuseSansJetonValide() {
        String jeton = activerBoat24();
        given().when().get("/flux/annonces/boat24.xml").then().statusCode(404);
        given().queryParam("token", "mauvais").when().get("/flux/annonces/boat24.xml").then().statusCode(404);
        // Le jeton de Boat24 ne donne pas accès aux autres plateformes
        given().queryParam("token", jeton).when().get("/flux/annonces/youboat.xml").then().statusCode(404);
    }

    @Test
    void testFluxRefuseSiPlateformeDesactivee() {
        String jeton = activerBoat24();
        given()
            .contentType("application/json")
            .body("{\"actif\":false,\"format\":\"NAUTIX\"}")
            .when().put("/plateformes-annonces/boat24")
            .then().statusCode(200);
        given().queryParam("token", jeton).when().get("/flux/annonces/boat24.xml").then().statusCode(404);
        activerBoat24();
    }

    @Test
    void testRegenererJeton() {
        String ancien = activerBoat24();
        String urlFlux = given()
            .when().post("/plateformes-annonces/boat24/jeton")
            .then().statusCode(200).extract().path("urlFlux");
        String nouveau = urlFlux.substring(urlFlux.indexOf("token=") + "token=".length());

        given().queryParam("token", ancien).when().get("/flux/annonces/boat24.xml").then().statusCode(404);
        lireFlux(nouveau);
    }

    @Test
    void testLectureDuFluxEnregistree() {
        String jeton = activerBoat24();
        int annonceId = creerAnnonce("{\"titre\":\"Lecture\",\"prix\":1500.0}");
        publier(annonceId, "BOAT24");
        lireFlux(jeton);

        given()
            .when().get("/plateformes-annonces")
            .then()
            .statusCode(200)
            .body("find { it.code == 'BOAT24' }.derniereLecture", notNullValue())
            .body("find { it.code == 'BOAT24' }.nombreAnnonces", greaterThanOrEqualTo(1))
            // Annonce sans bateau ni photo
            .body("find { it.code == 'BOAT24' }.avertissements", hasItem("« Lecture » : aucun bateau associé, le type et le modèle ne sont pas transmis"))
            .body("find { it.code == 'BOAT24' }.avertissements", hasItem("« Lecture » : aucune photo"));
    }

}
