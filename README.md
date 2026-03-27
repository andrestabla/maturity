# Maturity

Maturity es una plataforma para gestionar la producción integral de cursos universitarios como si cada curso fuera un proyecto vivo: con etapas, responsables, entregables, alertas, calidad y trazabilidad.

Esta primera entrega arranca el producto como una `project management platform` especializada en operación académica. El foco está en una interfaz moderna, clara y con proyección real a móvil desde el primer corte.

## Estado actual

El MVP actual incluye:

- `Dashboard` por rol con métricas, alertas y tareas visibles.
- `Portafolio de cursos` con vista tipo portfolio y pipeline por etapas.
- `Workspace del curso` con flujo, entregables, módulos, observaciones, equipo y asistentes IA.
- `Biblioteca` de recursos curados y propios.
- `Gobierno` con relevo entre etapas y lectura de permisos por rol.
- `API serverless` para Vercel en `/api`.
- `Persistencia inicial` en Neon PostgreSQL.
- `Seed automático` del dominio base si la base está vacía.
- `Autenticación real` con sesión `httpOnly`.
- `CRUD básico` de cursos y tareas.
- `Gestión de usuarios` por rol para administradores.
- `Cambio de contraseña` para usuarios autenticados.

## Stack

- React 19
- TypeScript
- Vite
- React Router
- Neon PostgreSQL
- Vercel Functions
- CSS custom, sin framework visual pesado

## Diseño

La interfaz evita patrones típicos de dashboards genéricos:

- tipografía editorial con `Sora` y `Plus Jakarta Sans`;
- paleta cálida con coral, arena, verde salvia y azul océano;
- layout tipo app shell con personalidad propia;
- responsive desde el arranque para preparar la evolución hacia experiencia móvil o PWA.

## Desarrollo local

```bash
npm install
npm run dev
```

`npm run dev` levanta la interfaz en modo frontend. Si no existe API disponible, la app usa datos demo automáticamente.

## Build de producción

```bash
npm run build
```

## Base de datos

Variables esperadas:

```bash
DATABASE_URL=...
INITIAL_ADMIN_EMAIL=...
INITIAL_ADMIN_NAME=...
INITIAL_ADMIN_PASSWORD=...
```

Preparar la base con el esquema y seed inicial:

```bash
npm run db:setup
```

## Vercel

El proyecto queda listo para desplegar como app Vite con funciones serverless:

- `vercel.json` define build y rewrites;
- `/api/bootstrap` carga los datos desde Neon;
- `/api/health` prepara y valida esquema + seed.
- `/api/auth/*` maneja sesión y login.
- `/api/auth/password` permite cambiar la contraseña actual.
- `/api/courses` y `/api/tasks` gestionan CRUD básico.
- `/api/users` expone directorio y administración de usuarios.

En Vercel deben existir `DATABASE_URL`, `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_NAME` e `INITIAL_ADMIN_PASSWORD`.

## Siguiente paso recomendado

La siguiente iteración debería convertir esta base en producto transaccional. El orden sugerido es:

1. login y permisos efectivos;
2. creación/edición real de cursos y tareas;
3. trazabilidad de comentarios, aprobaciones y devoluciones;
4. versionado de entregables y biblioteca;
5. integración posterior con asistentes IA por etapa.

## Referencia funcional

Los documentos base del producto quedaron en la raíz del repositorio como insumo de negocio:

- `Plataforma Maturity.docx`
- `Backlog funcional de la plataforma Maturity.docx`
- `Matriz de permisos.docx`
