/*
 * Domofon Card — Lovelace card for the Smart Domofon integration
 * https://github.com/heartpolik/domofon-card  (MIT)
 */
const VERSION = "0.1.0";

const I18N = {
  uk: {
    ringing: "Дзвонять у двері!",
    idle: "Тихо",
    open: "Відчинити",
    reject: "Скинути",
    release: "Відпустити лінію",
    confirm: "Ще раз — відчинити",
    confirmRelease: "Ще раз — відпустити",
    today: "сьогодні",
    calls: "дзвінків",
    history: "Останні дзвінки",
    empty: "Дзвінків ще не було",
    modes: ["Звичайний", "Один раз", "Завжди відчиняти", "Завжди скидати"],
    outcome: { ringing: "дзвонить", opened: "відчинено", rejected: "скинуто", missed: "пропущено" },
    via: { auto: "авто", phone: "з телефону", manual: "вручну" },
    noEntity: "Не знайдено сенсор інтеграції Smart Domofon. Вкажіть entity: sensor.…_calls_today",
    unavailable: "Домофон недоступний",
  },
  en: {
    ringing: "Someone is at the door!",
    idle: "Quiet",
    open: "Open",
    reject: "Reject",
    release: "Release line",
    confirm: "Tap again to open",
    confirmRelease: "Tap again to release",
    today: "today",
    calls: "calls",
    history: "Recent calls",
    empty: "No calls yet",
    modes: ["Normal", "Open once", "Always open", "Always reject"],
    outcome: { ringing: "ringing", opened: "opened", rejected: "rejected", missed: "missed" },
    via: { auto: "auto", phone: "phone", manual: "manual" },
    noEntity: "Smart Domofon sensor not found. Set entity: sensor.…_calls_today",
    unavailable: "Intercom unavailable",
  },
};

const MODE_ICONS = ["mdi:bell-outline", "mdi:door-open", "mdi:lock-open-variant", "mdi:phone-hangup"];
const OUTCOME_ICONS = {
  ringing: ["mdi:bell-ring", "var(--warning-color, #ff9800)"],
  opened: ["mdi:door-open", "var(--success-color, #43a047)"],
  rejected: ["mdi:phone-hangup", "var(--error-color, #e53935)"],
  missed: ["mdi:phone-missed", "var(--secondary-text-color, #888)"],
};

const findSensor = (hass) =>
  Object.keys(hass.states).find(
    (e) => e.startsWith("sensor.") && hass.states[e].attributes && hass.states[e].attributes.domofon_entities
  );

class DomofonCard extends HTMLElement {
  static getStubConfig(hass) {
    return { entity: findSensor(hass) || "" };
  }

  static getConfigElement() {
    return document.createElement("domofon-card-editor");
  }

  setConfig(config) {
    this._config = { history: 5, ...config };
    this._armed = null;
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this._key = "";
    if (this._hass) this._render();
  }

  set hass(hass) {
    this._hass = hass;
    const key = this._stateKey();
    if (key !== this._key) {
      this._key = key;
      this._render();
    }
  }

  getCardSize() {
    return 3 + Math.min(this._config.history || 0, 5);
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  // ── helpers ────────────────────────────────────────────────────────────────
  get _t() {
    const lang = (this._hass && (this._hass.locale?.language || this._hass.language)) || "en";
    return I18N[lang.startsWith("uk") ? "uk" : "en"];
  }

  get _sensorId() {
    return this._config.entity || (this._hass && findSensor(this._hass));
  }

  get _ents() {
    const s = this._sensorId && this._hass.states[this._sensorId];
    return { ...((s && s.attributes.domofon_entities) || {}), ...(this._config.entities || {}) };
  }

  _st(role) {
    const id = this._ents[role];
    return id ? this._hass.states[id] : undefined;
  }

  _stateKey() {
    if (!this._hass) return "";
    const ids = [this._sensorId, ...Object.values(this._ents)];
    return (
      ids.map((id) => (id && this._hass.states[id] ? this._hass.states[id].last_updated + this._hass.states[id].state : "")).join("|") +
      "|" + (this._armed || "") + "|" + (this._hass.locale?.language || "")
    );
  }

  _press(role) {
    const id = this._ents[role];
    if (id) this._hass.callService("button", "press", { entity_id: id });
  }

  _armOrRun(name, fn) {
    if (this._armed === name) {
      clearTimeout(this._armTimer);
      this._armed = null;
      fn();
    } else {
      this._armed = name;
      clearTimeout(this._armTimer);
      this._armTimer = setTimeout(() => {
        this._armed = null;
        this._key = "";
        this.hass = this._hass;
      }, 3000);
    }
    this._key = "";
    this.hass = this._hass;
  }

  _setMode(idx) {
    const st = this._st("mode");
    const opts = (st && st.attributes.options) || [];
    if (opts[idx] !== undefined) {
      this._hass.callService("select", "select_option", { entity_id: this._ents.mode, option: opts[idx] });
    }
  }

  _fmtTime(iso) {
    const d = new Date(iso);
    const lang = this._hass.locale?.language || "en";
    const today = new Date().toDateString() === d.toDateString();
    return today
      ? d.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleString(lang, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  // ── render ─────────────────────────────────────────────────────────────────
  _render() {
    if (!this.shadowRoot || !this._hass) return;
    const t = this._t;
    const sensor = this._sensorId && this._hass.states[this._sensorId];
    if (!sensor && !this._config.entities) {
      this.shadowRoot.innerHTML = `<ha-card><div class="warn">${t.noEntity}</div></ha-card>${STYLE}`;
      return;
    }
    const modeSt = this._st("mode");
    const unavailable = !modeSt || modeSt.state === "unavailable";
    const ringing = this._st("incoming_call")?.state === "on";
    const opts = (modeSt && modeSt.attributes.options) || [];
    const modeIdx = modeSt ? opts.indexOf(modeSt.state) : -1;
    const name = this._config.name || (sensor && sensor.attributes.friendly_name?.split(" ").slice(0, -2).join(" ")) || "Domofon";
    const lastEvent = this._st("last_event")?.state;
    const history = ((sensor && sensor.attributes.history) || []).slice(0, this._config.history);
    const callsToday = sensor ? sensor.state : "–";
    const hasRelease = !!this._ents.release;

    const modes = opts
      .slice(0, 4)
      .map(
        (_, i) => `
        <button class="mode ${i === modeIdx ? "on" : ""}" data-mode="${i}" ${unavailable ? "disabled" : ""}>
          <ha-icon icon="${MODE_ICONS[i]}"></ha-icon><span>${t.modes[i] || opts[i]}</span>
        </button>`
      )
      .join("");

    const rows = history.length
      ? history
          .map((r) => {
            const [icon, color] = OUTCOME_ICONS[r.outcome] || OUTCOME_ICONS.missed;
            const via = r.via && t.via[r.via] ? ` · ${t.via[r.via]}` : "";
            return `<div class="row"><ha-icon icon="${icon}" style="color:${color}"></ha-icon>
              <span class="what">${t.outcome[r.outcome] || r.outcome}<small>${via}</small></span>
              <span class="when">${this._fmtTime(r.start)}</span></div>`;
          })
          .join("")
      : `<div class="row empty">${t.empty}</div>`;

    this.shadowRoot.innerHTML = `
      <ha-card class="${ringing ? "ringing" : ""}">
        <div class="head">
          <div class="bell"><ha-icon icon="${ringing ? "mdi:bell-ring" : "mdi:doorbell"}"></ha-icon></div>
          <div class="title">
            <div class="name">${name}</div>
            <div class="sub">${unavailable ? t.unavailable : ringing ? t.ringing : lastEvent || t.idle}</div>
          </div>
          <div class="count" title="${t.today}"><b>${callsToday}</b><small>${t.today}</small></div>
        </div>
        ${
          ringing
            ? `<div class="actions big">
                <button class="act open" data-act="open"><ha-icon icon="mdi:door-open"></ha-icon>${t.open}</button>
                <button class="act reject" data-act="reject"><ha-icon icon="mdi:phone-hangup"></ha-icon>${t.reject}</button>
              </div>`
            : `<div class="actions">
                <button class="act open ${this._armed === "open" ? "armed" : ""}" data-act="open" ${unavailable ? "disabled" : ""}>
                  <ha-icon icon="mdi:door-open"></ha-icon>${this._armed === "open" ? t.confirm : t.open}</button>
                ${
                  hasRelease
                    ? `<button class="act ghost ${this._armed === "release" ? "armed" : ""}" data-act="release" ${unavailable ? "disabled" : ""}>
                        <ha-icon icon="mdi:phone-return"></ha-icon>${this._armed === "release" ? t.confirmRelease : t.release}</button>`
                    : ""
                }
              </div>`
        }
        <div class="modes">${modes}</div>
        ${this._config.history ? `<div class="hist"><div class="h">${t.history}</div>${rows}</div>` : ""}
      </ha-card>${STYLE}`;

    this.shadowRoot.querySelectorAll("[data-mode]").forEach((b) =>
      b.addEventListener("click", () => this._setMode(Number(b.dataset.mode)))
    );
    this.shadowRoot.querySelectorAll("[data-act]").forEach((b) =>
      b.addEventListener("click", () => {
        const act = b.dataset.act;
        if (ringing && act !== "release") return this._press(act);
        if (act === "open") this._armOrRun("open", () => this._press("open"));
        if (act === "release") this._armOrRun("release", () => this._press("release"));
      })
    );
  }
}

const STYLE = `<style>
  ha-card { padding: 16px; overflow: hidden; transition: box-shadow .3s; }
  ha-card.ringing { box-shadow: 0 0 0 2px var(--warning-color, #ff9800), var(--ha-card-box-shadow, none); }
  .warn { color: var(--error-color); }
  .head { display: flex; align-items: center; gap: 12px; }
  .bell { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; flex: none;
          background: rgba(var(--rgb-primary-color, 3,169,244), .15); color: var(--primary-color); }
  .ringing .bell { background: var(--warning-color, #ff9800); color: #fff; animation: ring 1s ease-in-out infinite; }
  @keyframes ring { 0%,100% { transform: rotate(0) scale(1); } 15% { transform: rotate(-14deg) scale(1.08); }
                    30% { transform: rotate(12deg) scale(1.08); } 45% { transform: rotate(-8deg); } 60% { transform: rotate(0); } }
  .title { flex: 1; min-width: 0; }
  .name { font-weight: 600; font-size: 16px; }
  .sub { color: var(--secondary-text-color); font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ringing .sub { color: var(--warning-color, #ff9800); font-weight: 600; }
  .count { text-align: center; line-height: 1.1; }
  .count b { display: block; font-size: 20px; }
  .count small { color: var(--secondary-text-color); font-size: 11px; }
  .actions { display: flex; gap: 8px; margin-top: 14px; }
  .act { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; border: none; cursor: pointer;
         border-radius: 12px; padding: 10px; font: inherit; font-weight: 600;
         background: var(--secondary-background-color); color: var(--primary-text-color); transition: background .2s, transform .1s; }
  .act:active { transform: scale(.97); }
  .act:disabled { opacity: .4; cursor: default; }
  .act.open { background: rgba(67,160,71,.18); color: var(--success-color, #43a047); }
  .act.reject { background: rgba(229,57,53,.18); color: var(--error-color, #e53935); }
  .act.armed { background: var(--success-color, #43a047); color: #fff; }
  .act.ghost.armed { background: var(--warning-color, #ff9800); }
  .big .act { padding: 16px; font-size: 16px; }
  .big .act.open { background: var(--success-color, #43a047); color: #fff; }
  .big .act.reject { background: var(--error-color, #e53935); color: #fff; }
  .modes { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 12px; }
  .mode { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 4px; border-radius: 10px;
          border: 1px solid var(--divider-color); background: none; color: var(--secondary-text-color);
          font: inherit; font-size: 11px; cursor: pointer; text-align: center; }
  .mode.on { border-color: var(--primary-color); color: var(--primary-color); background: rgba(var(--rgb-primary-color, 3,169,244), .1); font-weight: 600; }
  .mode:disabled { opacity: .4; }
  .hist { margin-top: 14px; }
  .hist .h { font-size: 12px; color: var(--secondary-text-color); text-transform: uppercase; letter-spacing: .04em; margin-bottom: 4px; }
  .row { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-top: 1px solid var(--divider-color); }
  .row:first-of-type { border-top: none; }
  .row .what { flex: 1; }
  .row small { color: var(--secondary-text-color); }
  .row .when { color: var(--secondary-text-color); font-size: 13px; font-variant-numeric: tabular-nums; }
  .row.empty { color: var(--secondary-text-color); justify-content: center; }
</style>`;

class DomofonCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this._render();
  }
  set hass(hass) {
    this._hass = hass;
    this._render();
  }
  _render() {
    if (!this._hass || !this._config) return;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s) =>
        ({ entity: "Sensor (Smart Domofon)", name: "Name", history: "History rows" })[s.name] || s.name;
      this._form.addEventListener("value-changed", (ev) => {
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: ev.detail.value }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.data = this._config;
    this._form.schema = [
      { name: "entity", selector: { entity: { domain: "sensor", integration: "domofon" } } },
      { name: "name", selector: { text: {} } },
      { name: "history", selector: { number: { min: 0, max: 20, mode: "box" } } },
    ];
  }
}

customElements.define("domofon-card", DomofonCard);
customElements.define("domofon-card-editor", DomofonCardEditor);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "domofon-card",
  name: "Domofon Card",
  description: "Smart Domofon intercom: ringing state, open / reject, modes and call history",
  preview: true,
  documentationURL: "https://github.com/heartpolik/domofon-card",
});
console.info(`%c DOMOFON-CARD %c v${VERSION} `, "background:#43a047;color:#fff;font-weight:700", "");
