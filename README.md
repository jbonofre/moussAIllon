# moussAIllon

**Plateforme de gestion de chantier naval augmentee par l'IA.**

MoussAIllon centralise l'ensemble des metiers d'un chantier naval dans une seule application : gestion commerciale, parc nautique, stock, planification des interventions, relation client et integration de fournisseurs.

## Fonctionnalites principales

- **Gestion clients & CRM** - fiches, prospects, bateaux, moteurs, remorques, historique, suivi commercial (échanges et actions commerciales à faire)
- **Catalogue & parc** - bateaux, moteurs, helices, remorques, produits (neuf et occasion), packages regroupant ces articles et des forfaits pour peupler une vente comptoir ou une transaction
- **Ventes & facturation** - forfaits, comptoir, transactions, lignes libres créant l'article au catalogue à la volée, paiement en ligne (Stripe, PayPlug)
- **Fournisseurs** - referentiel multi-types (bateaux, moteurs, helices, produits, remorques)
- **Equipe & planning** - gestion des techniciens, planification des interventions
- **Petites annonces** - publication et gestion d'annonces
- **Espace client** - portail self-service (bateaux, factures, profil, annonces)
- **Espace technicien** - planning mobile des interventions
- **IA integree** - chat assisté (OpenAI / Anthropic), serveur MCP pour l'exploration de l'API
- **Notifications email** - alertes incidents, mots de passe, planning
- **Multi-chantier** - une instance heberge plusieurs chantiers, chacun avec ses donnees, ses utilisateurs, ses clients et son abonnement ; chaque utilisateur se connecte avec le code de son chantier
- **Administration de l'instance** - application admin pour creer les chantiers, gerer leur abonnement (gratuit, modules, paiements recus, resiliation), couper leur acces et les supprimer
- **Modules & abonnement** - acces des utilisateurs par module (Vente, Parc, Catalogue, Atelier, Marketing, Comptabilite, Parametrage) ; abonnement calcule selon le nombre d'utilisateurs, de techniciens et de clients ayant acces au portail, et les modules souscrits ; active au premier paiement (frais d'activation et premier mois ou premiere annee), suivi mois par mois, modules ajoutes payes tout de suite ; sans abonnement active, l'acces est limite a la facturation

## Architecture

```
moussAIllon/
├── backend/          Java 21, Quarkus 3.32, Hibernate/Panache, H2
├── chantier-ui/      React 18, TypeScript, Ant Design 6 — gestion du chantier
├── client-ui/        React 18, TypeScript, Ant Design 5 — portail client
├── technicien-ui/    React 18, TypeScript, Ant Design 5 — espace technicien
└── admin-ui/         React, TypeScript, Ant Design 6 — administration de l'instance (chantiers)
```

Les frontends communiquent avec le backend via proxy sur `http://localhost:8080`.

## Prerequis

- JDK 21
- Node.js 20+
- Maven 3.9+

## Demarrage rapide

### Backend

```bash
cd backend
mvn quarkus:dev
```

Le backend demarre sur `http://localhost:8080`.

### Frontends

```bash
# Chantier UI (port 3000)
cd chantier-ui && npm install && npm start

# Client UI (port 3001)
cd client-ui && npm install && npm start

# Technicien UI (port 3002)
cd technicien-ui && npm install && npm start

# Admin UI (port 3003)
cd admin-ui && npm install && npm start
```

Sur une base vide, creez d'abord un chantier dans l'application admin (identifiants `admin` / `admin` par defaut, voir [Multi-chantier](#multi-chantier)), puis connectez-vous a l'espace chantier avec son code.

## Configuration

### Variables d'environnement

| Variable | Description | Defaut |
|---|---|---|
| `AI_OPENAI_API_KEY` | Cle API OpenAI | _(requis pour le chat IA)_ |
| `AI_ANTHROPIC_API_KEY` | Cle API Anthropic | _(requis pour le chat IA)_ |
| `AI_OPENAI_MODEL` | Modele OpenAI | `gpt-4o-mini` |
| `AI_ANTHROPIC_MODEL` | Modele Anthropic | `claude-haiku-4-5-20251001` |
| `AI_ANTHROPIC_IMPORT_DETECTION_ENABLED` | Detection par IA des bateaux, moteurs, helices et remorques a l'import du catalogue (les designations sont envoyees a Anthropic ; sinon detection par mots-cles) | `true` |
| `STRIPE_API_KEY` | Cle API Stripe | _(requis pour paiements Stripe)_ |
| `PAYPLUG_API_KEY` | Cle API PayPlug | _(requis pour paiements PayPlug)_ |
| `MAILER_FROM` | Expediteur email | `noreply@moussaillon.local` |
| `MAILER_HOST` | Serveur SMTP | `localhost` |
| `MAILER_PORT` | Port SMTP | `1025` |
| `MAILER_MOCK` | Mode mock (pas d'envoi reel) | `true` |
| `ADMIN_USERNAME` | Utilisateur de l'administrateur de l'instance (application admin) | `admin` |
| `ADMIN_PASSWORD` | Mot de passe de l'administrateur de l'instance — **a changer en production** | `admin` |
| `ADMIN_EMAIL` | Email de l'administrateur, indique aux chantiers dont l'acces est suspendu | `admin@moussaillon.local` |
| `CHANTIER_INITIAL` | Code du chantier qui recoit les donnees d'une installation anterieure au multi-chantier (une seule fois, au demarrage) | `principal` |
| `CHANTIER_PAR_DEFAUT` | Chantier des requetes qui n'en designent aucun (instance mono-chantier, outils) | _(aucun)_ |
| `ABONNEMENT_STRIPE_API_KEY` | Cle API Stripe de l'editeur pour payer l'abonnement en ligne au montant calcule (distincte de `STRIPE_API_KEY`, qui encaisse les ventes du chantier) ; sans cle, le lien de paiement fixe de la societe est utilise | _(vide)_ |
| `ABONNEMENT_PAYPLUG_API_KEY` | Cle API PayPlug de l'editeur pour payer l'abonnement en ligne au montant calcule | _(vide)_ |
| `ABONNEMENT_PAIEMENT_RETOUR_URL` | Page de retour apres le paiement en ligne de l'abonnement | `http://localhost:3000/chantier/` |
| `ABONNEMENT_PRIX_UTILISATEUR` | Prix mensuel de l'abonnement par utilisateur du chantier (EUR) | `10` |
| `ABONNEMENT_PRIX_TECHNICIEN` | Prix mensuel de l'abonnement par technicien (EUR) | `10` |
| `ABONNEMENT_PRIX_CLIENT` | Prix mensuel de l'abonnement par client ayant acces au portail client (EUR) | `0.10` |
| `ABONNEMENT_PRIX_MODULE_<MODULE>` | Prix mensuel d'un module souscrit (EUR) : `VENTE`, `PARC`, `CATALOGUE`, `ATELIER`, `MARKETING`, `COMPTABILITE` (`PARAMETRAGE` est inclus) | `35`, `20`, `25`, `20`, `20`, `20` |

### Multi-chantier

Une instance heberge plusieurs chantiers. Chaque table porte une colonne `chantier`, renseignee et filtree automatiquement par Hibernate (`@TenantId`, mode `DISCRIMINATOR`) : un chantier ne voit que ses donnees, y compris par identifiant.

- **Connexion** : les ecrans de connexion (chantier, client, technicien) demandent le **code chantier**. Il est memorise dans le navigateur, et un lien `?chantier=code` le pre-remplit (ex. `https://hote/client/?chantier=ms-plaisance`, a transmettre aux clients du chantier). Le jeton emis porte le chantier (claim `chantier`) : il designe les donnees de toutes les requetes suivantes. Les requetes sans jeton designent leur chantier par l'en-tete `X-Chantier` (ou le parametre `chantier`).
- **Application admin** (`/admin/`) : l'administrateur de l'instance (`ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_EMAIL`) cree les chantiers (code, nom, email, premier utilisateur, modules), accorde l'**abonnement gratuit** (remplace l'ancienne variable `ABONNEMENT_FREE`, desormais par chantier), modifie les modules, enregistre les paiements recus, resilie ou reactive l'abonnement, **coupe l'acces** (connexions refusees, jetons en cours rejetes, envois automatiques arretes) et **supprime** un chantier et toutes ses donnees (code a confirmer). Les images et documents deposes restent sur le disque.
- **Taches planifiees** (relances, campagnes, sequences d'emails, factures soldees) : executees pour chaque chantier dont l'acces n'est pas suspendu.
- **Flux d'annonces** : l'URL donnee aux plateformes ne change pas, son jeton secret designe le chantier.
- **Migration** : au premier demarrage, les donnees d'une installation mono-chantier sont affectees au chantier `CHANTIER_INITIAL` (cree au nom de la societe ; si `ABONNEMENT_FREE` etait active, son abonnement est gratuit), les utilisateurs sont recopies dans la table `UtilisateurEntity` et les contraintes d'unicite deviennent propres a chaque chantier. Ses utilisateurs se connectent ensuite avec ce code.

### Upload d'images

Les images (bateaux, moteurs, etc.) sont envoyees via `POST /api/images` et stockees dans `./data/images`. La taille maximale d'une requete est de **50 Mo**, a configurer a deux niveaux :

| Composant | Parametre | Valeur |
|---|---|---|
| Backend (`application.properties`) | `quarkus.http.limits.max-body-size` | `50M` (defaut Quarkus : 10 Mo) |
| nginx (gateway, frontends, reverse proxy) | `client_max_body_size` | `50m` (defaut nginx : 1 Mo) |

> **Note :** Sans `client_max_body_size`, nginx rejette les photos de plus de 1 Mo (HTTP 413) et l'UI affiche « Erreur lors de l'upload de l'image ». Si vous placez un autre reverse proxy ou un Ingress devant l'application, relevez aussi sa limite (ex. annotation `nginx.ingress.kubernetes.io/proxy-body-size: 50m` pour ingress-nginx).

### Base de donnees

Par defaut, H2 avec stockage fichier (`./data/moussaillon`). Le schema est mis a jour automatiquement au demarrage (`hibernate.schema-management.strategy=update`).

## Tests

### Backend

Tests d'integration avec Quarkus JUnit 5 et REST Assured (base H2 en memoire).

```bash
mvn -B verify -pl backend
```

Tests disponibles : `ClientResourceTest`, `UserResourceTest`, `BateauCatalogueResourceTest`.

### Frontend

Tests avec Jest et React Testing Library.

```bash
# Depuis le repertoire du frontend concerne
CI=true npm test -- --watchAll=false
```

## Docker

### Images

Chaque composant dispose d'un `Dockerfile` multi-stage :

| Image | Base build | Base runtime | Port |
|---|---|---|---|
| `backend/Dockerfile` | `maven:3.9-eclipse-temurin-21` | `eclipse-temurin:21-jre` | 8080 |
| `chantier-ui/Dockerfile` | `node:20-alpine` | `nginx:stable-alpine` | 80 |
| `client-ui/Dockerfile` | `node:20-alpine` | `nginx:stable-alpine` | 80 |
| `technicien-ui/Dockerfile` | `node:20-alpine` | `nginx:stable-alpine` | 80 |
| `admin-ui/Dockerfile` | `node:20-alpine` | `nginx:stable-alpine` | 80 |

Les frontends utilisent nginx pour servir le SPA et proxifier `/api/` vers le backend (le préfixe `/api` est strippé avant transmission). Un service `gateway` (nginx) unifie les 4 UIs sur le port 80 (`/chantier/`, `/client/`, `/technicien/`, `/admin/`), la racine `/` redirigeant vers `/chantier/`.

### Docker Compose

Demarrage de l'ensemble de la plateforme :

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| Backend API | `http://localhost:8080` |
| Chantier UI | `http://localhost/chantier/` |
| Client UI | `http://localhost/client/` |
| Technicien UI | `http://localhost/technicien/` |
| Admin UI | `http://localhost/admin/` |

Les variables d'environnement peuvent etre definies dans un fichier `.env` a la racine du projet.

### Build individuel

```bash
# Backend (contexte = racine du projet)
docker build -f backend/Dockerfile -t moussaillon/backend .

# Frontends (contexte = repertoire du frontend)
docker build -t moussaillon/chantier-ui chantier-ui/
docker build -t moussaillon/client-ui client-ui/
docker build -t moussaillon/technicien-ui technicien-ui/
docker build -t moussaillon/admin-ui admin-ui/
```

## Helm Chart

Le chart Helm se trouve dans `helm/moussaillon/`.

### Installation

```bash
helm install moussaillon ./helm/moussaillon
```

### Configuration

Les valeurs principales sont definies dans `values.yaml` :

| Parametre | Description | Defaut |
|---|---|---|
| `backend.replicaCount` | Nombre de replicas backend | `1` |
| `backend.persistence.enabled` | Activer le volume persistant (H2) | `true` |
| `backend.persistence.size` | Taille du volume | `1Gi` |
| `backend.existingSecret` | Secret Kubernetes pour les cles API | `""` |
| `chantierUi.replicaCount` | Replicas chantier-ui | `1` |
| `clientUi.replicaCount` | Replicas client-ui | `1` |
| `technicienUi.replicaCount` | Replicas technicien-ui | `1` |
| `adminUi.replicaCount` | Replicas admin-ui | `1` |
| `ingress.enabled` | Activer l'Ingress | `false` |

### Secrets

Pour les cles sensibles (API AI, Stripe, PayPlug), creer un secret Kubernetes et le referencer :

```bash
kubectl create secret generic moussaillon-secrets \
  --from-literal=AI_OPENAI_API_KEY=sk-... \
  --from-literal=AI_ANTHROPIC_API_KEY=sk-ant-... \
  --from-literal=STRIPE_API_KEY=sk_live_... \
  --from-literal=PAYPLUG_API_KEY=... \
  --from-literal=ADMIN_PASSWORD=...

helm install moussaillon ./helm/moussaillon \
  --set backend.existingSecret=moussaillon-secrets
```

### Ingress

L'Ingress (desactive par defaut) utilise un routage par host :

| Host | Service |
|---|---|
| `moussaillon.local` | chantier-ui (+ `/api` vers backend) |
| `client.moussaillon.local` | client-ui |
| `technicien.moussaillon.local` | technicien-ui |
| `admin.moussaillon.local` | admin-ui |

```bash
helm install moussaillon ./helm/moussaillon \
  --set ingress.enabled=true \
  --set ingress.className=nginx \
  --set-string 'ingress.annotations.nginx\.ingress\.kubernetes\.io/proxy-body-size=50m'
```

L'annotation `proxy-body-size` est necessaire pour l'upload d'images (voir [Upload d'images](#upload-dimages)).

> **Note :** Le backend utilise H2 (base embarquee fichier). Pour un deploiement Kubernetes en production avec plusieurs replicas, il est recommande de migrer vers PostgreSQL (`quarkus-jdbc-postgresql`).

## Integration continue

GitHub Actions (`.github/workflows/ci.yml`) — declenchement sur push et PR vers `main`.

Jobs en parallele :

| Job | Contenu |
|---|---|
| **Backend Tests** | Build Maven + tests d'integration (JDK 21) |
| **Chantier UI Tests** | `npm ci` + tests Jest + build |
| **Client UI Tests** | `npm ci` + tests Jest + build |
| **Technicien UI Tests** | `npm ci` + tests Jest + build |
| **Admin UI Tests** | `npm ci` + tests Jest + build |

## Serveur MCP (IA)

Le backend expose un endpoint MCP JSON-RPC 2.0 sur `POST /mcp`.

### Outils exposes

| Outil | Description |
|---|---|
| `moussaillon_list_api_resources` | Liste les ressources API disponibles |
| `moussaillon_call_api_resource` | Appelle une ressource API (`GET`, `POST`, `PUT`, `DELETE`) |

### Exemples d'utilisation

**Initialisation :**

```bash
curl -s http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
```

**Lister les outils :**

```bash
curl -s http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

**Lister les ressources API :**

```bash
curl -s http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"moussaillon_list_api_resources","arguments":{}}}'
```

**Appeler une ressource (GET avec query) :**

```bash
curl -s http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"moussaillon_call_api_resource","arguments":{"method":"GET","path":"/clients/search","query":{"q":"dupont"}}}}'
```

**Appeler une ressource (POST avec body) :**

```bash
curl -s http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"moussaillon_call_api_resource","arguments":{"method":"POST","path":"/clients","body":{"nom":"Jean Dupont","type":"PARTICULIER","email":"jean.dupont@example.com"}}}}'
```

## Chat IA

Le backend expose `POST /ai/chat`. Le frontend (`chantier-ui`) permet de choisir le provider :

- **ChatGPT** (`provider: "openai"`)
- **Claude** (`provider: "anthropic"`)

Les commandes API explicites (`GET /...`, `POST /...`) passent par MCP.

> Les cles API doivent rester cote backend uniquement — ne jamais les exposer dans le frontend.

## Deploiement AWS

Le projet peut etre deploye sur AWS via quatre approches.

### Prerequis communs (options 2, 3, 4)

Les options conteneurisees necessitent :

- AWS CLI configuree (`aws configure`)
- Images Docker poussees sur **Amazon ECR** :

```bash
# Creer les repositories ECR
for repo in backend chantier-ui client-ui technicien-ui; do
  aws ecr create-repository --repository-name moussaillon/$repo --region eu-west-3
done

# Authentification Docker aupres d'ECR
aws ecr get-login-password --region eu-west-3 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.eu-west-3.amazonaws.com

# Build et push des images
docker build -f backend/Dockerfile -t <account-id>.dkr.ecr.eu-west-3.amazonaws.com/moussaillon/backend:latest .
docker push <account-id>.dkr.ecr.eu-west-3.amazonaws.com/moussaillon/backend:latest

for ui in chantier-ui client-ui technicien-ui; do
  docker build -t <account-id>.dkr.ecr.eu-west-3.amazonaws.com/moussaillon/$ui:latest $ui/
  docker push <account-id>.dkr.ecr.eu-west-3.amazonaws.com/moussaillon/$ui:latest
done
```

- Stocker les secrets (cles API) dans **AWS Secrets Manager** ou **SSM Parameter Store**

### Option 1 : Amazon EC2 (deploiement classique)

Deploiement direct sur une instance EC2 sans conteneur, ideal pour un environnement simple ou de test.

**Instance recommandee :**

- Type : `t3.medium` (2 vCPU, 4 GB RAM) minimum
- AMI : Amazon Linux 2023
- Stockage : 20 GB gp3 minimum
- Security Group : ports 22 (SSH), 80 (HTTP), 443 (HTTPS optionnel)

**Installation des dependances :**

```bash
# Installer JDK 21
sudo dnf install -y java-21-amazon-corretto-devel

# Installer Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs

# Installer Maven et Git
sudo dnf install -y maven git
```

**Build de l'application :**

```bash
git clone https://github.com/jbonofre/moussAIllon.git
cd moussAIllon

# Builder les frontends
for ui in chantier-ui client-ui technicien-ui; do
  cd $ui && npm ci && npm run build && cd ..
done

# Builder le backend (uber-jar)
cd backend
mvn package -DskipTests -Dquarkus.package.jar.type=uber-jar
```

**Configuration des variables d'environnement :**

Creer `/opt/moussaillon/env.sh` :

```bash
AI_OPENAI_API_KEY=sk-...
AI_ANTHROPIC_API_KEY=sk-ant-...
STRIPE_API_KEY=sk_live_...
PAYPLUG_API_KEY=...
MAILER_MOCK=true
STRIPE_SUCCESS_URL=http://<IP_PUBLIQUE>/ventes?payment=success
STRIPE_CANCEL_URL=http://<IP_PUBLIQUE>/ventes?payment=cancel
```

**Service systemd :**

Creer `/etc/systemd/system/moussaillon.service` :

```ini
[Unit]
Description=moussAIllon Backend
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/moussAIllon/backend
EnvironmentFile=/opt/moussaillon/env.sh
ExecStart=/usr/bin/java -jar /home/ec2-user/moussAIllon/backend/target/moussaillon-1.0.0-SNAPSHOT-runner.jar
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now moussaillon
```

**Reverse proxy Nginx :**

```bash
sudo dnf install -y nginx
```

Creer `/etc/nginx/conf.d/moussaillon.conf` :

```nginx
server {
    listen 80;
    server_name _;

    # Upload d'images (defaut nginx : 1m)
    client_max_body_size 50m;

    location ^~ /api/ {
        rewrite ^/api/(.*) /$1 break;
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location ^~ /chantier/ {
        alias /home/ec2-user/moussAIllon/chantier-ui/target/classes/META-INF/resources/;
        try_files $uri $uri/ /chantier/index.html;
    }

    location ^~ /client/ {
        alias /home/ec2-user/moussAIllon/client-ui/target/classes/META-INF/resources/;
        try_files $uri $uri/ /client/index.html;
    }

    location ^~ /technicien/ {
        alias /home/ec2-user/moussAIllon/technicien-ui/target/classes/META-INF/resources/;
        try_files $uri $uri/ /technicien/index.html;
    }

    location = / {
        return 301 /chantier/;
    }
}
```

```bash
sudo systemctl enable --now nginx
```

**Points cles :**

- Pas de conteneur ni d'orchestrateur a gerer
- Base H2 fichier disponible directement sur le disque de l'instance
- HTTPS possible via Certbot (Let's Encrypt) avec un nom de domaine
- Sauvegardes via snapshots EBS
- Pas d'auto-scaling natif : il faut un AMI + Auto Scaling Group pour scaler

### Option 2 : Amazon EKS (Kubernetes manage)

Utilise directement le chart Helm (`helm/moussaillon/`).

**Creation du cluster :**

```bash
eksctl create cluster \
  --name moussaillon \
  --region eu-west-3 \
  --node-type t3.medium \
  --nodes 2
```

**Installation de l'AWS Load Balancer Controller** (necessaire pour l'Ingress) :

```bash
helm repo add eks https://aws.github.io/eks-charts
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=moussaillon
```

**Creation du secret Kubernetes :**

```bash
kubectl create secret generic moussaillon-secrets \
  --from-literal=AI_OPENAI_API_KEY=sk-... \
  --from-literal=AI_ANTHROPIC_API_KEY=sk-ant-... \
  --from-literal=STRIPE_API_KEY=sk_live_... \
  --from-literal=PAYPLUG_API_KEY=...
```

**Deploiement avec Helm :**

```bash
helm install moussaillon ./helm/moussaillon \
  --set global.imageRegistry=<account-id>.dkr.ecr.eu-west-3.amazonaws.com \
  --set backend.existingSecret=moussaillon-secrets \
  --set ingress.enabled=true \
  --set ingress.className=alb \
  --set 'ingress.annotations.alb\.ingress\.kubernetes\.io/scheme=internet-facing' \
  --set 'ingress.annotations.alb\.ingress\.kubernetes\.io/target-type=ip'
```

**Points cles :**

- Le chart gere les Deployments, Services, PVC (stockage H2) et Ingress
- Les sondes de sante (`/q/health/ready`, `/q/health/live`) sont deja configurees
- Le scaling se fait via `--set backend.replicaCount=N` (migrer vers RDS PostgreSQL si replicas > 1)

### Option 3 : Amazon ECS Fargate (conteneurs serverless)

Deploiement sans Kubernetes, directement depuis les images Docker.

**Creation du cluster ECS et des ressources :**

```bash
# Creer le cluster
aws ecs create-cluster --cluster-name moussaillon

# Creer un VPC avec des sous-reseaux publics (ou utiliser un existant)
# Creer un ALB (Application Load Balancer) avec des target groups pour chaque service
```

**Definition des taches** (une par service) :

| Service | Image ECR | Port | Health check |
|---|---|---|---|
| backend | `moussaillon/backend:latest` | 8080 | `/q/health/ready` |
| chantier-ui | `moussaillon/chantier-ui:latest` | 80 | `/` |
| client-ui | `moussaillon/client-ui:latest` | 80 | `/` |
| technicien-ui | `moussaillon/technicien-ui:latest` | 80 | `/` |

**Exemple de task definition backend :**

```json
{
  "family": "moussaillon-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "<account-id>.dkr.ecr.eu-west-3.amazonaws.com/moussaillon/backend:latest",
      "portMappings": [{ "containerPort": 8080 }],
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:8080/q/health/ready || exit 1"],
        "interval": 10,
        "timeout": 5,
        "retries": 5
      },
      "secrets": [
        { "name": "AI_OPENAI_API_KEY", "valueFrom": "arn:aws:ssm:eu-west-3:<account-id>:parameter/moussaillon/AI_OPENAI_API_KEY" },
        { "name": "AI_ANTHROPIC_API_KEY", "valueFrom": "arn:aws:ssm:eu-west-3:<account-id>:parameter/moussaillon/AI_ANTHROPIC_API_KEY" },
        { "name": "STRIPE_API_KEY", "valueFrom": "arn:aws:ssm:eu-west-3:<account-id>:parameter/moussaillon/STRIPE_API_KEY" },
        { "name": "PAYPLUG_API_KEY", "valueFrom": "arn:aws:ssm:eu-west-3:<account-id>:parameter/moussaillon/PAYPLUG_API_KEY" }
      ],
      "environment": [
        { "name": "MAILER_MOCK", "value": "true" }
      ]
    }
  ]
}
```

**Creation des services :**

```bash
aws ecs create-service \
  --cluster moussaillon \
  --service-name backend \
  --task-definition moussaillon-backend \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=arn:aws:...,containerName=backend,containerPort=8080"
```

**Points cles :**

- Pas de cluster Kubernetes a gerer
- Auto-scaling natif via les politiques ECS
- Les secrets sont injectes depuis SSM Parameter Store
- Routage via ALB : regles par host ou par path vers chaque target group

### Option 4 : AWS App Runner (le plus simple)

Deploiement entierement manage : une image ECR = un service avec HTTPS, auto-scaling et health checks integres. Aucune infra a configurer.

**Creation du role IAM pour l'acces ECR :**

```bash
aws iam create-role \
  --role-name AppRunnerECRAccess \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "build.apprunner.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

aws iam attach-role-policy \
  --role-name AppRunnerECRAccess \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess
```

**Deploiement du backend :**

```bash
aws apprunner create-service \
  --service-name moussaillon-backend \
  --source-configuration '{
    "ImageRepository": {
      "ImageIdentifier": "<account-id>.dkr.ecr.eu-west-3.amazonaws.com/moussaillon/backend:latest",
      "ImageRepositoryType": "ECR",
      "ImageConfiguration": {
        "Port": "8080",
        "RuntimeEnvironmentSecrets": {
          "AI_OPENAI_API_KEY": "arn:aws:ssm:eu-west-3:<account-id>:parameter/moussaillon/AI_OPENAI_API_KEY",
          "AI_ANTHROPIC_API_KEY": "arn:aws:ssm:eu-west-3:<account-id>:parameter/moussaillon/AI_ANTHROPIC_API_KEY",
          "STRIPE_API_KEY": "arn:aws:ssm:eu-west-3:<account-id>:parameter/moussaillon/STRIPE_API_KEY",
          "PAYPLUG_API_KEY": "arn:aws:ssm:eu-west-3:<account-id>:parameter/moussaillon/PAYPLUG_API_KEY"
        },
        "RuntimeEnvironmentVariables": {
          "MAILER_MOCK": "true"
        }
      }
    },
    "AutoDeploymentsEnabled": true,
    "AuthenticationConfiguration": {
      "AccessRoleArn": "arn:aws:iam::<account-id>:role/AppRunnerECRAccess"
    }
  }' \
  --health-check-configuration "Protocol=HTTP,Path=/q/health/ready,Interval=10,Timeout=5" \
  --instance-configuration "Cpu=1 vCPU,Memory=2 GB"
```

**Deploiement des frontends :**

Chaque frontend doit pointer vers l'URL publique du backend (et non `http://backend:8080` comme en Docker/Kubernetes). Adapter la config nginx avant le build :

```bash
# Recuperer l'URL du service backend
BACKEND_URL=$(aws apprunner list-services --query "ServiceSummaryList[?ServiceName=='moussaillon-backend'].ServiceUrl" --output text)

# Pour chaque frontend, remplacer le proxy_pass dans nginx.conf avant le build Docker
for ui in chantier-ui client-ui technicien-ui; do
  sed "s|proxy_pass http://backend:8080/;|proxy_pass https://$BACKEND_URL/;|" $ui/nginx.conf > $ui/nginx.conf.aws
  docker build --build-arg NGINX_CONF=nginx.conf.aws -t <account-id>.dkr.ecr.eu-west-3.amazonaws.com/moussaillon/$ui:latest $ui/
  docker push <account-id>.dkr.ecr.eu-west-3.amazonaws.com/moussaillon/$ui:latest

  aws apprunner create-service \
    --service-name moussaillon-$ui \
    --source-configuration '{
      "ImageRepository": {
        "ImageIdentifier": "<account-id>.dkr.ecr.eu-west-3.amazonaws.com/moussaillon/'$ui':latest",
        "ImageRepositoryType": "ECR",
        "ImageConfiguration": { "Port": "80" }
      },
      "AutoDeploymentsEnabled": true,
      "AuthenticationConfiguration": {
        "AccessRoleArn": "arn:aws:iam::<account-id>:role/AppRunnerECRAccess"
      }
    }' \
    --health-check-configuration "Protocol=HTTP,Path=/,Interval=10,Timeout=5" \
    --instance-configuration "Cpu=0.25 vCPU,Memory=0.5 GB"
done
```

**Points cles :**

- Chaque service recoit une URL HTTPS publique (`xxx.eu-west-3.awsapprunner.com`)
- Auto-scaling et TLS geres automatiquement, zero infra a maintenir
- Deploiement automatique a chaque push d'image sur ECR (`AutoDeploymentsEnabled: true`)
- Pas de service discovery interne : les frontends doivent utiliser l'URL publique du backend
- Pas de volume persistant : necessite une base externe (RDS PostgreSQL) des le depart

### Comparaison

| | EC2 | EKS + Helm | ECS Fargate | App Runner |
|---|---|---|---|---|
| Conteneurisation requise | Non | Oui | Oui | Oui |
| Reutilise le chart Helm | Non | Oui | Non | Non |
| Complexite operationnelle | Faible | Moyenne | Faible | Tres faible |
| Cout minimum | ~10-20 EUR/mois (t3.medium) | ~150 EUR/mois (cluster EKS) | ~30-50 EUR/mois | ~20-40 EUR/mois |
| Auto-scaling | Manuel (ASG) | HPA (manuel) | Natif | Natif |
| HTTPS/TLS | Certbot / ALB | A configurer | A configurer | Inclus |
| Volume persistant (H2) | Oui (disque EBS) | Oui (PVC) | EFS possible | Non |

> **Note :** Pour un deploiement production avec plusieurs replicas, il est recommande de migrer la base H2 vers **Amazon RDS PostgreSQL** (`quarkus-jdbc-postgresql`).

## License

Apache 2.0 — voir [LICENSE](LICENSE) pour plus de details.

## Copyright

moussAIllon — Copyright 2025-2026 NOSE Experts
