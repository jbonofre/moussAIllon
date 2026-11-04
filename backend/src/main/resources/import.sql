MERGE INTO userEntity(name, password, email) KEY(name) VALUES('admin', 'admin', 'contact@msplaisance.com');
MERGE INTO UserEntity_modules(UserEntity_name, modules) KEY(UserEntity_name, modules) VALUES('admin', 'VENTE'), ('admin', 'PARC'), ('admin', 'CATALOGUE'), ('admin', 'ATELIER'), ('admin', 'MARKETING'), ('admin', 'COMPTABILITE'), ('admin', 'PARAMETRAGE');

MERGE INTO societeEntity(id, nom, siren, capital, adresse) KEY(id) VALUES(1, 'A changer', 'A changer', 0, 'A changer');