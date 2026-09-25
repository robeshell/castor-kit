<script setup>
import { computed, ref } from 'vue'
import { useData, withBase } from 'vitepress'
import AiTerminal from './AiTerminal.vue'
import Showcase from './Showcase.vue'
import { CONTENT, DEMO_URL, INSTALL, STACK } from './landing-content.js'

/** Marketing landing page (the site root of each locale); copy lives in landing-content.js */
const { lang } = useData()
const c = computed(() => CONTENT[lang.value] ?? CONTENT['zh-CN'])
const href = (path) => withBase(`${c.value.prefix}${path}`)
const logo = withBase('/castor-logo.png')

const copied = ref(false)
async function copyInstall() {
  try {
    await navigator.clipboard.writeText(INSTALL)
    copied.value = true
    setTimeout(() => (copied.value = false), 1600)
  } catch {
    /* clipboard blocked: the command is still selectable */
  }
}

// Lucide icon paths (ISC license), inlined so the page has no icon dependency
const ICONS = {
  shield:
    '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  layers:
    '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  languages: '<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>',
  palette:
    '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
  table: '<path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/>',
  container:
    '<path d="M22 7.7c0-.6-.4-1.2-.8-1.5l-6.3-3.9a1.72 1.72 0 0 0-1.7 0l-10.3 6c-.5.2-.9.8-.9 1.4v6.6c0 .5.4 1.2.8 1.5l6.3 3.9a1.72 1.72 0 0 0 1.7 0l10.3-6c.5-.3.9-1 .9-1.5Z"/><path d="M10 21.9V14L2.1 9.1"/><path d="m10 14 11.9-6.9"/><path d="M14 19.8v-8.1"/><path d="M18 17.5V9.4"/>',
}
</script>

<template>
  <div class="landing">
    <!-- ── hero ── -->
    <section class="hero">
      <div class="backdrop" aria-hidden="true">
        <div class="aurora a1" />
        <div class="aurora a2" />
        <div class="aurora a3" />
        <div class="grid" />
      </div>
      <div class="hero-inner">
        <div class="lockup">
          <img :src="logo" alt="" width="68" height="68" />
          <span class="ck-wordmark big">castor<span class="ck-gradient-text">kit</span></span>
        </div>
        <p class="eyebrow">{{ c.hero.eyebrow }}</p>
        <h1 class="title">
          <span>{{ c.hero.title[0] }}</span>
          <span class="ck-gradient-text">{{ c.hero.title[1] }}</span>
        </h1>
        <p class="lead">{{ c.hero.lead }}</p>
        <div class="actions">
          <a class="btn brand" :href="href('/guide/getting-started')">{{ c.hero.primary }} <span aria-hidden="true">→</span></a>
          <a class="btn alt" :href="DEMO_URL" target="_blank" rel="noreferrer">{{ c.hero.demo }}</a>
          <a class="btn alt" href="https://github.com/robeshell/castor-kit" target="_blank" rel="noreferrer">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 0-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6 0-3.2 0 0 1-.3 3.4 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.2.8.8 1.3 1.9 1.3 3.2 0 4.6-2.8 5.6-5.5 5.9.5.4.9 1.1.9 2.2v3.3c0 .3.1.7.8.6A12 12 0 0 0 12 .3"/></svg>
            {{ c.hero.secondary }}
          </a>
        </div>
        <button type="button" class="install" @click="copyInstall">
          <span class="dollar">$</span>
          <code>{{ INSTALL }}</code>
          <span class="copy">{{ copied ? c.hero.copied : c.hero.copy }}</span>
        </button>
        <dl class="stats">
          <div v-for="[num, label] in c.stats" :key="label">
            <dt class="ck-gradient-text">{{ num }}</dt>
            <dd>{{ label }}</dd>
          </div>
        </dl>
      </div>
    </section>

    <!-- ── product showcase ── -->
    <section class="section">
      <header class="section-head">
        <p class="kicker">{{ c.showcase.kicker }}</p>
        <h2>{{ c.showcase.title }}</h2>
        <p class="section-lead">{{ c.showcase.lead }}</p>
      </header>
      <Showcase :t="c.showcase" />
    </section>

    <!-- ── AI workflow ── -->
    <section class="section ai">
      <div class="ai-copy">
        <p class="kicker">{{ c.ai.kicker }}</p>
        <h2>{{ c.ai.title }}</h2>
        <p class="section-lead left">{{ c.ai.lead }}</p>
        <ol class="points">
          <li v-for="([title, text], i) in c.ai.points" :key="title">
            <span class="num">0{{ i + 1 }}</span>
            <div>
              <h3>{{ title }}</h3>
              <p>{{ text }}</p>
            </div>
          </li>
        </ol>
        <a class="more" :href="href('/guide/ai-workflow')">{{ c.ai.more }} →</a>
      </div>
      <AiTerminal :prompt="c.ai.prompt" :script="c.ai.script" />
    </section>

    <!-- ── features ── -->
    <section class="section">
      <header class="section-head">
        <p class="kicker">{{ c.features.kicker }}</p>
        <h2>{{ c.features.title }}</h2>
      </header>
      <div class="features">
        <article v-for="[icon, title, text] in c.features.items" :key="title" class="feature">
          <span class="icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" v-html="ICONS[icon]" />
          </span>
          <h3>{{ title }}</h3>
          <p>{{ text }}</p>
        </article>
      </div>
    </section>

    <!-- ── stack ── -->
    <section class="section stack">
      <p class="kicker">{{ c.stack.kicker }}</p>
      <div class="marquee" aria-label="tech stack">
        <div class="track">
          <span v-for="(item, i) in [...STACK, ...STACK]" :key="i" :aria-hidden="i >= STACK.length">{{ item }}</span>
        </div>
      </div>
    </section>

    <!-- ── call to action ── -->
    <section class="section cta">
      <div class="cta-card">
        <div class="cta-glow" aria-hidden="true" />
        <img :src="logo" alt="" width="64" height="64" />
        <h2>{{ c.cta.title }}</h2>
        <p>{{ c.cta.lead }}</p>
        <div class="actions">
          <a class="btn brand" :href="href('/guide/getting-started')">{{ c.cta.primary }}</a>
          <a class="btn alt" :href="href('/guide/components')">{{ c.cta.secondary }}</a>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.landing {
  --gutter: 24px;
  overflow: hidden;
}

/* ---------- hero ---------- */
.hero {
  position: relative;
  padding: 72px var(--gutter) 64px;
  text-align: center;
}
.backdrop {
  position: absolute;
  inset: -80px 0 0;
  pointer-events: none;
  overflow: hidden;
}
.aurora {
  position: absolute;
  border-radius: 999px;
  filter: blur(70px);
  opacity: 0.9;
}
.a1 {
  top: -10%;
  left: 8%;
  width: 44vmax;
  height: 44vmax;
  background: radial-gradient(closest-side, color-mix(in srgb, var(--ck-from) 22%, transparent), transparent);
  animation: drift1 24s ease-in-out infinite alternate;
}
.a2 {
  top: 4%;
  right: -6%;
  width: 38vmax;
  height: 38vmax;
  background: radial-gradient(closest-side, color-mix(in srgb, var(--ck-to) 22%, transparent), transparent);
  animation: drift2 28s ease-in-out infinite alternate;
}
.a3 {
  top: 40%;
  left: 36%;
  width: 36vmax;
  height: 36vmax;
  background: radial-gradient(closest-side, color-mix(in srgb, var(--ck-via) 16%, transparent), transparent);
  animation: drift1 32s ease-in-out infinite alternate-reverse;
}
.dark .aurora {
  opacity: 1;
}
@keyframes drift1 {
  to {
    transform: translate3d(10vw, 8vh, 0) scale(1.12);
  }
}
@keyframes drift2 {
  to {
    transform: translate3d(-12vw, 10vh, 0) scale(0.92);
  }
}
.grid {
  position: absolute;
  inset: -56px;
  background-image:
    linear-gradient(to right, color-mix(in srgb, var(--vp-c-text-1) 6%, transparent) 1px, transparent 1px),
    linear-gradient(to bottom, color-mix(in srgb, var(--vp-c-text-1) 6%, transparent) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: radial-gradient(ellipse 60% 55% at 50% 38%, black 20%, transparent 100%);
  animation: pan 18s linear infinite;
}
@keyframes pan {
  to {
    background-position: 56px 56px;
  }
}
.hero-inner {
  position: relative;
  max-width: 980px;
  margin: 0 auto;
}
.lockup {
  display: flex;
  width: fit-content;
  align-items: center;
  gap: 14px;
  margin: 0 auto 26px;
}
.lockup img {
  width: 68px;
  height: 68px;
  filter: drop-shadow(0 8px 20px color-mix(in srgb, var(--ck-from) 30%, transparent));
}
.ck-wordmark.big {
  font-size: 50px;
}
.eyebrow {
  display: inline-block;
  margin: 0 0 18px;
  padding: 4px 12px;
  border-radius: 999px;
  background: var(--ck-soft);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ck-from) 22%, transparent);
  color: var(--vp-c-brand-1);
  font-size: 13px;
  font-weight: 500;
}
.title {
  display: flex;
  flex-direction: column;
  margin: 0;
  font-size: clamp(40px, 7.2vw, 80px);
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.045em;
  color: var(--vp-c-text-1);
}
.lead {
  max-width: 620px;
  margin: 24px auto 0;
  font-size: 17px;
  line-height: 1.7;
  color: var(--vp-c-text-2);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  margin-top: 32px;
}
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 22px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
  text-decoration: none;
  transition: transform 0.15s, filter 0.15s, background 0.15s;
}
.btn:hover {
  transform: translateY(-1px);
}
.btn.brand {
  background: var(--ck-gradient-strong);
  color: #fff;
  box-shadow: 0 10px 24px -10px color-mix(in srgb, var(--ck-from) 70%, transparent);
}
.btn.brand:hover {
  filter: brightness(1.08);
}
.btn.alt {
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  box-shadow: 0 0 0 1px var(--vp-c-divider), 0 1px 2px rgb(0 0 0 / 0.05);
}
.btn.alt:hover {
  background: var(--vp-c-bg-alt);
}
.install {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  max-width: 100%;
  margin-top: 22px;
  padding: 9px 10px 9px 16px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--vp-c-bg) 70%, transparent);
  backdrop-filter: blur(10px);
  box-shadow: 0 0 0 1px var(--vp-c-divider);
  font-family: var(--vp-font-family-mono);
  font-size: 12.5px;
  text-align: left;
}
.install code {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--vp-c-text-1);
}
.dollar {
  color: var(--vp-c-text-3);
}
.copy {
  flex-shrink: 0;
  padding: 3px 8px;
  border-radius: 6px;
  background: var(--vp-c-default-soft);
  font-family: var(--vp-font-family-base);
  font-size: 12px;
  color: var(--vp-c-text-2);
}
.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  max-width: 760px;
  margin: 56px auto 0;
}
.stats div {
  padding: 14px 8px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--vp-c-bg) 60%, transparent);
  backdrop-filter: blur(10px);
  box-shadow: 0 0 0 1px var(--vp-c-divider);
}
.stats dt {
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.1;
}
.stats dd {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--vp-c-text-2);
}

/* ---------- sections ---------- */
.section {
  max-width: 1152px;
  margin: 0 auto;
  padding: 72px var(--gutter);
}
.section-head {
  max-width: 720px;
  margin: 0 auto 36px;
  text-align: center;
}
.kicker {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--vp-c-brand-1);
}
.section h2 {
  margin: 0;
  border: 0;
  padding: 0;
  font-size: clamp(28px, 4vw, 40px);
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.035em;
}
.section-lead {
  margin: 14px 0 0;
  font-size: 16px;
  line-height: 1.7;
  color: var(--vp-c-text-2);
}

.ai {
  display: grid;
  grid-template-columns: 1fr 1.1fr;
  gap: 48px;
  align-items: center;
}
.points {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin: 28px 0 0;
  padding: 0;
  list-style: none;
}
.points li {
  display: flex;
  gap: 14px;
}
.num {
  flex-shrink: 0;
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-brand-1);
  line-height: 24px;
}
.points h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}
.points p {
  margin: 2px 0 0;
  font-size: 14px;
  line-height: 1.65;
  color: var(--vp-c-text-2);
}
.more {
  display: inline-block;
  margin-top: 24px;
  font-size: 14px;
  font-weight: 500;
  color: var(--vp-c-brand-1);
  text-decoration: none;
}

.features {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.feature {
  padding: 22px;
  border-radius: 14px;
  background: var(--vp-c-bg);
  box-shadow: 0 0 0 1px var(--vp-c-divider);
  transition: box-shadow 0.2s, transform 0.2s;
}
.feature:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--ck-from) 35%, var(--vp-c-divider)), 0 16px 32px -20px color-mix(in srgb, var(--ck-from) 45%, transparent);
}
.icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: var(--ck-soft);
  color: var(--vp-c-brand-1);
}
.feature h3 {
  margin: 16px 0 6px;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.feature p {
  margin: 0;
  font-size: 14px;
  line-height: 1.65;
  color: var(--vp-c-text-2);
}

.stack {
  padding-top: 24px;
  padding-bottom: 24px;
  text-align: center;
}
.marquee {
  overflow: hidden;
  mask-image: linear-gradient(to right, transparent, black 12%, black 88%, transparent);
}
.track {
  display: flex;
  gap: 10px;
  width: max-content;
  animation: marquee 40s linear infinite;
}
.marquee:hover .track {
  animation-play-state: paused;
}
.track span {
  padding: 7px 14px;
  border-radius: 999px;
  box-shadow: 0 0 0 1px var(--vp-c-divider);
  font-size: 13px;
  color: var(--vp-c-text-2);
  white-space: nowrap;
}
@keyframes marquee {
  to {
    transform: translateX(calc(-50% - 5px));
  }
}

.cta-card {
  position: relative;
  overflow: hidden;
  padding: 56px 24px;
  border-radius: 20px;
  text-align: center;
  background: var(--vp-c-bg-alt);
  box-shadow: 0 0 0 1px var(--vp-c-divider);
}
.cta-glow {
  position: absolute;
  inset: -40% -10% auto;
  height: 120%;
  background: radial-gradient(closest-side, color-mix(in srgb, var(--ck-from) 18%, transparent), transparent);
  pointer-events: none;
}
.cta-card img {
  position: relative;
  margin: 0 auto 14px;
}
.cta-card h2 {
  position: relative;
}
.cta-card p {
  position: relative;
  max-width: 520px;
  margin: 12px auto 0;
  color: var(--vp-c-text-2);
}
.cta-card .actions {
  position: relative;
}

@media (max-width: 960px) {
  .ai {
    grid-template-columns: 1fr;
  }
  .features {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 640px) {
  .landing {
    --gutter: 16px;
  }
  .hero {
    padding-top: 48px;
  }
  .ck-wordmark.big {
    font-size: 36px;
  }
  .lockup img {
    width: 50px;
    height: 50px;
  }
  .stats {
    grid-template-columns: repeat(2, 1fr);
  }
  .features {
    grid-template-columns: 1fr;
  }
  .section {
    padding-top: 56px;
    padding-bottom: 56px;
  }
}
</style>
