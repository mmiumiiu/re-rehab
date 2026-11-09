import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'

import PatientLayout from './components/PatientLayout.jsx'
import TherapistLayout from './components/TherapistLayout.jsx'

// Patient pages
import Login from './pages/patient/Login.jsx'
import Register from './pages/patient/Register.jsx'
import PrivacyConsent from './pages/patient/PrivacyConsent.jsx'
import OnboardingSelectTherapist from './pages/patient/OnboardingSelectTherapist.jsx'
import OnboardingEmergency from './pages/patient/OnboardingEmergency.jsx'
import Home from './pages/patient/Home.jsx'
import TrainingBig from './pages/patient/TrainingBig.jsx'
import TrainingLoud from './pages/patient/TrainingLoud.jsx'
import SessionBig from './pages/patient/SessionBig.jsx'
import SessionWeightShift from './pages/patient/SessionWeightShift.jsx'
import SessionLoud from './pages/patient/SessionLoud.jsx'
import Dashboard from './pages/patient/Dashboard.jsx'
import Profile from './pages/patient/Profile.jsx'
import NotificationSettings from './pages/patient/NotificationSettings.jsx'
import EmergencySettings from './pages/patient/EmergencySettings.jsx'
import EmergencyAlert from './pages/patient/EmergencyAlert.jsx'
import Chat from './pages/patient/Chat.jsx'
import TtsTest from './pages/patient/TtsTest.jsx'
import LsvtLoudTest from './pages/patient/LsvtLoudTest.jsx'
import GamesHub from './pages/patient/GamesHub.jsx'
import GameFruit from './pages/patient/GameFruit.jsx'
import GameRunner from './pages/patient/GameRunner.jsx'

// Therapist pages
import TherapistLogin from './pages/therapist/TherapistLogin.jsx'
import TherapistRegister from './pages/therapist/TherapistRegister.jsx'
import Patients from './pages/therapist/Patients.jsx'
import PatientDetail from './pages/therapist/PatientDetail.jsx'
import Messages from './pages/therapist/Messages.jsx'

// Key the BIG session by the exercise id so moving to the next exercise (same
// route, different ?exercise=) fully remounts it — resetting reps/pose state.
function KeyedBigSession() {
  const [sp] = useSearchParams()
  return <SessionBig key={`${sp.get('exercise') || '1'}:${sp.get('retry') || '0'}`} />
}

// Same for the LOUD session, keyed by step (+retry) so "ฝึกต่อ"/"ทำซ้ำ" start fresh.
function KeyedLoudSession() {
  const [sp] = useSearchParams()
  return <SessionLoud key={`${sp.get('step') || '1'}:${sp.get('retry') || '0'}`} />
}

function RequireAuth({ role, children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to={role === 'therapist' ? '/therapist/login' : '/login'} replace />
  if (role && user.role !== role) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const { user } = useAuth()
  const { pathname } = useLocation()

  // Overall zoom, bumped up ~half a step for readability.
  useEffect(() => {
    document.body.style.zoom = pathname.startsWith('/games/') ? '1' : pathname.startsWith('/therapist') ? '1.3' : '1.4'
  }, [pathname])

  return (
    <Routes>
      {/* Patient auth */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/onboarding/consent" element={<PrivacyConsent />} />
      <Route path="/onboarding/select-therapist" element={<OnboardingSelectTherapist />} />
      <Route path="/onboarding/emergency-contact" element={<OnboardingEmergency />} />

      {/* TTS test page (public, no auth needed) */}
      <Route path="/tts-test" element={<TtsTest />} />

      {/* LSVT LOUD test page — dB loudness + word accuracy (public, no auth needed) */}
      <Route path="/lsvt-test" element={<LsvtLoudTest />} />

      {/* Patient app (full-screen session routes live outside the sidebar layout) */}
      <Route
        element={
          <RequireAuth role="patient">
            <PatientLayout />
          </RequireAuth>
        }
      >
        <Route path="/home" element={<Home />} />
        <Route path="/games" element={<GamesHub />} />
        <Route path="/training/big" element={<TrainingBig />} />
        <Route path="/training/loud" element={<TrainingLoud />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings/notifications" element={<NotificationSettings />} />
        <Route path="/settings/emergency" element={<EmergencySettings />} />
        <Route path="/chat" element={<Chat />} />
      </Route>

      {/* Live sessions — full-screen, still auth-guarded */}
      <Route path="/training/big/session" element={<RequireAuth role="patient"><KeyedBigSession /></RequireAuth>} />
      <Route path="/training/big/session-weightshift" element={<RequireAuth role="patient"><SessionWeightShift /></RequireAuth>} />
      <Route path="/training/loud/session" element={<RequireAuth role="patient"><KeyedLoudSession /></RequireAuth>} />
      <Route path="/games/fruit" element={<RequireAuth role="patient"><GameFruit /></RequireAuth>} />
      <Route path="/games/runner" element={<RequireAuth role="patient"><GameRunner /></RequireAuth>} />
      <Route path="/emergency-alert" element={<RequireAuth role="patient"><EmergencyAlert /></RequireAuth>} />

      {/* Therapist portal */}
      <Route path="/therapist/login" element={<TherapistLogin />} />
      <Route path="/therapist/register" element={<TherapistRegister />} />
      <Route
        element={
          <RequireAuth role="therapist">
            <TherapistLayout />
          </RequireAuth>
        }
      >
        <Route path="/therapist/patients" element={<Patients />} />
        <Route path="/therapist/patients/:id" element={<PatientDetail />} />
        <Route path="/therapist/messages" element={<Messages />} />
      </Route>

      {/* Root redirect */}
      <Route
        path="*"
        element={
          <Navigate
            to={user ? (user.role === 'therapist' ? '/therapist/patients' : '/home') : '/login'}
            replace
          />
        }
      />
    </Routes>
  )
}
