# Plan de développement — Carte Lovelace custom PHS16-LC (`ha-card/`)

> **Suivi** : 2026-11-22 — phase P0 en cours sur la branche `feature/carte-lovelace`
> (squelette `custom:phs16lc-spot-card` : nom + état, config `device:`/`entity:`,
> harness `test/index.html`).

Carte frontend pour les luminaires PHS16-LC : vue compacte par SPOT et par groupe
de luminaires, avec accès rapide aux actions principales (on/off, recette,
luminosité, canaux, sauvegarde NVM).

Cible : **Home Assistant 2026.11+** — HACS y est remplacé par le **Marketplace
intégré** (Réglages → Marketplace). Docs de référence :

- Cartes custom : https://contributors.home-assistant.io/frontend/custom-ui/
- Structure d'un dépôt Marketplace : https://contributors.home-assistant.io/marketplace/reference/repository-structure/
- `hacs.json` : https://contributors.home-assistant.io/marketplace/reference/hacs-json/

Décisions actées (inputs utilisateur) :

- **Hébergement** : sous-projet **séparé** de l'intégration Python (cycles de
  release indépendants) : sous-répertoire `ha-card/` à la racine de ce workspace,
  poussé à la racine d'un dépôt GitHub dédié via
  `git subtree push --prefix=ha-card card-dist master` (remote `card-dist` =
  dépôt GitHub `phs16lc-card`), puis « Dépôts personnalisés » dans
  Réglages → Marketplace. (Embarquer la carte dans l'intégration reste possible
  plus tard : `www/` dans `custom_components/phs16lc/`.)
- **Périmètre** : carte SPOT **et** carte groupe de luminaires.
- **Contenu** — compact : état (on/off + en ligne), recette courante, moyenne des
  températures LED (LED 1 / LED 2). Dépliable : luminosité globale, slider par canal
  (16), températures détaillées, select « groupe de canaux » de la recette, bouton
  « Sauvegarder NVM ».
- **Configuration** : `device: SPOT 3` (résolution auto des entités via le device
  registry) avec surcharge possible par `entity:` individuel. Langue = langue HA
  (`hass.locale.language`, textes fr/en embarqués).

---

## 1. Contrat utilisateur (YAML)

```yaml
# Carte SPOT — config minimale (une ligne)
- type: custom:phs16lc-spot-card
  device: SPOT 3            # device registry (identifiers: (phs16lc, "spot_3"))

# Carte SPOT — surcharges explicites possibles
- type: custom:phs16lc-spot-card
  device: SPOT 3
  entity: light.spot_3      # surcharge du light principal
  show_channels: true       # sliders 16 canaux dans le panneau dépliable (défaut: true)

# Carte groupe
- type: custom:phs16lc-group-card
  device: Groupe serre 1    # device (identifiers: (phs16lc, "group_<id>"))
  group_id: serre_1_nord    # pour les appels service address="group:<id>" (save, ...)
```

La carte s'utilise ensuite comme n'importe quelle carte Lovelace, et apparaît dans
le sélecteur de cartes (« personnalisée ») via `window.customCards`.

## 2. Données disponibles (backend existant — aucun changement requis en v1)

Par device SPOT (`identifiers = (phs16lc, "spot_<n>")`), résolution par
`device_id` + domaine (+ `translation_key` quand dispo) :

| Donnée | Entité / attribut | Service / action carte |
|---|---|---|
| On/off, luminosité (mA max) | `light` (entité principale du device) | `light.turn_on/off`, `light.turn_on(brightness=)` |
| 16 courants canal par canal | `sensor.*_currents`, attribut `channels` | `phs16lc.set_channel(address, channel, ma)` |
| Températures CPU / LED1 / LED2 | 3 × `sensor` (`temp_cpu`, `temp_led1`, `temp_led2`) | — (affichage) |
| En ligne | `binary_sensor` (`spot_online`) | — (affichage) |
| Recette courante / applicable | `select` (`recipe`) | `select.select_option` → `phs16lc.apply_recipe` |
| Groupe de canaux de la recette | `select` (`group`) | `select.select_option` (application partielle) |
| Sauvegarder NVM (@WP) | `button` (`save_nvm`) | `button.press` → `phs16lc.save` |
| Scan ligne (hub) | `button` (`scan`, device hub) | `phs16lc.scan` |

Carte groupe : `light` du device groupe (on/off + luminosité agrégée),
`select` recette du groupe. Les services acceptent `address: "group:<id>"`
(`phs16lc.save`, `phs16lc.apply_recipe`, …) — d'où le `group_id` dans la config.

Petite extension backend **optionnelle** (peut être faite en v1.5.3 de
l'intégration, indépendante de la carte) : attribut `members` (adresses + état
online) sur `GroupLight`, pour afficher le nombre de membres en ligne sur la
carte groupe sans config explicite.

## 3. Stack technique (per https://contributors.home-assistant.io/frontend/custom-ui/)

- **JS vanilla, sans étape de build** : custom element enregistré via
  `customElements.define("phs16lc-spot-card", ...)`, utilisé en
  `type: custom:phs16lc-spot-card`. Contrat : `setConfig(config)` (lever une
  erreur si config invalide) + propriété `hass` (objet complet, nouvelle
  référence à chaque changement).
- **Ne dépendre d'aucun composant interne `ha-*`** (aucun contrat de stabilité,
  ils peuvent changer à chaque release) — seule exception tolérée en pratique :
  le conteneur `<ha-card>` (variables de thème `--ha-card-background`,
  `--ha-card-border-radius`). Wrapper la carte dans `<ha-card>` et styler avec
  les **variables de thème** (`--card-background-color`, `--primary-text-color`,
  …) pour suivre clair/sombre automatiquement.
- Si Lit devient nécessaire : **le bundler soi-même** dans le module — le
  frontend ne garantit pas d'importmap public pour `lit`.
- `window.customCards.push({ type, name, description, preview })` pour le
  sélecteur de cartes ; `getConfigElement()` / `getStubConfig()` pour un éditeur
  visuel (optionnel).
- Les **card helpers** (dialogues built-in, ex. more-info) sont chargés exprès
  pour les cartes custom : `import { createCardElement } from ".../card helpers"`
  — utiliser `fireEvent` + `more-info` via les helpers officiels plutôt que de
  réinventer.
- i18n : dictionnaire `{ fr: {...}, en: {...} }`, langue = `hass.locale.language`.
- Harnais de test statique `test/index.html` avec un objet `hass` mocké pour
  itérer vite sans instance HA.

## 4. Dépôt & distribution (Marketplace HA 2026.11+, plus de HACS)

- Dépôt GitHub dédié `phs16lc-card` (public, ou privé via la connexion GitHub
  comme `phs16lc-ha`), servi à la racine par subtree :
  `git subtree push --prefix=ha-card card-dist master`.
- Structure exigée (doc `repository-structure`) pour un « dashboard plugin » :
  - `hacs.json` à la racine : `{ "name": "PHS16-LC Card",
    "filename": "phs16lc-card.js", "homeassistant": "2026.11.0" }`
    (`homeassistant` = version min HA ; `filename` utile si le JS ne s'appelle
    pas comme le dépôt).
  - `README.md` à la racine ; le Marketplace en affiche le contenu — encadrer
    les sections « GitHub only » de `<!-- ha-marketplace:exclude-start -->` /
    `<!-- ha-marketplace:exclude-end -->`.
  - `dist/phs16lc-card.js` : le JS doit être nommé d'après le dépôt
    (`<name>.js`, `<name>.umd.js`, `<name>-bundle.js`, préfixe `lovelace-`
    retiré aussi essayé), présent dans `dist/`, à la racine, ou attaché à la
    **release** (recommandé ; la version servie = tag de release `vX.Y.Z`).
- Installation : Réglages → Marketplace → « Dépôts personnalisés » → lien du
  dépôt GitHub → install. Le fichier est copié dans
  `www/community/phs16lc-card/` et la **ressource de dashboard est ajoutée
  automatiquement** (rechargement du navigateur proposé). Ressource servie sous
  `/local/community/phs16lc-card/phs16lc-card.js` (les anciens chemins
  `/hacsfiles/...` continuent de fonctionner).
- Sans Marketplace (manuel) : copier le JS dans `/config/www/` + ressource
  « module » dans Réglages → Tableaux de bord → Ressources.
- Mises à jour : via le Marketplace (entité update du dépôt), version = release.

## 5. Phases

| Phase | Livrable | Détail |
|---|---|---|
| P0 | Repo + squelette | `hacs.json`, `dist/phs16lc-card.js` squelette, README, `test/index.html` (hass mocké), carte minimale qui rend nom + état du light, `setConfig` device/entity, `window.customCards` |
| P1 | Carte SPOT compacte | `<ha-card>`, icône état (on/off/indisponible/hors ligne), nom, tap → more-info, recette courante, moyenne temp LED (max en tooltip), bouton on/off |
| P2 | Panneau dépliable SPOT | Slider luminosité globale (`light.turn_on brightness`), 16 sliders canal (`phs16lc.set_channel`, 0–2150 mA, <74 = off), 3 températures, selects recette + groupe de canaux, bouton « Sauvegarder NVM » |
| P3 | Carte groupe | Compact : état agrégé, recette, luminosité, membres online (si attribut `members` dispo, sinon via config) ; dépliable : actions collectives (on/off, recette, save `group:<id>`) |
| P4 | i18n + polish | fr/en selon `hass.locale.language`, thèmes clair/sombre (variables), états `unavailable`/`offline`, icônes mdi cohérents |
| P5 | Docs + release v1.0.0 | README (install Marketplace + manuel, config, captures), première release taguée `v1.0.0`, test sur instance HA réelle (dashboard de dev) + subtree push |

## 6. Vérification / critères d'acceptation

- La carte s'ajoute en UI (« Carte personnalisée ») et en YAML (`custom:phs16lc-spot-card`).
- Sur une instance HA de test avec l'intégration phs16lc : état, recette et
  températures corrects ; chaque action (toggle, luminosité, canal, recette,
  save NVM) reflète le changement d'état réel du luminaire (polling coordinator).
- Config `device:` insensible au renommage des entités ; `entity:` prioritaire si fourni.
- fr quand HA est en français, en sinon.
- Install Marketplace : ressource ajoutée automatiquement, carte dispo sans
  toucher aux ressources ; install manuelle documentée et testée.
- Carte utilisable dans les dashboards « Culture » existants à la place des
  `tile`/`entities` par SPOT.

## 7. Risques & mitigations

| Risque | Mitigation |
|---|---|
| Cache navigateur sur le JS | Le Marketplace gère le versioning par release ; doc « vider le cache / hard refresh » si besoin |
| Dépendance à un composant `ha-*` interne | Interdit par la doc custom-ui : wrapper `<ha-card>` seul toléré, thème via variables CSS, helpers officiels pour les dialogues |
| `translation_key` absent du registry frontend | Fallback : matching par domaine + suffixe d'entity_id ; à valider contre HA 2026.11 en P0 |
| Renommage d'entités par l'utilisateur | Config par `device:` (registry), pas par entity_id |
| Deux versions carte/intégration incompatibles | Carte lit uniquement des entités/services stables ; `group_id` explicite pour la carte groupe |
