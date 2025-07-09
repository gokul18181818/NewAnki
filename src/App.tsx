import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import LandingPage from './pages/LandingPage';
import SignUp from './pages/SignUp';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import ImportFlow from './pages/ImportFlow';
import Dashboard from './pages/Dashboard';
import StudySession from './pages/StudySession';
import SessionResults from './pages/SessionResults';
import CreateCards from './pages/CreateCards';
import Progress from './pages/Progress';
import EditCard from './pages/EditCard';
import Settings from './pages/Settings';
import DeckDetails from './pages/DeckDetails';
import { UserProvider } from './contexts/UserContext';
import { StudyProvider } from './contexts/StudyContext';
import { ThemeProvider } from './contexts/ThemeContext';



function App() {
  return (
    <ThemeProvider>
      <UserProvider>
        <StudyProvider>
          <Router>
            <div className="min-h-screen bg-cream dark:bg-neutral-900 transition-colors duration-200">
              <AnimatePresence mode="wait">
                <Routes>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/signup" element={<SignUp />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/onboarding" element={<Onboarding />} />
                  <Route path="/import" element={<ImportFlow />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/study/:deckId" element={<StudySession />} />
                  <Route path="/deck/:deckId" element={<DeckDetails />} />
                  <Route path="/session-results" element={<SessionResults />} />
                  <Route path="/create" element={<CreateCards />} />
                  <Route path="/progress" element={<Progress />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/deck/:deckId/card/:cardId/edit" element={<EditCard />} />
                </Routes>
              </AnimatePresence>
            </div>
          </Router>
        </StudyProvider>
      </UserProvider>
    </ThemeProvider>
  );
}

export default App;