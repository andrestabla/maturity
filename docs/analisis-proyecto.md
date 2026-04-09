# Análisis del Proyecto Maturity
*Fecha: 4 de abril de 2026*

---

## ¿Qué es Maturity?

Maturity es una **plataforma de gestión de producción académica** diseñada para operar cursos universitarios como proyectos con etapas, responsables, entregables, calidad y trazabilidad. El stack es React 19 + TypeScript + Vite en el frontend, con funciones serverless en Vercel y PostgreSQL en Neon como base de datos.

---

## Estado actual del MVP

El proyecto tiene un MVP funcional y desplegado. Las capacidades principales ya están construidas:

- Autenticación real con sesión `httpOnly` y tokens hasheados en base de datos
- Dashboard por rol con métricas, alertas y tareas
- Portafolio de cursos con pipeline por etapas
- Workspace de curso con flujo completo: entregables, módulos, observaciones, equipo, asistentes IA
- Biblioteca de recursos (curados y propios) con búsqueda multifuente
- Módulo de gobierno con relevo de etapas y checkpoints
- Centro de administración completo: usuarios, institución, branding, integraciones, logs de auditoría
- CRUD completo para prácticamente todas las entidades

---

## Arquitectura

### Frontend

El frontend es una SPA (Single Page Application) con lazy loading por página. La gestión de estado es simple y correcta: `useAppData` es el hook central que carga todos los datos vía `/api/bootstrap`, con las siguientes características notables:

- **Snapshot en localStorage**: persiste los datos entre recargas, lo que hace la app muy rápida en visitas sucesivas
- **Revalidación automática**: polling cada 10 segundos cuando la pestaña es visible, más revalidación al enfocar la ventana o volver online
- **Sincronización entre pestañas**: usa `BroadcastChannel` para coordinar refreshes entre múltiples instancias abiertas
- **Race condition handling**: secuencia de requests numerada para ignorar respuestas desactualizadas

Zustand se usa solo para el estado del modal global. El resto es estado local de React.

### API y Backend

Hay **32 funciones serverless** organizadas en `/api`, con un total de ~3.200 líneas. Todas corren en el Edge Runtime de Vercel con un timeout máximo de 60 segundos. Los módulos más extensos son:

- `course-writing.ts` (568 líneas): gestión de escritura de productos con IA
- `admin-center.ts` (122 líneas) + `lib/admin-center.ts` (2.020 líneas): gestión institucional
- `lib/store.ts` (7.460 líneas): capa de datos completa contra Neon PostgreSQL

La capa de datos (`lib/store.ts`) no usa ningún ORM — SQL directo vía `@neondatabase/serverless`. Es la pieza más grande del proyecto y concentra toda la lógica de negocio del lado del servidor.

### Base de datos

PostgreSQL en Neon con seed automático. El script `npm run db:setup` prepara el esquema y carga datos base. La sesión se maneja con un token hasheado guardado en la tabla de sesiones (patrón correcto: nunca se guarda el token en texto plano).

### Seguridad de sesión

El sistema de sesión es sólido:
- Cookies `httpOnly`, `Secure`, `SameSite=Lax`
- Tokens hasheados antes de guardarse en BD
- Sesiones con expiración de 30 días
- Verificación de contraseña con hash (`lib/security.ts`)

---

## Modelo de dominio

El modelo es rico y bien tipado. Los tipos clave son:

**Roles** (8): Administrador, Coordinador, Experto, Diseñador instruccional, Diseñador multimedia, Gestor LMS, Analista QA, Auditor

**Etapas del curso** (9): microcurrículo → arquitectura → planeación → escritura → validación → multimedia → LMS → QA → entrega

**Entidades principales**: `Course`, `CourseProduct`, `Task`, `Alert`, `Deliverable`, `LearningModule`, `Observation`, `LibraryAsset`, `AuthUser`, `AdminIntegration`

Los permisos están bien granularizados en `lib/permissions.ts` y `src/utils/permissions.ts`. Cada acción tiene su propia función (`canManageCourses`, `canEditCourseProduct`, etc.) con lógica diferenciada por rol y contexto de etapa.

---

## Integraciones contempladas

El módulo de administración incluye integraciones catalogadas en seis categorías:

- **IA**: OpenAI (ya integrado con `openai ^6.33`)
- **Google**: Drive, Calendar
- **Storage**: AWS S3 / R2 (Cloudflare — ya tiene `lib/r2.ts`)
- **Audiovisual**: YouTube (con asistente específico)
- **Correo**: servicio de mail
- **Sistema**: LMS institucional

La API ya cuenta con endpoints para análisis de microcurrículos (`analyze-microcurriculo.ts`), extracción de lineamientos (`extract-guidelines.ts`) y generación de arquitectura (`generate-architecture.ts`), todos usando OpenAI.

La biblioteca admite múltiples proveedores de búsqueda académica: Semantic Scholar, OpenAlex, ArXiv, CORE, OER Commons, PHet, Redalyc, SciELO y YouTube.

---

## Fortalezas del proyecto

**Diseño de producto sólido**: el modelo de dominio refleja un conocimiento real del proceso académico universitario. Las 9 etapas y los 8 roles no son inventados — responden a una operación real.

**Tipado completo**: `src/types.ts` tiene ~905 líneas de interfaces TypeScript bien definidas. No hay `any` implícito en la superficie pública.

**Capa de datos robusta**: `lib/store.ts` con 7.460 líneas cubre prácticamente todo el CRUD sin ORM. El hecho de que esté en un solo archivo es una deuda técnica, pero el código está estructurado.

**UX bien pensada**: branding configurable, temas, skeleton screens, sincronización entre pestañas, y una paleta de diseño propia (coral, sage, ocean, gold, ink).

**Funciones IA reales**: no son maquetas — hay endpoints que llaman a OpenAI para análisis de microcurrículos y generación de arquitectura de cursos.

---

## Áreas de mejora y deuda técnica

### 1. `lib/store.ts` necesita fragmentarse
Con 7.460 líneas, es el fichero más grande y es difícil de mantener. Debería dividirse en módulos por dominio: `courses.ts`, `users.ts`, `library.ts`, `admin.ts`, etc.

### 2. `CourseWorkspacePage.tsx` es un monolito
Con 9.927 líneas, esta página concentra demasiada lógica. El workspace de curso es el corazón del producto y merece ser descompuesto en componentes más pequeños por sección (deliverables, modules, products, stage-notes, etc.).

### 3. `TeamPage.tsx` también es muy grande
5.064 líneas para el centro de administración. Misma lógica — necesita componentes por sección.

### 4. Los permisos están duplicados
Existe `src/utils/permissions.ts` (frontend) y `lib/permissions.ts` (backend). Tienen lógica similar pero no comparten código. Un cambio de reglas requiere actualizar ambos archivos.

### 5. No hay tests
No hay ningún archivo de test en el proyecto. Para un sistema con lógica de permisos, flujos de etapa y reglas de negocio complejas, esto representa un riesgo real al iterar.

### 6. Sin gestión de errores unificada
Los endpoints retornan errores con formatos variados. Sería útil un helper centralizado para respuestas de error tipadas.

### 7. `useAppData` hace polling agresivo
El intervalo de 10 segundos y la revalidación en cada `focus`/`pageshow` generan muchas requests a Neon. Para un despliegue con muchos usuarios concurrentes esto puede generar costos y latencia. Sería mejor implementar WebSockets o SSE para invalidación push, o al menos aumentar el intervalo.

---

## Próximos pasos recomendados (por orden de valor)

1. **Fragmentar `lib/store.ts`** — es la deuda técnica más urgente antes de que el proyecto crezca más.
2. **Descomponer `CourseWorkspacePage`** — la experiencia central del producto merece mejor mantenibilidad.
3. **Unificar lógica de permisos** — un módulo compartido o al menos una fuente de verdad en el servidor.
4. **Añadir tests de integración** para los endpoints críticos (auth, courses, permissions).
5. **Optimizar la estrategia de sincronización** — reducir polling o migrar a invalidación por evento.
6. **Activar las integraciones pendientes** — Google Drive y storage R2 ya tienen su infraestructura base.

---

## Resumen ejecutivo

Maturity es un proyecto con un núcleo de producto bien definido y una base técnica funcional. El MVP está desplegado, la autenticación es segura, el modelo de dominio es rico, y hay funcionalidades de IA reales en producción. La deuda principal es de tamaño y organización interna — los ficheros más importantes del sistema se han vuelto monolíticos y necesitan refactorización antes de que el equipo escale. El producto tiene proyección real: el modelo de negocio (operación de cursos universitarios por etapas y roles) no tiene equivalentes directos en el mercado con esta profundidad.
