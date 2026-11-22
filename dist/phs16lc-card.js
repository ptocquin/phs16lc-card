// Carte Lovelace custom PHS16-LC — phase P2 : carte SPOT compacte + panneau dépliable.
// Dev : JS vanilla sans étape de build. Contrat custom card : setConfig() + propriété `hass`.
// Doc : https://contributors.home-assistant.io/frontend/custom-ui/
//
// Config :
//   type: custom:phs16lc-spot-card
//   device: SPOT 3            # résolution auto des entités via le device registry
//   entity: light.spot_3      # (optionnel) surcharge du light principal
//   show_channels: false      # (optionnel, défaut true) masque les 16 sliders canal

const I18N = {
  fr: {
    on: "Allumé",
    off: "Éteint",
    unavailable: "Indisponible",
    unknown: "Inconnu",
    online: "En ligne",
    offline: "Hors ligne",
    recipe: "Recette",
    group: "Groupe",
    noRecipe: "Aucune recette",
    ledTemp: "LED",
    max: "max",
    powerOn: "Allumer",
    powerOff: "Éteindre",
    expand: "Déplier",
    collapse: "Replier",
    brightness: "Luminosité",
    channels: "Canaux",
    channel: "Canal",
    ma: "mA",
    tempCpu: "CPU",
    save: "Sauvegarder NVM",
    saveAll: "Sauvegarder NVM (tout le groupe)",
    members: "membres",
    onlineCount: "{on}/{total} en ligne",
    needGroupId: "Config : ajouter `group_id:` pour la sauvegarde NVM du groupe",
    addMember: "Ajouter un luminaire",
    removeMember: "Retirer du groupe",
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
    group: "Group",
    noRecipe: "No recipe",
    ledTemp: "LED",
    max: "max",
    powerOn: "Turn on",
    powerOff: "Turn off",
    expand: "Expand",
    collapse: "Collapse",
    brightness: "Brightness",
    channels: "Channels",
    channel: "Channel",
    ma: "mA",
    tempCpu: "CPU",
    save: "Save NVM",
    saveAll: "Save NVM (whole group)",
    members: "members",
    onlineCount: "{on}/{total} online",
    needGroupId: "Config: add `group_id:` to save the group NVM",
    addMember: "Add a luminaire",
    removeMember: "Remove from group",
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
const MDI_CHEVRON_DOWN =
  "M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z";
const MDI_CLOSE =
  "M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z";

// Choisit une entité dans une liste (même device + domaine) : par translation_key,
// sinon par suffixe de unique_id (`..._<key>`), sinon par indice dans l'entity_id.
function _pick(list, translationKey, idHint) {
  if (!list || !list.length) return null;
  let e = list.find((x) => x.translation_key === translationKey);
  if (!e && translationKey) e = list.find((x) => (x.unique_id || "").endsWith("_" + translationKey));
  if (!e && idHint) e = list.find((x) => x.entity_id.includes(idHint));
  return e ? e.entity_id : null;
}

// Normalisation pour matcher un nom de device à l'aveugle : "Serre 1 Nord",
// "serre_1_nord" et "Serre 1 — Nord" donnent la même clé.
function _norm(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function _findDevice(hass, ref) {
  const want = _norm(ref);
  return Object.values(hass.devices || {}).find(
    (d) => d.id === ref || _norm(d.name) === want || _norm(d.name_by_user) === want
  );
}

function _deviceNames(hass) {
  return Object.values(hass.devices || {})
    .map((d) => d.name_by_user || d.name)
    .filter(Boolean)
    .join(", ");
}

class Phs16lcSpotCard extends HTMLElement {
  constructor() {
    super();
    this._config = null;
    this._hass = null;
    this._device = null;
    this._ents = {}; // entity_id par rôle : light, online, tempCpu, tempLed1, tempLed2, currents, recipe, group, saveNvm
    this._error = null;
    this._errorDetail = null;
    this._expanded = false;
    this._built = false;
    this._sig = "";
  }

  static getStubConfig() {
    return { device: "SPOT 1" };
  }

  getCardSize() {
    return this._expanded ? 6 : 2;
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
    this._errorDetail = null;
    this._device = null;
    this._ents = {};
    if (this._config.entity) {
      this._ents.light = this._config.entity;
      if (!(hass.states && hass.states[this._config.entity])) {
        this._error = _t(hass, "entityNotFound") + " : " + this._config.entity;
      }
      return;
    }
    // `device:` prioritaire, `group_id:` accepté comme repli (carte groupe).
    const ref = this._config.device || this._config.group_id;
    const device = _findDevice(hass, ref);
    if (!device) {
      this._error = _t(hass, "deviceNotFound") + " : " + ref;
      this._errorDetail = _deviceNames(hass);
      console.warn("[phs16lc-card] devices vus :", this._errorDetail);
      return;
    }
    this._device = device;
    const dname = device.name_by_user || device.name;
    const ents = Object.values(hass.entities || {});
    let mine = ents.filter((e) => e.device_id === device.id);
    // Repli : si le registry frontend n'expose pas device_id, retrouver les entités
    // du device par friendly_name (l'entité principale du device porte son nom).
    if (!mine.length) {
      mine = ents.filter((e) => {
        const s = hass.states && hass.states[e.entity_id];
        return s && s.attributes && s.attributes.friendly_name === dname;
      });
    }
    const byDomain = (domain) => mine.filter((e) => e.entity_id.startsWith(domain + "."));
    this._ents.light = _pick(byDomain("light"), null, null);
    // Repli ultime : convention light.<slug du nom du device> dans les états.
    if (!this._ents.light) {
      const byName = Object.values(hass.states || {}).find(
        (s) => s.entity_id.startsWith("light.") && s.attributes && s.attributes.friendly_name === dname
      );
      if (byName) this._ents.light = byName.entity_id;
    }
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
      console.warn("[phs16lc-card] entité light introuvable", {
        device: dname,
        deviceId: device.id,
        entitiesDansDevice: mine.map((e) => e.entity_id),
        nbEntities: ents.length,
        sampleEntities: ents.slice(0, 30).map((e) => e.entity_id),
        lightsDansStates: Object.keys(hass.states || {}).filter((k) => k.startsWith("light.")),
      });
    }
  }

  // Adresse bus du SPOT : extraite de l'unique_id (`..._spot_<n>_...`), sinon du nom du device.
  _address() {
    const reg = (this._hass.entities || {})[this._ents.light];
    const m = reg && (reg.unique_id || "").match(/_spot_(\d+)_/);
    if (m) return m[1];
    const name = this._device && (this._device.name_by_user || this._device.name);
    const m2 = name && String(name).match(/(\d+)/);
    return m2 ? m2[1] : null;
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

  _setBrightness(ev) {
    const v = parseInt(ev.target.value, 10);
    if (v === 0) {
      this._hass.callService("light", "turn_off", { entity_id: this._ents.light });
    } else {
      this._hass.callService("light", "turn_on", { entity_id: this._ents.light, brightness: v });
    }
  }

  _setChannel(idx, ev) {
    const address = this._address();
    if (!address) return;
    this._hass.callService("phs16lc", "set_channel", {
      address,
      channel: idx + 1,
      ma: parseInt(ev.target.value, 10),
    });
  }

  _selectOption(role, ev) {
    this._hass.callService("select", "select_option", {
      entity_id: this._ents[role],
      option: ev.target.value,
    });
  }

  _saveNvm() {
    if (this._ents.saveNvm) {
      this._hass.callService("button", "press", { entity_id: this._ents.saveNvm });
      return;
    }
    const address = this._address();
    if (address) this._hass.callService("phs16lc", "save", { address });
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

  // Signature des états utilisés : évite de re-rendre (et de perdre le focus d'un
  // slider en cours de drag) quand rien n'a changé côté HA.
  _signature() {
    const ids = Object.values(this._ents).filter(Boolean);
    return JSON.stringify(
      ids.map((id) => {
        const s = this._hass.states[id];
        if (!s) return null;
        const a = s.attributes || {};
        return [s.state, a.brightness, a.channels, a.options];
      })
    );
  }

  _render(force) {
    if (!this._hass || !this._config) return;
    const sig = this._signature();
    if (!force && this._built && sig === this._sig) return;
    this._sig = sig;
    this._built = true;
    const hass = this._hass;
    const lang = (hass.locale && hass.locale.language) || "en";
    const light = this._state("light");
    const name =
      (light && light.attributes && light.attributes.friendly_name) ||
      (this._device && (this._device.name_by_user || this._device.name)) ||
      this._ents.light ||
      "PHS16-LC";

    const card = document.createElement("ha-card");
    card.style.padding = "12px 16px";
    card.style.cursor = "pointer";
    card.addEventListener("click", () => this._moreInfo());

    if (this._error || !light) {
      const msg = document.createElement("div");
      msg.style.color = "var(--error-color, #db4437)";
      msg.textContent = this._error || _t(hass, "entityNotFound");
      card.appendChild(msg);
      if (this._errorDetail) {
        const det = document.createElement("div");
        det.style.cssText = "font-size:11px; color:var(--secondary-text-color); margin-top:4px;";
        det.textContent = this._errorDetail;
        card.appendChild(det);
      }
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
    const isOnline = !online || online.state === "on";
    const onlineChip = online
      ? `<span style="color:${isOnline ? "var(--success-color, #4caf50)" : "var(--error-color, #db4437)"}">● ${isOnline ? _t(hass, "online") : _t(hass, "offline")}</span>`
      : "";

    // Recette courante (état du select).
    const recipe = this._state("recipe");
    const recipeOk = recipe && recipe.state && recipe.state !== "unknown" && recipe.state !== "unavailable";
    const recipeChip = `<span>${_t(hass, "recipe")} : ${recipeOk ? recipe.state : "—"}</span>`;

    // Moyenne des températures LED 1/2 (max en tooltip).
    const t1 = parseFloat(this._state("tempLed1") && this._state("tempLed1").state);
    const t2 = parseFloat(this._state("tempLed2") && this._state("tempLed2").state);
    const temps = [t1, t2].filter((v) => !Number.isNaN(v));
    let tempChip = "";
    if (temps.length) {
      const avg = temps.reduce((a, b) => a + b, 0) / temps.length;
      const max = Math.max(...temps);
      tempChip = `<span title="${_t(hass, "max")} ${max.toLocaleString(lang)} °C">${avg.toLocaleString(lang, { maximumFractionDigits: 1 })} °C ${_t(hass, "ledTemp")}</span>`;
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
        <div style="display:flex; align-items:center; gap:4px;">
          <div class="phs-state" style="font-size:13px; color:var(--secondary-text-color); margin-right:4px;">${stateLabel}</div>
          <button class="phs-power" title="${on ? _t(hass, "powerOff") : _t(hass, "powerOn")}"
            style="border:none; background:none; cursor:pointer; padding:4px; color:${iconColor};">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
              <path d="${MDI_POWER}"/>
            </svg>
          </button>
          <button class="phs-expand" title="${this._expanded ? _t(hass, "collapse") : _t(hass, "expand")}"
            style="border:none; background:none; cursor:pointer; padding:4px; color:var(--secondary-text-color); transform:${this._expanded ? "rotate(180deg)" : "none"};">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
              <path d="${MDI_CHEVRON_DOWN}"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="phs-details" style="display:${this._expanded ? "block" : "none"}; margin-top:12px; border-top:1px solid var(--divider-color, #e0e0e0); padding-top:12px;"></div>`;
    card.querySelector(".phs-name").textContent = name;
    card.querySelector(".phs-power").addEventListener("click", (ev) => {
      ev.stopPropagation();
      this._toggle();
    });
    card.querySelector(".phs-expand").addEventListener("click", (ev) => {
      ev.stopPropagation();
      this._expanded = !this._expanded;
      this._render(true);
    });

    if (this._expanded) this._renderDetails(card.querySelector(".phs-details"), hass, lang);
    this.replaceChildren(card);
  }

  _renderDetails(root, hass, lang) {
    const light = this._state("light");
    const brightness =
      light.attributes && light.attributes.brightness != null
        ? light.attributes.brightness
        : light.state === "on"
          ? 255
          : 0;
    const showChannels = this._config.show_channels !== false;
    const currents = this._state("currents");
    const channels = currents && currents.attributes && currents.attributes.channels;

    // Mapping luminosité HA (1-255) -> mA (linéaire 74-2150, cf. intégration).
    const maOf = (b) => Math.round(74 + (b / 255) * (2150 - 74));

    let html = `
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
        <span style="font-size:13px; color:var(--secondary-text-color); min-width:90px;">${_t(hass, "brightness")}</span>
        <input class="phs-brightness" type="range" min="0" max="255" step="1"
          value="${brightness}"
          style="flex:1; accent-color:var(--primary-color);">
        <span class="phs-brightness-val" style="font-size:12px; color:var(--secondary-text-color); min-width:110px; text-align:right;"></span>
      </div>`;

    // Températures détaillées.
    const tempRow = ["tempCpu", "tempLed1", "tempLed2"]
      .map((role) => {
        const s = this._state(role);
        const label = role === "tempCpu" ? _t(hass, "tempCpu") : role === "tempLed1" ? "LED 1" : "LED 2";
        return `<span style="font-size:12px; color:var(--secondary-text-color);">${label} : ${s && s.state !== "unavailable" ? s.state + " °C" : "—"}</span>`;
      })
      .join("<span style='margin:0 6px; color:var(--divider-color,#e0e0e0);'>|</span>");
    html += `<div style="display:flex; gap:6px; margin-bottom:10px;">${tempRow}</div>`;

    // Selects recette / groupe.
    const selRow = (role, labelKey) => {
      const s = this._state(role);
      if (!s) return "";
      const options = (s.attributes && s.attributes.options) || [];
      const opts = options
        .map((o) => `<option value="${o}"${o === s.state ? " selected" : ""}>${o}</option>`)
        .join("");
      return `<div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
        <span style="font-size:13px; color:var(--secondary-text-color); min-width:90px;">${_t(hass, labelKey)}</span>
        <select data-role="${role}" style="flex:1; background:var(--card-background-color,#fff); color:var(--primary-text-color); border:1px solid var(--divider-color,#e0e0e0); border-radius:4px; padding:4px;">
          ${opts}
        </select>
      </div>`;
    };
    html += selRow("recipe", "recipe") + selRow("group", "group");

    // 16 sliders de canaux.
    if (showChannels && Array.isArray(channels) && channels.length) {
      const items = channels
        .map(
          (ma, i) => `
        <div style="display:flex; align-items:center; gap:6px;">
          <span style="font-size:11px; color:var(--secondary-text-color); width:24px;">C${i + 1}</span>
          <input class="phs-channel" data-idx="${i}" type="range" min="0" max="2150" step="10"
            value="${ma}" style="flex:1; accent-color:var(--primary-color);">
          <span class="phs-channel-val" style="font-size:11px; color:var(--secondary-text-color); width:58px; text-align:right;">${ma} ${_t(hass, "ma")}</span>
        </div>`
        )
        .join("");
      html += `
        <div style="font-size:13px; color:var(--secondary-text-color); margin:6px 0;">${_t(hass, "channels")} (${_t(hass, "ma")})</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px 16px;">${items}</div>`;
    }

    // Bouton save NVM.
    html += `
      <div style="margin-top:12px; text-align:right;">
        <button class="phs-save" style="border:1px solid var(--divider-color,#e0e0e0); background:var(--card-background-color,#fff); color:var(--primary-text-color); border-radius:4px; padding:6px 12px; cursor:pointer; font-size:13px;">
          ${_t(hass, "save")}
        </button>
      </div>`;

    root.innerHTML = html;

    const bSlider = root.querySelector(".phs-brightness");
    const bVal = root.querySelector(".phs-brightness-val");
    const paintB = () => {
      const v = parseInt(bSlider.value, 10);
      bVal.textContent = v === 0 ? _t(hass, "off") : `${v}/255 (~${maOf(v)} ${_t(hass, "ma")})`;
    };
    paintB();
    bSlider.addEventListener("input", paintB);
    bSlider.addEventListener("change", (ev) => {
      ev.stopPropagation();
      this._setBrightness(ev);
    });
    bSlider.addEventListener("click", (ev) => ev.stopPropagation());

    root.querySelectorAll("select").forEach((sel) => {
      sel.addEventListener("click", (ev) => ev.stopPropagation());
      sel.addEventListener("change", (ev) => {
        ev.stopPropagation();
        this._selectOption(sel.dataset.role, ev);
      });
    });

    root.querySelectorAll(".phs-channel").forEach((slider) => {
      const idx = parseInt(slider.dataset.idx, 10);
      const val = slider.parentElement.querySelector(".phs-channel-val");
      slider.addEventListener("input", () => {
        val.textContent = `${slider.value} ${_t(hass, "ma")}`;
      });
      slider.addEventListener("click", (ev) => ev.stopPropagation());
      slider.addEventListener("change", (ev) => {
        ev.stopPropagation();
        this._setChannel(idx, ev);
      });
    });

    const saveBtn = root.querySelector(".phs-save");
    saveBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      this._saveNvm();
    });
  }
}

customElements.define("phs16lc-spot-card", Phs16lcSpotCard);

// ---------------------------------------------------------------------------
// Carte groupe : device « groupe de luminaires » (identifiers phs16lc "group_<id>").
// Config :
//   type: custom:phs16lc-group-card
//   device: Serre 1 Nord     # nom du device groupe (ou `entity: light.<groupe>`)
//   group_id: serre_1_nord   # pour phs16lc.save address="group:<id>"
// Attributs optionnels du light du groupe (backend v1.5.3+) : `members` (liste
// d'adresses) et `online` (nb de membres en ligne) -> puce « 2/3 en ligne ».
// ---------------------------------------------------------------------------

const MDI_LIGHTBULB_GROUP =
  "M7 2a5 5 0 0 0-3 9.3c.5.4.8 1 .8 1.7v1h4.4v-1c0-.7.3-1.3.8-1.7A5 5 0 0 0 7 2zM5 15h4v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-1zm10-3a5 5 0 0 0-3 9.3c.5.4.8 1 .8 1.7v1h4.4v-1c0-.7.3-1.3.8-1.7A5 5 0 0 0 15 9a5 5 0 0 0 0 3zM13 15h4v1a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-1z";

class Phs16lcGroupCard extends HTMLElement {
  constructor() {
    super();
    this._config = null;
    this._hass = null;
    this._device = null;
    this._ents = {};
    this._error = null;
    this._errorDetail = null;
    this._expanded = false;
    this._built = false;
    this._sig = "";
  }

  static getStubConfig() {
    return { device: "Serre 1 Nord", group_id: "serre_1_nord" };
  }

  getCardSize() {
    return this._expanded ? 4 : 2;
  }

  setConfig(config) {
    if (!config || (!config.device && !config.entity && !config.group_id)) {
      throw new Error(I18N.fr.configError + " / " + I18N.en.configError);
    }
    this._config = config;
    this._ents = {};
  }

  set hass(hass) {
    this._hass = hass;
    this._resolve();
    this._render();
  }

  _resolve() {
    const hass = this._hass;
    this._error = null;
    this._errorDetail = null;
    this._device = null;
    this._ents = {};
    if (this._config.entity) {
      this._ents.light = this._config.entity;
      return;
    }
    // `device:` prioritaire, `group_id:` accepté comme repli (carte groupe).
    const ref = this._config.device || this._config.group_id;
    const device = _findDevice(hass, ref);
    if (!device) {
      this._error = _t(hass, "deviceNotFound") + " : " + ref;
      this._errorDetail = _deviceNames(hass);
      console.warn("[phs16lc-card] devices vus :", this._errorDetail);
      return;
    }
    this._device = device;
    const dname = device.name_by_user || device.name;
    const ents = Object.values(hass.entities || {});
    let mine = ents.filter((e) => e.device_id === device.id);
    if (!mine.length) {
      mine = ents.filter((e) => {
        const s = hass.states && hass.states[e.entity_id];
        return s && s.attributes && s.attributes.friendly_name === dname;
      });
    }
    const byDomain = (domain) => mine.filter((e) => e.entity_id.startsWith(domain + "."));
    this._ents.light = _pick(byDomain("light"), null, null);
    if (!this._ents.light) {
      const byName = Object.values(hass.states || {}).find(
        (s) => s.entity_id.startsWith("light.") && s.attributes && s.attributes.friendly_name === dname
      );
      if (byName) this._ents.light = byName.entity_id;
    }
    this._ents.recipe = _pick(byDomain("select"), "recipe", "recipe");
    if (!this._ents.light) {
      this._error = _t(hass, "entityNotFound") + " (light.*) : " + (this._config.device || this._config.group_id);
      console.warn("[phs16lc-card] groupe sans light", { device: dname, entities: mine.map((e) => e.entity_id) });
    }
    this._resolveMembers();
  }

  // Membres du groupe. Source de vérité : attribut `members` (adresses) du light du
  // groupe, exposé par l'intégration (>= v1.5.3). Repli : label `<group_id>` sur les
  // devices — jamais retiré par la synchro registry (voir groups.py), donc périmé
  // après un retrait de membre.
  _resolveMembers() {
    this._members = [];
    const hass = this._hass;
    const ents = Object.values(hass.entities || {});
    const devs = Object.values(hass.devices || {});
    const bySuffix = (suffix) => ents.find((e) => (e.unique_id || "").endsWith(suffix));
    const light = this._state("light");
    const attrs = (light && light.attributes) || {};

    if (Array.isArray(attrs.members) && attrs.members.length) {
      for (const addr of attrs.members) {
        const l =
          bySuffix(`_spot_${addr}_light`) ||
          ents.find((e) => e.entity_id === `light.spot_${addr}`);
        const o = bySuffix(`_spot_${addr}_online`);
        const lReg = l && ents.find((e) => e.entity_id === l.entity_id);
        const dev = lReg && lReg.device_id ? devs.find((d) => d.id === lReg.device_id) : null;
        this._members.push({
          address: addr,
          device: dev || null,
          light: l ? l.entity_id : null,
          online: o ? o.entity_id : null,
        });
      }
      return;
    }

    // Repli (ancien backend sans attribut `members`) : labels, hors device du groupe.
    const gid = this._config.group_id;
    if (!gid) return;
    for (const d of devs) {
      if (this._device && d.id === this._device.id) continue;
      if (!(d.labels || []).includes(gid)) continue;
      let l = ents.find((e) => e.device_id === d.id && e.entity_id.startsWith("light."));
      if (!l) {
        const s = Object.values(hass.states || {}).find(
          (x) =>
            x.entity_id.startsWith("light.") &&
            x.attributes &&
            x.attributes.friendly_name === (d.name_by_user || d.name)
        );
        if (s) l = s;
      }
      const online = ents.find(
        (e) => e.device_id === d.id && e.entity_id.startsWith("binary_sensor.")
      );
      this._members.push({
        address: null,
        device: d,
        light: l ? l.entity_id : null,
        online: online ? online.entity_id : null,
      });
    }
  }

  _memberOnline(m) {
    const s = m.online && this._hass.states ? this._hass.states[m.online] : null;
    return !s || s.state === "on"; // pas de capteur online -> considéré en ligne
  }

  // Entity_id des lights des membres actuels (pour set_group spots=[...]).
  _memberSpots() {
    return (this._members || []).map((m) => m.light).filter(Boolean);
  }

  // Luminaires SPOT candidats à l'ajout : lights phs16lc dont l'unique_id est
  // `..._spot_<n>_light` (les lights de groupes sont `..._group_<id>_light`).
  _candidateSpots() {
    const current = new Set(this._memberSpots());
    return Object.values(this._hass.entities || {})
      .filter(
        (e) =>
          e.entity_id.startsWith("light.") &&
          /_spot_\d+_light$/.test(e.unique_id || "") &&
          !current.has(e.entity_id)
      )
      .map((e) => e.entity_id);
  }

  _setMembers(spots) {
    const gid = this._config.group_id;
    if (!gid) return;
    this._hass.callService("phs16lc", "set_group", { group_id: gid, spots });
  }

  _removeMember(m) {
    this._setMembers(this._memberSpots().filter((id) => id !== m.light));
  }

  _addMember(entityId) {
    if (!entityId) return;
    this._setMembers([...this._memberSpots(), entityId]);
  }

  _state(role) {
    const id = this._ents[role];
    return id && this._hass.states ? this._hass.states[id] : null;
  }

  _toggle() {
    const light = this._state("light");
    if (!light) return;
    this._hass.callService("light", light.state === "on" ? "turn_off" : "turn_on", {
      entity_id: this._ents.light,
    });
  }

  _setBrightness(ev) {
    const v = parseInt(ev.target.value, 10);
    if (v === 0) {
      this._hass.callService("light", "turn_off", { entity_id: this._ents.light });
    } else {
      this._hass.callService("light", "turn_on", { entity_id: this._ents.light, brightness: v });
    }
  }

  _selectRecipe(ev) {
    if (!this._ents.recipe) return;
    this._hass.callService("select", "select_option", {
      entity_id: this._ents.recipe,
      option: ev.target.value,
    });
  }

  _saveAll() {
    const gid = this._config.group_id;
    if (!gid) return;
    this._hass.callService("phs16lc", "save", { address: "group:" + gid });
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

  _signature() {
    const ids = Object.values(this._ents).filter(Boolean);
    const memberStates = (this._members || []).map((m) => {
      const l = m.light && this._hass.states[m.light];
      const o = m.online && this._hass.states[m.online];
      // inclure id/adresse : un changement de membres doit re-rendre même si les états sont identiques
      return [m.light, m.address, l && l.state, o && o.state];
    });
    return JSON.stringify([
      ids.map((id) => {
        const s = this._hass.states[id];
        if (!s) return null;
        const a = s.attributes || {};
        return [s.state, a.brightness, a.options, a.members, a.online];
      }),
      memberStates,
    ]);
  }

  _render(force) {
    if (!this._hass || !this._config) return;
    const sig = this._signature();
    if (!force && this._built && sig === this._sig) return;
    this._sig = sig;
    this._built = true;
    const hass = this._hass;
    const lang = (hass.locale && hass.locale.language) || "en";
    const light = this._state("light");
    const name =
      (light && light.attributes && light.attributes.friendly_name) ||
      (this._device && (this._device.name_by_user || this._device.name)) ||
      this._ents.light ||
      "PHS16-LC";

    const card = document.createElement("ha-card");
    card.style.padding = "12px 16px";
    card.style.cursor = "pointer";
    card.addEventListener("click", () => this._moreInfo());

    if (this._error || !light) {
      const msg = document.createElement("div");
      msg.style.color = "var(--error-color, #db4437)";
      msg.textContent = this._error || _t(hass, "entityNotFound");
      card.appendChild(msg);
      if (this._errorDetail) {
        const det = document.createElement("div");
        det.style.cssText = "font-size:11px; color:var(--secondary-text-color); margin-top:4px;";
        det.textContent = this._errorDetail;
        card.appendChild(det);
      }
      this.replaceChildren(card);
      return;
    }

    const on = light.state === "on";
    const iconColor = on
      ? "var(--state-light-active-color, #ffc107)"
      : "var(--disabled-text-color, #9e9e9e)";
    const brightness = light.attributes && light.attributes.brightness;
    const maOf = (b) => Math.round(74 + (b / 255) * (2150 - 74));

    // Puces : recette, luminosité (~mA), membres en ligne (attributs optionnels).
    const recipe = this._state("recipe");
    const recipeOk = recipe && recipe.state && recipe.state !== "unknown" && recipe.state !== "unavailable";
    const recipeChip = `<span>${_t(hass, "recipe")} : ${recipeOk ? recipe.state : "—"}</span>`;
    const brightChip =
      brightness != null
        ? `<span>${brightness}/255 (~${maOf(brightness)} ${_t(hass, "ma")})</span>`
        : "";
    const onlineCount = (this._members || []).filter((m) => this._memberOnline(m)).length;
    const attrs = light.attributes || {};
    const membersChip = (this._members || []).length
      ? `<span>${_t(hass, "onlineCount").replace("{on}", onlineCount).replace("{total}", this._members.length)}</span>`
      : Array.isArray(attrs.members)
        ? `<span>${attrs.members.length} ${_t(hass, "members")}</span>`
        : "";

    card.innerHTML = `
      <div style="display:flex; align-items:center; gap:12px;">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="${iconColor}" aria-hidden="true">
          <path d="${MDI_LIGHTBULB_GROUP}"/>
        </svg>
        <div style="flex:1; min-width:0;">
          <div class="phs-name" style="font-weight:500; color:var(--primary-text-color); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"></div>
          <div style="font-size:12px; color:var(--secondary-text-color); display:flex; gap:10px; flex-wrap:wrap;">
            ${recipeChip}${brightChip}${membersChip}
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:4px;">
          <button class="phs-power" title="${on ? _t(hass, "powerOff") : _t(hass, "powerOn")}"
            style="border:none; background:none; cursor:pointer; padding:4px; color:${iconColor};">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
              <path d="${MDI_POWER}"/>
            </svg>
          </button>
          <button class="phs-expand" title="${this._expanded ? _t(hass, "collapse") : _t(hass, "expand")}"
            style="border:none; background:none; cursor:pointer; padding:4px; color:var(--secondary-text-color); transform:${this._expanded ? "rotate(180deg)" : "none"};">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
              <path d="${MDI_CHEVRON_DOWN}"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="phs-details" style="display:${this._expanded ? "block" : "none"}; margin-top:12px; border-top:1px solid var(--divider-color, #e0e0e0); padding-top:12px;"></div>`;
    card.querySelector(".phs-name").textContent = name;
    card.querySelector(".phs-power").addEventListener("click", (ev) => {
      ev.stopPropagation();
      this._toggle();
    });
    card.querySelector(".phs-expand").addEventListener("click", (ev) => {
      ev.stopPropagation();
      this._expanded = !this._expanded;
      this._render(true);
    });

    if (this._expanded) this._renderDetails(card.querySelector(".phs-details"), hass, lang, light);
    this.replaceChildren(card);
  }

  _renderDetails(root, hass, lang, light) {
    const brightness =
      light.attributes && light.attributes.brightness != null
        ? light.attributes.brightness
        : light.state === "on"
          ? 255
          : 0;
    const maOf = (b) => Math.round(74 + (b / 255) * (2150 - 74));

    let html = `
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
        <span style="font-size:13px; color:var(--secondary-text-color); min-width:90px;">${_t(hass, "brightness")}</span>
        <input class="phs-brightness" type="range" min="0" max="255" step="1" value="${brightness}"
          style="flex:1; accent-color:var(--primary-color);">
        <span class="phs-brightness-val" style="font-size:12px; color:var(--secondary-text-color); min-width:110px; text-align:right;"></span>
      </div>`;

    const recipe = this._state("recipe");
    if (recipe) {
      const options = (recipe.attributes && recipe.attributes.options) || [];
      const opts = options
        .map((o) => `<option value="${o}"${o === recipe.state ? " selected" : ""}>${o}</option>`)
        .join("");
      html += `<div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
        <span style="font-size:13px; color:var(--secondary-text-color); min-width:90px;">${_t(hass, "recipe")}</span>
        <select class="phs-recipe" style="flex:1; background:var(--card-background-color,#fff); color:var(--primary-text-color); border:1px solid var(--divider-color,#e0e0e0); border-radius:4px; padding:4px;">${opts}</select>
      </div>`;
    }

    // Liste des luminaires membres (devices portant le label <group_id>),
    // avec bouton de retrait par ligne et sélecteur d'ajout en dessous.
    const candidates = this._candidateSpots();
    if ((this._members || []).length || candidates.length) {
      const rows = this._members
        .map(
          (m, i) => `
        <div class="phs-member" data-idx="${i}" style="display:flex; align-items:center; gap:8px; padding:4px 0; cursor:pointer;">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="var(--disabled-text-color, #9e9e9e)" aria-hidden="true">
            <path d="${MDI_LIGHTBULB}"/>
          </svg>
          <span class="phs-member-name" style="flex:1; font-size:13px; color:var(--primary-text-color);"></span>
          <span class="phs-member-state" style="font-size:12px; color:var(--secondary-text-color);"></span>
          <button class="phs-member-remove" data-idx="${i}" title="${_t(hass, "removeMember")}"
            style="border:none; background:none; cursor:pointer; padding:2px; color:var(--secondary-text-color);">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
              <path d="${MDI_CLOSE}"/>
            </svg>
          </button>
        </div>`
        )
        .join("");
      html += `<div style="font-size:13px; color:var(--secondary-text-color); margin:10px 0 4px;">${_t(hass, "members")} (${this._members.length})</div><div>${rows}</div>`;
      if (candidates.length) {
        const opts = candidates
          .map((id) => {
            const s = this._hass.states[id];
            const label = (s && s.attributes && s.attributes.friendly_name) || id;
            return `<option value="${id}">${label} (${id})</option>`;
          })
          .join("");
        html += `<div style="display:flex; gap:8px; margin-top:8px; align-items:center;">
          <select class="phs-add" style="flex:1; background:var(--card-background-color,#fff); color:var(--primary-text-color); border:1px solid var(--divider-color,#e0e0e0); border-radius:4px; padding:4px;">${opts}</select>
          <button class="phs-add-btn" style="border:1px solid var(--divider-color,#e0e0e0); background:var(--card-background-color,#fff); color:var(--primary-text-color); border-radius:4px; padding:6px 12px; cursor:pointer; font-size:13px; white-space:nowrap;">${_t(hass, "addMember")}</button>
        </div>`;
      }
    }

    const gid = this._config.group_id;
    html += `
      <div style="margin-top:12px; text-align:right;">
        <button class="phs-save" ${gid ? "" : "disabled"} title="${gid ? "" : _t(hass, "needGroupId")}"
          style="border:1px solid var(--divider-color,#e0e0e0); background:var(--card-background-color,#fff); color:var(--primary-text-color); border-radius:4px; padding:6px 12px; cursor:pointer; font-size:13px;">
          ${_t(hass, "saveAll")}
        </button>
      </div>`;

    root.innerHTML = html;

    const bSlider = root.querySelector(".phs-brightness");
    const bVal = root.querySelector(".phs-brightness-val");
    const paintB = () => {
      const v = parseInt(bSlider.value, 10);
      bVal.textContent = v === 0 ? _t(hass, "off") : `${v}/255 (~${maOf(v)} ${_t(hass, "ma")})`;
    };
    paintB();
    bSlider.addEventListener("input", paintB);
    bSlider.addEventListener("click", (ev) => ev.stopPropagation());
    bSlider.addEventListener("change", (ev) => {
      ev.stopPropagation();
      this._setBrightness(ev);
    });

    const sel = root.querySelector(".phs-recipe");
    if (sel) {
      sel.addEventListener("click", (ev) => ev.stopPropagation());
      sel.addEventListener("change", (ev) => {
        ev.stopPropagation();
        this._selectRecipe(ev);
      });
    }

    const saveBtn = root.querySelector(".phs-save");
    saveBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      this._saveAll();
    });

    // Lignes membres : état du light + clic -> more-info du luminaire.
    root.querySelectorAll(".phs-member").forEach((row) => {
      const m = this._members[parseInt(row.dataset.idx, 10)];
      if (!m) return;
      const ls = m.light && this._hass.states[m.light];
      const on = ls && ls.state === "on";
      row.querySelector("svg").setAttribute("fill", on ? "var(--state-light-active-color, #ffc107)" : "var(--disabled-text-color, #9e9e9e)");
      row.querySelector(".phs-member-name").textContent =
        (m.device && (m.device.name_by_user || m.device.name)) ||
        (ls && ls.attributes && ls.attributes.friendly_name) ||
        (m.address != null ? "SPOT " + m.address : m.light) ||
        "?";
      row.querySelector(".phs-member-state").textContent =
        ls ? (ls.state === "unavailable" ? "—" : ls.state) : "—";
      row.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (m.light) {
          this.dispatchEvent(
            new CustomEvent("hass-more-info", {
              detail: { entityId: m.light },
              bubbles: true,
              composed: true,
            })
          );
        }
      });
    });

    // Retrait / ajout de membres -> phs16lc.set_group (mise à jour partielle).
    root.querySelectorAll(".phs-member-remove").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const m = this._members[parseInt(btn.dataset.idx, 10)];
        if (m) this._removeMember(m);
      });
    });
    const addBtn = root.querySelector(".phs-add-btn");
    if (addBtn) {
      addBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const sel = root.querySelector(".phs-add");
        this._addMember(sel ? sel.value : null);
      });
    }
    const addSel = root.querySelector(".phs-add");
    if (addSel) addSel.addEventListener("click", (ev) => ev.stopPropagation());
  }
}

customElements.define("phs16lc-group-card", Phs16lcGroupCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "phs16lc-spot-card",
  name: "PHS16-LC — SPOT",
  description: "Carte compacte d'un luminaire PHS16-LC (intégration phs16lc).",
  preview: true,
});
window.customCards.push({
  type: "phs16lc-group-card",
  name: "PHS16-LC — Groupe",
  description: "Carte d'un groupe de luminaires PHS16-LC (intégration phs16lc).",
  preview: true,
});
