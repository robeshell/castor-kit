<script setup>
import { computed, ref } from 'vue'
import { useData, withBase } from 'vitepress'

/**
 * A live, simplified replica of the castor-kit admin UI. Accent and nav mode are switchable;
 * light / dark follows the docs site. Accent stops are the same hex values as apps/web/src/index.css.
 */
const props = defineProps({ t: { type: Object, required: true } })
const { isDark } = useData()

const ACCENTS = {
  ocean: [['#2563eb', '#0284c7', '#22d3ee'], ['#3b82f6', '#0ea5e9', '#22d3ee']],
  violet: [['#7c3aed', '#9333ea', '#e879f9'], ['#8b5cf6', '#a855f7', '#f0abfc']],
  emerald: [['#059669', '#0d9488', '#2dd4bf'], ['#10b981', '#14b8a6', '#5eead4']],
  rose: [['#e11d48', '#db2777', '#fb7185'], ['#f43f5e', '#ec4899', '#fda4af']],
  amber: [['#ea580c', '#f97316', '#fbbf24'], ['#f97316', '#fb923c', '#fcd34d']],
  slate: [['#334155', '#475569', '#94a3b8'], ['#64748b', '#94a3b8', '#cbd5e1']],
}
const accent = ref('ocean')
const nav = ref('sidebar')

const stops = (id) => ACCENTS[id][isDark.value ? 1 : 0]
const vars = computed(() => {
  const [from, via, to] = stops(accent.value)
  return { '--m-from': from, '--m-via': via, '--m-to': to }
})
const swatch = (id) => {
  const [from, via, to] = stops(id)
  return { background: `linear-gradient(135deg, ${from}, ${via} 55%, ${to})` }
}

const logo = withBase('/castor-logo.png')
const bars = [38, 52, 44, 70, 58, 86, 64]
const m = computed(() => props.t.mock)
</script>

<template>
  <div class="mock-wrap">
    <div class="controls">
      <div class="control">
        <span class="label">{{ t.accent }}</span>
        <div class="swatches">
          <button
            v-for="id in Object.keys(ACCENTS)"
            :key="id"
            type="button"
            class="swatch"
            :class="{ on: accent === id }"
            :style="swatch(id)"
            :title="t.accents[id]"
            :aria-label="t.accents[id]"
            :aria-pressed="accent === id"
            @click="accent = id"
          />
        </div>
      </div>
      <div class="control">
        <span class="label">{{ t.nav }}</span>
        <div class="segmented" role="group">
          <button
            v-for="(label, id) in t.navModes"
            :key="id"
            type="button"
            :class="{ on: nav === id }"
            :aria-pressed="nav === id"
            @click="nav = id"
          >
            {{ label }}
          </button>
        </div>
      </div>
    </div>

    <div class="frame" :style="vars" aria-hidden="true">
      <div class="chrome"><i /><i /><i /><span class="url">localhost:5173</span></div>
      <div class="app" :class="`nav-${nav}`">
        <aside v-if="nav !== 'top'" class="side">
          <div class="brand"><img :src="logo" alt="" /><b>castor<span class="grad">kit</span></b></div>
          <div class="group">{{ nav === 'mixed' ? m.groups[2] : m.groups[0] }}</div>
          <div v-for="(item, i) in m.menu" :key="item" class="item" :class="{ active: i === 5 }">
            <span class="ico" />{{ item }}
          </div>
        </aside>
        <main class="main">
          <header class="top">
            <template v-if="nav === 'top'">
              <div class="brand"><img :src="logo" alt="" /><b>castor<span class="grad">kit</span></b></div>
              <div class="hnav">
                <span v-for="(g, i) in m.groups" :key="g" :class="{ active: i === 2 }">{{ g }}</span>
              </div>
            </template>
            <div v-else-if="nav === 'mixed'" class="hnav">
              <span v-for="(g, i) in m.groups" :key="g" :class="{ active: i === 2 }">{{ g }}</span>
            </div>
            <div v-else class="crumbs">{{ m.groups[2] }} <em>/</em> <b>{{ m.title }}</b></div>
            <div class="top-right"><span class="search">⌘K</span><span class="avatar">A</span></div>
          </header>
          <div class="tabs">
            <span v-for="(tab, i) in m.tabs" :key="tab" :class="{ active: i === 2 }">{{ tab }}</span>
          </div>
          <section class="page">
            <div class="page-head">
              <h4>{{ m.title }}</h4>
              <span class="btn-primary">+ {{ m.create }}</span>
            </div>
            <div class="stats">
              <div v-for="n in 3" :key="n" class="stat">
                <div class="stat-num">{{ [128, 96, 7][n - 1] }}</div>
                <div class="mini-bars">
                  <span v-for="(h, i) in bars" :key="i" :style="{ height: `${Math.min(100, h + n * 6)}%` }" />
                </div>
              </div>
            </div>
            <div class="filters">
              <span class="input">{{ m.search }}</span>
              <span class="btn-query">{{ m.query }}</span>
            </div>
            <div class="table">
              <div class="tr th"><span v-for="c in m.cols" :key="c">{{ c }}</span></div>
              <div v-for="row in m.rows" :key="row[1]" class="tr">
                <span>{{ row[0] }}</span>
                <span class="mono">{{ row[1] }}</span>
                <span><i class="badge" :class="m.status[row[2]]">{{ row[2] }}</i></span>
                <span>{{ row[3] }}</span>
              </div>
            </div>
            <div class="pager"><span>‹</span><span class="on">1</span><span>2</span><span>3</span><span>›</span></div>
          </section>
        </main>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mock-wrap {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.controls {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 14px 28px;
}
.control {
  display: flex;
  align-items: center;
  gap: 10px;
}
.label {
  font-size: 13px;
  color: var(--vp-c-text-2);
}
.swatches {
  display: flex;
  gap: 8px;
}
.swatch {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  transition: transform 0.15s, box-shadow 0.15s;
}
.swatch:hover {
  transform: scale(1.1);
}
.swatch.on {
  box-shadow: 0 0 0 2px var(--vp-c-bg), 0 0 0 4px var(--vp-c-text-2);
}
.segmented {
  display: inline-flex;
  padding: 3px;
  border-radius: 9px;
  background: var(--vp-c-default-soft);
}
.segmented button {
  padding: 4px 12px;
  border-radius: 7px;
  font-size: 13px;
  color: var(--vp-c-text-2);
  transition: background 0.15s, color 0.15s;
}
.segmented button.on {
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.08), 0 0 0 1px var(--vp-c-divider);
}

/* ---- the fake window ---- */
.frame {
  --m-bg: #ffffff;
  --m-side: #f7f8fa;
  --m-border: #ebebeb;
  --m-text: #0a0a0a;
  --m-muted: #737373;
  --m-soft: color-mix(in srgb, var(--m-from) 9%, transparent);
  border-radius: 16px;
  overflow: hidden;
  background: var(--m-bg);
  color: var(--m-text);
  box-shadow:
    0 0 0 1px var(--vp-c-divider),
    0 30px 80px -30px color-mix(in srgb, var(--m-from) 35%, rgb(15 23 42 / 0.35)),
    0 8px 24px -12px rgb(15 23 42 / 0.18);
  font-size: 12px;
  text-align: left;
  transition: box-shadow 0.4s;
}
.dark .frame {
  --m-bg: #0a0a0a;
  --m-side: #0d0d0d;
  --m-border: #1f1f1f;
  --m-text: #f5f5f5;
  --m-muted: #a3a3a3;
  --m-soft: color-mix(in srgb, var(--m-from) 16%, transparent);
  box-shadow:
    0 0 0 1px #262626,
    0 30px 80px -30px color-mix(in srgb, var(--m-from) 45%, transparent);
}
.chrome {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 14px;
  border-bottom: 1px solid var(--m-border);
  background: var(--m-side);
}
.chrome i {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--m-muted) 35%, transparent);
}
.url {
  margin: 0 auto;
  padding: 3px 60px;
  border-radius: 6px;
  background: var(--m-bg);
  box-shadow: 0 0 0 1px var(--m-border);
  font-size: 11px;
  color: var(--m-muted);
}
.app {
  display: flex;
  height: 440px;
}
.grad {
  background-image: linear-gradient(135deg, var(--m-from), var(--m-via) 55%, var(--m-to));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.brand {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 14px;
  letter-spacing: -0.035em;
}
.brand img {
  width: 22px;
  height: 22px;
}

.side {
  width: 176px;
  flex-shrink: 0;
  padding: 14px 10px;
  border-right: 1px solid var(--m-border);
  background: var(--m-side);
}
.side .brand {
  padding: 0 6px 12px;
}
.group {
  padding: 8px 8px 6px;
  font-size: 11px;
  color: var(--m-muted);
}
.item {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 28px;
  padding: 0 8px;
  border-radius: 6px;
  color: color-mix(in srgb, var(--m-text) 75%, transparent);
}
.ico {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  border: 1.5px solid currentColor;
  opacity: 0.55;
}
.item.active {
  background: var(--m-bg);
  color: var(--m-text);
  font-weight: 500;
  box-shadow: 0 0 0 1px var(--m-border), 0 1px 2px rgb(0 0 0 / 0.05);
}
.item.active .ico {
  color: var(--m-from);
  opacity: 1;
}

.main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}
.top {
  display: flex;
  align-items: center;
  gap: 16px;
  height: 44px;
  padding: 0 16px;
  border-bottom: 1px solid var(--m-border);
}
.crumbs {
  color: var(--m-muted);
}
.crumbs em {
  margin: 0 4px;
  font-style: normal;
  opacity: 0.6;
}
.crumbs b {
  color: var(--m-text);
  font-weight: 500;
}
.hnav {
  display: flex;
  gap: 4px;
}
.hnav span {
  padding: 5px 10px;
  border-radius: 6px;
  color: var(--m-muted);
}
.hnav span.active {
  background: color-mix(in srgb, var(--m-text) 6%, transparent);
  color: var(--m-text);
  font-weight: 500;
}
.top-right {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}
.search {
  padding: 3px 36px 3px 10px;
  border-radius: 6px;
  box-shadow: 0 0 0 1px var(--m-border);
  font-size: 10px;
  color: var(--m-muted);
}
.avatar {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--m-text) 7%, transparent);
  font-size: 10px;
}
.tabs {
  display: flex;
  gap: 4px;
  height: 34px;
  align-items: center;
  padding: 0 12px;
  border-bottom: 1px solid var(--m-border);
}
.tabs span {
  padding: 3px 9px;
  border-radius: 5px;
  font-size: 11px;
  color: var(--m-muted);
}
.tabs span.active {
  background: var(--m-soft);
  color: var(--m-from);
  font-weight: 500;
}

.page {
  flex: 1;
  padding: 16px 20px;
  overflow: hidden;
}
.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.page-head h4 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.02em;
}
.btn-primary,
.btn-query {
  padding: 5px 11px;
  border-radius: 6px;
  background: linear-gradient(135deg, var(--m-from), var(--m-via));
  color: #fff;
  font-weight: 500;
  box-shadow: 0 6px 14px -6px color-mix(in srgb, var(--m-from) 60%, transparent);
  transition: background 0.3s;
}
.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin: 14px 0 12px;
}
.stat {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 10px;
  box-shadow: 0 0 0 1px var(--m-border);
}
.stat-num {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.02em;
}
.mini-bars {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 26px;
}
.mini-bars span {
  width: 5px;
  border-radius: 2px;
  background: linear-gradient(to top, var(--m-from), var(--m-to));
  opacity: 0.85;
  transition: background 0.3s;
}
.filters {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}
.input {
  width: 180px;
  padding: 5px 10px;
  border-radius: 6px;
  box-shadow: 0 0 0 1px var(--m-border);
  color: var(--m-muted);
}
.table {
  border-radius: 10px;
  box-shadow: 0 0 0 1px var(--m-border);
  overflow: hidden;
}
.tr {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr 0.8fr;
  align-items: center;
  height: 32px;
  padding: 0 12px;
  border-top: 1px solid var(--m-border);
}
.tr.th {
  border-top: 0;
  background: var(--m-side);
  color: var(--m-muted);
  font-size: 11px;
}
.mono {
  font-family: var(--vp-font-family-mono);
  color: var(--m-muted);
}
.badge {
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 10.5px;
  font-style: normal;
}
.badge.ok {
  background: rgb(34 197 94 / 0.12);
  color: #16a34a;
}
.badge.warn {
  background: rgb(245 158 11 / 0.14);
  color: #d97706;
}
.badge.off {
  background: color-mix(in srgb, var(--m-text) 7%, transparent);
  color: var(--m-muted);
}
.pager {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 10px;
}
.pager span {
  display: grid;
  place-items: center;
  min-width: 22px;
  height: 22px;
  border-radius: 6px;
  color: var(--m-muted);
}
.pager span.on {
  background: var(--m-from);
  color: #fff;
}

@media (max-width: 720px) {
  .side,
  .stats,
  .search {
    display: none;
  }
  .app {
    height: 380px;
  }
  .tr {
    grid-template-columns: 1.4fr 1fr 1fr;
  }
  .tr > span:last-child {
    display: none;
  }
}
</style>
