package net.nanthrax.moussaillon.services;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

import com.stripe.Stripe;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.json.Json;
import jakarta.json.JsonObject;
import jakarta.json.JsonReader;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.transaction.Transactional;
import net.nanthrax.moussaillon.persistence.VenteEntity;

import org.eclipse.microprofile.config.inject.ConfigProperty;

@Path("/ventes/{id}/payment-link")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class PaymentResource {

    @ConfigProperty(name = "payment.stripe.api-key", defaultValue = "")
    String stripeApiKey;

    @ConfigProperty(name = "payment.stripe.success-url")
    String stripeSuccessUrl;

    @ConfigProperty(name = "payment.stripe.cancel-url")
    String stripeCancelUrl;

    @ConfigProperty(name = "payment.payplug.api-key", defaultValue = "")
    String payplugApiKey;

    @ConfigProperty(name = "payment.payplug.return-url")
    String payplugReturnUrl;

    @ConfigProperty(name = "payment.payplug.cancel-url")
    String payplugCancelUrl;

    @POST
    @Path("/stripe")
    @Transactional
    public Map<String, String> createStripePaymentLink(@PathParam("id") long id) {
        VenteEntity vente = VenteEntity.findById(id);
        if (vente == null) {
            throw new WebApplicationException("La vente (" + id + ") n'est pas trouvee", 404);
        }
        if (vente.status != VenteEntity.Status.FACTURE_PRETE) {
            throw new WebApplicationException("Le paiement n'est possible que lorsque la facture est prete", 400);
        }
        if (stripeApiKey == null || stripeApiKey.isBlank()) {
            throw new WebApplicationException("La cle API Stripe n'est pas configuree", 500);
        }

        try {
            Stripe.apiKey = stripeApiKey;

            long amountCents = Math.round(vente.prixVenteTTC * 100);
            String description = "Vente #" + vente.id;
            if (vente.client != null) {
                description += " - " + vente.client.nom;
            }

            SessionCreateParams params = SessionCreateParams.builder()
                    .setMode(SessionCreateParams.Mode.PAYMENT)
                    .setSuccessUrl(stripeSuccessUrl)
                    .setCancelUrl(stripeCancelUrl)
                    .addLineItem(SessionCreateParams.LineItem.builder()
                            .setQuantity(1L)
                            .setPriceData(SessionCreateParams.LineItem.PriceData.builder()
                                    .setCurrency("eur")
                                    .setUnitAmount(amountCents)
                                    .setProductData(SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                            .setName(description)
                                            .build())
                                    .build())
                            .build())
                    .build();

            Session session = Session.create(params);

            Map<String, String> result = new HashMap<>();
            result.put("url", session.getUrl());
            return result;
        } catch (WebApplicationException e) {
            throw e;
        } catch (Exception e) {
            throw new WebApplicationException("Erreur lors de la creation du lien Stripe: " + e.getMessage(), 500);
        }
    }

    @POST
    @Path("/payplug")
    @Transactional
    public Map<String, String> createPayplugPaymentLink(@PathParam("id") long id) {
        VenteEntity vente = VenteEntity.findById(id);
        if (vente == null) {
            throw new WebApplicationException("La vente (" + id + ") n'est pas trouvee", 404);
        }
        if (vente.status != VenteEntity.Status.FACTURE_PRETE) {
            throw new WebApplicationException("Le paiement n'est possible que lorsque la facture est prete", 400);
        }
        if (payplugApiKey == null || payplugApiKey.isBlank()) {
            throw new WebApplicationException("La cle API PayPlug n'est pas configuree", 500);
        }

        try {
            int amountCents = (int) Math.round(vente.prixVenteTTC * 100);

            String customerEmail = null;
            String customerName = null;
            if (vente.client != null) {
                customerEmail = vente.client.email;
                customerName = vente.client.nom;
            }

            jakarta.json.JsonObjectBuilder paymentBuilder = Json.createObjectBuilder()
                    .add("amount", amountCents)
                    .add("currency", "EUR")
                    .add("hosted_payment", Json.createObjectBuilder()
                            .add("return_url", payplugReturnUrl)
                            .add("cancel_url", payplugCancelUrl));

            if (customerEmail != null && !customerEmail.isBlank()) {
                jakarta.json.JsonObjectBuilder billingBuilder = Json.createObjectBuilder()
                        .add("email", customerEmail);
                if (customerName != null) {
                    billingBuilder.add("last_name", customerName);
                }
                paymentBuilder.add("billing", billingBuilder);
            }

            JsonObject requestBody = paymentBuilder.build();

            URL url = new URL("https://api.payplug.com/v1/payments");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Authorization", "Bearer " + payplugApiKey);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setDoOutput(true);

            try (OutputStream os = conn.getOutputStream()) {
                os.write(requestBody.toString().getBytes(StandardCharsets.UTF_8));
            }

            int status = conn.getResponseCode();
            if (status < 200 || status >= 300) {
                throw new WebApplicationException("Erreur PayPlug (HTTP " + status + ")", 500);
            }

            JsonObject response;
            try (JsonReader reader = Json.createReader(conn.getInputStream())) {
                response = reader.readObject();
            }

            String paymentUrl = response.getJsonObject("hosted_payment").getString("payment_url");

            Map<String, String> result = new HashMap<>();
            result.put("url", paymentUrl);
            return result;
        } catch (WebApplicationException e) {
            throw e;
        } catch (Exception e) {
            throw new WebApplicationException("Erreur lors de la creation du lien PayPlug: " + e.getMessage(), 500);
        }
    }
}
