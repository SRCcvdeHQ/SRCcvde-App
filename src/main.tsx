import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import './pwa'
const restored=sessionStorage.getItem('srccvde-app:redirect')
if(restored){sessionStorage.removeItem('srccvde-app:redirect');history.replaceState(null,'',restored)}
createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>)
