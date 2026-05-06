import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import OwnerApp from './OwnerApp';
import CookApp from './CookApp';
import LandingPage from './LandingPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/owner/*" element={<OwnerApp />} />
        <Route path="/owners/*" element={<Navigate to="/owner" replace />} />
        <Route path="/cook/*" element={<CookApp />} />
        {/* Catch all redirects to landing page */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
