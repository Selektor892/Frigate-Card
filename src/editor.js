// editor.js — FrigateModernHassCardEditor config panel
import { DEFAULT_ROTATE_S, GRID_LAYOUTS, findLayout } from './constants.js';
import { t } from './i18n.js';

export class FrigateModernHassCardEditor extends HTMLElement {
  setConfig(c) { this._config=c; this._render(); }
  set hass(h) {
    this._hass = h;
    // Only re-render when the camera entity list actually changes — prevents dropdown closing
    const key = this._frigateEntities().join(',');
    const lang = h?.locale?.language || h?.language || '';
    if (key !== this._lastEntityKey || lang !== this._lastLang) { this._lastEntityKey = key; this._lastLang = lang; this._render(); }
  }

  _t(key, vars) { return t(this._hass, key, vars); }
  _layoutName(l) { const k = 'layouts.' + l.id; const v = this._t(k); return v === k ? l.label : v; }

  _frigateEntities() {
    if (!this._hass) return [];
    return Object.keys(this._hass.states)
      .filter(e => e.startsWith('camera.'))
      .filter(e => {
        const a = this._hass.states[e].attributes;
        return a?.client_id || a?.mqtt_client_id || a?.camera_name; // Frigate-specific attrs
      })
      .sort();
  }

  _render() {
    const frigEntities = this._frigateEntities();
    const allCamEntities = this._hass ? Object.keys(this._hass.states).filter(e=>e.startsWith('camera.')).sort() : [];
    const entityList = frigEntities.length ? frigEntities : allCamEntities;

    const cams = this._config?.cameras
      ? this._config.cameras
      : (this._config?.camera_entity ? [{ entity: this._config.camera_entity, name: '' }] : [{ entity: '', name: '' }]);

    const opts = (sel) => entityList.map(e => `<option value="${e}" ${e===sel?'selected':''}>${e}</option>`).join('');

    const layoutId = this._config?.grid_layout || 'auto';
    const usingLayout = layoutId !== 'auto';
    // Offering a layout with fewer tiles than there are cameras is just wrong,
    // so hide those. If nothing is big enough, show everything rather than an
    // empty picker.
    const fitting = GRID_LAYOUTS.filter(l => l.id === 'auto' || l.tiles >= cams.length);
    const layoutChoices = fitting.length > 1 ? fitting : GRID_LAYOUTS;
    // The tile number leads the row, so you read "tile 1 shows this camera",
    // which is the direction people think in. Picking a camera that already
    // sits in another tile swaps the two, so choosing is also positioning and
    // no separate reorder control is needed.
    const camRows = cams.map((c,i) => `
      <div class="cr" data-row="${i}">
        <span class="cnum" title="${this._t('e_tile', {n: i+1})}">${i+1}</span>
        <select name="cam-entity-${i}" class="ce" data-cam-entity="${i}">
          <option value="">${this._t('e_select_camera')}</option>
          ${opts(c.entity||'')}
        </select>
        <input type="text" name="cam-name-${i}" class="cn" data-cam-name="${i}" placeholder="${this._t('e_display_name')}" value="${c.name||''}">
        ${usingLayout ? '' : `
        <select class="cs" data-cam-span="${i}" title="${this._t('e_tile_size')}">
          ${[1,2,3].map(v => `<option value="${v}" ${Number(c.span?.cols ?? c.span ?? 1)===v?'selected':''}>${v}x${v}</option>`).join('')}
        </select>`}
        ${cams.length > 1 ? `<button class="xb" data-remove-cam="${i}" title="${this._t('e_remove')}">✕</button>` : ''}
      </div>`).join('');

    const hiddenTabs = new Set(this._config?.hidden_tabs || []);
    const tabCheck = (id, label) => `<label class="chk-lbl">
      <input type="checkbox" name="hide-${id}" data-hide-tab="${id}" ${hiddenTabs.has(id)?'checked':''}> ${label}
    </label>`;

    const defaultView = this._config?.default_view || 'single';
    const rotateOnLoad = this._config?.rotate_on_load === true;
    const multiCam = cams.length > 1 || (cams.length === 1 && !cams[0].entity);

    this.innerHTML = `<style>
      /* The editor lives in Home Assistant's own dialog, not in a shadow root of
         ours, so it has to follow the user's theme. Fixed colours here meant an
         unreadable panel on every dark theme. Each variable keeps a light
         fallback for the rare theme that does not define it. */
      .ed-wrap{display:flex;flex-direction:column;gap:14px;padding:6px 2px;
        font-family:var(--paper-font-body1_-_font-family,sans-serif);
        color:var(--primary-text-color,#111);
        --ed-dim:var(--secondary-text-color,#6b7280);
        --ed-line:var(--divider-color,#e5e7eb);
        --ed-field:var(--card-background-color,#fff);
        --ed-acc:var(--primary-color,#3b82f6);}
      .field-label{font-size:12px;font-weight:600;margin-bottom:4px;display:block;color:var(--primary-text-color,#111);}
      .section{border-top:1px solid var(--ed-line);padding-top:12px;}
      .hint{color:var(--ed-dim);font-size:11px;}
      .cr{display:flex;gap:5px;align-items:center;margin-bottom:6px;}
      .ce,.cn,.tf,.cs{border:1px solid var(--ed-line);border-radius:6px;font-size:12px;
        background:var(--ed-field);color:var(--primary-text-color,#111);box-sizing:border-box;}
      .ce,.cn{flex:1;padding:7px;min-width:0;}
      .tf{width:100%;padding:7px;}
      .cs{padding:7px 4px;flex-shrink:0;}
      .xb{padding:5px 8px;border:1px solid var(--error-color,#f87171);background:transparent;
        color:var(--error-color,#b91c1c);border-radius:6px;cursor:pointer;font-size:12px;flex-shrink:0;}
      .add-btn{padding:6px 12px;border:1px solid var(--ed-acc);background:transparent;color:var(--ed-acc);
        border-radius:7px;cursor:pointer;font-size:12px;margin-top:2px;}
      .radio-row,.chk-row{display:flex;gap:14px;flex-wrap:wrap;}
      .radio-lbl,.chk-lbl{display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer;color:var(--primary-text-color,#111);}
      .chk-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;}
      .cnum{width:26px;height:26px;flex-shrink:0;display:flex;align-items:center;justify-content:center;
        background:transparent;color:var(--ed-acc);border:1px solid var(--ed-acc);border-radius:6px;font-size:11px;font-weight:700;}
      .lay-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(74px,1fr));gap:8px;margin:4px 0 8px;}
      .lay{padding:6px 5px 5px;border:1px solid var(--ed-line);border-radius:8px;background:transparent;
        color:inherit;cursor:pointer;display:flex;flex-direction:column;gap:4px;align-items:center;}
      .lay:hover{border-color:var(--ed-acc);}
      .lay.sel{border-color:var(--ed-acc);box-shadow:0 0 0 1px var(--ed-acc) inset;}
      .lay-prev{width:100%;aspect-ratio:4/3;display:grid;gap:2px;grid-auto-flow:dense;grid-auto-rows:1fr;}
      /* Neutral grey reads on a light and a dark theme alike. */
      .lay-prev span{background:rgba(128,128,128,.35);border-radius:2px;display:flex;align-items:center;
        justify-content:center;font-size:9px;color:var(--primary-text-color,#475569);font-weight:700;}
      .lay.sel .lay-prev span{background:var(--ed-acc);color:var(--text-primary-color,#fff);}
      .lay-auto{width:100%;aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;
        color:var(--ed-dim);font-size:10px;text-align:center;border:1px dashed var(--ed-line);border-radius:4px;}
      .lay-lbl{font-size:10px;color:var(--primary-text-color,#374151);text-align:center;line-height:1.2;}
    </style>
    <div class="ed-wrap">
      <div>
        <span class="field-label">${this._t('e_cameras')} ${frigEntities.length ? `<small class="hint" style="font-weight:400">${this._t('e_detected')}</small>` : ''}</span>
        <div id="cam-list">${camRows}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <button class="add-btn" id="add-cam">${this._t('e_add_camera')}</button>
          <button class="add-btn" id="toggle-layout">${this._t('e_grid_layout')}${usingLayout ? `: ${findLayout(layoutId) ? this._layoutName(findLayout(layoutId)) : ''}` : ''}</button>
        </div>
        ${cams.length > 1 ? `<small class="hint" style="display:block;margin-top:4px">${this._t('e_tile_hint')}</small>` : ''}
        ${cams.length > 4 ? `<small class="hint" style="display:block;margin-top:4px">${this._t('e_load_hint')}</small>` : ''}
        <div id="layout-picker" style="display:${this._layoutOpen ? 'block' : 'none'};margin-top:8px">
          <div class="lay-grid">${layoutChoices.map(l => this._layoutButton(l, layoutId)).join('')}</div>
          <small class="hint">${this._t('e_layout_hint')}</small>
          <div style="border-top:1px solid var(--divider-color);margin-top:10px;padding-top:8px">
            <label class="chk-lbl"><input type="checkbox" name="stack_on_mobile" id="stack_on_mobile" ${this._config?.stack_on_mobile!==false?'checked':''}> ${this._t('e_stack_mobile')}</label>
            <small class="hint" style="display:block;margin-top:4px">${this._t('e_stack_mobile_hint')}</small>
          </div>
        </div>
      </div>

      <label><span class="field-label">${this._t('e_title')}</span>
        <input name="title" class="tf" id="title" type="text" value="${this._config?.title||''}" placeholder="My Camera">
      </label>
      <label><span class="field-label">${this._t('e_subtitle')}</span>
        <input name="subtitle" class="tf" id="subtitle" type="text" value="${this._config?.subtitle||''}" placeholder="Frigate">
      </label>

      <div class="section">
        <span class="field-label">${this._t('e_view')}</span>
        <div class="radio-row">
          <label class="radio-lbl"><input type="radio" name="default_view" value="single" ${defaultView==='single'?'checked':''}> ${this._t('e_single_camera')}</label>
          <label class="radio-lbl"><input type="radio" name="default_view" value="grid" ${defaultView==='grid'?'checked':''}> ${this._t('e_grid_all')}</label>
        </div>
        <div style="margin-top:8px">
          <label class="chk-lbl"><input type="checkbox" name="rotate_on_load" id="rotate_on_load" ${rotateOnLoad?'checked':''}> ${this._t('e_rotate_on_load')}</label>
        </div>
        <div style="margin-top:6px">
          <label><span class="hint">${this._t('e_rotate_interval', {n: DEFAULT_ROTATE_S})}</span>
            <input name="rotate_seconds" class="tf" id="rotate_seconds" type="number" value="${this._config?.rotate_seconds??0}" min="0" style="margin-top:3px">
          </label>
        </div>
      </div>
      <div class="section">
        <span class="field-label">${this._t('e_theme')}</span>
        <div class="radio-row">
          <label class="radio-lbl"><input type="radio" name="theme" value="dark"  ${(this._config?.theme||'dark')==='dark' ?'checked':''}> ${this._t('e_dark')}</label>
          <label class="radio-lbl"><input type="radio" name="theme" value="light" ${this._config?.theme==='light'?'checked':''}> ${this._t('e_light')}</label>
          <label class="radio-lbl"><input type="radio" name="theme" value="auto"  ${this._config?.theme==='auto' ?'checked':''}> ${this._t('e_auto_browser')}</label>
          <label class="radio-lbl"><input type="radio" name="theme" value="ha" ${this._config?.theme==='ha'?'checked':''}> ${this._t('e_ha_theme')}</label>
        </div>
      </div>
      <div class="section" ${this._config?.theme==='ha'?'style="display:none"':''}>
        <span class="field-label">${this._t('e_colors')}</span>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px;">
          <div>
            <label class="chk-lbl" style="margin-bottom:4px">
              <input type="checkbox" id="use_accent" ${this._config?.accent_color?'checked':''}> ${this._t('e_custom_accent')}
            </label>
            <div style="display:flex;align-items:center;gap:6px">
              <input type="color" id="accent_color" value="${this._config?.accent_color||'#3b82f6'}" style="width:40px;height:30px;border:none;padding:2px;border-radius:6px;cursor:pointer">
              <span class="hint" id="accent_lbl">${this._config?.accent_color||'#3b82f6'}</span>
            </div>
          </div>
          <div>
            <label class="chk-lbl" style="margin-bottom:4px">
              <input type="checkbox" id="use_bg" ${this._config?.bg_color?'checked':''}> ${this._t('e_custom_bg')}
            </label>
            <div style="display:flex;align-items:center;gap:6px">
              <input type="color" id="bg_color" value="${this._config?.bg_color||'#1c2233'}" style="width:40px;height:30px;border:none;padding:2px;border-radius:6px;cursor:pointer">
              <span class="hint" id="bg_lbl">${this._config?.bg_color||'#1c2233'}</span>
            </div>
          </div>
        </div>
        <small class="hint">${this._t('e_colors_hint')}</small>
      </div>

      <div class="section">
        <span class="field-label">${this._t('e_hidden_tabs')}</span>
        <div class="chk-grid">
          ${tabCheck('recordings',this._t('recordings'))}
          ${tabCheck('clips',this._t('clips'))}
          ${tabCheck('snapshot',this._t('snapshots'))}
          ${tabCheck('reviews',this._t('reviews'))}
          ${tabCheck('kept',this._t('kept'))}
        </div>
      </div>

      <div class="section" ${usingLayout ? 'style="display:none"' : ''}>
        <span class="field-label">${this._t('e_grid_columns')}</span>
        <div class="radio-row">
          <label class="radio-lbl"><input type="radio" name="grid_columns" value="auto" ${(this._config?.grid_columns||'auto')==='auto'?'checked':''}> ${this._t('e_automatic')}</label>
          <label class="radio-lbl"><input type="radio" name="grid_columns" value="1" ${String(this._config?.grid_columns)==='1'?'checked':''}> ${this._t('e_stacked')}</label>
          <label class="radio-lbl"><input type="radio" name="grid_columns" value="2" ${String(this._config?.grid_columns)==='2'?'checked':''}> 2</label>
          <label class="radio-lbl"><input type="radio" name="grid_columns" value="3" ${String(this._config?.grid_columns)==='3'?'checked':''}> 3</label>
          <label class="radio-lbl"><input type="radio" name="grid_columns" value="4" ${String(this._config?.grid_columns)==='4'?'checked':''}> 4</label>
        </div>
        <small class="hint">${this._t('e_columns_hint', {cols: this._colsAt(800, cams.length)})}</small>
      </div>

      <div class="section">
        <span class="field-label">${this._t('e_events_panel')}</span>
        <div class="radio-row" style="margin-bottom:6px">
          <label class="radio-lbl"><input type="radio" name="sidebar_position" value="right" ${this._config?.sidebar_position!=='left'?'checked':''}> ${this._t('e_sidebar_right')}</label>
          <label class="radio-lbl"><input type="radio" name="sidebar_position" value="left" ${this._config?.sidebar_position==='left'?'checked':''}> ${this._t('e_sidebar_left')}</label>
        </div>
        <label class="chk-lbl" style="margin-bottom:6px"><input type="checkbox" name="sidebar_separate" id="sidebar_separate" ${this._config?.sidebar_separate===true?'checked':''}> ${this._t('e_sidebar_separate')}</label>
        <small class="hint" style="display:block;margin-bottom:8px">${this._t('e_sidebar_separate_hint')}</small>
        <label class="chk-lbl"><input type="checkbox" name="events_collapsed" id="events_collapsed" ${this._config?.events_collapsed===true?'checked':''}> ${this._t('e_events_collapsed')}</label>
        <small class="hint" style="display:block;margin-top:4px">${this._t('e_events_collapsed_hint')}</small>
      </div>
      </div>

      <div class="section">
        <span class="field-label">${this._t('e_live_provider')}</span>
        <div class="radio-row">
          <label class="radio-lbl"><input type="radio" name="live_provider" value="hls" ${(this._config?.live_provider||'hls')==='hls'?'checked':''}> ${this._t('e_ha_stream')}</label>
          <label class="radio-lbl"><input type="radio" name="live_provider" value="go2rtc" ${this._config?.live_provider==='go2rtc'?'checked':''}> ${this._t('e_go2rtc')}</label>
        </div>
        <small class="hint">${this._t('e_go2rtc_hint')}</small>
        <div style="margin-top:8px">
          <span class="field-label">${this._t('e_go2rtc_transport')}</span>
          <div class="radio-row">
            <label class="radio-lbl"><input type="radio" name="go2rtc_mode" value="mse" ${(this._config?.go2rtc_mode||'mse')==='mse'?'checked':''}> ${this._t('e_mse')}</label>
            <label class="radio-lbl"><input type="radio" name="go2rtc_mode" value="webrtc" ${this._config?.go2rtc_mode==='webrtc'?'checked':''}> ${this._t('e_webrtc')}</label>
            <label class="radio-lbl"><input type="radio" name="go2rtc_mode" value="auto" ${this._config?.go2rtc_mode==='auto'?'checked':''}> ${this._t('e_automatic')}</label>
          </div>
          <small class="hint">${this._t('e_transport_hint')}</small>
        </div>
      </div>

      <div class="section">
        <span class="field-label">${this._t('e_max_height')}</span>
        <input name="stream_height" class="tf" id="stream_height" type="number"
          value="${this._config?.stream_height||''}" min="20" max="100"
          placeholder="${this._t('e_max_height_ph')}">
        <small class="hint">${this._t('e_max_height_hint')}</small>
      </div>

      <div class="section">
        <span class="field-label">${this._t('e_window_hours')}</span>
        <input name="window_hours" class="tf" id="window_hours" type="number" value="${this._config?.window_hours||24}" min="1" max="720">
      </div>


    </div>`;

    this.querySelector('#add-cam')?.addEventListener('click', () => {
      const cur = this._getCams(); cur.push({ entity:'', name:'' });
      this._config = { ...this._config, cameras: cur }; delete this._config.camera_entity; this._render(); this._dispatch();
    });
    this.querySelectorAll('[data-remove-cam]').forEach(b => b.addEventListener('click', e => {
      const cur = this._getCams(); cur.splice(Number(e.currentTarget.dataset.removeCam), 1);
      this._config = { ...this._config, cameras: cur }; delete this._config.camera_entity; this._render(); this._dispatch();
    }));
    this.querySelector('#toggle-layout')?.addEventListener('click', () => {
      this._layoutOpen = !this._layoutOpen; this._render();
    });
    // Picking a camera that is already shown in another tile moves it here and
    // sends whatever stood here back to the tile it came from. Without this you
    // would end up with the same camera twice and no way to place it. Runs
    // before the generic change handler so it can take over the update.
    this.querySelectorAll('[data-cam-entity]').forEach(el => el.addEventListener('change', ev => {
      const i = Number(ev.currentTarget.dataset.camEntity);
      const picked = ev.currentTarget.value;
      if (!picked) return;
      const before = cams;
      const j = before.findIndex((c, k) => k !== i && c.entity === picked);
      if (j < 0) return; // not in use elsewhere, nothing to swap
      ev.stopImmediatePropagation();
      const cur = this._getCams(); // keeps the sizes, which belong to the tile
      const nameOf = k => before[k]?.name || '';
      cur[i] = { ...cur[i], entity: picked, name: nameOf(j) };
      cur[j] = { ...cur[j], entity: before[i]?.entity || '', name: nameOf(i) };
      this._config = { ...this._config, cameras: cur }; delete this._config.camera_entity;
      this._render(); this._dispatch();
    }));
    this.querySelectorAll('[data-layout]').forEach(b => b.addEventListener('click', () => {
      this._config = { ...this._config, grid_layout: b.dataset.layout };
      this._render(); this._dispatch();
    }));
    this.querySelectorAll('select,input').forEach(el => el.addEventListener('change', () => this._u()));
    // The custom colour section is hidden while the card follows the HA theme.
    this.querySelectorAll('input[name="theme"]').forEach(el => el.addEventListener('change', () => this._render()));
    // prevent click outside from closing select while user is choosing
    this.querySelectorAll('select').forEach(sel => sel.addEventListener('mousedown', e => e.stopPropagation()));
    // sync color picker label as user drags
    ['accent','bg'].forEach(key => {
      const picker = this.querySelector(`#${key}_color`);
      const lbl    = this.querySelector(`#${key}_lbl`);
      if (picker && lbl) picker.addEventListener('input', () => { lbl.textContent = picker.value; });
    });
  }

  // What the current settings produce at a given card width. The card does this
  // same sum; showing it beats making someone resize a phone to find out.
  _colsAt(width, camCount) {
    if (this._config?.stack_on_mobile !== false && width < 500) return this._t('e_one_camera');
    const min = Number(this._config?.min_tile_width) > 0 ? Number(this._config.min_tile_width) : 200;
    const layout = findLayout(this._config?.grid_layout || 'auto');
    const pinned = Number(this._config?.grid_columns);
    let cols = layout && layout.cols ? layout.cols
      : (pinned > 0 ? pinned
      : (camCount <= 1 ? 1 : camCount <= 4 ? 2 : camCount <= 9 ? 3 : 4));
    cols = Math.max(1, Math.min(cols, Math.floor(width / min)));
    return cols === 1 ? this._t('e_one_camera') : this._t('e_n_cameras', {n: cols});
  }

  // Draw a layout as numbered cells. Seeing the shape is the point; a written
  // span tells nobody what they will end up with.
  _layoutButton(l, selected) {
    const sel = l.id === selected ? ' sel' : '';
    if (l.id === 'auto') {
      return `<button type="button" class="lay${sel}" data-layout="auto">
        <div class="lay-auto">${this._t('e_fits_count')}</div>
        <div class="lay-lbl">${this._layoutName(l)}</div></button>`;
    }
    const cells = Array.from({ length: l.tiles }, (_, i) => {
      const sp = l.spans[i];
      const style = sp ? ` style="grid-column:span ${sp[0]};grid-row:span ${sp[1]}"` : '';
      return `<span${style}>${i + 1}</span>`;
    }).join('');
    return `<button type="button" class="lay${sel}" data-layout="${l.id}">
      <div class="lay-prev" style="grid-template-columns:repeat(${l.cols},1fr)">${cells}</div>
      <div class="lay-lbl">${this._layoutName(l)}</div></button>`;
  }

  _getCams() {
    const rows = [...this.querySelectorAll('[data-row]')];
    return rows.map(r => {
      const span = Number(r.querySelector('[data-cam-span]')?.value || 1);
      return {
        entity: r.querySelector('[data-cam-entity]')?.value || '',
        name: r.querySelector('[data-cam-name]')?.value || '',
        // Only carry a size when it is not the default, to keep configs clean.
        ...(span > 1 ? { span } : {}),
      };
    });
  }
  _u() {
    const g = id => this.querySelector('#'+id)?.value?.trim() || '';
    const cams = this._getCams().filter(c => c.entity);
    const c = { ...this._config };
    if (cams.length > 1) { c.cameras = cams; delete c.camera_entity; }
    else if (cams.length === 1) { c.camera_entity = cams[0].entity; delete c.cameras; }
    const t=g('title'),s=g('subtitle'),w=g('window_hours'),r=g('rotate_seconds');
    if(t) c.title=t; else delete c.title;
    if(s) c.subtitle=s; else delete c.subtitle;
    if(w) c.window_hours=Number(w);
    c.rotate_seconds = Number(r)||0;
    // custom colors
    c.accent_color = this.querySelector('#use_accent')?.checked
      ? (this.querySelector('#accent_color')?.value || null) : null;
    c.bg_color = this.querySelector('#use_bg')?.checked
      ? (this.querySelector('#bg_color')?.value || null) : null;
    // theme
    c.theme = this.querySelector('input[name="theme"]:checked')?.value || 'dark';
    // default view
    const dv = this.querySelector('input[name="default_view"]:checked')?.value || 'single';
    c.default_view = dv;
    // rotate on load
    c.rotate_on_load = this.querySelector('#rotate_on_load')?.checked === true;
    // hidden tabs
    const hidden = [...this.querySelectorAll('[data-hide-tab]')]
      .filter(el => el.checked).map(el => el.dataset.hideTab);
    c.hidden_tabs = hidden.length ? hidden : [];
    const sh = this.querySelector('#stream_height')?.value;
    c.stream_height = sh ? Number(sh) : null;
    c.events_collapsed = this.querySelector('#events_collapsed')?.checked === true;
    c.sidebar_separate = this.querySelector('#sidebar_separate')?.checked === true;
    c.sidebar_position = this.querySelector('input[name="sidebar_position"]:checked')?.value === 'left' ? 'left' : 'right';
    if (this._config?.grid_layout) c.grid_layout = this._config.grid_layout;
    const gc = this.querySelector('input[name="grid_columns"]:checked')?.value || 'auto';
    c.grid_columns = gc === 'auto' ? 'auto' : Number(gc);
    c.stack_on_mobile = this.querySelector('#stack_on_mobile')?.checked !== false;
    c.live_provider = this.querySelector('input[name="live_provider"]:checked')?.value === 'go2rtc' ? 'go2rtc' : 'hls';
    c.go2rtc_mode = this.querySelector('input[name="go2rtc_mode"]:checked')?.value || 'mse';
    this._config=c; this._dispatch();
  }
  _dispatch() { this.dispatchEvent(new CustomEvent('config-changed',{detail:{config:this._config}})); }
}
