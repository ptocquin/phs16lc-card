// Smoke test node de dist/phs16lc-card.js : DOM stubé, hass mocké (backend D23/D24/D25).
// Lancer depuis ha-card/ : `node test/smoke-card.js` (exit 0 si OK).
// Vérifie : enregistrement des custom elements, rendu carte SPOT (slider variateur en %,
// sliders PAR TYPE DE LED bornés au led_max du type quand `led_types` est exposé (D25),
// repli sur les 16 sliders canal sinon, slider désactivé sans recette) et carte groupe
// (puce % de la recette via le led_max d'un membre).

const path = require("path");

const registry = new Map();
globalThis.window = globalThis;
globalThis.customElements = {
  define: (name, cls) => registry.set(name, cls),
  get: (n) => registry.get(n),
};
globalThis.HTMLElement = class {
  constructor() {
    this._children = null;
  }
  replaceChildren(n) {
    this._children = n;
  }
  dispatchEvent() {}
};
globalThis.CustomEvent = class {
  constructor(type, opts) {
    this.type = type;
    this.detail = opts && opts.detail;
  }
};

function el() {
  const cache = new Map();
  return {
    style: {},
    dataset: {},
    value: "200",
    textContent: "",
    innerHTML: "",
    addEventListener() {},
    appendChild() {},
    setAttribute() {},
    querySelector(sel) {
      if (!cache.has(sel)) cache.set(sel, el());
      return cache.get(sel);
    },
    querySelectorAll() {
      return [];
    },
    _cache: cache,
  };
}
let lastCreated = null;
globalThis.document = { createElement: () => (lastCreated = el()) };

require(path.join(__dirname, "..", "dist", "phs16lc-card.js"));

const LED_MAX = [1400, 1800, 1000, 1400, 1000, 1800, 1400, 2000, 1000, 1800, 1400, 2000, 1400, 1800, 1000, 1400];
const LED_TYPES = ["RE", "WH", "FR", "RE", "FR", "WH", "RE", "BL", "FR", "WH", "RE", "BL", "RE", "WH", "FR", "RE"];
const E = (entity_id, device_id, translation_key) => ({
  entity_id,
  device_id,
  platform: "phs16lc",
  translation_key,
});

const hass = {
  locale: { language: "fr" },
  devices: {
    dev_spot3: { id: "dev_spot3", name: "SPOT 3", name_by_user: null, labels: [] },
    dev_g1: { id: "dev_g1", name: "serre_1_nord", name_by_user: null, labels: ["serre_1_nord"] },
  },
  entities: {
    "light.spot_3": E("light.spot_3", "dev_spot3", null),
    "binary_sensor.spot_3_online": E("binary_sensor.spot_3_online", "dev_spot3", "spot_online"),
    "sensor.spot_3_courants": E("sensor.spot_3_courants", "dev_spot3", "currents"),
    "select.spot_3_recette": E("select.spot_3_recette", "dev_spot3", "recipe"),
    "button.spot_3_sauvegarder_nvm": E("button.spot_3_sauvegarder_nvm", "dev_spot3", "save_nvm"),
    "light.serre_1_nord": E("light.serre_1_nord", "dev_g1", null),
    "select.serre_1_nord_recette": E("select.serre_1_nord_recette", "dev_g1", "recipe"),
  },
  states: {
    "light.spot_3": {
      entity_id: "light.spot_3",
      state: "on",
      attributes: {
        friendly_name: "SPOT 3",
        brightness: 200,
        recette: "floraison.json",
        led_max: LED_MAX,
        led_types: LED_TYPES,
        channels_ma: Array(16).fill(800),
      },
    },
    "binary_sensor.spot_3_online": { entity_id: "binary_sensor.spot_3_online", state: "on", attributes: {} },
    "sensor.spot_3_courants": {
      entity_id: "sensor.spot_3_courants",
      state: "800x16",
      attributes: { channels: Array(16).fill(800) },
    },
    "select.spot_3_recette": {
      entity_id: "select.spot_3_recette",
      state: "floraison.json",
      attributes: { options: ["croissance.json", "floraison.json"] },
    },
    "light.serre_1_nord": {
      entity_id: "light.serre_1_nord",
      state: "on",
      attributes: { friendly_name: "serre_1_nord", brightness: 180, members: [3] },
    },
    "select.serre_1_nord_recette": {
      entity_id: "select.serre_1_nord_recette",
      state: "floraison.json",
      attributes: { options: ["croissance.json", "floraison.json"] },
    },
  },
  callService() {},
};

let failures = 0;
const check = (label, cond) => {
  console.log((cond ? "PASS" : "FAIL") + "  " + label);
  if (!cond) failures++;
};

// --- carte SPOT ---
const SpotCard = registry.get("phs16lc-spot-card");
check("custom element phs16lc-spot-card enregistré", !!SpotCard);
const card = new SpotCard();
card.setConfig({ device: "SPOT 3" });
card.hass = hass;
card._expanded = true;
card._render(true);
const cardEl = lastCreated;
const details = cardEl.querySelector(".phs-details");
const html = details.innerHTML;
check("slider brightness présent", html.includes('class="phs-brightness"'));
const bVal = details._cache.get(".phs-brightness-val");
check("valeur slider = % de la recette (200/255 -> 78 %)", bVal && bVal.textContent === "78 % de la recette");
check("section « Types de LED » (D25)", html.includes("Types de LED"));
check("4 sliders par type de LED (RE/WH/FR/BL)", (html.match(/class="phs-channel" data-type=/g) || []).length === 4);
check("pas de slider canal individuel en mode types", !html.includes("data-idx="));
check("slider FR borné à 1000 mA", html.includes('data-type="FR" type="range" min="0" max="1000"'));
check("slider RE borné à 1400 mA", html.includes('data-type="RE" type="range" min="0" max="1400"'));
check("slider WH borné à 1800 mA", html.includes('data-type="WH" type="range" min="0" max="1800"'));
check("slider BL borné à 2000 mA", html.includes('data-type="BL" type="range" min="0" max="2000"'));
check("tooltip RE = canaux C1, C4, C7, C11, C13, C16", html.includes("canaux C1, C4, C7, C11, C13, C16"));
check("sliders en UNE seule colonne (v1.2.1, plus de dépassement)", html.includes("grid-template-columns:1fr;") && !html.includes("grid-template-columns:1fr 1fr"));
check("slider actif (recette choisie)", !html.includes('value="200" disabled'));

// ancien backend (led_max sans led_types) -> repli sur les 16 sliders canal
const hass3 = JSON.parse(JSON.stringify(hass));
delete hass3.states["light.spot_3"].attributes.led_types;
const card3 = new SpotCard();
card3.setConfig({ device: "SPOT 3" });
card3.hass = hass3;
card3._expanded = true;
card3._render(true);
const html3 = lastCreated.querySelector(".phs-details").innerHTML;
check("sans led_types : section « Canaux » + 16 sliders canal", html3.includes("Canaux (mA)") && (html3.match(/class="phs-channel" data-idx=/g) || []).length === 16);
check("repli : slider canal 3 (FR) borné à 1000 mA", html3.includes('data-idx="2" type="range" min="0" max="1000"'));
check("repli : slider canal 8 (BL) borné à 2000 mA", html3.includes('data-idx="7" type="range" min="0" max="2000"'));
check("repli canaux : aussi une seule colonne", html3.includes("grid-template-columns:1fr;") && !html3.includes("grid-template-columns:1fr 1fr"));

// show_channels: "channels" force la vue canal même avec led_types
const card3b = new SpotCard();
card3b.setConfig({ device: "SPOT 3", show_channels: "channels" });
card3b.hass = hass;
card3b._expanded = true;
card3b._render(true);
const html3b = lastCreated.querySelector(".phs-details").innerHTML;
check('show_channels: "channels" force les 16 sliders canal', (html3b.match(/class="phs-channel" data-idx=/g) || []).length === 16 && !html3b.includes("data-type="));

// sans recette -> slider variateur désactivé
const hass2 = JSON.parse(JSON.stringify(hass));
delete hass2.states["light.spot_3"].attributes.recette;
const card2 = new SpotCard();
card2.setConfig({ device: "SPOT 3" });
card2.hass = hass2;
card2._expanded = true;
card2._render(true);
const html2 = lastCreated.querySelector(".phs-details").innerHTML;
check("sans recette : slider désactivé + hint", html2.includes("disabled") && html2.includes("recette active"));

// --- carte groupe ---
const GroupCard = registry.get("phs16lc-group-card");
check("custom element phs16lc-group-card enregistré", !!GroupCard);
const gcard = new GroupCard();
gcard.setConfig({ group_id: "serre_1_nord" });
gcard.hass = hass;
gcard._expanded = true;
gcard._render(true);
const gHtml = lastCreated.innerHTML;
check("puce groupe = % de la recette (180/255 -> 71 %)", gHtml.includes("71 % de la recette"));
const gDetails = lastCreated.querySelector(".phs-details");
check(
  "slider groupe présent et actif (recette du groupe choisie)",
  gDetails.innerHTML.includes('class="phs-brightness"') && !gDetails.innerHTML.includes('value="180" disabled')
);

check("CARD_VERSION = 1.2.1", window.__phs16lcCardVersion === "1.2.1");

console.log(failures === 0 ? "SMOKE OK" : `SMOKE KO (${failures} échecs)`);
process.exit(failures === 0 ? 0 : 1);
