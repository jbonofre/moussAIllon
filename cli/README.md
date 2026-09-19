# moussAIllon CLI

CLI de gestion du chantier naval moussAIllon. Permet d'interagir avec l'API REST du backend depuis le terminal.

## Prérequis

- JDK 21+
- Maven 3.9+
- Le backend moussAIllon doit être démarré (`http://localhost:8080` par défaut)

## Build

```bash
mvn -B package -pl cli -DskipTests
```

## Utilisation

```bash
java -jar cli/target/quarkus-app/quarkus-run.jar [COMMANDE] [SOUS-COMMANDE] [OPTIONS]
```

Pour simplifier, vous pouvez créer un alias :

```bash
alias moussaillon='java -jar cli/target/quarkus-app/quarkus-run.jar'
```

## Commandes disponibles

| Commande       | Description                      |
|----------------|----------------------------------|
| `clients`      | Gestion des clients              |
| `bateaux`      | Gestion du catalogue de bateaux  |
| `moteurs`      | Gestion du catalogue de moteurs  |
| `techniciens`  | Gestion des techniciens          |
| `fournisseurs` | Gestion des fournisseurs         |
| `ventes`       | Gestion des ventes               |

Chaque commande supporte les sous-commandes suivantes :

| Sous-commande | Description                          |
|---------------|--------------------------------------|
| `list`        | Lister toutes les entités            |
| `get <id>`    | Afficher une entité par son ID       |
| `search`      | Rechercher des entités               |
| `create`      | Créer une nouvelle entité            |
| `update <id>` | Mettre à jour une entité existante   |
| `delete <id>` | Supprimer une entité                 |

## Options globales

| Option        | Description                              |
|---------------|------------------------------------------|
| `--help`      | Afficher l'aide de la commande           |
| `--version`   | Afficher la version du CLI               |
| `--json`      | Afficher la sortie en JSON (sur `list` et `search`) |

## Exemples

### Clients

```bash
# Lister tous les clients
moussaillon clients list

# Lister en format JSON
moussaillon clients list --json

# Rechercher un client
moussaillon clients search "Dupont"

# Afficher un client par ID
moussaillon clients get 1

# Créer un client
moussaillon clients create --nom "Jean Dupont" --type particulier --email jean@dupont.fr --telephone 0601020304

# Mettre à jour un client
moussaillon clients update 1 --email nouveau@email.fr

# Supprimer un client
moussaillon clients delete 1
```

### Bateaux (catalogue)

```bash
# Lister le catalogue
moussaillon bateaux list

# Rechercher un bateau
moussaillon bateaux search "Bénéteau"

# Ajouter un bateau au catalogue
moussaillon bateaux create --marque Bénéteau --modele "Flyer 7" --type moteur --annee 2025 --prix-public 45000 --stock 3
```

### Moteurs (catalogue)

```bash
# Lister les moteurs
moussaillon moteurs list

# Ajouter un moteur
moussaillon moteurs create --marque Yamaha --modele F150 --type hors-bord --puissance 150cv
```

### Techniciens

```bash
# Lister les techniciens
moussaillon techniciens list

# Créer un technicien
moussaillon techniciens create --nom Martin --prenom Pierre --email pierre@chantier.fr --couleur "#3498db"
```

### Fournisseurs

```bash
# Lister les fournisseurs
moussaillon fournisseurs list

# Créer un fournisseur
moussaillon fournisseurs create --nom "Accastillage Diffusion" --email contact@accastillage.fr --telephone 0102030405
```

### Ventes

```bash
# Lister les ventes
moussaillon ventes list

# Rechercher par statut et/ou client
moussaillon ventes search --status EN_ATTENTE
moussaillon ventes search --client-id 1 --type COMPTOIR

# Créer une vente
moussaillon ventes create --type COMPTOIR --client-id 1
```

## Configuration

L'URL du backend est configurable via la propriété `moussaillon.api.url` dans `src/main/resources/application.properties` (défaut : `http://localhost:8080`).

Elle peut aussi être surchargée au lancement :

```bash
java -Dmoussaillon.api.url=http://mon-serveur:8080 -jar cli/target/quarkus-app/quarkus-run.jar clients list
```
