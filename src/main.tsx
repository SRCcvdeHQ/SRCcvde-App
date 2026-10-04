import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import './pwa'

class WorkspaceErrorBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false}
  static getDerivedStateFromError(){return {failed:true}}
  componentDidCatch(error:Error,info:ErrorInfo){console.error('SRCcvde workspace render failure',error,info)}
  render(){
    if(this.state.failed)return <main className="crash-screen"><div><p className="eyebrow">Workspace recovery</p><h1>Something didn’t load correctly.</h1><p>SRCcvde kept your session safe. Reload the workspace to try again.</p><button className="primary" onClick={()=>window.location.reload()}>Reload workspace</button></div></main>
    return this.props.children
  }
}

const restored=sessionStorage.getItem('srccvde-app:redirect')
if(restored){sessionStorage.removeItem('srccvde-app:redirect');history.replaceState(null,'',restored)}
createRoot(document.getElementById('root')!).render(<StrictMode><WorkspaceErrorBoundary><App/></WorkspaceErrorBoundary></StrictMode>)
