import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (
              id.includes('react/') ||
              id.includes('react-dom/') ||
              id.includes('react-router-dom/') ||
              id.includes('react-router/') ||
              id.includes('@remix-run/') ||
              id.includes('scheduler/')
            ) {
              return 'react-vendor';
            }

            if (id.includes('lucide-react')) {
              return 'icon-vendor';
            }

            return undefined;
          }

          if (id.includes('src/pages/TeamPage')) {
            return 'page-government';
          }

          if (id.includes('src/pages/CourseWorkspacePage')) {
            return 'page-workspace';
          }

          if (id.includes('src/pages/CoursesPage')) {
            return 'page-courses';
          }

          if (id.includes('src/pages/LibraryPage')) {
            return 'page-library';
          }

          if (id.includes('src/pages/DashboardPage')) {
            return 'page-pulse';
          }

          return undefined;
        },
      },
    },
  },
});
