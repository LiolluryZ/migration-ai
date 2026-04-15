---
name: angular-best-practices
description: Règles de codage Angular à respecter dans ce projet (Conduit migration).
---

# Bonnes pratiques Angular – Projet Conduit

## Structure des composants

**Toujours séparer en 3 fichiers distincts — sans exception.**

```
moncomposant/
  moncomposant.ts      ← logique + métadonnées @Component
  moncomposant.html    ← template
  moncomposant.scss    ← styles
```

Dans le décorateur `@Component`, utiliser **obligatoirement** :

```ts
@Component({
  selector: 'app-mon-composant',
  templateUrl: './moncomposant.html',   // ← jamais template: `...`
  styleUrl: './moncomposant.scss',      // ← jamais styles: [...]
})
```

**Interdit :**

```ts
// ❌ template inline
@Component({ selector: 'app-x', template: '<p>...</p>' })

// ❌ styles inline
@Component({ selector: 'app-x', styles: [':host { color: red }'] })
```

## Styles

- Fichier de style : **SCSS** (`.scss`), jamais `.css` ni styles inline.
- Utiliser les variables SCSS globales définies dans `src/styles.scss`.
- Les fichiers SCSS de composants ne contiennent que les surcharges spécifiques au composant.
- Un fichier SCSS stub (composant non encore implémenté) doit exister et contenir au minimum un commentaire.

## Standalone API (Angular 17+)

- Tous les composants sont **standalone** (`standalone: true` est la valeur par défaut depuis Angular 19 — ne pas l'écrire explicitement).
- Déclarer chaque dépendance dans le tableau `imports: []` du composant qui l'utilise.
- Pas de `NgModule`.

## Lazy loading

- Chaque page dans `pages/` est chargée en lazy via `loadComponent()` dans `app.routes.ts`.
- Ne jamais importer directement un composant de page dans `app.ts` ou `app.config.ts`.

## Signals

- Préférer les **signals** (`signal()`, `computed()`, `effect()`) à `BehaviorSubject` pour l'état local et les services.
- `toSignal()` pour convertir des Observables RxJS exposés en template.

## Nommage des fichiers

Suivre la convention Angular CLI **2025** (camelCase) telle que configurée dans `angular.json` :

```
moncomposant.ts / moncomposant.html / moncomposant.scss
```
