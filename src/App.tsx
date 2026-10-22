import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Spinner } from './components/ui'
import PublicPage from './pages/PublicPage'

// A página pública vai no pacote principal (abre rápido no navegador do Instagram);
// o painel carrega sob demanda.
const AppLayout = lazy(() => import('./components/AppLayout').then((m) => ({ default: m.AppLayout })))
const Account = lazy(() => import('./pages/Account'))
const Login = lazy(() => import('./pages/Auth').then((m) => ({ default: m.Login })))
const Signup = lazy(() => import('./pages/Auth').then((m) => ({ default: m.Signup })))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Editor = lazy(() => import('./pages/Editor'))
const Landing = lazy(() => import('./pages/Landing'))
const PagesList = lazy(() => import('./pages/PagesList'))
const PageStats = lazy(() => import('./pages/PageStats'))
const Team = lazy(() => import('./pages/Team'))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/entrar" element={<Login />} />
          <Route path="/cadastro" element={<Signup />} />
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="paginas" element={<PagesList />} />
            <Route path="paginas/:id" element={<Editor />} />
            <Route path="paginas/:id/metricas" element={<PageStats />} />
            <Route path="equipe" element={<Team />} />
            <Route path="conta" element={<Account />} />
          </Route>
          <Route path="/:slug" element={<PublicPage />} />
        </Routes>
      </Suspense>
    </>
  )
}
