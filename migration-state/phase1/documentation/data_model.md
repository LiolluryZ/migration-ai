# Modèle de Données

[← Retour à l'index](./index.md)

---

## Diagramme Entité-Relation

```mermaid
erDiagram
    accounts_user {
        bigint id PK
        varchar_128 password
        datetime last_login
        boolean is_superuser
        boolean is_staff
        boolean is_active
        datetime date_joined
        varchar_254 email UK
        varchar_60 username UK
        text bio
        varchar_200 image
    }

    accounts_user_followers {
        bigint id PK
        bigint from_user_id FK
        bigint to_user_id FK
    }

    articles_article {
        bigint id PK
        varchar_150 title UK
        text summary
        text content
        datetime created IDX
        datetime updated
        varchar_255 slug UK
        bigint author_id FK
    }

    articles_article_favorites {
        bigint id PK
        bigint article_id FK
        bigint user_id FK
    }

    comments_comment {
        bigint id PK
        text content
        datetime created IDX
        datetime updated
        bigint article_id FK
        bigint author_id FK
    }

    taggit_tag {
        int id PK
        varchar_100 name UK
        varchar_100 slug UK
    }

    taggit_taggeditem {
        int id PK
        int object_id IDX
        int content_type_id FK
        int tag_id FK
    }

    accounts_user ||--o{ accounts_user_followers : "from_user_id (suit)"
    accounts_user ||--o{ accounts_user_followers : "to_user_id (est suivi par)"
    accounts_user ||--o{ articles_article : "author_id"
    accounts_user ||--o{ articles_article_favorites : "user_id"
    accounts_user ||--o{ comments_comment : "author_id"
    articles_article ||--o{ articles_article_favorites : "article_id"
    articles_article ||--o{ comments_comment : "article_id"
    articles_article ||--o{ taggit_taggeditem : "object_id (GenericFK)"
    taggit_tag ||--o{ taggit_taggeditem : "tag_id"
```

---

## Tables applicatives

### `accounts_user` — Utilisateurs

> Hérite de `AbstractUser` Django. L'email est l'identifiant de connexion.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | bigint | PK, auto | Identifiant interne |
| `email` | varchar(254) | **UNIQUE**, NOT NULL | **Identifiant de connexion** ([BR-007](./business_rules_index.md#br-007)) |
| `username` | varchar(60) | **UNIQUE**, NOT NULL | Nom d'affichage ([BR-007](./business_rules_index.md#br-007)) |
| `password` | varchar(128) | NOT NULL | Hash bcrypt |
| `bio` | text | blank=True, default='' | Biographie libre ([BR-009](./business_rules_index.md#br-009)) |
| `image` | varchar(200) | NULL, URL | URL de l'avatar ([BR-009](./business_rules_index.md#br-009)) |
| `is_staff` | boolean | default=False | Accès admin Django |
| `is_active` | boolean | default=True | Compte actif |
| `date_joined` | datetime | auto | Date d'inscription |
| `last_login` | datetime | NULL | Dernière connexion |

> **Note migration** : `first_name` et `last_name` de AbstractUser sont explicitement supprimés ([BR-008](./business_rules_index.md#br-008)). Ne pas les créer dans Sequelize.

> **Historique** : le champ s'appelait `name` en migration 0001, renommé en `username` (0002), puis rendu `UNIQUE` (0003).

---

### `accounts_user_followers` — Relations de suivi

> Table implicite créée par Django pour la relation ManyToMany auto-référentielle `symmetrical=False`.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | bigint | PK | — |
| `from_user_id` | bigint | FK → `accounts_user.id` | L'utilisateur **qui suit** |
| `to_user_id` | bigint | FK → `accounts_user.id` | L'utilisateur **suivi** |

> Contrainte UNIQUE sur `(from_user_id, to_user_id)` — on ne peut pas suivre deux fois le même utilisateur.  
> Relation asymétrique : A suit B ≠ B suit A ([BR-010](./business_rules_index.md#br-010)).

---

### `articles_article` — Articles

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | bigint | PK, auto | — |
| `title` | varchar(150) | **UNIQUE**, NOT NULL | Titre de l'article ([BR-022](./business_rules_index.md#br-022)) |
| `summary` | text | blank=True, default='' | Court résumé ([BR-022](./business_rules_index.md#br-022)) |
| `content` | text | blank=True, default='' | Corps en Markdown ([BR-022](./business_rules_index.md#br-022)) |
| `slug` | varchar(255) | **UNIQUE**, NOT NULL | Généré depuis le titre à la création ([BR-023](./business_rules_index.md#br-023)) |
| `created` | datetime | auto_now_add, **INDEX** | Date de publication |
| `updated` | datetime | auto_now | Dernière modification |
| `author_id` | bigint | FK → `accounts_user.id` ON DELETE CASCADE | Auteur |

> **Mapping formulaire → modèle** : `form.description` → `article.summary`, `form.body` → `article.content` ([BR-031](./business_rules_index.md#br-031)).  
> **Slug** : généré une seule fois à la création via `slugify(title)`. **Non régénéré lors des mises à jour** ([BR-023](./business_rules_index.md#br-023)).  
> **Historique** : `updated` était `auto_now_add` (bug), corrigé en `auto_now` via migration 0002.

---

### `articles_article_favorites` — Favoris

> Table implicite pour `Article.favorites` (ManyToMany vers User).

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | bigint | PK | — |
| `article_id` | bigint | FK → `articles_article.id` | Article favorisé |
| `user_id` | bigint | FK → `accounts_user.id` | Utilisateur qui a favorisé |

> Contrainte UNIQUE sur `(article_id, user_id)` — un utilisateur ne peut favoriser un article qu'une fois.

---

### `comments_comment` — Commentaires

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | bigint | PK, auto | — |
| `content` | text | NOT NULL | Texte du commentaire ([BR-039](./business_rules_index.md#br-039)) |
| `created` | datetime | auto_now_add, **INDEX** | Date de création |
| `updated` | datetime | auto_now | Dernière modification |
| `article_id` | bigint | FK → `articles_article.id` ON DELETE CASCADE | Article parent |
| `author_id` | bigint | FK → `accounts_user.id` ON DELETE CASCADE | Auteur |

> **Cascade** : supprimer un article supprime tous ses commentaires. Supprimer un utilisateur supprime tous ses commentaires ([BR-043](./business_rules_index.md#br-043)).

---

### `taggit_tag` et `taggit_taggeditem` — Tags (bibliothèque tierce)

Ces tables appartiennent à `django-taggit`. Dans la cible, les tags seront implémentés nativement sans cette dépendance.

| Table | Rôle |
|---|---|
| `taggit_tag` | Catalogue des tags (`id`, `name` unique, `slug` unique) |
| `taggit_taggeditem` | Jointure GenericFK : `tag_id` + `content_type_id` + `object_id` (pointe sur l'article) |

> **Pour la migration** : remplacer par une table `article_tags` directe (suppression de la GenericForeignKey).

---

## Requêtes importantes

| Module | Type | Tables touchées | Description |
|---|---|---|---|
| `_build_feed` | Complexe | `articles_article`, `accounts_user`, `favorites`, `taggit_*` | Fil d'actualité avec annotations favorites + tri + pagination |
| `article_detail_view` | Complexe | `articles_article`, `accounts_user`, `favorites`, `taggit_*` | Détail article avec favoris et tags |
| `article_detail_view` | Modérée | `comments_comment`, `accounts_user` | Commentaires avec auteurs |
| `follow_view` | Simple | `accounts_user_followers` | Toggle follow/unfollow |
| `_build_feed` | Simple | `taggit_tag` | Tags sidebar (avec cache 5 min) |

---

## Historique des migrations

| # | Fichier | Date | Impact |
|---|---|---|---|
| 1 | `accounts/0001_initial` | 2023-06-26 | Création `accounts_user`. Champ `name` (renommé plus tard) |
| 2 | `accounts/0002_rename_name_user_username` | 2023-06-28 | Renommage `name` → `username` |
| 3 | `articles/0001_initial` | 2024-01-06 | Création `articles_article` (bug `updated` = `auto_now_add`) |
| 4 | `comments/0001_initial` | 2024-01-06 | Création `comments_comment` |
| 5 | `accounts/0003_alter_user_username` | 2024-06-10 | Contrainte UNIQUE sur `username` |
| 6 | `articles/0002_alter_article_updated` | 2026-02-04 | **Correction bug** : `updated` → `auto_now` |
| 7 | `articles/0003_alter_article_created` | 2026-03-20 | Index sur `articles_article.created` |
| 8 | `comments/0002_alter_comment_created` | 2026-03-20 | Index sur `comments_comment.created` |

---

*[← Architecture](./architecture.md) | [Référence API →](./api_reference.md)*
