# Maturity

Maturity es una plataforma para gestionar la producción integral de cursos universitarios como si cada curso fuera un proyecto vivo: con etapas, responsables, entregables, alertas, calidad y trazabilidad.

Esta primera entrega arranca el producto como una `project management platform` especializada en operación académica. El foco está en una interfaz moderna, clara y con proyección real a móvil desde el primer corte.

## Estado actual

El MVP frontend incluye:

- `Dashboard` por rol con métricas, alertas y tareas visibles.
- `Portafolio de cursos` con vista tipo portfolio y pipeline por etapas.
- `Workspace del curso` con flujo, entregables, módulos, observaciones, equipo y asistentes IA.
- `Biblioteca` de recursos curados y propios.
- `Gobierno` con relevo entre etapas y lectura de permisos por rol.

## Stack

- React 19
- TypeScript
- Vite
- React Router
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

## Build de producción

```bash
npm run build
```

## Siguiente paso recomendado

La siguiente iteración debería conectar este frontend con persistencia real y autenticación por roles. El orden sugerido es:

1. modelo de datos y API;
2. login y permisos efectivos;
3. creación/edición real de cursos y tareas;
4. trazabilidad de comentarios, aprobaciones y devoluciones;
5. integración posterior con asistentes IA por etapa.

## Referencia funcional

Los documentos base del producto quedaron en la raíz del repositorio como insumo de negocio:

- `Plataforma Maturity.docx`
- `Backlog funcional de la plataforma Maturity.docx`
- `Matriz de permisos.docx`
