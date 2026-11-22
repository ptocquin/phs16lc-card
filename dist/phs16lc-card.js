// Carte Lovelace custom PHS16-LC — phase P0 : carte SPOT minimale (nom + état).
// Dev : JS vanilla sans étape de build. Contrat custom card : setConfig() + propriété `hass`.
// Doc : https://contributors.home-assistant.io/frontend/custom-ui/

const I18N = {
  fr: {
    on: "Allumé",
    off: "Éteint",
    unavailable: "Indisponible",
    unknown: "Inconnu",
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

class Phs16lcSpotCard extends HTMLElement {
  constructor() {
    super();
    this._config = null;
    this._hass = null;
    this._device = null;
    this._lightEntity = null;
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
    this._lightEntity = null; // re-résolution au prochain `hass`
  }

  set hass(hass) {
    this._hass = hass;
    this._resolve();
    this._render();
  }

  // Résout le light du device (config `device:`) ou prend `entity:` tel quel.
  _resolve() {
    const hass = this._hass;
    this._error = null;
    this._device = null;
    this._lightEntity = this._config.entity || null;
    if (!this._lightEntity && this._config.device) {
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
      const lights = Object.values(hass.entities || {}).filter(
        (e) => e.device_id === device.id && e.entity_id.startsWith("light.")
      );
      if (!lights.length) {
        this._error = _t(hass, "entityNotFound") + " (light.*) : " + this._config.device;
        return;
      }
      this._lightEntity = lights[0].entity_id;
    }
    if (this._lightEntity && !(hass.states && hass.states[this._lightEntity])) {
      this._error = _t(hass, "entityNotFound") + " : " + this._lightEntity;
    }
  }

  _moreInfo() {
    if (!this._lightEntity) return;
    this.dispatchEvent(
      new CustomEvent("hass-more-info", {
        detail: { entityId: this._lightEntity },
        bubbles: true,
        composed: true,
      })
    );
  }

  _render() {
    if (!this._hass || !this._config) return;
    const hass = this._hass;
    const stateObj = this._lightEntity ? hass.states[this._lightEntity] : null;
    const name =
      (stateObj && stateObj.attributes && stateObj.attributes.friendly_name) ||
      (this._device && (this._device.name_by_user || this._device.name)) ||
      this._lightEntity ||
      "PHS16-LC";

    const card = document.createElement("ha-card");
    card.style.padding = "12px 16px";
    card.style.cursor = "pointer";
    card.addEventListener("click", () => this._moreInfo());

    if (this._error || !stateObj) {
      const msg = document.createElement("div");
      msg.style.color = "var(--error-color, #db4437)";
      msg.textContent = this._error || _t(hass, "entityNotFound");
      card.appendChild(msg);
      this.replaceChildren(card);
      return;
    }

    const state = stateObj.state;
    const on = state === "on";
    const label =
      state === "on"
        ? _t(hass, "on")
        : state === "off"
          ? _t(hass, "off")
          : state === "unavailable"
            ? _t(hass, "unavailable")
            : _t(hass, "unknown");
    const iconColor = on
      ? "var(--state-light-active-color, #ffc107)"
      : "var(--disabled-text-color, #9e9e9e)";

    card.innerHTML = `
      <div style="display:flex; align-items:center; gap:12px;">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="${iconColor}" aria-hidden="true">
          <path d="${MDI_LIGHTBULB}"/>
        </svg>
        <div style="flex:1; min-width:0;">
          <div class="phs-name" style="font-weight:500; color:var(--primary-text-color); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"></div>
          <div class="phs-sub" style="font-size:12px; color:var(--secondary-text-color);"></div>
        </div>
        <div class="phs-state" style="font-size:13px; color:var(--secondary-text-color);"></div>
      </div>`;
    card.querySelector(".phs-name").textContent = name;
    card.querySelector(".phs-sub").textContent = this._lightEntity;
    card.querySelector(".phs-state").textContent = label;
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
