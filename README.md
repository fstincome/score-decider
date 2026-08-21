# ScoreDecider — Guide d'utilisation

**ScoreDecider** est une application web de classement en temps réel conçue pour les compétitions, concours et jurys. Elle permet à un administrateur de créer des présidents de jury, à chaque président de gérer ses propres compétitions, équipes, critères et jurés, et aux jurés de soumettre leurs notes. Le classement final est calculé automatiquement et affiché publiquement.

---

## Vue d'ensemble du fonctionnement

L'application repose sur une hiérarchie de trois rôles :

1. **Administrateur** : crée les présidents de jury et leur attribue un code d'accès.
2. **Président de jury** : crée une ou plusieurs compétitions, définit les critères de notation, ajoute les équipes et crée les jurés avec leurs codes.
3. **Juré** : se connecte avec son code et saisit ses notes pour chaque équipe de la compétition à laquelle il est rattaché.

Le classement public (`/`) affiche la moyenne des totaux des jurés ayant voté, triée du plus grand au plus petit. Le président peut clôturer une compétition pour figer les notes et proclamer les résultats.

---

## Flux typique d'une session

### 1. Connexion

- Tous les utilisateurs passent par `/login`.
- L'administrateur entre le code admin défini en base (`access_codes` avec `role = 'admin'`).
- Un président entre le code qui lui a été attribué par l'administrateur.
- Un juré entre le code qui lui a été attribué par son président.

Après connexion, l'utilisateur est redirigé automatiquement :

- Admin → `/admin`
- Président → `/president`
- Juré → `/vote`

### 2. L'administrateur crée un président

Dans `/admin` :

- Saisir le nom du président.
- Saisir un code numérique de 3 à 8 chiffres.
- Cliquer sur **Créer**.
- Le président apparaît dans la liste avec son code.
- L'administrateur peut modifier le code ou supprimer le président.

> L'administrateur ne gère pas directement les compétitions, les équipes ni les jurés : c'est le rôle du président.

### 3. Le président crée une compétition

Dans `/president` :

- Section **Mes compétitions**.
- Saisir le nom de la compétition et cliquer sur **Créer**.
- La compétition est créée avec les critères par défaut :
  - Innovation — 25 pts
  - Impact — 20 pts
  - Faisabilité technique — 20 pts
  - Qualité du prototype — 15 pts
  - Présentation du pitch — 10 pts
  - Réponses aux questions — 10 pts
- Le total maximum est de **100 points**.

Le président peut créer **autant de compétitions qu'il souhaite** et basculer entre elles avec le bouton **Activer**.

### 4. Le président personnalise la compétition active

Une compétition active permet de :

- **Renommer** la compétition.
- **Modifier les critères** : libellé et nombre de points maximum.
- **Ajouter** de nouveaux critères.
- **Supprimer** des critères.
- Le total maximum se recalcule automatiquement.

### 5. Le président ajoute les équipes

Dans la section **Équipes** :

- Saisir le nom de l'équipe.
- Cliquer sur le bouton **+**.
- Le numéro de projet est attribué automatiquement de manière séquentielle.
- Le nom peut être modifié ensuite.
- Une équipe peut être supprimée.

### 6. Le président ajoute les jurés

Dans la section **Jurés** :

- Saisir le nom du juré.
- Saisir un code numérique de 3 à 8 chiffres.
- Cliquer sur **Ajouter**.
- Le code s'affiche à côté du nom du juré et peut être modifié.
- Le président peut supprimer un juré.

Chaque compétition a **son propre ensemble de jurés**.

### 7. Les jurés notent les équipes

Un juré connecté arrive sur `/vote` :

- Il voit la liste des équipes de sa compétition.
- Pour chaque équipe, il saisit une note pour chaque critère.
- La note est automatiquement plafonnée au maximum du critère.
- Son total par équipe s'affiche en temps réel.
- Il clique sur **Envoyer** pour enregistrer ses notes.
- Il peut modifier ses notes et les renvoyer tant que la compétition n'est pas clôturée.

Si un juré n'est rattaché à aucune compétition, un message lui indique d'attendre que son président l'affecte.

### 8. Clôture et proclamation

Dans `/president` ou `/vote` (pour le président) :

- Le président clique sur **Clôturer & proclamer**.
- La compétition passe en mode verrouillé.
- Aucune note ne peut plus être modifiée.
- Le classement public affiche **Résultats Proclamés**.
- Le président peut rouvrir la compétition s'il le souhaite.

### 9. Classement public

La page d'accueil `/` affiche :

- La compétition active (la plus récente par défaut).
- Un sélecteur si plusieurs compétitions existent.
- Le classement avec la moyenne des totaux des jurés.
- Le nombre de jurés ayant voté pour chaque équipe.
- Le podium visuel (🥇, 🥈, 🥉).
- Un bandeau lorsque la compétition est clôturée.

Seules les équipes ayant reçu au moins une note apparaissent dans le classement.

---

## Calcul du classement

Pour chaque équipe :

1. On additionne les notes de chaque juré sur tous les critères → total par juré.
2. On calcule la moyenne de ces totaux.
3. On trie les équipes par moyenne décroissante.

Formule simplifiée :

```
moyenne_équipe = (somme des totaux des jurés ayant voté) / (nombre de jurés ayant voté)
```

Le maximum théorique correspond à la somme des points maximums de tous les critères.

---

## Architecture technique

- **Framework** : TanStack Start v1 + React 19 + Vite 7.
- **Base de données** : Lovable Cloud (Supabase) avec synchronisation temps réel.
- **Authentification** : codes d'accès numériques stockés dans `access_codes`.
- **Stockage de session** : `localStorage` via `src/lib/session.ts`.
- **Logique métier** : `src/lib/scoring.ts` pour les types et le calcul du classement.
- **Données temps réel** : `src/lib/useCompetition.ts` écoute les changements PostgreSQL.
- **Fonctions serveur** : `src/lib/access.functions.ts` pour la vérification des codes et la gestion des droits.

### Tables principales

| Table | Rôle |
|-------|------|
| `competitions` | Une compétition avec nom, état verrouillé et président propriétaire. |
| `criteria` | Critères de notation (libellé, points max, position) liés à une compétition. |
| `teams` | Équipes participantes avec un numéro de projet. |
| `juries` | Jurés et présidents, rattachés à une compétition. |
| `scores` | Notes atomiques : une ligne par juré, équipe et critère. |
| `access_codes` | Codes d'accès admin, présidents et jurés. |

---

## Raccourcis d'accès

| Route | Usage |
|-------|-------|
| `/` | Classement public en direct |
| `/login` | Connexion par code |
| `/admin` | Gestion des présidents |
| `/president` | Gestion des compétitions, critères, équipes et jurés |
| `/vote` | Saisie des notes par les jurés |

---

## Bonnes pratiques

- Attribuez des codes distincts et confidentiels à chaque juré.
- Créez la compétition, les équipes et les jurés **avant** de distribuer les codes.
- Vérifiez le total maximum des points avant le début de la compétition.
- Ne clôturez la compétition que lorsque tous les jurés ont envoyé leurs notes.
- En cas de problème, le président peut rouvrir temporairement la compétition.
