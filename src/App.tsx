import { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { CourseWorkspacePage } from './pages/CourseWorkspacePage';
import { CoursesPage } from './pages/CoursesPage';
import { DashboardPage } from './pages/DashboardPage';
import { LibraryPage } from './pages/LibraryPage';
import { TeamPage } from './pages/TeamPage';
import type { Role } from './types';

export default function App() {
  const [role, setRole] = useState<Role>('Coordinador');

  return (
    <AppShell role={role} onRoleChange={setRole}>
      <Routes>
        <Route path="/" element={<DashboardPage role={role} />} />
        <Route path="/courses" element={<CoursesPage role={role} />} />
        <Route path="/courses/:slug" element={<CourseWorkspacePage role={role} />} />
        <Route path="/library" element={<LibraryPage role={role} />} />
        <Route path="/team" element={<TeamPage role={role} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
