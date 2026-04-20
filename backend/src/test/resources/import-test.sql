-- Test data for integration tests

-- Users
INSERT INTO UserEntity (name, password, email, roles, theme) VALUES ('admin', 'admin123', 'admin@test.com', 'ADMIN', 0);
INSERT INTO UserEntity (name, password, email, roles, theme) VALUES ('technicien1', 'tech123', 'tech@test.com', 'TECHNICIEN', 0);

-- Societe (ID=1 required by SocieteResource)
INSERT INTO SocieteEntity (id, nom, siren, adresse, siret, email, telephone, capital) VALUES (1, 'MS Plaisance', '123456789', '10 quai du Port', '12345678900010', 'contact@msplaisance.com', '0400000000', 10000);

-- Clients (use high IDs to avoid sequence conflicts)
INSERT INTO ClientEntity (id, nom, prenom, type, email, telephone, adresse, consentement, evaluation, remise, date, motDePasse) VALUES (100, 'Dupont', 'Jean', 'Particulier', 'jean.dupont@test.com', '0612345678', '1 rue du Port', true, 4.5, 0.0, '2025-01-15', 'client123');
INSERT INTO ClientEntity (id, nom, prenom, type, email, telephone, adresse, consentement, evaluation, remise, date) VALUES (101, 'Martin', 'Sophie', 'Professionnel', 'sophie.martin@test.com', '0698765432', '2 avenue de la Mer', true, 3.0, 10.0, '2025-02-20');

-- Techniciens
INSERT INTO TechnicienEntity (id, nom, prenom, email, telephone, couleur, motDePasse) VALUES (100, 'Leclerc', 'Pierre', 'pierre.leclerc@test.com', '0611223344', '#FF5733', 'tech456');

-- Fournisseurs
INSERT INTO FournisseurEntity (id, nom, email, telephone, adresse, evaluation) VALUES (100, 'Marine Parts SA', 'contact@marineparts.com', '0400001111', '5 zone portuaire', 4.0);

-- Catalogue bateaux
INSERT INTO BateauCatalogueEntity (id, modele, marque, type, description, evaluation, anneeDebut, anneeFin, longueurExterieure, largeur, poidsVide, stock, stockAlerte, prixPublic, prixVenteHT, tva, montantTVA, prixVenteTTC, frais, tauxMarge, tauxMarque, longueurCoque, hauteur, tirantAir, tirantEau, poidsMoteurMax, chargeMax, reservoirEau, reservoirCarburant, nombrePassagersMax) VALUES (100, 'Quicksilver 505', 'Quicksilver', 'Open', 'Bateau open polyvalent', 4.0, 2024, 2024, 5.05, 2.10, 650, 3, 1, 25000.0, 22000.0, 20.0, 4400.0, 26400.0, 500.0, 10.0, 9.0, 4.80, 1.50, 2.0, 0.5, 200.0, 800.0, 50.0, 100.0, 6);

-- Catalogue moteurs (all primitive fields included)
INSERT INTO MoteurCatalogueEntity (id, modele, marque, type, description, anneeDebut, anneeFin, puissanceCv, puissanceKw, arbre, cylindres, cylindree, evaluation, stock, stockAlerte, prixPublic, frais, tauxMarge, tauxMarque, prixVenteHT, tva, montantTVA, prixVenteTTC) VALUES (100, 'Mercury 115 EFI', 'Mercury', 'Hors-bord', 'Moteur 4 temps', NULL, NULL, 115, 85, 0, 4, 2100, 0, 5, 1, 12000.0, 0, 0, 0, 10000.0, 20.0, 2000.0, 12000.0);

-- Catalogue helices (all primitive fields included)
INSERT INTO HeliceCatalogueEntity (id, modele, marque, description, diametre, pales, cannelures, evaluation, prixPublic, frais, tauxMarge, tauxMarque, prixVenteHT, tva, montantTVA, prixVenteTTC) VALUES (100, 'Vengeance 14x19', 'Mercury', 'Helice inox', 14, 3, 15, 0, 350.0, 0, 0, 0, 300.0, 20.0, 60.0, 360.0);

-- Catalogue remorques (all primitive fields included)
INSERT INTO RemorqueCatalogueEntity (id, modele, marque, description, evaluation, ptac, chargeAVide, chargeUtile, longueur, largeur, longueurMaxBateau, largeurMaxBateau, stock, stockAlerte, prixPublic, frais, tauxMarge, tauxMarque, prixVenteHT, tva, montantTVA, prixVenteTTC) VALUES (100, 'Sun Way 500', 'Sun Way', 'Remorque routiere', 0, 750, 200, 550, 600, 200, 500, 200, 2, 1, 2500.0, 0, 0, 0, 2000.0, 20.0, 400.0, 2400.0);

-- Catalogue produits (all primitive fields included)
INSERT INTO ProduitCatalogueEntity (id, nom, marque, categorie, description, evaluation, stock, stockMini, prixPublic, frais, tauxMarge, tauxMarque, prixVenteHT, tva, montantTVA, prixVenteTTC) VALUES (100, 'Huile moteur 4T', 'Motul', 'Entretien', 'Huile marine 4 temps', 0, 50, 10, 25.0, 0, 0, 0, 20.0, 20.0, 4.0, 24.0);
INSERT INTO ProduitCatalogueEntity (id, nom, marque, categorie, description, evaluation, stock, stockMini, prixPublic, frais, tauxMarge, tauxMarque, prixVenteHT, tva, montantTVA, prixVenteTTC) VALUES (101, 'Filtre a huile', 'Mercury', 'Entretien', 'Filtre compatible Mercury', 0, 2, 5, 15.0, 0, 0, 0, 12.0, 20.0, 2.4, 14.4);

-- Main d'oeuvres (all primitive fields included)
INSERT INTO MainOeuvreEntity (id, reference, nom, description, prixHT, tva, montantTVA, prixTTC) VALUES (100, 'MO-001', 'Revision annuelle', 'Revision complete moteur', 150.0, 20.0, 30.0, 180.0);
INSERT INTO MainOeuvreEntity (id, reference, nom, description, prixHT, tva, montantTVA, prixTTC) VALUES (101, 'MO-002', 'Vidange moteur', 'Vidange huile et filtre', 80.0, 20.0, 16.0, 96.0);

-- Services (all primitive fields included)
INSERT INTO ServiceEntity (id, nom, description, dureeEstimee, prixHT, tva, montantTVA, prixTTC) VALUES (100, 'Entretien complet', 'Service entretien complet moteur', 3.0, 230.0, 20.0, 46.0, 276.0);

-- Forfaits (all primitive fields included)
INSERT INTO ForfaitEntity (id, nom, reference, dureeEstimee, heuresFonctionnement, joursFrequence, prixHT, tva, montantTVA, prixTTC) VALUES (100, 'Pack entretien complet', 'FORFAIT-001', 2.0, 0, 0, 250.0, 20.0, 50.0, 300.0);

-- Transactions (all primitive fields included)
INSERT INTO TransactionEntity (id, status, montantHT, remise, dateCreation) VALUES (100, 'EN_ATTENTE', 1500, 0, '2025-06-01');

-- Annonces
INSERT INTO AnnonceEntity (id, titre, description, prix, contact, telephone, status, client_id) VALUES (100, 'Vente bateau occasion', 'Quicksilver 505 en bon etat', 18000.0, 'Jean Dupont', '0612345678', 0, 100);

-- Ventes (all primitive fields included)
INSERT INTO VenteEntity (id, status, bonPourAccord, ordreDeReparation, comptoir, client_id, date, prixVenteTTC, montantTTC, tva, montantTVA, montantHT, remise, stockDecremented, rappel1Envoye, rappel2Envoye, rappel3Envoye) VALUES (100, 3, true, false, false, 100, '2025-06-15 10:00:00', 500.0, 500.0, 20.0, 100.0, 400.0, 0.0, false, false, false, false);

-- VenteForfaits (linked to vente 100)
INSERT INTO VenteForfaitEntity (id, forfait_id, quantite, status, dateDebut, dateFin, dureeReelle, vente_id) VALUES (100, 100, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0.0, 100);

-- VenteForfait-Technicien association (many-to-many)
INSERT INTO VenteForfaitEntity_TechnicienEntity (VenteForfaitEntity_id, techniciens_id) VALUES (100, 100);

-- Tasks (checklist items, linked to venteForfait 100)
INSERT INTO TaskEntity (id, nom, description, done, vente_forfait_id) VALUES (100, 'Revision moteur', 'Revision complete', false, 100);

-- Fournisseur-Produit associations
INSERT INTO FournisseurProduitEntity (id, fournisseur_id, produit_id, reference, prixAchatHT, tva, montantTVA, prixAchatTTC, portForfaitaire, portParUnite, nombreMinACommander) VALUES (100, 100, 100, 'MP-H4T', 15.0, 20.0, 3.0, 18.0, 10.0, 0.5, 5);

-- Commandes Fournisseur
INSERT INTO CommandeFournisseurEntity (id, status, fournisseur_id, date, reference, montantHT, tva, montantTVA, montantTTC, portTotal, stockIncremented, notes) VALUES (100, 'EN_ATTENTE', 100, '2025-07-01', 'CF-001', 150.0, 20.0, 30.0, 180.0, 10.0, false, 'Commande initiale');

-- Lignes commande fournisseur
INSERT INTO CommandeFournisseurLigneEntity (id, commandeFournisseur_id, produit_id, quantite, prixUnitaireHT, tva, montantTVA, prixTotalHT, prixTotalTTC) VALUES (100, 100, 100, 10, 15.0, 20.0, 30.0, 150.0, 180.0);

-- Reset sequences to avoid conflicts with pre-inserted data
ALTER TABLE ClientEntity ALTER COLUMN id RESTART WITH 200;
ALTER TABLE TechnicienEntity ALTER COLUMN id RESTART WITH 200;
ALTER TABLE BateauCatalogueEntity ALTER COLUMN id RESTART WITH 200;
ALTER TABLE MoteurCatalogueEntity ALTER COLUMN id RESTART WITH 200;
ALTER TABLE HeliceCatalogueEntity ALTER COLUMN id RESTART WITH 200;
ALTER TABLE RemorqueCatalogueEntity ALTER COLUMN id RESTART WITH 200;
ALTER TABLE ProduitCatalogueEntity ALTER COLUMN id RESTART WITH 200;
ALTER TABLE MainOeuvreEntity ALTER COLUMN id RESTART WITH 200;
ALTER TABLE ServiceEntity ALTER COLUMN id RESTART WITH 200;
ALTER TABLE ServiceMainOeuvreEntity ALTER COLUMN id RESTART WITH 200;
ALTER TABLE ServiceProduitEntity ALTER COLUMN id RESTART WITH 200;
ALTER TABLE ForfaitEntity ALTER COLUMN id RESTART WITH 200;
ALTER TABLE ForfaitMainOeuvreEntity ALTER COLUMN id RESTART WITH 200;
ALTER TABLE FournisseurEntity ALTER COLUMN id RESTART WITH 200;
ALTER TABLE TransactionEntity ALTER COLUMN id RESTART WITH 200;
ALTER TABLE AnnonceEntity ALTER COLUMN id RESTART WITH 200;
ALTER TABLE VenteEntity ALTER COLUMN id RESTART WITH 200;
ALTER TABLE VenteForfaitEntity ALTER COLUMN id RESTART WITH 200;
ALTER TABLE VenteServiceEntity ALTER COLUMN id RESTART WITH 200;
ALTER TABLE TaskEntity ALTER COLUMN id RESTART WITH 200;
ALTER TABLE SocieteEntity ALTER COLUMN id RESTART WITH 200;
ALTER TABLE FournisseurProduitEntity ALTER COLUMN id RESTART WITH 200;
ALTER TABLE CommandeFournisseurEntity ALTER COLUMN id RESTART WITH 200;
ALTER TABLE CommandeFournisseurLigneEntity ALTER COLUMN id RESTART WITH 200;
ALTER TABLE RappelHistoriqueEntity ALTER COLUMN id RESTART WITH 200;
