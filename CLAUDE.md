# Migration IA - Projet de Migration Legacy Fullstack

## Contexte
Ce projet contient un framework de migration d'application legacy fullstack base sur 24 agents specialises orchestres par un agent principal. La strategie est incrementale (Strangler Fig) avec garantie de conformite metier.

## Architecture du framework

### Agents disponibles
Tous les agents sont dans `.claude/agents/` et s'invoquent via la syntaxe `use migration-<nom>`.

- `use migration-init` - Initialiser un nouveau projet de migration (OBLIGATOIRE en premier)
- `use migration-orchestrator` - Agent principal, determine la prochaine etape et l'execute
- `use migration-status` - Afficher l'etat courant de la migration

#### Phase 0 - Audit & Inventaire
- `use migration-01-cartographe` - Cartographier la structure et dependances
- `use migration-02-analyseur-routes` - Extraire toutes les routes/endpoints
- `use migration-03-inventaire-db` - Documenter le schema de base de donnees
- `use migration-04-metriques` - Calculer les metriques de complexite

#### Phase 1 - Extraction des Regles Metier
- `use migration-05-extracteur-regles` - Extraire et formaliser les regles metier
- `use migration-06-extracteur-workflows` - Identifier les workflows/machines a etats
- `use migration-07-extracteur-rbac` - Extraire la matrice de permissions
- `use migration-08-documenteur` - Generer la documentation consolidee

#### Phase 2 - Construction du Harnais de Tests
- `use migration-09-generateur-tests-api` - Generer les tests de contrat API
- `use migration-10-generateur-tests-e2e` - Generer les scenarios E2E
- `use migration-11-golden-file` - Capturer les golden files de reference
- `use migration-12-recorder-http` - Enregistrer le trafic HTTP
- `use migration-13-navigateur-visuel` - Capturer la baseline visuelle (screenshots)
- `use migration-14-comparateur-visuel` - Comparer visuellement avant/apres
- `use migration-15-couverture-metier` - Mesurer la couverture des regles metier

#### Phase 3 - Architecture Cible
- `use migration-16-mappeur-techno` - Table de correspondance techno source/cible
- `use migration-17-planificateur` - Determiner l'ordre de migration des modules

#### Phase 4 - Migration Incrementale (par module)
- `use migration-18-traducteur` avec nom du module en argument - Traduire le code d'un module
- `use migration-19-validateur-conformite` avec nom du module - Valider la conformite d'un module migre
- `use migration-20-comparateur-reponses` avec nom du module - Comparer les reponses en shadow mode
- `use migration-21-revieweur-migration` avec nom du module - Revue de code specialisee migration

#### Phase 5 - Validation Finale
- `use migration-22-audit-final` - Audit exhaustif post-migration (produit CERTIFIED/CONDITIONAL/FAILED)
- `use migration-23-detecteur-features-fantomes` - Detecter les ajouts non prevus dans la cible
- `use migration-24-comparateur-surface-api` - Diff structurel des APIs source vs cible

### State Management

```
.claude/migration-state/     <- TEMPLATES (partie du framework, ne pas modifier)
    state.json               <- Structure vierge copiee a l'init
    config.json              <- Config vierge copiee a l'init

./migration-state/           <- COPIE DE TRAVAIL (creee par migration-init, liberement modifiee)
    state.json               <- Etat general maintenu par l'orchestrateur
    config.json              <- Configuration du projet
    phase0/                  <- Artefacts Phase 0 (structure, routes, db, metriques)
    phase1/                  <- Artefacts Phase 1 (business_rules, workflows, rbac, documentation)
    phase2/                  <- Artefacts Phase 2 (tests_api, golden_files, visual_catalog)
    phase3/                  <- Artefacts Phase 3 (tech_mapping, migration_plan)
    phase4/modules/{module}/ <- Artefacts Phase 4 par module
    phase5/                  <- Artefacts Phase 5 (audit_final, ghost_features, api_diff)
```

L'agent `migration-init` copie les templates vers `./migration-state/` puis remplit les valeurs. Tous les agents ecrasent directement les fichiers de `./migration-state/` via Write — jamais de `.new.json` ni de backup.

### Modeles utilises par agent
- **claude-opus-4-6** : Agents critiques (05, 18, 21, 22, 23) — analyse metier et traduction
- **claude-sonnet-4-6** : Agents standard (orchestrateur, init, 01-04, 06-17, 19-20, 24)
- **claude-haiku-4-5** : Agent status (lecture seule, reponse rapide)

### Regles
- Chaque agent est **stateless** : il lit ses entrees depuis `migration-state/`, produit ses sorties, et met a jour `state.json`
- **ZERO ajout de fonctionnalite** : la migration doit etre iso-fonctionnelle
- Toute regle metier avec confiance < 80% doit etre validee par un humain
- Les agents de Phase 4 prennent le nom du module en argument
- Une regle metier "missing" = BLOCKER systematique (sauf acceptation explicite documentee)
- L'orchestrateur est le point d'entree recommande — il determine automatiquement la prochaine action
