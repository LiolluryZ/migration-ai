# Index des Règles Métier

[← Retour à l'index](./index.md)

> **54 règles métier** extraites par l'agent 05. Confiance globale : 94 %.  
> Les règles avec confiance < 80 % sont marquées ⚠️.

---

## Navigation par domaine

| Domaine | Règles | Nb |
|---|---|---|
| [Rendu HTMX](#domaine-rendu-htmx) | BR-001, BR-029, BR-042 | 3 |
| [Gestion des erreurs](#domaine-gestion-des-erreurs) | BR-002 | 1 |
| [Sécurité](#domaine-sécurité) | BR-003, BR-037, BR-054 | 3 |
| [Configuration](#domaine-configuration) | BR-004, BR-005, BR-006 | 3 |
| [Authentification](#domaine-authentification) | BR-007 à BR-016, BR-020 | 11 |
| [Gestion utilisateur](#domaine-gestion-utilisateur) | BR-008, BR-009, BR-017, BR-018, BR-021 | 5 |
| [Social (Follow)](#domaine-social-follow) | BR-010, BR-019 | 2 |
| [Articles](#domaine-articles) | BR-022 à BR-036, BR-038 | 16 |
| [Tags](#domaine-tags) | BR-027, BR-032, BR-038 | 3 |
| [Favoris](#domaine-favoris) | BR-025, BR-036, BR-051 | 3 |
| [Commentaires](#domaine-commentaires) | BR-039 à BR-044 | 6 |
| [Interface utilisateur](#domaine-interface-utilisateur) | BR-045 à BR-053 | 9 |
| [Pagination](#domaine-pagination) | BR-017, BR-028 | 2 |

---

## Domaine : Rendu HTMX

### BR-001
**Module** : helpers | **Type** : transformation | **Confiance** : ⚠️ 70 %

Le header HTTP `HX-Request: true` détermine si la réponse doit être un fragment HTML (HTMX) ou une page complète.

```
is_htmx(request) := request.headers['HX-Request'] == 'true'
```

- Si absent ou différent de `'true'` → page complète

> ⚠️ **Confiance 70 %** : le mécanisme est simple et clair, mais la confiance est basse car c'est le fondement de tout le rendu. À tester exhaustivement dans la migration.

---

### BR-029
**Module** : articles | **Type** : transformation | **Confiance** : 90 %

Requêtes HTMX sur la page d'accueil → `partials/feed_content.html` seulement. Requête normale → `articles/home.html`.

---

### BR-042
**Module** : comments | **Type** : transformation | **Confiance** : 95 %

Après création ou suppression de commentaire, HTMX reçoit `partials/comment_list.html` (liste complète mise à jour). Sinon redirect vers le détail.

---

## Domaine : Gestion des erreurs

### BR-002
**Module** : helpers | **Type** : transformation | **Confiance** : 75 %

Les violations de contrainte d'unicité (email/username déjà pris) sont parsées pour identifier le champ en erreur. Supporte SQLite et PostgreSQL.

```python
clean_integrity_error(error) -> field_name | None
```

- PostgreSQL : extrait via `UniqueViolation`
- SQLite : extrait via parsing du message d'erreur
- Format non reconnu → retourne `None` silencieusement

> Pour la migration : remplacer par une gestion d'erreur native Sequelize/Fastify.

---

## Domaine : Sécurité

### BR-003
**Module** : helpers | **Type** : transformation | **Confiance** : 80 %

Le contexte expose les données utilisateur en JSON pour `window.__conduit_debug__` (débogage frontend).

```
IF authenticated THEN expose {username, email, bio, image} ELSE expose null
```

- `bio` et `image` vides (`""`) sont convertis en `null` via `or None`

---

### BR-037
**Module** : articles | **Type** : transformation | **Confiance** : 98 %

Le contenu Markdown est rendu en HTML puis sanitisé par `nh3.clean()` pour prévenir les XSS.

```python
render_markdown(value) = mark_safe(nh3.clean(markdown(value, extensions=['extra'])))
```

> **Pour la migration** : utiliser une bibliothèque de sanitisation équivalente côté cible (ex: `DOMPurify` côté Angular).

---

### BR-054
**Module** : templates | **Type** : contrainte | **Confiance** : 90 %

Le token CSRF est injecté globalement sur le `<body>` pour toutes les requêtes HTMX :

```html
<body hx-headers='{"X-CSRFToken": "{{ csrf_token }}"}'>
```

> **Pour la migration** : Angular gère le CSRF via `HttpClientXsrfModule`. Fastify devra valider un header `X-XSRF-Token` ou similaire.

---

## Domaine : Configuration

### BR-004
**Module** : config | **Type** : validation | **Confiance** : 100 % | **Statut** : ✅ EXCLU — Décision validée le 2026-04-13

Les validateurs de mot de passe Django (`AUTH_PASSWORD_VALIDATORS`) sont **configurés mais non appliqués**. Il n'y a aucune restriction de complexité sur les mots de passe.

> **Décision humaine** : comportement intentionnel — ne pas appliquer de validation de complexité dans la cible.

---

### BR-005
**Module** : config | **Type** : contrainte | **Confiance** : 95 %

Les utilisateurs non authentifiés accédant à une route protégée sont redirigés vers `/login`.

```
IF NOT authenticated AND route.requires_auth THEN redirect('/login')
```

---

### BR-006
**Module** : config | **Type** : contrainte | **Confiance** : 90 %

Langue : anglais américain (`en-us`). Fuseau horaire : UTC. Toutes les dates sont stockées en UTC.

---

## Domaine : Authentification

### BR-007
**Module** : accounts | **Type** : contrainte | **Confiance** : 98 %

L'email est le champ d'identification (`USERNAME_FIELD = 'email'`). L'email est obligatoire et unique. Le username est également unique, max 60 caractères.

---

### BR-008
**Module** : accounts | **Type** : contrainte | **Confiance** : 95 %

Les champs `first_name` et `last_name` d'AbstractUser sont supprimés. Seuls `username`, `email`, `bio` et `image` sont utilisés.

---

### BR-009
**Module** : accounts | **Type** : validation | **Confiance** : 95 %

- `bio` : texte libre, optionnel, défaut `""`
- `image` : URL externe (pas upload de fichier), optionnel, null autorisé

---

### BR-011
**Module** : accounts | **Type** : workflow | **Confiance** : 98 %

Authentification par email + password. **Message d'erreur générique** en cas d'échec : `"Invalid email or password."` (pas de distinction entre email inconnu et mot de passe incorrect).

---

### BR-012
**Module** : accounts | **Type** : workflow | **Confiance** : 95 %

Après login réussi → redirect vers la page d'accueil (`/`).

---

### BR-013
**Module** : accounts | **Type** : validation | **Confiance** : 98 %

L'inscription requiert `username`, `email` et `password`. Messages d'erreur spécifiques :
- Email déjà pris : `"This email has already been taken."`
- Username déjà pris : `"This username has already been taken."`
- Autre erreur : `"Registration failed."`

---

### BR-014
**Module** : accounts | **Type** : workflow | **Confiance** : 98 %

Après inscription réussie → **login automatique** + redirect vers `/`.

---

### BR-015
**Module** : accounts | **Type** : validation | **Confiance** : 95 %

La page Settings permet de modifier `image`, `username`, `bio`, `email`. Le `password` est **optionnel** : si fourni, il est mis à jour et l'utilisateur est **re-connecté** (pour maintenir la session active). Après sauvegarde → redirect vers `/profile/<username>`.

---

### BR-016
**Module** : accounts | **Type** : authorization | **Confiance** : 95 %

La déconnexion nécessite une **requête POST** (pas GET → HTTP 405). Après logout → redirect vers `/`.

---

### BR-020
**Module** : accounts | **Type** : authorization | **Confiance** : 98 %

`/settings` et `/profile/<username>/follow` requièrent l'authentification (`@login_required`). Non-authentifiés → redirect `/login`.

---

## Domaine : Gestion utilisateur

### BR-017
**Module** : accounts | **Type** : calculation | **Confiance** : 95 %

Pagination du profil : 10 articles par page. `page` depuis GET, défaut=1. Valeurs non valides → fallback page=1.

```
offset = (page - 1) * 10; LIMIT 10
```

---

### BR-018
**Module** : accounts | **Type** : transformation | **Confiance** : 95 %

Profil à deux onglets : `my` (articles écrits) et `favorites` (articles favorisés). Triés par date décroissante.

---

### BR-021
**Module** : accounts | **Type** : validation | **Confiance** : 90 %

Profil inexistant → page `accounts/profile_404.html` avec le username en contexte (status 404).

---

## Domaine : Social (Follow)

### BR-010
**Module** : accounts | **Type** : contrainte | **Confiance** : 98 %

La relation de suivi est **asymétrique** : A peut suivre B sans que B suive A. ManyToMany auto-référentiel avec `symmetrical=False`.

```
is_following(A, B) := A in B.followers
```

- Utilisateur non authentifié → `is_following` retourne toujours `False`

---

### BR-019
**Module** : accounts | **Type** : authorization | **Confiance** : 98 %

Follow/unfollow est un **toggle**. Un utilisateur **ne peut pas se suivre lui-même** (no-op silencieux, `is_following=False`).

```
IF profile_user == current_user THEN no-op (is_following=False)
ELIF already_following THEN unfollow
ELSE follow
```

---

## Domaine : Articles

### BR-022
**Module** : articles | **Type** : validation | **Confiance** : 98 %

- `title` : obligatoire, unique, max 150 chars
- `summary` : optionnel, défaut `""`
- `content` : optionnel, défaut `""`

---

### BR-023
**Module** : articles | **Type** : transformation | **Confiance** : 98 %

Le slug est généré **une seule fois à la création** via `slugify(title)`. **Jamais régénéré lors des modifications**.

```
IF NOT article.pk THEN article.slug = slugify(article.title)
```

---

### BR-024
**Module** : articles | **Type** : contrainte | **Confiance** : 95 %

- `created` : auto-rempli à la création, indexé
- `updated` : auto-mis à jour à chaque sauvegarde

---

### BR-026
**Module** : articles | **Type** : transformation | **Confiance** : 98 %

Trois onglets de fil :
- `global` : tous les articles (défaut)
- `following` : articles des auteurs suivis (requiert auth → redirect `/login` si anonyme)
- `tag` : articles du tag sélectionné

---

### BR-028
**Module** : articles | **Type** : calculation | **Confiance** : 95 %

Pagination du feed : 10 articles par page, triés par date décroissante.

> ⚠️ **Inconsistance** : `ARTICLES_PER_PAGE = 10` défini indépendamment dans `accounts/views.py` et `articles/views.py`. Voir [attention_points.md](./attention_points.md).

---

### BR-030
**Module** : articles | **Type** : validation | **Confiance** : 95 %

Article inexistant → `articles/detail_404.html` (404) avec slug en contexte. Commentaires affichés triés par date décroissante.

---

### BR-031
**Module** : articles | **Type** : transformation | **Confiance** : 95 %

**Mapping formulaire → modèle** (spécificité du spec RealWorld) :
- `form.description` → `article.summary`
- `form.body` → `article.content`
- `form.tags` → chaîne séparée par virgules → `article.tags`

---

### BR-033
**Module** : articles | **Type** : authorization | **Confiance** : 98 %

Création d'article : requiert auth. L'auteur est automatiquement l'utilisateur courant (`article.author = request.user`).

---

### BR-034
**Module** : articles | **Type** : authorization | **Confiance** : 98 %

Édition d'article : requiert auth + **être l'auteur**. Non-propriétaire → **404** (pas 403, intentionnel).

```
get_object_or_404(Article, slug=slug, author=request.user)
```

---

### BR-035
**Module** : articles | **Type** : authorization | **Confiance** : 98 %

Suppression d'article : requiert auth + être auteur + @require_POST. Non-propriétaire → 404. En cas de succès → redirect `/`.

---

### BR-036
**Module** : articles | **Type** : authorization | **Confiance** : 98 %

Favori = toggle (add/remove). Requiert auth. Le compteur est recalculé après l'opération. L'auteur peut favoriser son propre article.

---

### BR-038
**Module** : articles | **Type** : validation | **Confiance** : 90 %

Un article peut avoir des tags via `django-taggit` (GenericForeignKey). Tags optionnels.

---

## Domaine : Tags

### BR-027
**Module** : articles | **Type** : contrainte | **Confiance** : 90 %

La liste de tous les tags est **cachée 5 minutes** (`cache.get_or_set('all_tags', timeout=300)`). Cache invalidé à chaque création/modification d'article.

> ⚠️ **Bug potentiel** : le cache n'est **pas invalidé** lors de la suppression d'un article → tags orphelins visibles jusqu'à expiration.

---

### BR-032
**Module** : articles | **Type** : transformation | **Confiance** : 95 %

Gestion des tags à la sauvegarde :
1. `article.tags.clear()` (supprime tous les tags existants)
2. Pour chaque nom dans la chaîne séparée par virgules : `article.tags.add(tag_name.strip())`
3. Tags vides ou espaces seuls → ignorés

---

## Domaine : Favoris

### BR-025
**Module** : articles | **Type** : calculation | **Confiance** : 98 %

Chaque article expose :
- `num_favorites` : `COUNT(article.favorites)` (toujours calculé)
- `is_favorite` : si auth → `EXISTS(user IN article.favorites)` ; sinon `False`

---

## Domaine : Commentaires

### BR-039
**Module** : comments | **Type** : validation | **Confiance** : 95 %

Le corps du commentaire est **trimmé** (strip). Si vide après trim → aucun commentaire créé (silencieux, pas d'erreur).

---

### BR-040
**Module** : comments | **Type** : authorization | **Confiance** : 98 %

Créer un commentaire : requiert auth + @require_POST. L'auteur = utilisateur courant. L'article est identifié par slug.

---

### BR-041
**Module** : comments | **Type** : authorization | **Confiance** : 98 %

Supprimer un commentaire : autorisé pour **l'auteur du commentaire OU l'auteur de l'article** (modération). Toute autre tentative → **HTTP 403 Forbidden** (le seul 403 de l'application).

```
IF comment.author == request.user OR article.author == request.user THEN delete ELSE 403
```

---

### BR-043
**Module** : comments | **Type** : contrainte | **Confiance** : 98 %

Les commentaires sont liés à l'article et à l'auteur par FK avec **ON DELETE CASCADE**. La suppression d'un article supprime tous ses commentaires. La suppression d'un utilisateur aussi.

---

### BR-044
**Module** : comments | **Type** : authorization | **Confiance** : 95 %

Suppression requiert auth + @require_POST. Le commentaire doit appartenir à l'article du slug → sinon 404.

---

## Domaine : Interface utilisateur

### BR-045
**Module** : templates | **Type** : transformation | **Confiance** : 90 %

Le bandeau d'accueil (logo + slogan `"A place to share your knowledge."`) est affiché **uniquement aux utilisateurs non authentifiés**.

---

### BR-046
**Module** : templates | **Type** : authorization | **Confiance** : 95 %

Navigation selon l'état d'auth :
- **Authentifié** : Home, New Article, Settings, Profile (username + avatar)
- **Non authentifié** : Home, Sign in, Sign up

---

### BR-047
**Module** : templates | **Type** : transformation | **Confiance** : 95 %

Avatar par défaut : `static/images/default-avatar.svg`. Utilisé partout en l'absence d'URL dans `user.image`.

---

### BR-048
**Module** : templates | **Type** : contrainte | **Confiance** : 90 %

Format de date : `"F j, Y"` → ex: `"January 1, 2026"`. Utilisé dans les listes d'articles et les commentaires.

---

### BR-049
**Module** : templates | **Type** : authorization | **Confiance** : 98 %

Actions contextuelles sur un article :
- **Auteur** → [Edit Article] [Delete Article]
- **Authentifié non-auteur** → [Follow <auteur>] [Favorite]
- **Non authentifié** → rien

---

### BR-050
**Module** : templates | **Type** : contrainte | **Confiance** : 95 %

L'onglet "Your Feed" (following) est visible uniquement pour les authentifiés. L'onglet tag apparaît dynamiquement lors du filtrage par tag.

---

### BR-051
**Module** : templates | **Type** : contrainte | **Confiance** : 95 %

Bouton Favorite pour non-authentifiés → redirect vers `/login` (onclick). Texte : `"Favorite"` / `"Unfavorite"` selon l'état.

---

### BR-052
**Module** : templates | **Type** : contrainte | **Confiance** : 95 %

Bouton Follow caché si l'utilisateur consulte son propre profil. Texte : `"Follow <username>"` / `"Unfollow <username>"`.

---

### BR-053
**Module** : templates | **Type** : authorization | **Confiance** : 95 %

Non authentifiés → message `"Sign in or sign up to add comments on this article."` avec lien vers `/register` (à la place du formulaire de commentaire).

---

## Domaine : Pagination

### BR-017 & BR-028 — Inconsistance détectée
**Confiance** : 95 %

`ARTICLES_PER_PAGE = 10` défini deux fois indépendamment dans `accounts/views.py` et `articles/views.py`. Voir [attention_points.md](./attention_points.md).

---

*[← Référence API](./api_reference.md) | [Points d'attention →](./attention_points.md)*
