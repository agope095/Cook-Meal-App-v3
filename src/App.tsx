import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import OwnerApp from './OwnerApp';
import CookApp from './CookApp';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/owner/*" element={<OwnerApp />} />
        <Route path="/owners/*" element={<Navigate to="/owner" replace />} />
        <Route path="/cook/*" element={<CookApp />} />
        {/* Default route redirects to cook view, or maybe a landing page later */}
        <Route path="/" element={<Navigate to="/cook" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
