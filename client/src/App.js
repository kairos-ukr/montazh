import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./layout/AppLayout";

import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import ProjectsPage from "./pages/InstallationsPage"; 
import ProjectDetailsPage from "./pages/ProjectDetailsPage";
import TimeOffManager from "./pages/TimeOffManager"; // Якщо треба
import NotFoundPage from "./pages/NotFoundPage";
import RoofMeasurementPage from './pages/RoofMeasurementPage';
import ProjectDocumentsPage from './pages/ProjectDocumentsPage';
import ReportPage from "./pages/ReportsPage"
import WorkCalendar from "./pages/WorkCalendar"
import Microtask from "./pages/MicrotasksPage"
import Ocrvis from "./pages/ocrsn"
import Equipment from "./pages/EquipmentPage2"
import OCRSNPage from "./pages/OCRSNScanPage";
export default function App() {
  return (
    <Routes>
      {/* Публічна сторінка авторизації */}
      <Route path="/auth" element={<AuthPage />} />

      {/* Все інше — всередині layout (AppLayout вже малює меню) */}
      <Route element={<AppLayout />}>
        {/* При вході на корінь кидаємо на /home */}
        <Route path="/" element={<Navigate to="/home" replace />} />
        
        {/* Якщо хтось по старій пам'яті введе /dashboard -> кидаємо на /home */}
        <Route path="/dashboard" element={<Navigate to="/home" replace />} />

        {/* ОСНОВНИЙ РОУТ: /home малює DashboardPage */}
        <Route path="/home" element={<DashboardPage />} />
        
        <Route path="/installations" element={<ProjectsPage />} /> 
        <Route path="/project/:id" element={<ProjectDetailsPage />} />
        <Route path="/documents/:id" element={<ProjectDocumentsPage />} />
        <Route path="/measurements/:id" element={<RoofMeasurementPage />} />
        <Route path="/weakends" element={<TimeOffManager />} /> 
        <Route path="/report" element={<ReportPage />} />
        <Route path="/calendar" element={<WorkCalendar /> } />
        <Route path="/tasks" element={<Microtask /> } />
        <Route path="/equipment" element={<Equipment />} />
        <Route path="/ocr" element={<Ocrvis /> } />
        <Route path="/ocrsn" element={<OCRSNPage />} />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}