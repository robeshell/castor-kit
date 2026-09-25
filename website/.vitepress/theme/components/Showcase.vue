<script setup>
import { computed, ref } from 'vue'
import { useData, withBase } from 'vitepress'

/**
 * Real product screenshots (captured by `npm --prefix website run screenshots`).
 * The main frame switches between views in the page's language; light / dark follows the docs site.
 * The accent strip shows the dashboard in each of the six accent colors.
 */
const props = defineProps({ t: { type: Object, required: true } })
const { isDark, lang } = useData()

const VIEWS = ['dashboard', 'list', 'appearance', 'top-nav', 'login']
const ACCENTS = ['ocean', 'violet', 'emerald', 'rose', 'amber', 'slate']
const SWATCH = {
  ocean: ['#2563eb', '#22d3ee'],
  violet: ['#7c3aed', '#e879f9'],
  emerald: ['#059669', '#2dd4bf'],
  rose: ['#e11d48', '#fb7185'],
  amber: ['#ea580c', '#fbbf24'],
  slate: ['#334155', '#94a3b8'],
}

const view = ref('dashboard')
const theme = computed(() => (isDark.value ? 'dark' : 'light'))
const shotLang = computed(() => (['zh-CN', 'en-US', 'ja-JP'].includes(lang.value) ? lang.value : 'zh-CN'))
const mainSrc = computed(() => withBase(`/screenshots/${shotLang.value}/${view.value}-${theme.value}.webp`))
const accentSrc = (accent) => withBase(`/screenshots/accent/${accent}-${theme.value}.webp`)
const alt = computed(() => `castor-kit — ${props.t.views[view.value]}`)
</script>

<template>
  <div class="showcase">
    <div class="views" role="tablist">
      <button
        v-for="id in VIEWS"
        :key="id"
        type="button"
        role="tab"
        :aria-selected="view === id"
        :class="{ on: view === id }"
        @click="view = id"
      >
        {{ t.views[id] }}
      </button>
    </div>

    <div class="frame">
      <div class="chrome"><i /><i /><i /><span class="url">localhost:5173</span></div>
      <div class="screen">
        <Transition name="swap" mode="out-in">
          <img :key="mainSrc" :src="mainSrc" :alt="alt" width="1440" height="900" decoding="async" />
        </Transition>
      </div>
    </div>

    <div class="accents">
      <p class="accents-title">{{ t.accentsTitle }}</p>
      <div class="accent-grid">
        <figure v-for="id in ACCENTS" :key="id" class="accent">
          <img :src="accentSrc(id)" :alt="t.accents[id]" width="1440" height="900" loading="lazy" decoding="async" />
          <figcaption>
            <span class="dot" :style="{ background: `linear-gradient(135deg, ${SWATCH[id][0]}, ${SWATCH[id][1]})` }" />
            {{ t.accents[id] }}
          </figcaption>
        </figure>
      </div>
    </div>
  </div>
</template>

<style scoped>
.showcase {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.views {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
  margin: 0 auto;
  padding: 4px;
  border-radius: 11px;
  background: var(--vp-c-default-soft);
}
.views button {
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 13.5px;
  color: var(--vp-c-text-2);
  transition: background 0.15s, color 0.15s;
}
.views button:hover {
  color: var(--vp-c-text-1);
}
.views button.on {
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-weight: 500;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.08), 0 0 0 1px var(--vp-c-divider);
}

.frame {
  border-radius: 14px;
  overflow: hidden;
  background: var(--vp-c-bg);
  box-shadow:
    0 0 0 1px var(--vp-c-divider),
    0 30px 80px -30px color-mix(in srgb, var(--ck-from) 35%, rgb(15 23 42 / 0.35)),
    0 8px 24px -12px rgb(15 23 42 / 0.18);
}
.dark .frame {
  box-shadow:
    0 0 0 1px #262626,
    0 30px 80px -30px color-mix(in srgb, var(--ck-from) 40%, transparent);
}
.chrome {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 14px;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-alt);
}
.chrome i {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--vp-c-text-3) 45%, transparent);
}
.url {
  margin: 0 auto;
  padding: 3px 60px;
  border-radius: 6px;
  background: var(--vp-c-bg);
  box-shadow: 0 0 0 1px var(--vp-c-divider);
  font-size: 11px;
  color: var(--vp-c-text-3);
}
.screen {
  aspect-ratio: 1440 / 900;
  background: var(--vp-c-bg-alt);
}
.screen img {
  display: block;
  width: 100%;
  height: 100%;
}
.swap-enter-active,
.swap-leave-active {
  transition: opacity 0.18s ease;
}
.swap-enter-from,
.swap-leave-to {
  opacity: 0;
}

.accents {
  margin-top: 28px;
}
.accents-title {
  margin: 0 0 14px;
  text-align: center;
  font-size: 15px;
  font-weight: 600;
}
.accent-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
}
.accent {
  margin: 0;
}
.accent img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 8px;
  box-shadow: 0 0 0 1px var(--vp-c-divider), 0 6px 16px -10px rgb(15 23 42 / 0.3);
  transition: transform 0.2s;
}
.accent:hover img {
  transform: translateY(-2px);
}
.accent figcaption {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 12.5px;
  color: var(--vp-c-text-2);
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
}

@media (max-width: 860px) {
  .accent-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (max-width: 480px) {
  .accent-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .url {
    padding: 3px 24px;
  }
}
</style>
