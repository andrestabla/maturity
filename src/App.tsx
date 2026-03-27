import { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell.js';
import { useAppData } from './hooks/useAppData.js';
import { CourseWorkspacePage } from './pages/CourseWorkspacePage.js';
import { CoursesPage } from './pages/CoursesPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { LibraryPage } from './pages/LibraryPage.js';
import { TeamPage } from './pages/TeamPage.js';
import type { Role } from './types.js';

export default function App() {
  const [role, setRole] = useState<Role>('Coordinador');
  const { appData, source, isLoading } = useAppData();

  return (
    <AppShell
      role={role}
      onRoleChange={setRole}
      dataSource={source}
      isLoading={isLoading}
    >
      <Routes>
        <Route path="/" element={<DashboardPage role={role} appData={appData} />} />
        <Route path="/courses" element={<CoursesPage role={role} appData={appData} />} />
        <Route
          path="/courses/:slug"
          element={<CourseWorkspacePage role={role} appData={appData} />}
        />
        <Route path="/library" element={<LibraryPage role={role} appData={appData} />} />
        <Route path="/team" element={<TeamPage role={role} appData={appData} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
