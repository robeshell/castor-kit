import { createRoot } from 'react-dom/client'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import './index.css'
import '@/i18n'
import App from '@/App.jsx'

createRoot(document.getElementById('root')).render(<App />)
