# Points d'attention & Risques

[← Retour à l'index](./index.md)

> Ce document liste tous les risques, anomalies, inconsistances et points critiques identifiés lors de l'analyse. Classés par sévérité.

---

## Résumé

| Sévérité | Nb | Statut |
|---|---|---|
| 🔴 CRITICAL (BLOCKER) | 2 | À traiter avant migration |
| 🟠 HIGH | 2 | À traiter en priorité |
| 🟡 MEDIUM | 2 | À traiter pendant la migration |
| 🔵 INFO / LOW | 4 | À noter pour la migration |
| ✅ RÉSOLU | 1 | Décision prise le 2026-04-13 |

---

## 🔴 CRITICAL — Blockers

### C-001 — Logique duale de suppression de commentaire

**Règle** : [BR-041](./business_rules_index.md#br-041)  
**Source** : `apps/comments/views.py` ligne 28-32

L'autorisation de suppression d'un commentaire comprend **deux rôles autorisés** :
1. L'auteur du commentaire
2. L'auteur de l'article (modération)

Tout autre utilisateur doit recevoir un **HTTP 403 Forbidden** (pas 404).

```python
if comment.author != request.user and article.author != request.user:
    return HttpResponseForbidden()
```

> **Risque migration** : Implémenter seulement le premier cas serait une régression métier. Ce guard doit être spécifiquement codé dans Fastify.

**Action requise** : Créer un guard Fastify `canDeleteComment(userId, commentAuthorId, articleAuthorId)` et le tester explicitement avec les 3 rôles (auteur commentaire, auteur article, tiers).

---

### C-002 — Non-propriétaire = 404 (pas 403) sur edit/delete article

**Règles** : [BR-034](./business_rules_index.md#br-034), [BR-035](./business_rules_index.md#br-035)  
**Source** : `apps/articles/views.py` lignes 120, 133

Quand un utilisateur authentifié tente de modifier ou supprimer l'article d'un autre :
```python
get_object_or_404(Article, slug=slug, author=request.user)
# → retourne 404 si non-propriétaire (intentionnel)
```

Ce comportement est **délibéré** ("sécurité par obscurité") : on ne révèle pas l'existence de l'article.

> **Risque migration** : Si la cible retourne 403 au lieu de 404, ce sera détecté par les tests de conformité comportementale.

**Action requise** : Configurer le guard ownership de Fastify pour retourner 404 (et non 403) quand `article.authorId !== user.id` sur les endpoints edit et delete.

---

## 🟠 HIGH

### H-001 — Endpoint logout non protégé par @login_required {#anomalie-1}

**Règle** : [BR-016](./business_rules_index.md#br-016)  
**Source** : `apps/accounts/views.py` ligne 72  
**Type** : Anomalie sécurité (WARNING)

```python
@require_POST  # présent
# @login_required  ← ABSENT
def logout_view(request):
    logout(request)
    return redirect('home')
```

Un utilisateur **non authentifié** peut envoyer un `POST /logout` valide. Django `logout()` est un no-op sur une session anonyme, et le CSRF est requis. Le risque pratique est minimal.

> **Pour la migration** : Ajouter un guard d'authentification sur le logout Fastify est **recommandé** (MN-07 dans la matrice RBAC). Ce n'est pas obligatoire pour la conformité iso-fonctionnelle, mais améliore la sécurité.

---

### H-002 — Inconsistance ARTICLES_PER_PAGE

**Règles** : [BR-017](./business_rules_index.md#br-017), [BR-028](./business_rules_index.md#br-028)  
**Sévérité** : Medium (problème de maintenabilité, pas de bug actuel)

```python
# apps/accounts/views.py ligne 12
ARTICLES_PER_PAGE = 10

# apps/articles/views.py ligne 14
ARTICLES_PER_PAGE = 10
```

La constante est dupliquée. Si l'une est modifiée sans l'autre, la pagination sera incohérente entre le profil (accounts) et le feed (articles).

> **Pour la migration** : Définir une seule constante partagée dans la cible.

---

## 🟡 MEDIUM

### M-001 — Vérification d'auth "following" en handler, pas en middleware

**Source** : `apps/articles/views.py` ligne 27  
**Type** : Anomalie INFO

La protection de l'onglet "following" (`?feed=following`) est vérifiée **à l'intérieur du handler** et non par un middleware/décorateur :

```python
if feed == 'following' and not request.user.is_authenticated:
    return redirect('login')
```

Si la route est copiée/réutilisée sans ce bloc, la protection serait perdue.

> **Pour la migration** : Dans Fastify, utiliser un guard conditionnel sur le paramètre `feed`. Voir [MN-06](./business_rules_index.md).

---

### M-002 — Bug cache tags lors de la suppression d'article

**Règle** : [BR-027](./business_rules_index.md#br-027)  
**Source** : `apps/articles/views.py`

Le cache `all_tags` est invalidé lors de la création/modification d'un article (`cache.delete('all_tags')`) mais **pas lors de la suppression**. Des tags orphelins (sans nombre d'articles ≥ 1) peuvent rester visibles dans la sidebar jusqu'à l'expiration du cache (5 minutes).

> **Pour la migration** : Invalider le cache également lors de la suppression d'article. C'est une amélioration acceptable en iso-fonctionnel.

---

## 🔵 INFO / LOW

### I-001 — Rôle staff sans privilège applicatif

**Source** : RBAC Matrix  
**Type** : Anomalie INFO

Le rôle `staff` (`is_staff=True`) n'a **aucun privilège spécial** dans le code applicatif. Il n'existe que pour l'accès à l'interface `/admin/` de Django.

> Un utilisateur staff ne peut pas supprimer les commentaires d'autres utilisateurs via l'application (seulement via `/admin/`). **Ne pas créer de rôle "admin" avec permissions supplémentaires** dans la cible.

---

### I-002 — Pas de redirect si déjà connecté sur login/register

**Source** : `apps/accounts/views.py`

Un utilisateur **déjà authentifié** peut accéder à `/login` et `/register` sans être redirigé. Il peut même se re-connecter.

> Ce comportement peut être corrigé dans la cible (redirect vers `/` si déjà connecté) sans violer la conformité iso-fonctionnelle.

---

### I-003 — Code mort dans helpers

**Source** : `helpers/exceptions.py`

Trois éléments définis mais **jamais utilisés** dans le code applicatif :
- `get_or_404()` : les vues utilisent directement `get_object_or_404` de Django
- `ResourceNotFound` : classe d'exception inutilisée
- Import associé

> **Pour la migration** : **Ne pas migrer** ces éléments. Code mort confirmé.

---

### I-004 — Auto-favorisation autorisée

**Règle** : [BR-036](./business_rules_index.md#br-036)

Un utilisateur peut favoriser **son propre article**. Il n'y a aucune restriction.

> Comportement intentionnel à reproduire dans la cible.

---

## ✅ RÉSOLU — Question Q-001 : Validateurs de mot de passe

**Règle** : [BR-004](./business_rules_index.md#br-004)  
**Décision** : 2026-04-13

Les validateurs de mot de passe Django sont configurés dans `settings.py` mais **non appliqués** lors de l'inscription ni du changement de mot de passe. Les mots de passe faibles sont acceptés.

**Décision** : comportement intentionnel — **ne pas appliquer de validation de complexité de mot de passe dans la cible**.

---

## Tableau de synthèse pour la migration

| ID | Sévérité | Description | Action | Priorité |
|---|---|---|---|---|
| C-001 | 🔴 CRITICAL | Double autorisation suppression commentaire (auteur commentaire OU auteur article) → 403 | Guard Fastify spécifique | **Avant Phase 4** |
| C-002 | 🔴 CRITICAL | Non-propriétaire edit/delete article → 404 pas 403 | Configurer guard ownership Fastify | **Avant Phase 4** |
| H-001 | 🟠 HIGH | Logout sans @login_required | Ajouter guard auth sur logout Fastify (recommandé) | Phase 4 |
| H-002 | 🟠 HIGH | ARTICLES_PER_PAGE dupliqué | Une seule constante partagée | Phase 4 |
| M-001 | 🟡 MEDIUM | Auth following en handler pas en middleware | Guard conditionnel sur feed param | Phase 4 |
| M-002 | 🟡 MEDIUM | Cache tags non invalidé à la suppression d'article | Invalider cache sur delete article aussi | Phase 4 |
| I-001 | 🔵 INFO | Staff sans privilège applicatif | Ne pas créer de rôle admin applicatif | Phase 3 |
| I-002 | 🔵 INFO | Pas de redirect si déjà connecté | Amélioration optionnelle | Phase 4 |
| I-003 | 🔵 INFO | Code mort dans helpers | Ne pas migrer | Phase 4 |
| I-004 | 🔵 INFO | Auto-favorisation autorisée | Reproduire dans la cible | Phase 4 |

---

*[← Business Rules Index](./business_rules_index.md) | [← Index](./index.md)*
