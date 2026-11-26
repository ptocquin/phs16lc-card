# PHS16-LC Card — carte Lovelace custom pour les luminaires PHS16-LC

> **v1.2.3 — 2026-11-26** : vue dépliée
> de la carte SPOT — sous les températures CPU/LED, affichage **compact** des
> paramètres ventilateur lus par l'intégration (`@GF`, attributs `fan_low_temp` /
> `fan_high_temp` / `fan_min_duty` de la lampe, phs16-lc seul) :
> « Vi 40° · Vmax 60° · Vduty 30% » (détail complet en tooltip). Affichage seul —
> la reprogrammation (`@SF`) reste réservée au service `phs16lc.set_fan_settings`
> (action rare, pas de contrôle dans la carte). Le % du slider de luminosité
> passe aussi en compact « x % » (il dépassait de la carte en « x % de la recette »).
> **v1.2.2 — 2026-11-25** : en vue 16 canaux, l'étiquette devant chaque slider
> inclut le **type de LED** : `01_WH`, `03_FR`… (canal sur 2 chiffres + type, ex.
> `led_types`) au lieu de `C1` ; sans `led_types` (vieux backend), `C1` conservé.
> **v1.2.1 — 2026-11-25** : fix affichage — les sliders (par type de LED comme les
> 16 canaux) passent en **une seule colonne** ; la grille 2 colonnes dépassait de la
> carte vers la droite.
> **v1.2.0 — 2026-11-25** : panneau déplié = **un slider par type de LED**
> (RE/WH/FR/BL) quand l'intégration expose l'attribut `led_types` (backend D25,
> spec `led_spec.json`) : chaque slider règle **tous les canaux du type** en même
> temps (via `phs16lc.set_channels`, vecteur complet) et est borné au max LED du
> type ; les canaux couverts sont en tooltip. Sans `led_types` (ou
> `show_channels: "channels"`), repli sur les 16 sliders canal bornés au `led_max`.
> **v1.1.0 — 2026-11-24** : adaptation au backend D23/D24 — le slider luminosité
> est un **variateur de la recette active** (affiché en % de la recette, désactivé
> tant qu'aucune recette n'est choisie) et les 16 sliders canal sont **bornés au
> courant max LED de chaque canal** (attribut `led_max` exposé par l'intégration ;
> le clamp reste appliqué côté serveur de toute façon). Détection automatique :
> attribut `led_max` présent = nouveau mode, absent = ancien affichage (~mA).
> **v1.0.0 — 2026-11-22** : première release. Carte SPOT (`custom:phs16lc-spot-card`) :
> état, en ligne, recette, températures, panneau dépliable (luminosité, 16 canaux,
> enregistrer/supprimer une recette, save NVM). Carte groupe (`custom:phs16lc-group-card`) :
> recette de groupe, membres (ajout/retrait via `phs16lc.set_group`), save NVM collectif.
> Nécessite l'intégration **phs16lc >= 1.5.3** pour la liste des membres fiable
> (attribut `members`) ; sinon repli sur les labels.

Carte compacte pour les luminaires **PHS16-LC** (intégration Home Assistant
`phs16lc`) : état, recette courante, températures, luminosité, courants des
16 canaux et actions rapides (on/off, recette, « Sauvegarder NVM »), pour un
SPOT individuel ou un groupe de luminaires.

<!-- ha-marketplace:exclude-start -->
## Installation via le Marketplace (recommandé, HA 2026.11+)

1. Créer le dépôt GitHub `phs16lc-card` à partir de ce sous-répertoire
   (`git subtree push --prefix=ha-card card-dist master`, remote `card-dist`).
2. Dans Home Assistant : **Réglages → Marketplace → Dépôts personnalisés →
   « Ajouter depuis un lien »**, coller l'URL du dépôt GitHub.
3. Ouvrir le dépôt dans le Marketplace et l'installer : le fichier
   `dist/phs16lc-card.js` est copié dans `www/community/phs16lc-card/` et la
   ressource de dashboard est **ajoutée automatiquement** (un rechargement du
   navigateur est proposé).
<!-- ha-marketplace:exclude-end -->

## Installation manuelle (sans Marketplace)

1. Copier `dist/phs16lc-card.js` dans `/config/www/phs16lc-card.js`.
2. **Réglages → Tableaux de bord → Ressources** (ou « … » en haut à droite de
   n'importe quel dashboard) : ajouter une ressource de type **Module** avec
   l'URL `/local/phs16lc-card.js`.

## Utilisation

```yaml
# Carte d'un SPOT (résolution auto des entités via le device registry)
- type: custom:phs16lc-spot-card
  device: SPOT 3

# Carte d'un groupe de luminaires (device « Groupe <name> » de l'intégration)
- type: custom:phs16lc-group-card
  device: Groupe serre 1
  group_id: serre_1_nord   # pour les appels service address="group:<id>"
```

La carte suit la langue de Home Assistant (français / anglais).

### Luminosité et canaux (backend phs16lc récent, D23/D24)

- Le **slider « Luminosité » dimme la recette active** : il envoie
  `light.turn_on(brightness=…)` que l'intégration applique canal par canal en
  conservant les rapports de la recette (jamais un courant uniforme). La valeur
  affichée est le **% de la recette**. Sans recette choisie, le slider est
  désactivé (l'intégration renverrait sinon une erreur explicite).
- Backend avec attribut `led_types` (D25) : la section affiche **un slider par
  type de LED** (RE/WH/FR/BL), borné au max LED du type (ex. 1000 mA pour FR) ;
  déplacer le slider applique la valeur à **tous les canaux de ce type** en même
  temps (tooltip = canaux concernés, ex. « canaux C1, C4, C7, C11, C13, C16 »).
- Backend avec `led_max` seul (D24) : les **16 sliders canal** sont bornés au max
  LED du canal : on ne peut pas régler au-delà depuis la carte — et de toute
  façon tout courant envoyé est clampé côté serveur.
- Ancien backend (sans attribut `led_max`) : la carte retombe sur l'affichage
  historique `brightness/255 (~mA)` et sliders canal 0–2150 mA.
- Option de config `show_channels` : `true` (défaut, auto : types si `led_types`
  exposé, sinon canaux) · `"types"` / `"channels"` pour forcer · `false` pour
  masquer la section.

## Tester sur l'instance HA de dev (macOS)

1. Copier le JS dans le `www/` de dev (servi sans auth sur `/local/`) :
   `cp ha-card/dist/phs16lc-card.js ~/.hass_dev/www/phs16lc-card.js`
   (vérifié : `curl -s -o /dev/null -w "%{http_code}" http://localhost:8123/local/phs16lc-card.js` → 200).
2. Dans HA : tableau de bord → menu ⋮ (haut droite) → **Ressources** → ajouter une
   ressource de type **Module**, URL `/local/phs16lc-card.js`.
3. Ajouter une carte de test (elle apparaît aussi dans le sélecteur « Personnalisée »
   sous « PHS16-LC — SPOT ») :
   ```yaml
   type: custom:phs16lc-spot-card
   device: SPOT 1
   ```
4. **Cmd+Shift+R** après chaque mise à jour du fichier JS (cache navigateur). Si le
   cache résiste, ajouter un paramètre de version à l'URL de la ressource
   (`/local/phs16lc-card.js?v=2026-11-22-p3`) : l'URL change force le rechargement.
5. Si le lien série est mort (erreurs `termios.error: (6, 'Device not configured')`
   dans le log : pty d'un ancien `fake_spot` fermé), relancer le simulateur :
   ```
   cd ha-integration
   .venv-ha/bin/python ../light-monitor/tools/fake_spot.py --boards 3 --channels 16 --duration 86400 > /tmp/phs_port_new.txt 2>/tmp/fake_spot.log &
   sleep 1 && cat /tmp/phs_port_new.txt
   ```
   puis Réglages → Appareils et services → PHS16-LC → ⋮ → **Configurer** → Port = ce
   pty → **Recharger** l'entrée. Les trames reçues par le faux SPOT sont dans
   `/tmp/fake_spot.log` (vérifier `@SP` au slider canal, `@WP` au bouton NVM).

## Développement

Voir `PLAN.md` (phases P0–P5). JS vanilla sans build, testable hors HA via
`test/index.html` (objet `hass` mocké).

L'intégration `phs16lc` (obligatoire pour que la carte ait des données) :
voir le dépôt `phs16lc-ha` / le Marketplace.
