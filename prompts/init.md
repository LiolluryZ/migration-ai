## Init

### Prompt a migration-init

---
Ok j'aimerai faire une migration du projet qui se trouve dans le repertoire legacy. Cette application s'appel **conduit**. Elle a été développé en Django + HTMX + (Sqlite || Postgre). J'aimerai en faire une stack Angular + Fastify + Sequelize + (sqlite || Postgre).
La bdd est donc en sqlite pour les test et execution local et en postgre en production.
elle s'execute en http://localhost:8000/
un compte de test en bdd : test@email.com - test
---

### Resultat

Création des fichier `config.json` et `state.json`

## Phase 0

### Prompt à migration-orchestrator

---
Commence l'audit avec l'agent cartographe
---

### Resultat

Fichier de carto créé

### Prompt à migration-orchestrator

Lance les agents suivants dans la phase 0

### Resultat

Résultat
Phase 0 — COMPLÉTÉE ✅ | Phase 1 — EN COURS 🔄

Agents 02, 03, 04 terminés en parallèle
Agent	Confiance	Sortie principale
02-analyseur-routes	93%	23 routes backend, 8 interactions HTMX
03-inventaire-db	88%	9 tables, 38 colonnes, 8 migrations, 2 bugs historiques
04-metriques	82%	1651 LOC, CC moyen 2.48, ordre migration établi
Prochaine étape : Phase 1
L'agent 05-extracteur-regles doit passer en premier (pré-requis pour 06 et 07). C'est l'agent le plus critique — il utilise claude-opus-4-6.