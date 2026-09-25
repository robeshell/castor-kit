import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import './custom.css'
import Wordmark from './components/Wordmark.vue'
import Landing from './components/Landing.vue'

/** castor-kit docs theme: VitePress default theme + brand tokens, wordmark in the nav bar and a custom landing page */
export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'nav-bar-title-after': () => h(Wordmark),
    }),
  enhanceApp({ app }) {
    app.component('Landing', Landing)
  },
}
