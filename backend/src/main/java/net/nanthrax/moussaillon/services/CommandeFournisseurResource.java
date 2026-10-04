package net.nanthrax.moussaillon.services;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import net.nanthrax.moussaillon.persistence.BateauCatalogueEntity;
import net.nanthrax.moussaillon.persistence.CommandeFournisseurEntity;
import net.nanthrax.moussaillon.persistence.CommandeFournisseurLigneEntity;
import net.nanthrax.moussaillon.persistence.FournisseurBateauEntity;
import net.nanthrax.moussaillon.persistence.FournisseurEntity;
import net.nanthrax.moussaillon.persistence.FournisseurHeliceEntity;
import net.nanthrax.moussaillon.persistence.FournisseurMoteurEntity;
import net.nanthrax.moussaillon.persistence.FournisseurProduitEntity;
import net.nanthrax.moussaillon.persistence.FournisseurRemorqueEntity;
import net.nanthrax.moussaillon.persistence.HeliceCatalogueEntity;
import net.nanthrax.moussaillon.persistence.MoteurCatalogueEntity;
import net.nanthrax.moussaillon.persistence.ProduitCatalogueEntity;
import net.nanthrax.moussaillon.persistence.RemorqueCatalogueEntity;
import net.nanthrax.moussaillon.persistence.VenteBateauCatalogueEntity;
import net.nanthrax.moussaillon.persistence.VenteEntity;
import net.nanthrax.moussaillon.persistence.VenteHeliceCatalogueEntity;
import net.nanthrax.moussaillon.persistence.VenteMoteurCatalogueEntity;
import net.nanthrax.moussaillon.persistence.VenteProduitEntity;
import net.nanthrax.moussaillon.persistence.VenteRemorqueCatalogueEntity;

@Path("/commandes-fournisseur")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class CommandeFournisseurResource {

    @GET
    public List<CommandeFournisseurEntity> list() {
        return CommandeFournisseurEntity.listAll();
    }

    @GET
    @Path("/search")
    public List<CommandeFournisseurEntity> search(
            @QueryParam("q") String q,
            @QueryParam("status") String status,
            @QueryParam("fournisseurId") Long fournisseurId,
            @QueryParam("venteId") Long venteId
    ) {
        CommandeFournisseurEntity.Status parsedStatus = parseStatus(status);
        boolean hasStatus = parsedStatus != null;
        boolean hasFournisseurId = fournisseurId != null;
        boolean hasVenteId = venteId != null;
        boolean hasQuery = q != null && !q.trim().isEmpty();

        StringBuilder query = new StringBuilder();
        List<Object> params = new java.util.ArrayList<>();
        int paramIndex = 1;

        if (hasQuery) {
            String likePattern = "%" + q.toLowerCase() + "%";
            query.append("(LOWER(reference) like ?").append(paramIndex++).append(" or LOWER(referenceFournisseur) like ?").append(paramIndex++).append(" or LOWER(fournisseur.nom) like ?").append(paramIndex++).append(")");
            params.add(likePattern);
            params.add(likePattern);
            params.add(likePattern);
        }
        if (hasStatus) {
            if (query.length() > 0) query.append(" and ");
            query.append("status = ?").append(paramIndex++);
            params.add(parsedStatus);
        }
        if (hasFournisseurId) {
            if (query.length() > 0) query.append(" and ");
            query.append("fournisseur.id = ?").append(paramIndex++);
            params.add(fournisseurId);
        }
        if (hasVenteId) {
            if (query.length() > 0) query.append(" and ");
            query.append("vente.id = ?").append(paramIndex++);
            params.add(venteId);
        }

        if (query.length() == 0) {
            return CommandeFournisseurEntity.listAll();
        }
        return CommandeFournisseurEntity.list(query.toString(), params.toArray());
    }

    @POST
    @Transactional
    public Response create(CommandeFournisseurEntity commande) {
        commande.id = null;
        if (commande.reference == null || commande.reference.trim().isEmpty()) {
            int year = java.time.LocalDate.now().getYear();
            long count = CommandeFournisseurEntity.count();
            commande.reference = String.format("CF-%d-%04d", year, count + 1);
        }
        if (commande.date == null) {
            commande.date = new Timestamp(System.currentTimeMillis());
        }
        commande.persist();
        return Response.status(Response.Status.CREATED).entity(commande).build();
    }

    @GET
    @Path("{id}")
    public CommandeFournisseurEntity get(@PathParam("id") long id) {
        CommandeFournisseurEntity entity = CommandeFournisseurEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("La commande fournisseur (" + id + ") n'est pas trouvee", 404);
        }
        return entity;
    }

    @GET
    @Path("/vente/{venteId}")
    public List<CommandeFournisseurEntity> getByVenteId(@PathParam("venteId") long venteId) {
        return CommandeFournisseurEntity.list("vente.id", venteId);
    }

    @DELETE
    @Path("{id}")
    @Transactional
    public Response delete(@PathParam("id") long id) {
        CommandeFournisseurEntity entity = CommandeFournisseurEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("La commande fournisseur (" + id + ") n'est pas trouvee", 404);
        }
        entity.delete();
        return Response.status(204).build();
    }

    @PUT
    @Path("{id}")
    @Transactional
    public CommandeFournisseurEntity update(@PathParam("id") long id, CommandeFournisseurEntity commande) {
        CommandeFournisseurEntity entity = CommandeFournisseurEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("La commande fournisseur (" + id + ") n'est pas trouvee", 404);
        }

        entity.status = commande.status;
        entity.fournisseur = commande.fournisseur;
        entity.vente = commande.vente;
        entity.date = commande.date;
        entity.dateReception = commande.dateReception;
        entity.reference = commande.reference;
        entity.referenceFournisseur = commande.referenceFournisseur;
        entity.montantHT = commande.montantHT;
        entity.tva = commande.tva;
        entity.montantTVA = commande.montantTVA;
        entity.montantTTC = commande.montantTTC;
        entity.portTotal = commande.portTotal;
        entity.notes = commande.notes;

        if (entity.lignes != null) {
            entity.lignes.clear();
        }
        if (commande.lignes != null) {
            for (CommandeFournisseurLigneEntity incomingLigne : commande.lignes) {
                CommandeFournisseurLigneEntity clonedLigne = new CommandeFournisseurLigneEntity();
                clonedLigne.produit = incomingLigne.produit;
                clonedLigne.bateau = incomingLigne.bateau;
                clonedLigne.moteur = incomingLigne.moteur;
                clonedLigne.helice = incomingLigne.helice;
                clonedLigne.remorque = incomingLigne.remorque;
                clonedLigne.quantite = incomingLigne.quantite;
                clonedLigne.prixUnitaireHT = incomingLigne.prixUnitaireHT;
                clonedLigne.tva = incomingLigne.tva;
                clonedLigne.montantTVA = incomingLigne.montantTVA;
                clonedLigne.prixTotalHT = incomingLigne.prixTotalHT;
                clonedLigne.prixTotalTTC = incomingLigne.prixTotalTTC;
                entity.lignes.add(clonedLigne);
            }
        }

        // Incrementer le stock quand la commande est recue
        if (!entity.stockIncremented && entity.status == CommandeFournisseurEntity.Status.RECUE) {
            incrementStock(entity);
            entity.stockIncremented = true;
        }

        return entity;
    }

    private void incrementStock(CommandeFournisseurEntity commande) {
        if (commande.lignes != null) {
            for (CommandeFournisseurLigneEntity ligne : commande.lignes) {
                if (ligne.produit != null) {
                    ProduitCatalogueEntity p = ProduitCatalogueEntity.findById(ligne.produit.id);
                    if (p != null) {
                        p.stock = p.stock + ligne.quantite;
                    }
                }
                if (ligne.bateau != null) {
                    BateauCatalogueEntity b = BateauCatalogueEntity.findById(ligne.bateau.id);
                    if (b != null) {
                        b.stock = b.stock + ligne.quantite;
                    }
                }
                if (ligne.moteur != null) {
                    MoteurCatalogueEntity m = MoteurCatalogueEntity.findById(ligne.moteur.id);
                    if (m != null) {
                        m.stock = m.stock + ligne.quantite;
                    }
                }
                if (ligne.remorque != null) {
                    RemorqueCatalogueEntity r = RemorqueCatalogueEntity.findById(ligne.remorque.id);
                    if (r != null) {
                        r.stock = r.stock + ligne.quantite;
                    }
                }
            }
        }
    }

    @GET
    @Path("/prepare-from-vente/{venteId}")
    public PrepareCommandeFromVenteDTO prepareFromVente(@PathParam("venteId") long venteId) {
        VenteEntity vente = VenteEntity.findById(venteId);
        if (vente == null) {
            throw new WebApplicationException("La vente (" + venteId + ") n'est pas trouvee", 404);
        }

        PrepareCommandeFromVenteDTO dto = new PrepareCommandeFromVenteDTO();
        dto.venteId = vente.id;
        dto.clientNom = vente.client != null ? vente.client.nom : null;
        dto.numeroFacture = vente.numeroFacture;
        dto.comptoir = vente.comptoir;
        dto.dateVente = vente.date != null ? vente.date.toString() : null;

        Map<Long, FournisseurSuggerDTO> countMap = new HashMap<>();

        // 1. Produits
        if (vente.venteProduits != null && !vente.venteProduits.isEmpty()) {
            for (VenteProduitEntity vp : vente.venteProduits) {
                if (vp.produit != null && vp.produit.id != null) {
                    ProduitCatalogueEntity p = ProduitCatalogueEntity.findById(vp.produit.id);
                    if (p != null) {
                        VenteArticleFournisseurDTO art = new VenteArticleFournisseurDTO();
                        art.articleKey = "produit-" + p.id;
                        art.type = "produit";
                        art.id = p.id;
                        art.designation = p.designation;
                        art.reference = p.ref;
                        art.quantiteVente = vp.quantite;
                        art.stockActuel = p.stock;
                        art.stockMini = p.stockMini;
                        art.besoinStock = Math.max(0, art.quantiteVente - p.stock);
                        if (art.besoinStock == 0) art.besoinStock = art.quantiteVente;

                        List<FournisseurProduitEntity> fps = FournisseurProduitEntity.list("produit.id", p.id);
                        for (FournisseurProduitEntity fp : fps) {
                            if (fp.fournisseur != null) {
                                FournisseurItemDTO fi = new FournisseurItemDTO();
                                fi.fournisseurId = fp.fournisseur.id;
                                fi.fournisseurNom = fp.fournisseur.nom;
                                fi.referenceFournisseur = fp.reference;
                                fi.prixAchatHT = fp.prixAchatHT;
                                fi.tva = fp.tva;
                                fi.nombreMinACommander = fp.nombreMinACommander;
                                art.fournisseurs.add(fi);

                                countMap.computeIfAbsent(fp.fournisseur.id, id -> {
                                    FournisseurSuggerDTO s = new FournisseurSuggerDTO();
                                    s.fournisseurId = fp.fournisseur.id;
                                    s.fournisseurNom = fp.fournisseur.nom;
                                    s.nombreArticles = 0;
                                    return s;
                                }).nombreArticles++;
                            }
                        }
                        dto.articles.add(art);
                    }
                }
            }
        } else if (vente.produits != null) {
            for (ProduitCatalogueEntity pRef : vente.produits) {
                if (pRef != null && pRef.id != null) {
                    ProduitCatalogueEntity p = ProduitCatalogueEntity.findById(pRef.id);
                    if (p != null) {
                        VenteArticleFournisseurDTO art = new VenteArticleFournisseurDTO();
                        art.articleKey = "produit-" + p.id;
                        art.type = "produit";
                        art.id = p.id;
                        art.designation = p.designation;
                        art.reference = p.ref;
                        art.quantiteVente = 1;
                        art.stockActuel = p.stock;
                        art.stockMini = p.stockMini;
                        art.besoinStock = Math.max(0, 1 - p.stock);
                        if (art.besoinStock == 0) art.besoinStock = 1;

                        List<FournisseurProduitEntity> fps = FournisseurProduitEntity.list("produit.id", p.id);
                        for (FournisseurProduitEntity fp : fps) {
                            if (fp.fournisseur != null) {
                                FournisseurItemDTO fi = new FournisseurItemDTO();
                                fi.fournisseurId = fp.fournisseur.id;
                                fi.fournisseurNom = fp.fournisseur.nom;
                                fi.referenceFournisseur = fp.reference;
                                fi.prixAchatHT = fp.prixAchatHT;
                                fi.tva = fp.tva;
                                fi.nombreMinACommander = fp.nombreMinACommander;
                                art.fournisseurs.add(fi);

                                countMap.computeIfAbsent(fp.fournisseur.id, id -> {
                                    FournisseurSuggerDTO s = new FournisseurSuggerDTO();
                                    s.fournisseurId = fp.fournisseur.id;
                                    s.fournisseurNom = fp.fournisseur.nom;
                                    s.nombreArticles = 0;
                                    return s;
                                }).nombreArticles++;
                            }
                        }
                        dto.articles.add(art);
                    }
                }
            }
        }

        // 2. Bateaux
        if (vente.venteBateauxCatalogue != null) {
            for (VenteBateauCatalogueEntity vb : vente.venteBateauxCatalogue) {
                if (vb.bateau != null && vb.bateau.id != null) {
                    BateauCatalogueEntity b = BateauCatalogueEntity.findById(vb.bateau.id);
                    if (b != null) {
                        VenteArticleFournisseurDTO art = new VenteArticleFournisseurDTO();
                        art.articleKey = "bateau-" + b.id;
                        art.type = "bateau";
                        art.id = b.id;
                        art.designation = b.designation;
                        art.quantiteVente = vb.quantite;
                        art.stockActuel = (int) b.stock;
                        art.stockMini = (int) b.stockAlerte;
                        art.besoinStock = Math.max(0, art.quantiteVente - (int) b.stock);
                        if (art.besoinStock == 0) art.besoinStock = art.quantiteVente;

                        List<FournisseurBateauEntity> fbs = FournisseurBateauEntity.list("bateau.id", b.id);
                        for (FournisseurBateauEntity fb : fbs) {
                            if (fb.fournisseur != null) {
                                FournisseurItemDTO fi = new FournisseurItemDTO();
                                fi.fournisseurId = fb.fournisseur.id;
                                fi.fournisseurNom = fb.fournisseur.nom;
                                fi.prixAchatHT = fb.prixAchatHT;
                                fi.tva = fb.tva;
                                art.fournisseurs.add(fi);

                                countMap.computeIfAbsent(fb.fournisseur.id, id -> {
                                    FournisseurSuggerDTO s = new FournisseurSuggerDTO();
                                    s.fournisseurId = fb.fournisseur.id;
                                    s.fournisseurNom = fb.fournisseur.nom;
                                    s.nombreArticles = 0;
                                    return s;
                                }).nombreArticles++;
                            }
                        }
                        dto.articles.add(art);
                    }
                }
            }
        }

        // 3. Moteurs
        if (vente.venteMoteursCatalogue != null) {
            for (VenteMoteurCatalogueEntity vm : vente.venteMoteursCatalogue) {
                if (vm.moteur != null && vm.moteur.id != null) {
                    MoteurCatalogueEntity m = MoteurCatalogueEntity.findById(vm.moteur.id);
                    if (m != null) {
                        VenteArticleFournisseurDTO art = new VenteArticleFournisseurDTO();
                        art.articleKey = "moteur-" + m.id;
                        art.type = "moteur";
                        art.id = m.id;
                        art.designation = m.designation;
                        art.quantiteVente = vm.quantite;
                        art.stockActuel = (int) m.stock;
                        art.stockMini = (int) m.stockAlerte;
                        art.besoinStock = Math.max(0, art.quantiteVente - (int) m.stock);
                        if (art.besoinStock == 0) art.besoinStock = art.quantiteVente;

                        List<FournisseurMoteurEntity> fms = FournisseurMoteurEntity.list("moteur.id", m.id);
                        for (FournisseurMoteurEntity fm : fms) {
                            if (fm.fournisseur != null) {
                                FournisseurItemDTO fi = new FournisseurItemDTO();
                                fi.fournisseurId = fm.fournisseur.id;
                                fi.fournisseurNom = fm.fournisseur.nom;
                                fi.prixAchatHT = fm.prixAchatHT;
                                fi.tva = fm.tva;
                                art.fournisseurs.add(fi);

                                countMap.computeIfAbsent(fm.fournisseur.id, id -> {
                                    FournisseurSuggerDTO s = new FournisseurSuggerDTO();
                                    s.fournisseurId = fm.fournisseur.id;
                                    s.fournisseurNom = fm.fournisseur.nom;
                                    s.nombreArticles = 0;
                                    return s;
                                }).nombreArticles++;
                            }
                        }
                        dto.articles.add(art);
                    }
                }
            }
        }

        // 4. Helices
        if (vente.venteHelicesCatalogue != null) {
            for (VenteHeliceCatalogueEntity vh : vente.venteHelicesCatalogue) {
                if (vh.helice != null && vh.helice.id != null) {
                    HeliceCatalogueEntity h = HeliceCatalogueEntity.findById(vh.helice.id);
                    if (h != null) {
                        VenteArticleFournisseurDTO art = new VenteArticleFournisseurDTO();
                        art.articleKey = "helice-" + h.id;
                        art.type = "helice";
                        art.id = h.id;
                        art.designation = h.designation;
                        art.quantiteVente = vh.quantite;
                        art.stockActuel = 0;
                        art.stockMini = 0;
                        art.besoinStock = vh.quantite;

                        List<FournisseurHeliceEntity> fhs = FournisseurHeliceEntity.list("helice.id", h.id);
                        for (FournisseurHeliceEntity fh : fhs) {
                            if (fh.fournisseur != null) {
                                FournisseurItemDTO fi = new FournisseurItemDTO();
                                fi.fournisseurId = fh.fournisseur.id;
                                fi.fournisseurNom = fh.fournisseur.nom;
                                fi.prixAchatHT = fh.prixAchatHT;
                                fi.tva = fh.tva;
                                art.fournisseurs.add(fi);

                                countMap.computeIfAbsent(fh.fournisseur.id, id -> {
                                    FournisseurSuggerDTO s = new FournisseurSuggerDTO();
                                    s.fournisseurId = fh.fournisseur.id;
                                    s.fournisseurNom = fh.fournisseur.nom;
                                    s.nombreArticles = 0;
                                    return s;
                                }).nombreArticles++;
                            }
                        }
                        dto.articles.add(art);
                    }
                }
            }
        }

        // 5. Remorques
        if (vente.venteRemorquesCatalogue != null) {
            for (VenteRemorqueCatalogueEntity vr : vente.venteRemorquesCatalogue) {
                if (vr.remorque != null && vr.remorque.id != null) {
                    RemorqueCatalogueEntity r = RemorqueCatalogueEntity.findById(vr.remorque.id);
                    if (r != null) {
                        VenteArticleFournisseurDTO art = new VenteArticleFournisseurDTO();
                        art.articleKey = "remorque-" + r.id;
                        art.type = "remorque";
                        art.id = r.id;
                        art.designation = r.designation;
                        art.quantiteVente = vr.quantite;
                        art.stockActuel = (int) r.stock;
                        art.stockMini = (int) r.stockAlerte;
                        art.besoinStock = Math.max(0, art.quantiteVente - (int) r.stock);
                        if (art.besoinStock == 0) art.besoinStock = art.quantiteVente;

                        List<FournisseurRemorqueEntity> frs = FournisseurRemorqueEntity.list("remorque.id", r.id);
                        for (FournisseurRemorqueEntity fr : frs) {
                            if (fr.fournisseur != null) {
                                FournisseurItemDTO fi = new FournisseurItemDTO();
                                fi.fournisseurId = fr.fournisseur.id;
                                fi.fournisseurNom = fr.fournisseur.nom;
                                fi.prixAchatHT = fr.prixAchatHT;
                                fi.tva = fr.tva;
                                art.fournisseurs.add(fi);

                                countMap.computeIfAbsent(fr.fournisseur.id, id -> {
                                    FournisseurSuggerDTO s = new FournisseurSuggerDTO();
                                    s.fournisseurId = fr.fournisseur.id;
                                    s.fournisseurNom = fr.fournisseur.nom;
                                    s.nombreArticles = 0;
                                    return s;
                                }).nombreArticles++;
                            }
                        }
                        dto.articles.add(art);
                    }
                }
            }
        }

        List<FournisseurSuggerDTO> suggested = new ArrayList<>(countMap.values());
        suggested.sort((a, b) -> Integer.compare(b.nombreArticles, a.nombreArticles));
        dto.fournisseursSuggeres = suggested;

        dto.tousFournisseurs = FournisseurEntity.listAll();

        return dto;
    }

    @POST
    @Path("/from-vente/{venteId}")
    @Transactional
    public Response createFromVente(@PathParam("venteId") long venteId, CreateCommandeFromVenteRequest req) {
        VenteEntity vente = VenteEntity.findById(venteId);
        if (vente == null) {
            throw new WebApplicationException("La vente (" + venteId + ") n'est pas trouvee", 404);
        }
        if (req == null || req.fournisseurId == null) {
            throw new WebApplicationException("Fournisseur requis", 400);
        }
        FournisseurEntity fournisseur = FournisseurEntity.findById(req.fournisseurId);
        if (fournisseur == null) {
            throw new WebApplicationException("Fournisseur introuvable", 400);
        }

        CommandeFournisseurEntity commande = new CommandeFournisseurEntity();
        commande.vente = vente;
        commande.fournisseur = fournisseur;
        commande.date = new Timestamp(System.currentTimeMillis());
        if (req.status != null && !req.status.trim().isEmpty()) {
            commande.status = CommandeFournisseurEntity.Status.valueOf(req.status.trim());
        } else {
            commande.status = CommandeFournisseurEntity.Status.EN_ATTENTE;
        }

        if (req.reference != null && !req.reference.trim().isEmpty()) {
            commande.reference = req.reference.trim();
        } else {
            int year = java.time.LocalDate.now().getYear();
            long count = CommandeFournisseurEntity.count();
            commande.reference = String.format("CF-%d-%04d", year, count + 1);
        }

        commande.referenceFournisseur = req.referenceFournisseur;
        commande.portTotal = req.portTotal != null ? req.portTotal : 0.0;
        commande.notes = req.notes != null ? req.notes : ("Commande fournisseur issue de la vente comptoir #" + vente.id + (vente.numeroFacture != null ? " (" + vente.numeroFacture + ")" : ""));

        if (req.lignes != null) {
            for (CreateCommandeLigneRequest lr : req.lignes) {
                if (lr.quantite <= 0) continue;
                CommandeFournisseurLigneEntity l = new CommandeFournisseurLigneEntity();
                if ("produit".equalsIgnoreCase(lr.type)) {
                    l.produit = ProduitCatalogueEntity.findById(lr.id);
                } else if ("bateau".equalsIgnoreCase(lr.type)) {
                    l.bateau = BateauCatalogueEntity.findById(lr.id);
                } else if ("moteur".equalsIgnoreCase(lr.type)) {
                    l.moteur = MoteurCatalogueEntity.findById(lr.id);
                } else if ("helice".equalsIgnoreCase(lr.type)) {
                    l.helice = HeliceCatalogueEntity.findById(lr.id);
                } else if ("remorque".equalsIgnoreCase(lr.type)) {
                    l.remorque = RemorqueCatalogueEntity.findById(lr.id);
                }
                l.quantite = lr.quantite;
                l.prixUnitaireHT = lr.prixUnitaireHT;
                l.tva = lr.tva;
                l.prixTotalHT = Math.round(l.prixUnitaireHT * l.quantite * 100.0) / 100.0;
                l.montantTVA = Math.round(l.prixTotalHT * (l.tva / 100.0) * 100.0) / 100.0;
                l.prixTotalTTC = Math.round((l.prixTotalHT + l.montantTVA) * 100.0) / 100.0;
                commande.lignes.add(l);
            }
        }

        double ht = 0;
        double tva = 0;
        double ttc = 0;
        for (CommandeFournisseurLigneEntity l : commande.lignes) {
            ht += l.prixTotalHT;
            tva += l.montantTVA;
            ttc += l.prixTotalTTC;
        }
        commande.montantHT = Math.round(ht * 100.0) / 100.0;
        commande.montantTVA = Math.round(tva * 100.0) / 100.0;
        commande.montantTTC = Math.round((ttc + commande.portTotal) * 100.0) / 100.0;
        commande.tva = ht > 0 ? Math.round((tva / ht * 100.0) * 100.0) / 100.0 : 20.0;

        commande.persist();
        return Response.status(Response.Status.CREATED).entity(commande).build();
    }

    public static class FournisseurItemDTO {
        public Long fournisseurId;
        public String fournisseurNom;
        public String referenceFournisseur;
        public double prixAchatHT;
        public double tva;
        public int nombreMinACommander;
    }

    public static class VenteArticleFournisseurDTO {
        public String articleKey;
        public String type;
        public Long id;
        public String designation;
        public String reference;
        public int quantiteVente;
        public int stockActuel;
        public int stockMini;
        public int besoinStock;
        public List<FournisseurItemDTO> fournisseurs = new ArrayList<>();
    }

    public static class FournisseurSuggerDTO {
        public Long fournisseurId;
        public String fournisseurNom;
        public int nombreArticles;
    }

    public static class PrepareCommandeFromVenteDTO {
        public Long venteId;
        public String clientNom;
        public String numeroFacture;
        public boolean comptoir;
        public String dateVente;
        public List<VenteArticleFournisseurDTO> articles = new ArrayList<>();
        public List<FournisseurSuggerDTO> fournisseursSuggeres = new ArrayList<>();
        public List<FournisseurEntity> tousFournisseurs = new ArrayList<>();
    }

    public static class CreateCommandeFromVenteRequest {
        public Long fournisseurId;
        public String reference;
        public String referenceFournisseur;
        public String notes;
        public Double portTotal;
        public String status;
        public List<CreateCommandeLigneRequest> lignes = new ArrayList<>();
    }

    public static class CreateCommandeLigneRequest {
        public String type;
        public Long id;
        public int quantite;
        public double prixUnitaireHT;
        public double tva;
    }

    private CommandeFournisseurEntity.Status parseStatus(String status) {
        if (status == null || status.trim().isEmpty()) {
            return null;
        }
        try {
            return CommandeFournisseurEntity.Status.valueOf(status.trim());
        } catch (IllegalArgumentException ex) {
            throw new WebApplicationException("Statut de commande fournisseur invalide: " + status, 400);
        }
    }
}
