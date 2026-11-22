// Carte Lovelace custom PHS16-LC — phase P1 : carte SPOT compacte.
// Dev : JS vanilla sans étape de build. Contrat custom card : setConfig() + propriété `hass`.
// Doc : https://contributors.home-assistant.io/frontend/custom-ui/
//
// Config :
//   type: custom:phs16lc-spot-card
//   device: SPOT 3        # résolution auto des entités via le device registry
//   entity: light.spot_3  # (optionnel) surcharge du light principal

const I18N = {
  fr: {
    on: "Allumé",
    off: "Éteint",
    unavailable: "Indisponible",
    unknown: "Inconnu",
    online: "En ligne",
    offline: "Hors ligne",
    recipe: "Recette",
    noRecipe: "Aucune recette",
    ledTemp: "LED",
    max: "max",
    powerOn: "Allumer",
    powerOff: "Éteindre",
    configError:
      'Config invalide : fournir `device:` (ex. "SPOT 3") ou `entity:` (ex. "light.spot_3").',
    deviceNotFound: "Device introuvable",
    entityNotFound: "Entité introuvable",
  },
  en: {
    on: "On",
    off: "Off",
    unavailable: "Unavailable",
    unknown: "Unknown",
    online: "Online",
    offline: "Offline",
    recipe: "Recipe",
    noRecipe: "No recipe",
    ledTemp: "LED",
    max: "max",
    powerOn: "Turn on",
    powerOff: "Turn off",
    configError:
      'Invalid config: provide `device:` (e.g. "SPOT 3") or `entity:` (e.g. "light.spot_3").',
    deviceNotFound: "Device not found",
    entityNotFound: "Entity not found",
  },
};

function _t(hass, key) {
  const lang = (hass && hass.locale && hass.locale.language) || "en";
  const pack = I18N[lang] || I18N.en;
  return pack[key] || I18N.en[key] || key;
}

const MDI_LIGHTBULB =
  "M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2V17h6v-.3c0-.8.4-1.5 1-2A7 7 0 0 0 12 2zM9 21h6v1a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-1z";
const MDI_POWER =
  "M13 3h-2v10h2V3zm4.83 2.17-1.42 1.42A6.99 6.99 0 0 1 19 12a7 7 0 1 1-14 0c0-2.05.9-3.9 2.59-5.41L6.17 5.17A8.93 8.93 0 0 0 3 12a9 9 0 1 0 18 0 8.93 8.93 0 0 0-3.17-6.83z";

// Choisit une entité dans une liste (même device + domaine) : par translation_key,
// sinon par suffixe de unique_id (`..._<key>`), sinon par indice dans l'entity_id.
function _pick(list, translationKey, idHint) {
  if (!list || !list.length) return null;
  let e = list.find((x) => x.translation_key === translationKey);
  if (!e && translationKey) e = list.find((x) => (x.unique_id || "").endsWith("_" + translationKey));
  if (!e && idHint) e = list.find((x) => x.entity_id.includes(idHint));
  return e ? e.entity_id : null;
}

class Phs16lcSpotCard extends HTMLElement {
  constructor() {
    super();
    this._config = null;
    this._hass = null;
    this._device = null;
    this._ents = {}; // entity_id par rôle : light, online, tempCpu, tempLed1, tempLed2, currents, recipe, group, saveNvm
    this._error = null;
  }

  static getStubConfig() {
    return { device: "SPOT 1" };
  }

  getCardSize() {
    return 2;
  }

  setConfig(config) {
    if (!config || (!config.device && !config.entity)) {
      throw new Error(I18N.fr.configError + " / " + I18N.en.configError);
    }
    this._config = config;
    this._ents = {}; // re-résolution au prochain `hass`
  }

  set hass(hass) {
    this._hass = hass;
    this._resolve();
    this._render();
  }

  // Résout toutes les entités phs16lc du device (config `device:`), ou seulement
  // le light si `entity:` est fourni (les autres rôles restent vides).
  _resolve() {
    const hass = this._hass;
    this._error = null;
    this._device = null;
    this._ents = {};
    if (this._config.entity) {
      this._ents.light = this._config.entity;
      if (!(hass.states && hass.states[this._config.entity])) {
        this._error = _t(hass, "entityNotFound") + " : " + this._config.entity;
      }
      return;
    }
    const wanted = String(this._config.device).toLowerCase();
    const device = Object.values(hass.devices || {}).find(
      (d) =>
        d.id === this._config.device ||
        (d.name && d.name.toLowerCase() === wanted) ||
        (d.name_by_user && d.name_by_user.toLowerCase() === wanted)
    );
    if (!device) {
      this._error = _t(hass, "deviceNotFound") + " : " + this._config.device;
      return;
    }
    this._device = device;
    const mine = Object.values(hass.entities || {}).filter((e) => e.device_id === device.id);
    const byDomain = (domain) => mine.filter((e) => e.entity_id.startsWith(domain + "."));
    this._ents.light = _pick(byDomain("light"), null, null);
    this._ents.online = _pick(byDomain("binary_sensor"), "spot_online", "online");
    this._ents.tempCpu = _pick(byDomain("sensor"), "temp_cpu", "cpu");
    this._ents.tempLed1 = _pick(byDomain("sensor"), "temp_led1", "led1");
    this._ents.tempLed2 = _pick(byDomain("sensor"), "temp_led2", "led2");
    this._ents.currents = _pick(byDomain("sensor"), "currents", "currents");
    this._ents.recipe = _pick(byDomain("select"), "recipe", "recipe");
    this._ents.group = _pick(byDomain("select"), "group", "group");
    this._ents.saveNvm = _pick(byDomain("button"), "save_nvm", "save");
    if (!this._ents.light) {
      this._error = _t(hass, "entityNotFound") + " (light.*) : " + this._config.device;
    }
  }

  _state(role) {
    const id = this._ents[role];
    return id && this._hass.states ? this._hass.states[id] : null;
  }

  _toggle() {
    const light = this._state("light");
    if (!light) return;
    const on = light.state === "on";
    this._hass.callService("light", on ? "turn_off" : "turn_on", {
      entity_id: this._ents.light,
    });
  }

  _moreInfo() {
    if (!this._ents.light) return;
    this.dispatchEvent(
      new CustomEvent("hass-more-info", {
        detail: { entityId: this._ents.light },
        bubbles: true,
        composed: true,
      })
    );
  }

  _render() {
    if (!this._hass || !this._config) return;
    const hass = this._hass;
    const light = this._state("light");
    const name =
      (light && light.attributes && light.attributes.friendly_name) ||
      (this._device && (this._device.name_by_user || this._device.name)) ||
      this._ents.light ||
      "PHS16-LC";

    const card = document.createElement("ha-card");
    card.style.padding = "12px 16px";
    card.addEventListener("click", () => this._moreInfo());

    if (this._error || !light) {
      const msg = document.createElement("div");
      msg.style.color = "var(--error-color, #db4437)";
      msg.textContent = this._error || _t(hass, "entityNotFound");
      card.appendChild(msg);
      this.replaceChildren(card);
      return;
    }

    const on = light.state === "on";
    const stateLabel =
      light.state === "on"
        ? _t(hass, "on")
        : light.state === "off"
          ? _t(hass, "off")
          : light.state === "unavailable"
            ? _t(hass, "unavailable")
            : _t(hass, "unknown");
    const iconColor = on
      ? "var(--state-light-active-color, #ffc107)"
      : "var(--disabled-text-color, #9e9e9e)";

    // Puce en ligne / hors ligne.
    const online = this._state("online");
    const isOnline = !online || online.state === "on"; // pas de binary_sensor => on ignore
    const onlineChip = online
      ? `<span class="phs-chip" style="color:${isOnline ? "var(--success-color, #4caf50)" : "var(--error-color, #db4437)"}">● ${isOnline ? _t(hass, "online") : _t(hass, "offline")}</span>`
      : "";

    // Recette courante (état du select).
    const recipe = this._state("recipe");
    const recipeChip = `<span class="phs-chip">${_t(hass, "recipe")} : ${recipe && recipe.state && recipe.state !== "unknown" ? recipe.state : _t(hass, "noRecipe")}</span>`;

    // Moyenne des températures LED 1/2 (max en tooltip).
    const t1 = parseFloat(this._state("tempLed1") && this._state("tempLed1").state);
    const t2 = parseFloat(this._state("tempLed2") && this._state("tempLed2").state);
    const temps = [t1, t2].filter((v) => !Number.isNaN(v));
    const lang = (hass.locale && hass.locale.language) || "en";
    let tempChip = "";
    if (temps.length) {
      const avg = temps.reduce((a, b) => a + b, 0) / temps.length;
      const max = Math.max(...temps);
      tempChip = `<span class="phs-chip" title="${_t(hass, "max")} ${max.toLocaleString(lang)} °C">${avg.toLocaleString(lang, { maximumFractionDigits: 1 })} °C ${_t(hass, "ledTemp")}</span>`;
    }

    card.innerHTML = `
      <div style="display:flex; align-items:center; gap:12px;">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="${iconColor}" aria-hidden="true">
          <path d="${MDI_LIGHTBULB}"/>
        </svg>
        <div style="flex:1; min-width:0;">
          <div class="phs-name" style="font-weight:500; color:var(--primary-text-color); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"></div>
          <div style="font-size:12px; color:var(--secondary-text-color); display:flex; gap:10px; flex-wrap:wrap;">
            ${onlineChip}${recipeChip}${tempChip}
          </div>
        </div>
        <div style="text-align:right;">
          <div class="phs-state" style="font-size:13px; color:var(--secondary-text-color);">${stateLabel}</div>
          <button class="phs-power" title="${on ? _t(hass, "powerOff") : _t(hass, "powerOn")}"
            style="border:none; background:none; cursor:pointer; padding:4px; color:${iconColor};">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
              <path d="${MDI_POWER}"/>
            </svg>
          </button>
        </div>
      </div>`;
    card.querySelector(".phs-name").textContent = name;
    card.querySelector(".phs-power").addEventListener("click", (ev) => {
      ev.stopPropagation();
      this._toggle();
    });
    this.replaceChildren(card);
  }
}

customElements.define("phs16lc-spot-card", Phs16lcSpotCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "phs16lc-spot-card",
  name: "PHS16-LC — SPOT",
  description: "Carte compacte d'un luminaire PHS16-LC (intégration phs16lc).",
  preview: true,
});
