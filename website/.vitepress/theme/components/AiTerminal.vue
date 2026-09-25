<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * Terminal replay of the AI workflow: the prompt is typed, then each step appears in turn.
 * Starts when scrolled into view; with reduced motion everything is shown at once.
 */
const props = defineProps({ prompt: { type: String, required: true }, script: { type: Array, required: true } })

const root = ref(null)
const typed = ref('')
const shown = ref(0)
const running = ref(false)
let timers = []
let observer = null

const wait = (ms) => new Promise((resolve) => timers.push(setTimeout(resolve, ms)))

async function play() {
  timers.forEach(clearTimeout)
  timers = []
  running.value = true
  typed.value = ''
  shown.value = 0
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    typed.value = props.prompt
    shown.value = props.script.length
    running.value = false
    return
  }
  for (const ch of props.prompt) {
    typed.value += ch
    await wait(38)
  }
  await wait(450)
  for (let i = 0; i < props.script.length; i++) {
    shown.value = i + 1
    await wait(props.script[i][0] === 'cmd' ? 520 : 380)
  }
  running.value = false
}

onMounted(() => {
  observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        observer.disconnect()
        play()
      }
    },
    { threshold: 0.35 },
  )
  observer.observe(root.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  timers.forEach(clearTimeout)
})

const MARK = { info: '›', ok: '✓', gate: '✓', done: '●' }
</script>

<template>
  <div ref="root" class="term">
    <div class="bar">
      <i /><i /><i />
      <span class="title">castor-kit — AI</span>
      <button type="button" class="replay" :disabled="running" aria-label="Replay" @click="play">↻</button>
    </div>
    <div class="body">
      <div class="line prompt">
        <span class="who">you</span>
        <span>{{ typed }}<span v-if="running && shown === 0" class="caret" /></span>
      </div>
      <TransitionGroup name="line">
        <div v-for="([kind, text], i) in script.slice(0, shown)" :key="i" class="line" :class="kind">
          <span class="mark">{{ kind === 'cmd' ? '$' : MARK[kind] }}</span>
          <span class="text">
            <template v-if="kind === 'gate'">
              <span v-for="name in text.split(' · ')" :key="name" class="chip">✓ {{ name }}</span>
            </template>
            <template v-else>{{ text }}</template>
          </span>
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>

<style scoped>
.term {
  border-radius: 14px;
  overflow: hidden;
  background: #0b0d12;
  color: #e5e7eb;
  box-shadow:
    0 0 0 1px rgb(255 255 255 / 0.06),
    0 30px 60px -30px color-mix(in srgb, var(--ck-from) 45%, rgb(0 0 0 / 0.6));
  font-family: var(--vp-font-family-mono);
  font-size: 12.5px;
  line-height: 1.6;
  text-align: left;
}
.bar {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  border-bottom: 1px solid rgb(255 255 255 / 0.06);
  background: rgb(255 255 255 / 0.02);
}
.bar i {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: rgb(255 255 255 / 0.14);
}
.title {
  margin-left: 8px;
  font-size: 11px;
  color: rgb(255 255 255 / 0.4);
}
.replay {
  margin-left: auto;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  color: rgb(255 255 255 / 0.5);
  transition: background 0.15s, color 0.15s;
}
.replay:hover:not(:disabled) {
  background: rgb(255 255 255 / 0.08);
  color: #fff;
}
.replay:disabled {
  opacity: 0.3;
}
.body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 360px;
  padding: 16px 18px 20px;
}
.line {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.line .text {
  min-width: 0;
  overflow-wrap: anywhere;
}
.prompt {
  margin-bottom: 6px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgb(255 255 255 / 0.05);
  font-family: var(--vp-font-family-base);
  font-size: 13.5px;
  color: #fff;
}
.who {
  flex-shrink: 0;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--ck-gradient-strong);
  font-size: 11px;
  line-height: 18px;
}
.caret {
  display: inline-block;
  width: 7px;
  height: 15px;
  margin-left: 2px;
  vertical-align: -2px;
  background: #fff;
  animation: blink 1s steps(1) infinite;
}
@keyframes blink {
  50% {
    opacity: 0;
  }
}
.mark {
  flex-shrink: 0;
  width: 12px;
  text-align: center;
  color: rgb(255 255 255 / 0.35);
}
.cmd .mark {
  color: #7dd3fc;
}
.cmd .text {
  color: #f8fafc;
}
.info .text {
  color: rgb(255 255 255 / 0.62);
}
.ok .mark,
.gate .mark {
  color: #4ade80;
}
.ok .text {
  color: rgb(255 255 255 / 0.62);
}
.chip {
  display: inline-block;
  margin: 0 6px 6px 0;
  padding: 1px 8px;
  border-radius: 999px;
  background: rgb(74 222 128 / 0.1);
  color: #86efac;
  font-size: 11.5px;
}
.done {
  margin-top: 4px;
}
.done .mark {
  color: var(--ck-to);
}
.done .text {
  background-image: var(--ck-gradient);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-weight: 600;
}
.line-enter-active {
  transition: opacity 0.3s, transform 0.3s;
}
.line-enter-from {
  opacity: 0;
  transform: translateY(4px);
}
</style>
