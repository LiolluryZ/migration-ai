# Migrer sans Régresser — Une Méthode Agentique pour les Applications Legacy

> *Ce document présente une méthode de migration incrémentale s'appuyant sur 24 agents IA spécialisés.  
> Les exemples et métriques sont issus d'une migration réelle : Django 5.2 / HTMX → TypeScript / Fastify + Angular 21.  
> Verdict de certification : **CERTIFIED (97%)** — 0 breaking change API, 90/90 tests, 0 régression visuelle.*

---

## Qu'est-ce que c'est ?

Un framework composé de **24 agents IA spécialisés**, orchestrés par un agent principal, qui automatise chaque phase d'une migration legacy fullstack. Chaque agent a une responsabilité précise, lit ses entrées dans un état partagé (`migration-state/`) et y écrit ses sorties. L'orchestrateur maintient la cohérence globale et détermine la séquence d'exécution.

La stratégie sous-jacente est le **Strangler Fig** : le système cible est déployé en parallèle du legacy, les routes sont basculées progressivement, le legacy est éteint après certification.

---

## Architecture en 6 phases, 24 agents

```
Phase 0 — Audit & Inventaire        (agents 01 → 04)   comprendre l'existant
Phase 1 — Extraction des règles      (agents 05 → 08)   formaliser le comportement métier
Phase 2 — Harnais de tests           (agents 09 → 15)   capturer la vérité de référence
Phase 3 — Architecture cible         (agents 16 → 17)   planifier les correspondances
Phase 4 — Migration incrémentale     (agents 18 → 21)   traduire module par module
Phase 5 — Validation finale          (agents 22 → 24)   certifier
```

Chaque phase est un prérequis absolu de la suivante. L'orchestrateur contrôle les transitions.

---

## Phase 0 — Comprendre l'existant

Les 4 premiers agents cartographient le code source sans en modifier une ligne.

### Agent 01 — Cartographe

Produit un graphe de dépendances complet. Sur la migration Conduit :

```
helpers  →  articles  →  accounts  →  comments  →  templates
  └──────────────────────────────────────────────────────┘
                     chemin critique
```

Résultat : `structure.json`, `dependency_graph.dot`, `er_diagram.mermaid`.

### Agent 02 — Analyseur de routes

Extrait tous les endpoints du legacy. Sur Conduit : **18 routes Django** (GET HTML + POST form) cataloguées avec leur handler, méthode HTTP, authentification requise, et payload attendu.

### Agent 03 — Inventaire DB

Documente le schéma complet : tables, colonnes, types, contraintes, relations. Sur Conduit : `accounts_user`, `articles_article`, `articles_tag`, `articles_article_tags`, `articles_favorite`, `accounts_user_followers`, `comments_comment` — avec les clés étrangères et les comportements CASCADE.

### Agent 04 — Métriques

Calcule la complexité cyclomatique (style McCabe) et les métriques de couplage. Sur Conduit :

| Module | LOC | Complexité moy. | Instabilité | Effort estimé |
|--------|-----|-----------------|-------------|---------------|
| helpers | 100 | 1.56 | 0.0 | low |
| config | 215 | 2.60 | 1.0 | medium |
| accounts | 294 | 2.47 | 0.5 | high |
| articles | 332 | 2.50 | 0.25 | high |
| comments | 64 | 2.67 | 0.67 | low |
| templates | 600 | 2.94 | 1.0 | very_high |
| **Total** | **1 651** | **2.48** | — | — |

La pire fonction : `register_view` (complexité 6) — `if POST + if form.is_valid + except IntegrityError + if email + elif username`.

---

## Phase 1 — Extraire le comportement métier

C'est la phase la plus critique. Avant d'écrire une ligne de code cible, le comportement de l'application doit être formalisé de façon exploitable.

### Agent 05 — Extracteur de règles

Parcourt le code source et en extrait chaque règle métier avec sa localisation exacte. Sur Conduit : **54 règles** extraites, dont 12 de validation, 12 d'autorisation, 14 de transformation, 3 de workflow.

Exemples de règles critiques détectées :

```
BR-023 CRITICAL : Le slug d'un article est généré à la création et ne peut jamais être modifié.
  Source : apps/articles/views.py:52 — slugify(title) appelé uniquement dans article_create_view
  Confiance : 99%

BR-041 CRITICAL : Un commentaire peut être supprimé par son auteur OU par l'auteur de l'article.
  Source : apps/comments/views.py:35 — comment.author == user or article.author == user
  Confiance : 99%

BR-026 : following = true si l'utilisateur courant suit l'auteur de l'article.
  Source : apps/accounts/models.py — User.following.filter(id=author.id).exists()
  Confiance : 87%
```

La règle BR-041 est un exemple parfait de ce que l'on rate dans une migration manuelle : une condition booléenne discrète dans une vue Python, qui doit devenir un double check explicite dans le middleware Fastify.

### Agent 06 — Extracteur de workflows

Modélise les machines à états. Sur Conduit : **11 workflows**, 39 états, 36 transitions. Exemple :

```
WF-010 : Créer un commentaire
  INIT → [POST /article/:slug/comment, auth required] → 
    [body vide ?] → SKIP (no-op, Django) | ERROR 422 (cible REST)
    [article inexistant ?] → 404
    → CREATED (201) → reload partiel HTMX | update réactif Angular
```

### Agent 07 — Extracteur RBAC

Produit la matrice de permissions complète. Chaque combinaison (endpoint × rôle × méthode) est vérifiée : anonymous / authenticated / owner.

### Agent 08 — Documenteur

Consolide tout en une documentation de référence (`api_reference.md`, `documentation/`) utilisée par tous les agents de Phase 4.

---

## Phase 2 — Capturer la vérité de référence

Avant de migrer, il faut un **filet de sécurité** : des artefacts capturés sur le système legacy en cours d'exécution qui serviront de référence immuable.

Sur Conduit, 5 agents ont produit en parallèle :

| Agent | Artefact | Volume Conduit |
|-------|----------|----------------|
| 09 — Tests API | Fichiers `.http` par endpoint | 100 tests, 17 endpoints |
| 10 — Tests E2E | Scripts Playwright | 43 tests, 11 workflows |
| 11 — Golden files | Réponses JSON normalisées | 43 fichiers, 22 endpoints |
| 12 — Recorder HTTP | Trafic HAR complet | 133 enregistrements |
| 13 — Navigateur visuel | Screenshots de référence | 51 captures, 17 écrans, 3 viewports |

**Normalisation automatique des golden files** : timestamps, UUIDs, tokens CSRF et IDs de session sont remplacés par des marqueurs (`{{TIMESTAMP}}`, `{{UUID}}`…) pour des comparaisons stables.

**Agent 15 — Couverture métier** : vérifie que les tests couvrent les 54 règles extraites. Sur Conduit : **98.1% de couverture métier** (100% en excluant BR-004 déclaré non applicable). Aucune règle entièrement non couverte.

---

## Phase 3 — Planifier la correspondance

### Agent 16 — Mappeur technologique

Produit une table de correspondance pattern par pattern. Sur Conduit : **32 patterns**, classés en :

- **direct** (5) : comportement identique, syntaxe différente
- **adapt** (18) : logique équivalente, restructuration nécessaire
- **redesign** (9) : paradigme différent, réécriture complète
- **unmappable** (1) : Django Admin → hors scope

Exemples de mappings complexes documentés :

```
TM-003 (redesign) : django-taggit TaggableManager
  Source : article.tags.add("python")  — M2M géré automatiquement
  Cible  : Tag.findOrCreate() + ArticleTag.create() — tables explicites
  Gotcha : les tags legacy sont case-preserving, la cible les normalise lowercase
           → script de migration de données requis

TM-008 (redesign) : Session Django → JWT Bearer
  Source : request.session + @login_required → cookie httpOnly
  Cible  : POST /api/users/login → JWT 7j + Authorization: Bearer
  Gotcha : PBKDF2 (legacy) ≠ bcrypt (cible) → lazy re-hash ou reset forcé
           DÉCISION HUMAINE REQUISE avant déploiement
```

### Agent 17 — Planificateur

Détermine l'ordre de migration (topologique + instabilité + complexité) et le séquencement Strangler Fig sprint par sprint.

Sur Conduit : ordre `helpers → config → articles → accounts → comments → templates`, 6 sprints.

---

## Phase 4 — Migration incrémentale, module par module

Pour chaque module, 4 agents s'enchaînent :

```
Agent 18 (Traducteur)
    ↓
Agent 19 (Validateur conformité)  ←→  Agent 21 (Reviewer)
    ↓
Agent 20 (Comparateur shadow mode)
```

### Agent 18 — Traducteur

Traduit le code source dans la technologie cible, règle par règle. Chaque décision est tracée dans un `translation_log.json`.

**Exemple : BR-041 (autorisation double des commentaires)**

```python
# Source Django apps/comments/views.py
def comment_delete_view(request, slug, comment_id):
    comment = get_object_or_404(Comment, id=comment_id)
    article = get_object_or_404(Article, slug=slug)
    if comment.author != request.user and article.author != request.user:
        return HttpResponseForbidden()
    comment.delete()
```

```typescript
// Cible Fastify target/backend/src/modules/comments/comments.routes.ts
async function deleteComment(request, reply) {
  const currentUser = request.user as { id: number };
  const comment = await Comment.findByPk(id, { include: [Article] });
  // BR-041 CRITICAL: auteur commentaire OU auteur article
  const isCommentAuthor = comment.authorId === currentUser.id;
  const isArticleAuthor = comment.article.authorId === currentUser.id;
  if (!isCommentAuthor && !isArticleAuthor) {
    return reply.code(403).send({ errors: { body: ['Forbidden'] } });
  }
  await comment.destroy();
  reply.code(204).send();
}
```

3 tests Jest dédiés vérifient cette règle : auteur du commentaire autorisé, auteur de l'article autorisé, tiers → 403.

**Exemple : BR-026 (following=true dans les réponses article)**

Initialement harcodé à `false` (deferred), résolu en Phase 5 par un helper de batch query :

```typescript
// Avant (16 sessions de développement plus tôt)
following: false, // BR-026 deferred Sprint 3

// Après (résolution COND-01)
async function buildFollowingSet(
  currentUserId: number | null,
  candidateAuthorIds: number[],
): Promise<Set<number>> {
  if (!currentUserId || candidateAuthorIds.length === 0) return new Set();
  const rows = await Follower.findAll({
    where: { fromUserId: currentUserId, toUserId: { [Op.in]: candidateAuthorIds } },
  });
  return new Set(rows.map((r) => r.toUserId));
}
// Un seul SELECT pour tous les auteurs de la page → O(1) requête vs O(n)
```

### Agent 19 — Validateur de conformité

Vérifie statiquement que chaque règle métier est couverte et que les tests passent. Sur le module articles : **17 règles validées, 0 MISSING, 0 BLOCKER**, 25/25 tests Jest.

### Agent 21 — Reviewer spécialisé migration

Code review focalisée exclusivement sur la fidélité à la migration (pas sur le style ou la performance). Il détecte les BLOCKERS et les deviations documentées.

Sur le module articles : CHANGES_REQUESTED → BLOCKER `BLOCKER-articles-001` : endpoint `GET /api/tags` absent, sidebar tags toujours vide. Résolu immédiatement dans la même session.

Sur le module config : BLOCKER `BLOCKER-config-001` : `JWT_SECRET` avec fallback hardcodé `'dev-insecure-secret-change-me'`. Résolu : exception levée si absent hors contexte Jest.

### Agent 20 — Comparateur shadow mode

Lance les deux applications en parallèle, rejoue le trafic HTTP enregistré (Phase 2) sur les deux, et compare les réponses champ par champ. Les différences attendues (format de date, structure JSON vs HTML) sont filtrées.

---

## Phase 5 — Certification

### Agent 22 — Audit final

Produit un rapport exhaustif couvrant :
- Couverture des 54 règles métier (PRESENT / DEFERRED_ACCEPTED / NOT_APPLICABLE / MISSING)
- OWASP Top 10 (A01 à A10)
- Surface API (breaking changes)
- Tests (backend + frontend)

Sur Conduit, verdict initial CONDITIONAL (91%) avec 3 conditions :

| ID | Sévérité | Condition |
|----|----------|-----------|
| COND-01 | medium | `following=true` harcodé `false` dans toutes les réponses author |
| COND-02 | low | Shadow mode non exécuté (apps non démarrées simultanément) |
| COND-03 | low | Format date `'longDate'` ≠ `'MMMM d, y'` (Django `'F j, Y'`) |

Après résolution : **CERTIFIED (97%)**.

### Agent 23 — Détecteur de features fantômes

Vérifie que la cible n'a pas introduit de fonctionnalités non prévues par le legacy (over-engineering, ajouts involontaires). Critique pour s'assurer que la migration est strictement iso-fonctionnelle.

### Agent 24 — Comparateur surface API

Diff structurel complet endpoint par endpoint. Sur Conduit :

```
18 endpoints legacy  →  19 endpoints cible
17 matched (compatible)
 1 missing  : POST /logout — intentionnel (JWT stateless, client supprime le token)
 5 added    : DELETE follow/favorite (split REST), GET comments, GET tags, GET /health
 0 BREAKING CHANGE
```

---

## Ce que le framework garantit

### 1. Zéro régression métier non détectée

54 règles formalisées → couverture 98.1% par les tests → validation module par module → audit final. Une règle MISSING est un BLOCKER systématique (sauf acceptation explicite documentée).

### 2. Traçabilité complète

Chaque décision de migration a une source (`BR-026`, `TM-008`, `WF-010`), une localisation dans le code legacy, et une justification. Les `translation_log.json` constituent un journal d'audit complet.

### 3. Détection précoce des incompatibilités

Le framework a détecté et documenté dès la Phase 3 :
- L'incompatibilité **PBKDF2 (Django) ↔ bcrypt (Node.js)** — stratégie de migration de mots de passe requise avant déploiement
- Le comportement **django-taggit case-preserving** vs la normalisation lowercase cible — script de migration de données nécessaire
- L'absence de l'équivalent Django Admin — hors scope documenté

### 4. Rollback possible à tout moment

Le Strangler Fig garantit que le legacy tourne en parallèle jusqu'à la certification. La bascule est progressive (10% → 50% → 100% du trafic HTML) avec rollback nginx immédiat si nécessaire.

### 5. Vérification visuelle automatisée

51 screenshots de référence capturés sur le legacy, comparés automatiquement avec la cible. Les régressions visuelles sont détectées par analyse structurelle DOM + classes CSS.

---

## Résultats sur la migration Conduit

| Métrique | Valeur |
|----------|--------|
| Durée (simulation) | 6 sprints |
| LOC source analysée | 1 651 (Python + HTML) |
| Règles métier extraites | 54 |
| Tests backend (Jest) | 90 / 90 ✅ |
| Build frontend (Angular) | 0 erreur ✅ |
| Breaking changes API | 0 ✅ |
| Golden files API | 43 |
| Screenshots baseline | 51 |
| Verdict final | **CERTIFIED 97%** |
| OWASP blockers | 0 |

---

## Structure des artefacts produits

```
migration-state/
  config.json                        ← configuration projet (stacks, URLs, credentials)
  state.json                         ← état global (phases, agents, log)

  phase0/
    structure.json                   ← graphe de dépendances et structure
    routes_catalog.json              ← tous les endpoints legacy
    db_schema.json                   ← schéma base de données complet
    metrics_report.json              ← métriques complexité / couplage

  phase1/
    business_rules/
      index.json                     ← index des 54 règles
      modules/{module}/rules.json    ← règles par module
    workflows/                       ← 11 machines à états
    rbac_matrix/                     ← matrice permissions
    documentation/api_reference.md   ← documentation consolidée

  phase2/
    tests_api/endpoints/{slug}/      ← 100 tests HTTP par endpoint
    tests_e2e/                       ← 43 scénarios Playwright
    golden_files/endpoints/{slug}/   ← 43 réponses JSON normalisées
    http_recordings/                 ← 133 captures trafic HAR
    visual_baseline/screens/{slug}/  ← 51 screenshots + metadata
    business_coverage.json           ← 98.1% couverture règles métier

  phase3/
    tech_mapping.json                ← 32 patterns source→cible
    migration_plan.json              ← ordre, sprints, Strangler Fig

  phase4/modules/{module}/
    translation_log.json             ← journal de décisions
    conformity_report.json           ← validation règles
    review_report.json               ← code review migration

  phase5/
    audit_final.json                 ← CERTIFIED / CONDITIONAL / FAILED
    api_surface_diff.json            ← diff endpoints source vs cible
    visual_diff.json                 ← diff visuel baseline vs cible
```

---

## Points d'attention identifiés en pratique

**Les règles CRITICAL méritent des tests dédiés.** BR-041 (double autorisation commentaire) a nécessité 3 tests Jest spécifiques (auteur commentaire / auteur article / tiers) pour être considéré validé. Sans ces tests, le cas `tiers qui tente de supprimer → doit recevoir 403` n'aurait pas été couvert.

**Les "deferred" s'accumulent.** BR-026 (`following=true`) a été marqué deferred 3 fois avant d'être résolu en Phase 5. Le framework force sa résolution avant la certification — mais sans tracking explicite dans `state.json`, ces dettes auraient pu passer en prod.

**La vérification shadow mode (agent 20) est difficile à automatiser.** Elle nécessite les deux applications en cours d'exécution simultanée avec des données de test communes, ce qui suppose un environnement de staging dédié.

**Le mapping PBKDF2 → bcrypt est un vrai BLOCKER de déploiement.** Il n'a pas de solution automatique — c'est une décision métier (reset forcé des mots de passe vs fenêtre de re-hash lazy de 30 jours).

---

## Comparaison avec une migration manuelle

| Aspect | Migration manuelle | Ce framework |
|--------|-------------------|--------------|
| Règles métier | Tacites, dans les têtes | 54 formalisées, localisées, tracées |
| Régression détectée par | Tests écrits après coup | 43 golden files capturés *avant* migration |
| Revue de code | Généraliste | Focalisée sur la fidélité métier |
| Incompatibilités (PBKDF2, tags…) | Découvertes en prod | Détectées en Phase 3, 3 sprints à l'avance |
| Visuel | Comparaison manuelle | 51 screenshots diff automatique |
| Certification | "ça marche sur ma machine" | Verdict documenté (CERTIFIED / CONDITIONAL / FAILED) |
| Surface API | Vérifiée à la main | Diff structurel automatique, 0 breaking change garanti |
