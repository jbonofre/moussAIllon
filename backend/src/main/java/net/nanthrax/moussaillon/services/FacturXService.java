package net.nanthrax.moussaillon.services;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import jakarta.enterprise.context.ApplicationScoped;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.mustangproject.Invoice;
import org.mustangproject.Item;
import org.mustangproject.Product;
import org.mustangproject.TradeParty;
import org.mustangproject.ZUGFeRD.ZUGFeRDExporterFromA3;

import net.nanthrax.moussaillon.persistence.BateauCatalogueEntity;
import net.nanthrax.moussaillon.persistence.HeliceCatalogueEntity;
import net.nanthrax.moussaillon.persistence.MoteurCatalogueEntity;
import net.nanthrax.moussaillon.persistence.ProduitCatalogueEntity;
import net.nanthrax.moussaillon.persistence.RemorqueCatalogueEntity;
import net.nanthrax.moussaillon.persistence.SocieteEntity;
import net.nanthrax.moussaillon.persistence.VenteEntity;
import net.nanthrax.moussaillon.persistence.VenteForfaitEntity;
import net.nanthrax.moussaillon.persistence.VenteServiceEntity;

@ApplicationScoped
public class FacturXService {

    private static final double TVA_DEFAUT = 20.0;
    private static final SimpleDateFormat SDF = new SimpleDateFormat("dd/MM/yyyy");

    public byte[] generer(VenteEntity vente, SocieteEntity societe) throws Exception {
        byte[] pdfBytes = genererPdf(vente, societe);

        Invoice invoice = construireInvoice(vente, societe);

        ZUGFeRDExporterFromA3 exporter = new ZUGFeRDExporterFromA3()
            .setZUGFeRDVersion(2)
            .setProfile("EN16931")
            .load(new ByteArrayInputStream(pdfBytes));
        exporter.setTransaction(invoice);

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        exporter.export(baos);
        return baos.toByteArray();
    }

    private byte[] genererPdf(VenteEntity vente, SocieteEntity societe) throws Exception {
        try (PDDocument doc = new PDDocument()) {
            PDPage page = new PDPage(PDRectangle.A4);
            doc.addPage(page);

            PDType1Font fontNormal = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
            PDType1Font fontGras   = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);

            float margin = 50f;
            float pageWidth  = PDRectangle.A4.getWidth();
            float pageHeight = PDRectangle.A4.getHeight();
            float contentWidth = pageWidth - 2 * margin;
            float y = pageHeight - margin;

            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {

                // En-tête société
                if (societe != null && societe.nom != null) {
                    y = drawText(cs, fontGras, 14, societe.nom, margin, y);
                    String infos = buildInfosLegales(societe);
                    if (!infos.isBlank()) {
                        y = drawText(cs, fontNormal, 9, infos, margin, y - 3);
                    }
                    if (societe.adresse != null) {
                        y = drawText(cs, fontNormal, 9, societe.adresse.replace("\n", " — "), margin, y - 2);
                    }
                }

                // Titre
                String titre = vente.numeroFacture != null
                    ? "Facture n° " + vente.numeroFacture
                    : "Facture #" + vente.id;
                y -= 18;
                y = drawText(cs, fontGras, 16, titre, margin, y);
                String dateEmission = vente.dateFacturePrete != null ? SDF.format(vente.dateFacturePrete)
                    : (vente.date != null ? SDF.format(vente.date) : "-");
                y = drawText(cs, fontNormal, 10, "Date : " + dateEmission, margin, y - 4);

                // Bloc client
                y -= 14;
                y = drawText(cs, fontGras, 11, "Destinataire :", margin, y);
                if (vente.client != null) {
                    String nomClient = safe(vente.client.prenom, "") + (vente.client.prenom != null ? " " : "") + safe(vente.client.nom, "Client");
                    y = drawText(cs, fontNormal, 10, nomClient.trim(), margin + 10, y - 4);
                    if (vente.client.adresse != null && !vente.client.adresse.isBlank()) {
                        y = drawText(cs, fontNormal, 9, vente.client.adresse.replace("\n", " — "), margin + 10, y - 2);
                    }
                    if (vente.client.siret != null) {
                        y = drawText(cs, fontNormal, 9, "SIRET : " + vente.client.siret, margin + 10, y - 2);
                    }
                }

                // Tableau des lignes
                y -= 16;
                float colDes  = margin;
                float colQte  = margin + contentWidth * 0.60f;
                float colPuHT = margin + contentWidth * 0.72f;
                float colTtc  = margin + contentWidth * 0.86f;

                drawTextAt(cs, fontGras, 10, "Désignation",   colDes,  y);
                drawTextAt(cs, fontGras, 10, "Qté",          colQte,  y);
                drawTextAt(cs, fontGras, 10, "PU HT",             colPuHT, y);
                drawTextAt(cs, fontGras, 10, "Total TTC",         colTtc,  y);
                y -= 4;
                drawHLine(cs, margin, y, pageWidth - margin);
                y -= 12;

                List<LignePdf> lignes = extraireLignes(vente);
                if (lignes.isEmpty()) {
                    lignes.add(new LignePdf("Prestations diverses", 1,
                        vente.montantHT, vente.prixVenteTTC, vente.tva > 0 ? vente.tva : TVA_DEFAUT));
                }
                for (LignePdf ligne : lignes) {
                    if (y < 130) break;
                    y = drawText(cs, fontNormal, 9, ligne.designation, colDes, y);
                    float rowY = y + 9;
                    drawTextAt(cs, fontNormal, 9, String.valueOf(ligne.quantite),                           colQte,  rowY);
                    drawTextAt(cs, fontNormal, 9, String.format("%.2f €", ligne.prixHT),               colPuHT, rowY);
                    drawTextAt(cs, fontNormal, 9, String.format("%.2f €", ligne.prixTTC * ligne.quantite), colTtc, rowY);
                    y -= 3;
                }

                // Totaux
                y -= 10;
                drawHLine(cs, margin, y, pageWidth - margin);
                y -= 14;
                float xRight = pageWidth - margin;
                y = drawTextRight(cs, fontNormal, 10, String.format("Montant HT : %.2f €", vente.montantHT), xRight, y, fontNormal, 10);
                y = drawTextRight(cs, fontNormal, 10, String.format("TVA (%.0f %%) : %.2f €", vente.tva, vente.montantTVA), xRight, y - 4, fontNormal, 10);
                if (vente.remise > 0) {
                    y = drawTextRight(cs, fontNormal, 10, String.format("Remise : -%.2f €", vente.remise), xRight, y - 4, fontNormal, 10);
                }
                y = drawTextRight(cs, fontGras, 12, String.format("TOTAL TTC : %.2f €", vente.prixVenteTTC), xRight, y - 6, fontGras, 12);

                // Conditions de paiement
                y -= 20;
                if (vente.dateEcheance != null) {
                    y = drawText(cs, fontNormal, 9, "Date d'échéance : " + SDF.format(vente.dateEcheance), margin, y);
                }
                if (vente.conditionsPaiement != null && !vente.conditionsPaiement.isBlank()) {
                    y = drawText(cs, fontNormal, 9, "Conditions de paiement : " + vente.conditionsPaiement, margin, y - 3);
                }
                if (vente.penalitesRetard != null && !vente.penalitesRetard.isBlank()) {
                    y = drawText(cs, fontNormal, 9, "Pénalités de retard : " + vente.penalitesRetard, margin, y - 3);
                }
                double indemniteForf = vente.indemniteForfaitaire > 0 ? vente.indemniteForfaitaire : 40.0;
                y = drawText(cs, fontNormal, 9,
                    String.format("Indemnité forfaitaire de recouvrement : %.0f €", indemniteForf), margin, y - 3);

                // Coordonnées bancaires
                if (societe != null && societe.bancaire != null && !societe.bancaire.isBlank()) {
                    y -= 10;
                    y = drawText(cs, fontGras, 9, "Coordonnées bancaires :", margin, y);
                    drawText(cs, fontNormal, 9, societe.bancaire.replace("\n", " | "), margin, y - 3);
                }
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            doc.save(baos);
            return baos.toByteArray();
        }
    }

    private Invoice construireInvoice(VenteEntity vente, SocieteEntity societe) {
        Invoice invoice = new Invoice();
        invoice.setNumber(vente.numeroFacture != null ? vente.numeroFacture : "FACT-" + vente.id);

        java.util.Date dateEmission = vente.dateFacturePrete != null ? new java.util.Date(vente.dateFacturePrete.getTime())
            : (vente.date != null ? new java.util.Date(vente.date.getTime()) : new java.util.Date());
        invoice.setIssueDate(dateEmission);

        if (vente.dateEcheance != null) {
            invoice.setDueDate(new java.util.Date(vente.dateEcheance.getTime()));
        }

        // Émetteur
        TradeParty emetteur = new TradeParty(
            safe(societe != null ? societe.nom : null, "Société"),
            safe(societe != null ? societe.adresse : null, ""),
            "", "", "FR"
        );
        if (societe != null) {
            if (societe.siret  != null) emetteur.addTaxID(societe.siret);
            if (societe.numerotva != null) emetteur.addVATID(societe.numerotva);
        }
        invoice.setSender(emetteur);

        // Destinataire
        String nomClient = vente.client != null
            ? (safe(vente.client.prenom, "") + " " + safe(vente.client.nom, "Client")).trim()
            : "Client";
        TradeParty destinataire = new TradeParty(
            nomClient,
            vente.client != null ? safe(vente.client.adresse, "") : "",
            "", "", "FR"
        );
        if (vente.client != null) {
            if (vente.client.siret != null) destinataire.addTaxID(vente.client.siret);
            if (vente.client.tva  != null) destinataire.addVATID(vente.client.tva);
        }
        invoice.setRecipient(destinataire);

        // Lignes
        List<LignePdf> lignes = extraireLignes(vente);
        if (lignes.isEmpty()) {
            lignes.add(new LignePdf("Prestations diverses", 1,
                vente.montantHT, vente.prixVenteTTC, vente.tva > 0 ? vente.tva : TVA_DEFAUT));
        }
        for (LignePdf ligne : lignes) {
            Product produit = new Product(ligne.designation, "", "C62",
                BigDecimal.valueOf(ligne.tva).setScale(2, RoundingMode.HALF_UP));
            Item item = new Item(produit,
                BigDecimal.valueOf(ligne.quantite),
                BigDecimal.valueOf(ligne.prixHT).setScale(4, RoundingMode.HALF_UP));
            invoice.addItem(item);
        }

        return invoice;
    }

    private List<LignePdf> extraireLignes(VenteEntity vente) {
        List<LignePdf> lignes = new ArrayList<>();
        double tvaGlobale = vente.tva > 0 ? vente.tva : TVA_DEFAUT;

        if (vente.venteForfaits != null) {
            for (VenteForfaitEntity vf : vente.venteForfaits) {
                if (vf.forfait == null) continue;
                double tva = vf.forfait.tva > 0 ? vf.forfait.tva : tvaGlobale;
                double prixHT = vf.forfait.prixHT > 0 ? vf.forfait.prixHT
                    : vf.forfait.prixTTC / (1 + tva / 100);
                lignes.add(new LignePdf(safe(vf.forfait.nom, "Forfait"), vf.quantite, prixHT, vf.forfait.prixTTC, tva));
            }
        }

        if (vente.venteServices != null) {
            for (VenteServiceEntity vs : vente.venteServices) {
                if (vs.service == null) continue;
                double tva = vs.service.tva > 0 ? vs.service.tva : tvaGlobale;
                double prixHT = vs.service.prixHT > 0 ? vs.service.prixHT
                    : vs.service.prixTTC / (1 + tva / 100);
                lignes.add(new LignePdf(safe(vs.service.nom, "Service"), vs.quantite, prixHT, vs.service.prixTTC, tva));
            }
        }

        if (vente.produits != null && !vente.produits.isEmpty()) {
            Map<Long, int[]> counts = new HashMap<>();
            Map<Long, ProduitCatalogueEntity> map = new HashMap<>();
            for (ProduitCatalogueEntity p : vente.produits) {
                if (p.id == null) continue;
                counts.merge(p.id, new int[]{1}, (a, b) -> new int[]{a[0] + 1});
                map.putIfAbsent(p.id, p);
            }
            for (Map.Entry<Long, int[]> e : counts.entrySet()) {
                ProduitCatalogueEntity p = map.get(e.getKey());
                double tva = p.tva > 0 ? p.tva : tvaGlobale;
                double prixHT = p.prixVenteTTC / (1 + tva / 100);
                lignes.add(new LignePdf(safe(p.nom, "Produit"), e.getValue()[0], prixHT, p.prixVenteTTC, tva));
            }
        }

        if (vente.bateauxCatalogue != null && !vente.bateauxCatalogue.isEmpty()) {
            Map<Long, int[]> counts = new HashMap<>();
            Map<Long, BateauCatalogueEntity> map = new HashMap<>();
            for (BateauCatalogueEntity b : vente.bateauxCatalogue) {
                if (b.id == null) continue;
                counts.merge(b.id, new int[]{1}, (a, c) -> new int[]{a[0] + 1});
                map.putIfAbsent(b.id, b);
            }
            for (Map.Entry<Long, int[]> e : counts.entrySet()) {
                BateauCatalogueEntity b = map.get(e.getKey());
                double tva = b.tva > 0 ? b.tva : tvaGlobale;
                double prixHT = b.prixVenteTTC / (1 + tva / 100);
                lignes.add(new LignePdf(safe(b.marque, "") + " " + safe(b.modele, "Bateau"), e.getValue()[0], prixHT, b.prixVenteTTC, tva));
            }
        }

        if (vente.moteursCatalogue != null && !vente.moteursCatalogue.isEmpty()) {
            Map<Long, int[]> counts = new HashMap<>();
            Map<Long, MoteurCatalogueEntity> map = new HashMap<>();
            for (MoteurCatalogueEntity m : vente.moteursCatalogue) {
                if (m.id == null) continue;
                counts.merge(m.id, new int[]{1}, (a, c) -> new int[]{a[0] + 1});
                map.putIfAbsent(m.id, m);
            }
            for (Map.Entry<Long, int[]> e : counts.entrySet()) {
                MoteurCatalogueEntity m = map.get(e.getKey());
                double tva = m.tva > 0 ? m.tva : tvaGlobale;
                double prixHT = m.prixVenteTTC / (1 + tva / 100);
                lignes.add(new LignePdf(safe(m.marque, "") + " " + safe(m.modele, "Moteur"), e.getValue()[0], prixHT, m.prixVenteTTC, tva));
            }
        }

        if (vente.helicesCatalogue != null && !vente.helicesCatalogue.isEmpty()) {
            Map<Long, int[]> counts = new HashMap<>();
            Map<Long, HeliceCatalogueEntity> map = new HashMap<>();
            for (HeliceCatalogueEntity h : vente.helicesCatalogue) {
                if (h.id == null) continue;
                counts.merge(h.id, new int[]{1}, (a, c) -> new int[]{a[0] + 1});
                map.putIfAbsent(h.id, h);
            }
            for (Map.Entry<Long, int[]> e : counts.entrySet()) {
                HeliceCatalogueEntity h = map.get(e.getKey());
                double tva = h.tva > 0 ? h.tva : tvaGlobale;
                double prixHT = h.prixVenteTTC / (1 + tva / 100);
                lignes.add(new LignePdf(safe(h.marque, "") + " " + safe(h.modele, "Hélice"), e.getValue()[0], prixHT, h.prixVenteTTC, tva));
            }
        }

        if (vente.remorquesCatalogue != null && !vente.remorquesCatalogue.isEmpty()) {
            Map<Long, int[]> counts = new HashMap<>();
            Map<Long, RemorqueCatalogueEntity> map = new HashMap<>();
            for (RemorqueCatalogueEntity r : vente.remorquesCatalogue) {
                if (r.id == null) continue;
                counts.merge(r.id, new int[]{1}, (a, c) -> new int[]{a[0] + 1});
                map.putIfAbsent(r.id, r);
            }
            for (Map.Entry<Long, int[]> e : counts.entrySet()) {
                RemorqueCatalogueEntity r = map.get(e.getKey());
                double tva = r.tva > 0 ? r.tva : tvaGlobale;
                double prixHT = r.prixVenteTTC / (1 + tva / 100);
                lignes.add(new LignePdf(safe(r.marque, "") + " " + safe(r.modele, "Remorque"), e.getValue()[0], prixHT, r.prixVenteTTC, tva));
            }
        }

        return lignes;
    }

    // --- Helpers PDF ---

    private float drawText(PDPageContentStream cs, PDType1Font font, float size, String text, float x, float y) throws Exception {
        cs.beginText();
        cs.setFont(font, size);
        cs.newLineAtOffset(x, y);
        cs.showText(sanitize(text));
        cs.endText();
        return y - size - 2;
    }

    private void drawTextAt(PDPageContentStream cs, PDType1Font font, float size, String text, float x, float y) throws Exception {
        cs.beginText();
        cs.setFont(font, size);
        cs.newLineAtOffset(x, y);
        cs.showText(sanitize(text));
        cs.endText();
    }

    private float drawTextRight(PDPageContentStream cs, PDType1Font font, float size, String text,
            float xRight, float y, PDType1Font measureFont, float measureSize) throws Exception {
        float textWidth = measureFont.getStringWidth(sanitize(text)) / 1000f * measureSize;
        drawTextAt(cs, font, size, text, xRight - textWidth, y);
        return y - size - 2;
    }

    private void drawHLine(PDPageContentStream cs, float x1, float y, float x2) throws Exception {
        cs.setLineWidth(0.5f);
        cs.moveTo(x1, y);
        cs.lineTo(x2, y);
        cs.stroke();
    }

    // PDFBox Type1/Helvetica utilise WinAnsiEncoding : Latin-1 + signe Euro (U+20AC → 0x80)
    private String sanitize(String text) {
        if (text == null) return "";
        StringBuilder sb = new StringBuilder();
        for (char c : text.toCharArray()) {
            if (c <= 0xFF || c == '€') {
                sb.append(c);
            } else {
                sb.append('?');
            }
        }
        return sb.toString();
    }

    private String safe(String value, String fallback) {
        return (value != null && !value.isBlank()) ? value : fallback;
    }

    private String buildInfosLegales(SocieteEntity s) {
        List<String> parts = new ArrayList<>();
        if (s.forme    != null) parts.add(s.forme);
        if (s.capital  > 0)    parts.add("Capital " + s.capital + " €");
        if (s.siren    != null) parts.add("SIREN " + s.siren);
        if (s.rcs      != null) parts.add("RCS " + s.rcs);
        if (s.numerotva != null) parts.add("TVA " + s.numerotva);
        return String.join(" — ", parts);
    }

    private static class LignePdf {
        final String designation;
        final int    quantite;
        final double prixHT;
        final double prixTTC;
        final double tva;

        LignePdf(String designation, int quantite, double prixHT, double prixTTC, double tva) {
            this.designation = designation;
            this.quantite    = quantite;
            this.prixHT      = prixHT;
            this.prixTTC     = prixTTC;
            this.tva         = tva;
        }
    }
}
