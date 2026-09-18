# Tactical RPG — Game Design Document

**Version :** 1.0  
**Statut :** spécification de production  
**Langue :** français  
**Référence d'inspiration :** tactical RPG 2D au tour par tour, avec une structure de campagne et des archétypes de classes rappelant les jeux de stratégie fantasy sur grille. Le projet ne réutilise aucun code, contenu, nom, scénario, carte, sprite ou donnée propriétaire d'une œuvre existante.

## 1. Vision

Le jeu est un tactical RPG fantasy solo, lisible et expressif, dans lequel chaque décision de placement, d'équipement et de recrutement compte. Le joueur dirige une petite armée à travers une campagne composée de chapitres reliés par une carte du monde. Les batailles privilégient la clarté des règles, les conséquences assumées et la personnalisation des unités plutôt que la complexité opaque.

### Promesse joueur

> « Je construis une équipe complémentaire, je lis le terrain, je prends des risques mesurés et chaque victoire raconte une histoire. »

### Périmètre cible

- **Plateforme :** navigateur desktop en priorité, contrôleur et tactile envisageables.
- **Public :** joueurs de tactical RPG débutants à confirmés.
- **Mode :** campagne solo, sans connexion requise après chargement.
- **Durée cible :** 20 à 30 chapitres, 20 à 45 minutes par chapitre.
- **Échelle :** 8 à 12 unités déployables, 30 à 40 unités recrutables, 12 à 16 classes jouables.
- **Difficultés :** Histoire, Classique, Expert ; mode Permadeath configurable.

## 2. Piliers de conception

1. **Décisions lisibles :** portée, dégâts, taux de touche, critique et contre-attaque sont affichés avant validation.
2. **Complémentarité :** aucune classe ne couvre seule tous les besoins ; terrain, armes et rôles créent des synergies.
3. **Risque choisi :** les récompenses optionnelles et les objectifs secondaires poussent à sortir du chemin sûr.
4. **Progression signifiante :** niveaux, promotions, affinités et équipement changent concrètement la façon de jouer.
5. **Monde accueillant :** une direction artistique chaleureuse et une UX pédagogique rendent la stratégie accessible.
6. **Système data-driven :** classes, unités, armes, cartes, règles et tables de croissance sont des données versionnées, validées par schéma et indépendantes des scènes Phaser.

## 3. Direction artistique et présentation

### Style visuel

- Sprites d'unités **32×32 px** sur une grille carrée ; animations composées de poses lisibles plutôt que d'effets réalistes.
- Tuiles de base 32×32 px, avec éléments de décor modulaires alignés sur la même grille.
- Perspective orthographique vue du dessus, lisibilité « Zelda-like » : silhouettes nettes, aplats colorés, contours modérés et ombres courtes.
- Palette par faction : couleurs distinctives mais compatibles avec le daltonisme ; jamais plus de trois couleurs d'accent par unité.
- Les cases sélectionnées, menacées et accessibles utilisent à la fois couleur, motif et icône.
- Portraits 2D semi-stylisés pour les conversations ; illustrations clés réservées aux moments majeurs.

### Caméra et feedback

- Caméra centrée sur la case active, déplacement par glissement clavier, bord d'écran ou mini-carte.
- Zoom borné entre 1× et 2× ; la grille reste alignée à tous les niveaux.
- Animation courte pour déplacement, attaque, soin, promotion et capture d'objectif.
- Journal de combat consultable après chaque action ; sons et secousses désactivables indépendamment.

### Accessibilité

- Mode contraste élevé, taille de texte réglable, vitesse d'animation x0,5/x1/x2.
- Remplacement des couleurs d'équipe par motifs et icônes.
- Confirmation systématique des actions irréversibles, raccourcis clavier documentés, navigation entièrement au clavier.
- Option « aperçu détaillé » affichant les formules et bonus temporaires.

## 4. Mécaniques requises

- Batailles au tour par tour sur grille carrée.
- Tours alternés joueur / ennemi, avec renforts et événements scriptés.
- Déplacement par points de mouvement, coûts de terrain et zones de menace.
- Attaques physiques et magiques, portée, contre-attaque et double attaque.
- Triangle des armes **configurable par scénario ou mode de jeu**.
- Rangs d'armes E, D, C, B, A, S, expérience d'arme et restrictions de classe.
- Efficacités d'armes contre catégories de cibles.
- Statistiques de base, croissances par niveau, promotion et plafonds.
- Classes de base et promotions, armes autorisées, déplacement, rôle et capacités.
- Terrain : plaine, forêt, montagne, eau, fort, château, route, désert, pont, marais, mur et case spéciale.
- Inventaire individuel, objets consommables, armes à durabilité et convoy partagé.
- Progression par expérience, niveaux, compétences passives, soutien et promotion.
- IA de combat, priorités d'objectif, patrouilles, renforts et comportements de boss.
- Recrutement par dialogue, visite, condition de classe, survie ou événement.
- Maisons et villages visitables, récompenses, conversations et destruction différée.
- Carte du monde avec nœuds, itinéraires, boutiques, arènes et chapitres rejouables.
- Sauvegarde manuelle, sauvegarde automatique, emplacements multiples et reprise après défaite.
- Flux complet de chapitre, objectifs principaux et secondaires, récompenses et statistiques de fin.

## 5. Boucle de gameplay

1. **Carte du monde :** choisir le prochain chapitre, consulter les rumeurs et gérer les ressources.
2. **Préparation :** sélectionner les unités, formation, inventaires, supports, difficulté et conditions de déploiement.
3. **Déploiement :** placer les unités dans les zones autorisées et lire les objectifs.
4. **Exploration tactique :** déplacer, attaquer, soigner, visiter ou attendre ; chaque action consomme le tour de l'unité.
5. **Phase ennemie :** l'IA exécute ses ordres, les événements réagissent aux changements de carte.
6. **Résolution :** victoire, défaite ou retraite ; distribution d'expérience, or, objets et soutiens.
7. **Intermission :** conversations, promotion, boutique, convoyage, sauvegarde et choix du prochain nœud.

## 6. Modèle de données et extensibilité

Les données de contenu sont séparées du code de simulation. Chaque entité possède un `id` stable, un `displayName`, une version de schéma et des références vers d'autres entités.

```ts
type UnitDefinition = {
  id: string;
  factionId: string;
  classId: string;
  baseStats: Stats;
  growths: Partial<Record<StatName, number>>;
  startingLevel: number;
  startingItems: string[];
  recruitment: RecruitmentRule;
};

type ClassDefinition = {
  id: string;
  tier: "base" | "promoted";
  move: number;
  movementType: "foot" | "mounted" | "flying" | "armored" | "aquatic";
  weaponRanks: Partial<Record<WeaponType, WeaponRank>>;
  statCaps: Stats;
  promotionIds?: string[];
  roleTags: string[];
};
```

Les validateurs doivent refuser les identifiants dupliqués, les références absentes, les croissances hors plage, les armes incompatibles et les cartes dont les cases sont inaccessibles. Un registre de règles permet de surcharger le triangle, les caps, la permadeath, les bonus de terrain et les conditions de victoire sans modifier le moteur.

## 7. Statistiques et formules

| Statistique | Fonction |
|---|---|
| PV | points de vie maximum |
| Force | dégâts physiques et poids transportable partiel |
| Magie | dégâts magiques et puissance de soin |
| Technique | précision, critique et fiabilité |
| Vitesse | esquive et seuil de double attaque |
| Chance | esquive, critique reçu et événements |
| Défense | réduction des dégâts physiques |
| Résistance | réduction des dégâts magiques |
| Constitution | poids d'arme supportable et déplacement de certains alliés |

Formules par défaut, configurables par règle :

- `dégâts physiques = max(0, force + puissanceArme - défenseCible)`.
- `dégâts magiques = max(0, magie + puissanceTome - résistanceCible)`.
- `précision = précisionArme + 2×technique + chance/2 + bonusTerrain`.
- `esquive = 2×vitesse + chance + bonusTerrain`.
- `tauxDeTouche = clamp(précision - esquive, 0, 100)`.
- `critique = critiqueArme + technique/2 + chance/2 - chanceCible/2`.
- Double attaque si `vitesseAttaquant - vitesseCible >= seuilDouble`, seuil par règle (par défaut 4).
- Une arme de poids supérieur à la Constitution réduit la vitesse de `poids - constitution`, sans valeur négative.

Les arrondis sont déterministes et centralisés dans le moteur de règles. L'aperçu de combat affiche les valeurs finales et les modificateurs.

## 8. Classes, promotions et rôles

Les valeurs suivantes sont des **bases de référence** au niveau 1. Les statistiques sont présentées dans l'ordre `PV / FOR / MAG / TEC / VIT / CHA / DEF / RES / CON`. Les croissances sont des pourcentages par niveau. Une promotion conserve l'expérience, accorde un bonus fixe et augmente les caps.

| Classe de base | Base | Croissances | Dépl. | Armes | Rôle |
|---|---:|---:|---:|---|---|
| Soldat | 19/6/0/5/6/2/5/1/8 | 85/45/0/50/45/35/35/15 | 5 | Lance E | ligne polyvalente |
| Combattant | 21/8/0/3/5/3/4/0/10 | 90/55/0/35/45/30/25/10 | 5 | Hache E | force et PV |
| Bretteur | 18/5/0/8/9/5/3/2/7 | 70/35/0/60/60/40/20/20 | 5 | Épée E | esquive et critique |
| Archer | 18/5/0/6/6/3/3/1/7 | 75/45/0/55/50/35/25/15 | 5 | Arc E | dégâts à distance |
| Mage | 16/0/7/5/6/3/2/5/5 | 55/10/55/45/45/30/15/45 | 5 | Tome E | dégâts magiques |
| Prêtre | 17/0/3/5/5/4/2/7/5 | 60/0/45/45/40/35/15/55 | 5 | Bâton E | soin et utilitaire |
| Cavalier | 20/6/0/5/7/2/6/1/9 | 80/45/0/45/45/25/35/15 | 7 | Épée E, Lance E | mobilité |
| Pégase | 18/5/1/6/8/4/4/5/6 | 70/40/15/50/55/45/20/35 | 7 | Lance E | mobilité aérienne |
| Voleur | 17/4/0/7/8/6/2/1/6 | 65/35/0/60/60/50/15/20 | 6 | Épée E | coffres et portes |

| Promotion | Bonus PV/FOR/MAG/TEC/VIT/CHA/DEF/RES/CON | Dépl. | Armes | Rôle |
|---|---:|---:|---|---|
| Chevalier | +4/+3/0/+2/+1/+0/+4/+2/+2 | 5 | Lance C, Épée E | tank de ligne |
| Héros | +3/+2/0/+3/+2/+1/+2/+1/+1 | 6 | Épée C, Hache D | combattant complet |
| Maître d'armes | +2/+1/0/+3/+3/+2/+1/+1/+0 | 6 | Épée C | duelliste |
| Guerrier | +4/+4/0/+1/+1/+1/+2/+0/+2 | 6 | Hache C, Arc D | dégâts lourds |
| Sniper | +2/+2/0/+3/+2/+1/+1/+1/+0 | 6 | Arc C | portée et critique |
| Sage | +2/0/+3/+2/+1/+1/+0/+3/+0 | 6 | Tome C, Bâton D | magie et soin |
| Évêque | +3/0/+2/+1/+0/+1/+1/+4/+0 | 6 | Bâton C, Tome D | soutien spécialisé |
| Paladin | +4/+2/+0/+2/+2/+0/+3/+2/+2 | 8 | Épée C, Lance C | cavalerie flexible |
| Fauconnier | +3/+2/+1/+2/+2/+1/+2/+3/+1 | 8 | Lance C, Épée D | éclaireur aérien |
| Assassin | +2/+2/0/+3/+3/+2/+0/+1/+0 | 7 | Épée C | infiltration et exécution |

Caps, bonus de promotion et chemins disponibles sont propres à chaque définition. Une promotion est irréversible par défaut ; le mode Histoire peut proposer une réinitialisation limitée.

## 9. Terrains

| Terrain | Coût pied | Coût monté | Évasion | Défense | Règle |
|---|---:|---:|---:|---:|---|
| Plaine | 1 | 1 | 0 | 0 | terrain neutre |
| Route | 1 | 1 | 0 | 0 | bonus de déplacement scripté |
| Forêt | 2 | 3 | +20 | +1 | cavaliers non volants ralentis |
| Montagne | 3 | interdit | +25 | +2 | pégases et unités adaptées |
| Colline | 2 | 2 | +10 | +1 | avantage de vision |
| Eau | interdit | interdit | 0 | 0 | traversable par aquatique ou pont |
| Marais | 2 | interdit | +5 | 0 | dégâts de fin de tour optionnels |
| Désert | 2 | 3 | 0 | 0 | certains objets enfouis |
| Fort | 1 | 1 | +10 | +2 | soin de 10 % PV au début du tour |
| Château | 1 | 1 | +10 | +3 | point de contrôle et soin |
| Pont | 1 | 1 | 0 | 0 | case étroite, pas de dépassement |
| Mur | interdit | interdit | — | — | bloque déplacement et ligne de vue |

Les règles de vision, de vol, de destruction et de terrain peuvent être remplacées par scénario. La carte doit toujours offrir au joueur une lecture des coûts accessibles avant déplacement.

## 10. Combat

### Séquence

1. Vérifier portée, ligne de vue, compatibilité et durabilité.
2. Calculer l'aperçu déterministe : touche, dégâts, critiques, doubles et contres.
3. Confirmer ou annuler ; aucune action ne doit être consommée avant confirmation.
4. Résoudre les frappes dans l'ordre attaquant, contre, double éventuel.
5. Déclencher capacités, réactions, mort, fuite, butin et événements.

Les bâtons peuvent soigner, restaurer un état, ouvrir une porte ou téléporter une unité selon leur définition. Les attaques à distance ne contre-attaquent que si la portée adverse le permet. Une unité à 0 PV est vaincue ; la permadeath applique la perte à la fin de la carte après la fenêtre de sauvegarde automatique.

### Triangle des armes configurable

Le triangle est une matrice de données, non une constante :

```json
{
  "sword": { "axe": 1, "lance": -1 },
  "lance": { "sword": 1, "axe": -1 },
  "axe": { "lance": 1, "sword": -1 }
}
```

Une entrée positive accorde par défaut `+15 précision / +1 dégâts`, une entrée négative `-15 précision / -1 dégâts`. Le scénario peut choisir d'autres valeurs, ajouter les tomes, neutraliser le triangle ou déclarer des catégories (`sacred`, `beast`, `siege`). Les règles sont affichées dans l'écran d'aide du chapitre.

### Rangs et armes

Rangs : **E, D, C, B, A, S**. Une utilisation valide accorde de l'expérience d'arme ; le rang requis doit être atteint avant l'utilisation. Les seuils par défaut sont `E 0`, `D 30`, `C 70`, `B 120`, `A 180`, `S 255`.

| Type | Exemples | Efficacités possibles |
|---|---|---|
| Épée | épée courte, rapière, lame sacrée | armure légère, bêtes |
| Lance | lance, javelot, pique | cavalerie, volants |
| Hache | hache, hachette, marteau | armure, portes |
| Arc | arc court, arc long, arc de chasse | volants |
| Tome | feu, foudre, vent, lumière | affinité élémentaire |
| Bâton | soin, remède, téléportation | aucune ou utilitaire |

Chaque arme définit puissance, précision, critique, portée, poids, durabilité, rang, prix, catégorie d'efficacité et tags d'animation. Les armes efficaces appliquent un multiplicateur configurable (par défaut ×2) avant bonus fixes. Les armes légendaires sont des données ordinaires avec des règles d'obtention spécifiques.

## 11. Inventaire, convoyage et économie

- Chaque unité possède 5 emplacements d'inventaire, dont un équipement actif.
- Armes et objets empilables déclarent leur limite ; les armes équipées ne peuvent pas être déplacées pendant une animation de combat.
- Le convoy est partagé par l'armée, accessible depuis la préparation et par les unités adjacentes au convoi sur certaines cartes.
- Le convoy peut contenir 200 piles en mode standard ; cette limite est configurable.
- Boutiques, armureries et vendeurs proposent stock, prix, rang requis et chapitre d'apparition.
- Or gagné par victoire, villages, primes, objectifs et vente ; aucune microtransaction.
- Les objets-clés et récompenses uniques sont protégés contre la vente.

## 12. Progression

L'expérience est plafonnée à 100 par niveau. Une action rapporte selon le risque, la différence de niveau et l'effet réel ; une unité de niveau supérieur ne peut pas exploiter indéfiniment les ennemis faibles. Au niveau 20, l'unité peut se promouvoir avec un objet de promotion ou une règle de chapitre.

Les soutiens se développent lorsque deux unités alliées commencent un tour dans un rayon défini. Chaque rang de soutien déverrouille une conversation et un bonus contextuel ; les bonus ne se cumulent pas au-delà de la limite de liens par unité.

Les capacités sont des tags data-driven : `vantage`, `rescue`, `lockpick`, `canto`, `effectiveness`, `healer`. Elles disposent de conditions, priorité de déclenchement, paramètres et texte d'explication.

## 13. IA

Chaque groupe ennemi reçoit une posture :

- **Garde :** reste dans une zone jusqu'à intrusion.
- **Patrouille :** suit un chemin de cases et revient à son origine.
- **Assaut :** choisit la meilleure cible atteignable selon une fonction de score.
- **Protection :** maximise la couverture d'un boss, village ou convoi.
- **Fuite :** rejoint une sortie ; sa défaite n'est pas toujours obligatoire.

Ordre de décision par défaut : respecter l'objectif, éviter une mort certaine, atteindre une cible prioritaire, maximiser le score de dégâts/soin, réduire la distance. L'IA simule au minimum l'aperçu de combat, les contre-attaques, les efficacités, les portes et les cases occupées. Les renforts sont télégraphiés par message ou marqueur lorsque le mode choisi l'exige. Le joueur peut afficher la zone de menace complète ou celle de l'ennemi actif.

## 14. Recrutement

Les règles de recrutement sont déclaratives :

- dialogue avec une unité précise ;
- visite d'une maison ou d'un village ;
- présence d'une classe, faction ou unité spécifique ;
- survie jusqu'à un tour donné ;
- objet remis ou objectif secondaire accompli ;
- recrutement après combat sans mise à mort.

Une recrue rejoint avec un niveau, un inventaire, une loyauté, des conversations et des affinités définis. Les conditions non satisfaites doivent être journalisées dans l'encyclopédie, sans révéler les secrets avant leur découverte.

## 15. Maisons, villages et carte du monde

Les maisons et villages sont des points d'interaction sur la carte. Une unité dépense son action pour visiter ; la récompense peut être or, arme, objet-clé, information, recrue ou amélioration temporaire. Un village peut être détruit par un ennemi après un délai configurable. Son état persiste après sauvegarde et influence la carte du monde.

La carte du monde est un graphe de nœuds : chapitre, annexe, boutique, arène, détour ou événement. Chaque nœud expose prérequis, récompenses, difficulté estimée et statut de complétion. Les chapitres déjà terminés peuvent être rejoués en mode entraînement sans modifier la chronologie principale, selon la difficulté choisie.

## 16. Sauvegarde et reprise

- Sauvegarde manuelle dans 3 emplacements nommés, avec date, chapitre, difficulté et temps de jeu.
- Sauvegarde automatique avant le chapitre, après la préparation et après la victoire.
- En mode Classique, une défaite propose reprendre la sauvegarde pré-bataille ; en mode Permadeath, les pertes sont conservées dans la sauvegarde validée.
- Les données de contenu et la version du moteur sont stockées pour détecter une incompatibilité.
- Écriture atomique, checksum et message d'erreur explicite en cas d'échec ; jamais de succès silencieux.
- Export/import local optionnel si l'environnement navigateur l'autorise.

## 17. Flux détaillé d'un chapitre

1. Charger le nœud et valider les données de carte.
2. Afficher briefing, objectifs, récompenses connues et conditions de défaite.
3. Ouvrir la préparation : unités, déploiement, inventaires, convoy, supports et règles.
4. Créer la sauvegarde pré-bataille.
5. Afficher les événements d'introduction puis le premier tour joueur.
6. Autoriser les actions selon les règles de terrain, portée et objectif.
7. Résoudre la phase ennemie et les événements de fin de tour.
8. Mettre à jour objectifs, villages, renforts, tours et journal.
9. Déclarer victoire lorsque les conditions sont remplies ; déclarer défaite ou retraite selon la règle.
10. Jouer l'épilogue, attribuer expérience, or et objets, puis créer la sauvegarde validée.
11. Afficher statistiques : tours, pertes, villages, ennemis, recrutements, objectifs et rang de performance.
12. Retourner à la carte du monde et débloquer les nœuds concernés.

## 18. UX et écrans

### Écran de bataille

- Barre supérieure : chapitre, tour, objectifs, or et bouton aide.
- Panneau contextuel : unité, PV, statut, arme active, rangs et portée.
- Survol d'une case : coordonnées, terrain, bonus et unités affectées.
- Commandes : Déplacer, Attaquer, Bâton, Objet, Échanger, Visiter, Attendre, Information.
- Aperçu de combat côte à côte avec valeurs avant/après et icônes explicatives.
- Annulation du déplacement tant qu'aucune action secondaire n'est confirmée.

### Menus

Préparation, inventaire, convoy, statistiques, supports, objectifs, journal, encyclopédie, options et sauvegarde doivent être accessibles sans perdre le contexte de la carte. Les textes de règles utilisent le même vocabulaire que les données et le moteur.

## 19. Critères de réussite

### Critères fonctionnels

- Toutes les mécaniques de la section 4 sont jouables sans modification du code lorsqu'on change leurs données.
- Une carte de test permet de vérifier au moins chaque terrain, chaque type d'arme, une promotion, un recrutement, un village, un renfort et une sauvegarde.
- L'aperçu de combat est identique au résultat résolu, hors hasard explicitement affiché.
- Une campagne peut être terminée depuis une nouvelle partie jusqu'à l'épilogue sans corruption ni blocage.

### Critères de qualité

- Temps de chargement initial inférieur à 3 secondes sur ordinateur courant après cache.
- 60 FPS visés sur une carte de 40×30 cases avec 30 unités visibles.
- Aucun texte critique coupé à 100 % et 125 % de zoom système.
- Tous les raccourcis et états de couleur disposent d'une alternative non visuelle.
- Les erreurs de données sont détectées au chargement avec identifiant, chemin et correction attendue.

### Critères de plaisir à valider en playtest

- Un nouveau joueur comprend déplacement, attaque et fin de tour dans les 10 premières minutes.
- Au moins deux compositions d'équipe viables par chapitre.
- Les objectifs secondaires créent un choix de risque plutôt qu'une obligation cachée.
- Les pertes et la promotion sont comprises avant leur confirmation.
- Les joueurs experts identifient un avantage du terrain ou de l'arme dans chaque carte.

## 20. Plan de validation data-driven

Les tests automatisés couvrent les formules, caps, coûts de mouvement, triangle, efficacité, rangs, inventaire, IA déterministe et sérialisation. Des fixtures minimales décrivent une carte par mécanique. Un test de compatibilité charge la totalité du catalogue de production et vérifie les références croisées. Toute nouvelle règle doit être ajoutée comme donnée ou stratégie enregistrée, accompagnée d'un cas de test et d'une entrée d'aide UX.

