# PHS16-LC Card — carte Lovelace custom pour les luminaires PHS16-LC

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
4. **Cmd+Shift+R** après chaque mise à jour du fichier JS (cache navigateur).
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
