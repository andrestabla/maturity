# Plan MVP de Maturity

## Visión de producto

Maturity debe comportarse como el sistema operativo de producción académica de una institución: no solo almacenar contenidos, sino coordinar el flujo completo desde el sílabus hasta la liberación del curso en LMS.

La primera versión arranca desde el ángulo más útil para construcción temprana de producto: una plataforma de gestión de proyectos especializada en cursos.

## Objetivo de esta fase

Diseñar y desarrollar un MVP visual y funcional que permita validar tres cosas:

1. que el flujo por etapas se entiende y se puede operar;
2. que los roles ven una experiencia realmente distinta y útil;
3. que la interfaz ya tiene carácter propio y puede evolucionar a móvil sin rediseño completo.

## Módulos incluidos en la primera iteración

### 1. Dashboard por rol

- cursos visibles según alcance del usuario;
- tareas abiertas;
- alertas y bloqueos;
- indicadores rápidos del portafolio.

### 2. Portafolio de cursos

- vista de tarjetas;
- vista pipeline por etapa;
- filtro por estado;
- lectura del portafolio como cartera de proyectos.

### 3. Workspace del curso

- ficha general del curso;
- progreso y métricas;
- flujo visible por checkpoints;
- entregables activos;
- agenda de hitos;
- módulos del curso;
- observaciones y puntos abiertos;
- equipo;
- asistentes IA sugeridos por etapa.

### 4. Biblioteca

- recursos propios y curados;
- trazabilidad básica por unidad;
- lectura de estado;
- criterios visibles de curaduría y calidad.

### 5. Gobierno

- cadena de relevo entre etapas;
- visión de roles;
- interpretación operativa de permisos;
- cobertura del portafolio por rol.

## Decisiones de producto

### Navegación

Se eligió una app shell con sidebar fijo en desktop y navegación inferior en móvil para acercar la experiencia a una futura app.

### Datos

Se modelaron ejemplos realistas basados en los documentos de negocio para que el MVP comunique estructura real, no solo cajas vacías.

### Diseño

Se evitó un estilo neutro o genérico. La interfaz usa una dirección visual cálida y editorial con contraste suficiente para operación intensiva.

## Arquitectura técnica inicial

- `React + TypeScript + Vite`
- `React Router` para escalar a múltiples módulos
- `capa de datos compartida` con cursos, etapas, tareas, alertas, recursos y perfiles de rol
- `API serverless` en Vercel para bootstrap y health check
- `Neon PostgreSQL` como persistencia inicial
- `CSS tokens` para sostener identidad visual consistente
- `manifest.webmanifest` como base para proyección móvil/PWA

## Próximas iteraciones sugeridas

### Fase 2. Backoffice real

- autenticación;
- permisos efectivos;
- CRUD de cursos, tareas, observaciones y recursos.
- normalización progresiva del esquema hoy sembrado en JSONB.

### Fase 3. Flujo transaccional

- cambios de etapa;
- aprobaciones y devoluciones;
- historial de acciones;
- comentarios por entregable;
- adjuntos y versionado.

### Fase 4. Inteligencia especializada

- asistentes por etapa;
- sugerencias de arquitectura;
- curaduría asistida;
- control de coherencia pedagógica;
- revisión previa a LMS y QA.

### Fase 5. Evolución móvil

- PWA completa o app híbrida;
- notificaciones;
- cola de tareas optimizada para móvil;
- revisión rápida de observaciones y aprobaciones.
