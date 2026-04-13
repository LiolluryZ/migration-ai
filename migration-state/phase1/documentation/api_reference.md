# Référence API — Toutes les Routes

[← Retour à l'index](./index.md)

> **Base URL Legacy** : `http://localhost:8000`  
> **Base URL Cible** : `http://localhost:3000`  
> **Format** : HTML (SSR Django). Certaines routes retournent un fragment HTML partiel si le header `HX-Request: true` est présent.  
> **CSRF** : Toutes les requêtes POST requièrent un token CSRF (`csrfmiddlewaretoken`).

---

## Tableau récapitulatif

| Méthode | Chemin | Auth ? | Handler | Description |
|---|---|---|---|---|
| GET | `/` | Non | `home_view` | Fil d'actualité (global/following/tag) |
| GET | `/tag/<tag>` | Non | `tag_view` | Fil filtré par tag |
| GET | `/article/<slug>` | Non | `article_detail_view` | Détail d'un article |
| GET | `/editor` | **Oui** | `article_create_view` | Formulaire création article |
| POST | `/editor` | **Oui** | `article_create_view` | Soumettre création article |
| GET | `/editor/<slug>` | **Oui** | `article_edit_view` | Formulaire édition article |
| POST | `/editor/<slug>` | **Oui** | `article_edit_view` | Soumettre édition article |
| POST | `/article/<slug>/delete` | **Oui** | `article_delete_view` | Supprimer un article |
| POST | `/article/<slug>/favorite` | **Oui** | `article_favorite_view` | Toggle favori |
| GET | `/login` | Non | `login_view` | Formulaire connexion |
| POST | `/login` | Non | `login_view` | Soumettre connexion |
| GET | `/register` | Non | `register_view` | Formulaire inscription |
| POST | `/register` | Non | `register_view` | Soumettre inscription |
| GET | `/settings` | **Oui** | `settings_view` | Formulaire paramètres |
| POST | `/settings` | **Oui** | `settings_view` | Soumettre paramètres |
| POST | `/logout` | Non ⚠️ | `logout_view` | Déconnexion |
| GET | `/profile/<username>` | Non | `profile_view` | Profil utilisateur (articles) |
| GET | `/profile/<username>/favorites` | Non | `profile_favorites_view` | Profil (favoris) |
| POST | `/profile/<username>/follow` | **Oui** | `follow_view` | Toggle follow/unfollow |
| POST | `/article/<slug>/comment` | **Oui** | `comment_create_view` | Créer un commentaire |
| POST | `/article/<slug>/comment/<id>/delete` | **Oui** | `comment_delete_view` | Supprimer un commentaire |
| GET/POST | `/admin/` | Staff | Django admin | Interface d'administration |

---

## Détail des routes

### Articles

---

#### `GET /`  
**Fil d'actualité**

| Paramètre | Type | Requis | Valeurs | Description |
|---|---|---|---|---|
| `feed` | query string | Non | `global`, `following` | Onglet actif. `following` requiert auth → redirect `/login` si anonyme |
| `page` | query string | Non | entier, défaut=1 | Numéro de page |
| `tag` | query string | Non | chaîne | Filtre par tag (équivalent à `/tag/<tag>`) |

**Réponses :**
- `HX-Request` absent → `articles/home.html` (page complète)
- `HX-Request: true` → `partials/feed_content.html` (fragment)

**Règles** : [BR-026](./business_rules_index.md#br-026), [BR-028](./business_rules_index.md#br-028), [BR-029](./business_rules_index.md#br-029)

---

#### `GET /tag/<tag>`  
**Fil filtré par tag**

| Paramètre | Type | Requis | Description |
|---|---|---|---|
| `tag` | path | Oui | Nom du tag |
| `page` | query | Non | Page, défaut=1 |

Même logique de rendu que `GET /`.

---

#### `GET /article/<slug>`  
**Détail d'un article**

| Paramètre | Type | Requis | Description |
|---|---|---|---|
| `slug` | path | Oui | Identifiant URL de l'article |

**Réponses :**
- Article trouvé → `articles/detail.html` (200)
- Article introuvable → `articles/detail_404.html` (404) avec `slug` dans le contexte

Affiche aussi tous les commentaires triés par date décroissante.

**Règles** : [BR-030](./business_rules_index.md#br-030)

---

#### `GET /editor`  
**Formulaire de création d'article**  
🔒 Requiert authentification → redirect `/login?next=/editor`

Affiche un formulaire vide.

---

#### `POST /editor`  
**Créer un article**  
🔒 Requiert authentification + CSRF

| Champ | Type | Requis | Contrainte | Description |
|---|---|---|---|---|
| `title` | string | **Oui** | max 150 chars, **unique** | Titre |
| `description` | string | Non | — | Court résumé (→ `article.summary`) |
| `body` | text | Non | — | Contenu Markdown (→ `article.content`) |
| `tags` | string | Non | Séparés par virgules | Noms de tags |

**Réponses :**
- Valide → redirect `/article/<slug-généré>` (302)
- Invalide → `articles/editor.html` avec erreurs (200)

**Règles** : [BR-022](./business_rules_index.md#br-022), [BR-023](./business_rules_index.md#br-023), [BR-031](./business_rules_index.md#br-031), [BR-032](./business_rules_index.md#br-032), [BR-033](./business_rules_index.md#br-033)

---

#### `GET /editor/<slug>`  
**Formulaire d'édition d'article**  
🔒 Requiert auth + être auteur (sinon 404)

Formulaire pré-rempli. **Nota bene** : le slug ne change pas lors de l'édition ([BR-023](./business_rules_index.md#br-023)).

---

#### `POST /editor/<slug>`  
**Modifier un article**  
🔒 Requiert auth + être auteur + CSRF

Mêmes champs que POST /editor.

**Réponses :**
- Valide → redirect `/article/<slug>` (302)
- Invalide → `articles/editor.html` (200)
- Non-propriétaire → 404

**Règles** : [BR-034](./business_rules_index.md#br-034)

---

#### `POST /article/<slug>/delete`  
**Supprimer un article**  
🔒 Requiert auth + être auteur + CSRF + @require_POST

**Réponses :**
- Succès → redirect `/` (302)
- Non-propriétaire → 404

⚠️ Suppression en cascade : tous les commentaires de l'article sont supprimés ([BR-043](./business_rules_index.md#br-043)).

**Règles** : [BR-035](./business_rules_index.md#br-035)

---

#### `POST /article/<slug>/favorite`  
**Toggle favori**  
🔒 Requiert auth + CSRF + @require_POST

Pas de corps requis hormis CSRF.

**Réponses :**
- `HX-Request: true` → `partials/favorite_button.html` (200), bouton mis à jour
- Sinon → redirect `/article/<slug>` (302)

**Règles** : [BR-025](./business_rules_index.md#br-025), [BR-036](./business_rules_index.md#br-036)

---

### Comptes & Authentification

---

#### `GET /login`  
Affiche le formulaire de connexion.

#### `POST /login`  
**Connexion**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `email` | email | **Oui** | Identifiant |
| `password` | string | **Oui** | Mot de passe |

**Réponses :**
- Succès → redirect `/` (302)
- Échec → `accounts/login.html` (200) avec erreur générique `"Invalid email or password."`

**Règles** : [BR-007](./business_rules_index.md#br-007), [BR-011](./business_rules_index.md#br-011), [BR-012](./business_rules_index.md#br-012)

---

#### `GET /register`  
Affiche le formulaire d'inscription.

#### `POST /register`  
**Inscription**

| Champ | Type | Requis | Contrainte | Description |
|---|---|---|---|---|
| `username` | string | **Oui** | max 60 chars, unique | Nom d'affichage |
| `email` | email | **Oui** | unique | Identifiant de connexion |
| `password` | string | **Oui** | — | Mot de passe (aucune contrainte de complexité) |

**Réponses :**
- Succès → auto-login + redirect `/` (302)
- Email déjà pris → erreur sur champ `email`
- Username déjà pris → erreur sur champ `username`
- Autre erreur → `accounts/register.html` (200)

**Règles** : [BR-013](./business_rules_index.md#br-013), [BR-014](./business_rules_index.md#br-014)

---

#### `GET /settings`  
🔒 Requiert auth. Affiche le formulaire pré-rempli.

#### `POST /settings`  
**Mettre à jour le profil**  
🔒 Requiert auth + CSRF

| Champ | Type | Requis | Description |
|---|---|---|---|
| `image` | URL | Non | URL de l'avatar |
| `username` | string | **Oui** | Nom d'affichage |
| `bio` | text | Non | Biographie |
| `email` | email | **Oui** | Adresse email |
| `password` | string | Non | Nouveau mot de passe (vide = inchangé) |

**Réponses :**
- Succès → redirect `/profile/<username>` (302)
- Si mot de passe modifié : re-login automatique pour maintenir la session
- Invalide → `accounts/settings.html` (200)

**Règles** : [BR-015](./business_rules_index.md#br-015)

---

#### `POST /logout`  
**Déconnexion**  
⚠️ Pas de `@login_required` (voir [attention_points.md](./attention_points.md))  
Requiert CSRF + @require_POST

**Réponse** : redirect `/` (302). Si pas connecté : no-op + redirect `/`.

**Règles** : [BR-016](./business_rules_index.md#br-016)

---

### Profil & Social

---

#### `GET /profile/<username>`  
**Profil utilisateur (onglet articles)**

| Paramètre | Type | Requis | Description |
|---|---|---|---|
| `username` | path | Oui | Nom d'utilisateur |
| `page` | query | Non | Page, défaut=1 |

**Réponses :**
- Utilisateur trouvé → `accounts/profile.html` (200)
- `HX-Request: true` → sélection hx-select sur `.profile-page`
- Introuvable → `accounts/profile_404.html` (404)

---

#### `GET /profile/<username>/favorites`  
**Profil (onglet favoris)**

Même logique que `/profile/<username>` mais affiche les articles favorisés.

**Règles** : [BR-018](./business_rules_index.md#br-018), [BR-017](./business_rules_index.md#br-017)

---

#### `POST /profile/<username>/follow`  
**Toggle follow/unfollow**  
🔒 Requiert auth + CSRF + @require_POST

Pas de corps requis hormis CSRF.

**Réponses :**
- `HX-Request: true` → `partials/follow_button.html` (200)
- Sinon → redirect `/profile/<username>` (302)
- Self-follow → no-op (is_following=False, pas d'erreur)

**Règles** : [BR-019](./business_rules_index.md#br-019)

---

### Commentaires

---

#### `POST /article/<slug>/comment`  
**Créer un commentaire**  
🔒 Requiert auth + CSRF + @require_POST

| Champ | Type | Requis | Description |
|---|---|---|---|
| `body` | text | Non* | Texte (trimmé). Si vide après trim : ignoré silencieusement |

**Réponses :**
- `HX-Request: true` → `partials/comment_list.html` (200) liste mise à jour
- Sinon → redirect `/article/<slug>` (302)

**Règles** : [BR-039](./business_rules_index.md#br-039), [BR-040](./business_rules_index.md#br-040), [BR-042](./business_rules_index.md#br-042)

---

#### `POST /article/<slug>/comment/<comment_id>/delete`  
**Supprimer un commentaire**  
🔒 Requiert auth + CSRF + @require_POST

Autorisé pour : l'auteur du commentaire OU l'auteur de l'article.

**Réponses :**
- Autorisé : `HX-Request: true` → `partials/comment_list.html` (200) ; sinon redirect (302)
- Non-autorisé → **HTTP 403 Forbidden**
- Commentaire non trouvé ou n'appartient pas à l'article → 404

**Règles** : [BR-041](./business_rules_index.md#br-041), [BR-044](./business_rules_index.md#br-044)

---

*[← Modèle de données](./data_model.md) | [Règles métier →](./business_rules_index.md)*
