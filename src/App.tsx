import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import Account from './pages/Account'
import { Login, Signup } from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Editor from './pages/Editor'
import Landing from './pages/Landing'
import PagesList from './pages/PagesList'
import PageStats from './pages/PageStats'
import PublicPage from './pages/PublicPage'
import Team from './pages/Team'

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
    </>
  )
}
