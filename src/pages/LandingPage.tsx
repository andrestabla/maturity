import {
  ArrowRight,
  Bot,
  ChartNoAxesCombined,
  CheckCircle2,
  CircleCheckBig,
  Clock3,
  FileCheck2,
  LayoutGrid,
  LibraryBig,
  MessagesSquare,
  MonitorSmartphone,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import type { BrandingSettings } from '../types.js';

const whatsappUrl =
  'https://api.whatsapp.com/send/?phone=573006590161&text&type=phone_number&app_absent=0';

interface LandingPageProps {
  branding: BrandingSettings;
}

const timelineSteps = [
  {
    title: 'Microcurrículo',
    eyebrow: 'La experiencia inicia aquí',
    description: 'Crea o carga en el sistema tu planificación microcurricular.',
    accent: 'coral',
  },
  {
    title: 'Arquitectura',
    eyebrow: 'Estructura pedagógica',
    description:
      'A partir de los lineamientos institucionales, el sistema genera la arquitectura de la experiencia de aprendizaje (momentos y dispositivos didácticos).',
    accent: 'gold',
  },
  {
    title: 'Planificación',
    eyebrow: 'Ritmo operativo',
    description:
      'Define tiempos y asigna el equipo de trabajo encargado de diseñar y producir la experiencia de aprendizaje.',
    accent: 'ocean',
  },
  {
    title: 'Diseño',
    eyebrow: 'Construcción asistida',
    description:
      'Construye, con asistencia IA, las actividades de aprendizaje y los contenidos educativos digitales. Integra recursos disponibles en la biblioteca.',
    accent: 'sage',
  },
  {
    title: 'Validación institucional',
    eyebrow: 'Gobierno pedagógico',
    description:
      'Valida que los productos generados cumplan con los lineamientos pedagógicos definidos a nivel institucional.',
    accent: 'ink',
  },
  {
    title: 'Producción multimedia',
    eyebrow: 'Recursos listos para salir',
    description:
      'Genera los recursos educativos digitales mediante las herramientas de autor integradas o descarga los guiones para producir con otros medios.',
    accent: 'coral',
  },
  {
    title: 'Distribución (LMS)',
    eyebrow: 'Publicación controlada',
    description:
      'Asegura que el contenido generado se cargue en las plataformas definidas para tal fin.',
    accent: 'ocean',
  },
  {
    title: 'QA',
    eyebrow: 'Control de calidad final',
    description:
      'Realiza el control de calidad de los productos finales e integrados antes de su publicación.',
    accent: 'sage',
  },
];

const libraryCards = [
  {
    title: 'Artículo científico',
    source: 'OpenAlex + SciELO',
    tag: 'Curado',
  },
  {
    title: 'Recurso abierto',
    source: 'CORE + OER',
    tag: 'Listo para integrar',
  },
  {
    title: 'Video académico',
    source: 'YouTube educativo',
    tag: 'Relacionado con módulo 2',
  },
];

const analyticsStats = [
  { label: 'Cursos activos', value: '24', tone: 'ocean' },
  { label: 'Riesgos tempranos', value: '05', tone: 'coral' },
  { label: 'Cumplimiento global', value: '92%', tone: 'sage' },
];

const analyticsRows = [
  { label: 'Producción académica', value: '89%', tone: 'ocean' },
  { label: 'Multimedia', value: '74%', tone: 'gold' },
  { label: 'Montaje LMS', value: '67%', tone: 'coral' },
  { label: 'QA final', value: '81%', tone: 'sage' },
];

function getRevealProps(reduceMotion: boolean, delay = 0) {
  if (reduceMotion) {
    return {
      viewport: { once: true, amount: 0.2 },
    };
  }

  return {
    initial: { opacity: 0, y: 36 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.24 },
    transition: {
      duration: 0.72,
      delay,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  };
}

function getTimelineRevealProps(reduceMotion: boolean, index: number) {
  if (reduceMotion) {
    return {
      viewport: { once: true, amount: 0.35 },
    };
  }

  return {
    initial: { opacity: 0, y: 52, scale: 0.98 },
    whileInView: { opacity: 1, y: 0, scale: 1 },
    viewport: { once: true, amount: 0.35 },
    transition: {
      duration: 0.78,
      delay: index * 0.06,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  };
}

export function LandingPage({ branding }: LandingPageProps) {
  const reduceMotion = Boolean(useReducedMotion());
  const platformLabel = branding.platformName.endsWith('360')
    ? branding.platformName
    : `${branding.platformName}360`;

  function renderBrandMark() {
    if (branding.logoMode === 'Imagen' && branding.logoUrl.trim()) {
      return <img className="m360-brand__image" src={branding.logoUrl} alt={branding.logoText} />;
    }

    if (branding.logoMode === 'Wordmark') {
      return <span className="m360-brand__wordmark">{branding.logoText}</span>;
    }

    return <span className="m360-brand__mark">{branding.shortMark}</span>;
  }

  return (
    <main className="m360-home">
      <div className="m360-home__noise" aria-hidden />

      <header className="m360-nav">
        <Link to="/" className="m360-brand" aria-label={branding.platformName}>
          {renderBrandMark()}
          <span className="m360-brand__copy">
            <strong>{platformLabel}</strong>
            <span>Diseño y producción educativa con IA</span>
          </span>
        </Link>

        <nav className="m360-nav__links" aria-label="Secciones principales">
          <a href="#flujo">Flujo</a>
          <a href="#biblioteca">Biblioteca</a>
          <a href="#analitica">Analítica</a>
          <a href="#contacto">Contacto</a>
        </nav>

        <div className="m360-nav__actions">
          <Link to="/login" className="m360-button m360-button--ghost">
            Ingresar
          </Link>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="m360-button m360-button--primary"
          >
            Solicitar una demo
          </a>
        </div>
      </header>

      <section className="m360-hero" id="inicio">
        <div className="m360-section__inner m360-hero__inner">
          <motion.div className="m360-hero__copy" {...getRevealProps(reduceMotion)}>
            <span className="m360-kicker">
              <Sparkles size={16} />
              Operación educativa orquestada de punta a punta
            </span>

            <h1>
              Escala el diseño de experiencias de aprendizaje y la producción de contenidos
              educativos.
            </h1>

            <p className="m360-hero__lead">
              {platformLabel} te ayuda a escalar el diseño de experiencias de aprendizaje y la
              producción de contenidos educativos, asegurando estándares de calidad, control y
              trazabilidad del 100% del proceso.
            </p>

            <div className="m360-hero__actions">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="m360-button m360-button--primary"
              >
                <span>Solicitar una demo</span>
                <ArrowRight size={18} />
              </a>
              <Link to="/login" className="m360-button m360-button--ghost">
                Entrar a la plataforma
              </Link>
            </div>

            <div className="m360-hero__signals">
              <div>
                <strong>100%</strong>
                <span>trazabilidad del proceso académico y productivo.</span>
              </div>
              <div>
                <strong>IA + control</strong>
                <span>asistencia operativa sin perder gobierno institucional.</span>
              </div>
              <div>
                <strong>Una sola capa</strong>
                <span>planeación, diseño, biblioteca, analítica y QA conectados.</span>
              </div>
            </div>
          </motion.div>

          <motion.div className="m360-hero__visual" {...getRevealProps(reduceMotion, 0.08)}>
            <div className="m360-ui-shot m360-ui-shot--hero">
              <div className="m360-ui-shot__topbar">
                <span className="m360-ui-shot__chip">Interfaz de plataforma</span>
                <span className="m360-ui-shot__status">
                  <CircleCheckBig size={16} />
                  Producción sincronizada
                </span>
              </div>

              <div className="m360-ui-shot__workspace">
                <aside className="m360-ui-shot__sidebar">
                  <div className="m360-ui-shot__brand-mini">{branding.shortMark}</div>
                  <span className="is-active">Dashboard</span>
                  <span>Cursos</span>
                  <span>Biblioteca</span>
                  <span>Analítica</span>
                </aside>

                <div className="m360-ui-shot__main">
                  <div className="m360-ui-shot__panel m360-ui-shot__panel--headline">
                    <div>
                      <small>Curso activo</small>
                      <strong>Diseño de experiencia de aprendizaje</strong>
                    </div>
                    <span>12 entregables en progreso</span>
                  </div>

                  <div className="m360-ui-shot__hero-grid">
                    <div className="m360-ui-shot__stage-stack">
                      <article>
                        <LayoutGrid size={18} />
                        <div>
                          <strong>Arquitectura</strong>
                          <span>Momentos, dispositivos y mapa didáctico.</span>
                        </div>
                      </article>
                      <article>
                        <Bot size={18} />
                        <div>
                          <strong>Diseño con IA</strong>
                          <span>Actividades, contenidos y criterios editables.</span>
                        </div>
                      </article>
                      <article>
                        <ShieldCheck size={18} />
                        <div>
                          <strong>Validación institucional</strong>
                          <span>Checklist y control pedagógico antes de publicar.</span>
                        </div>
                      </article>
                    </div>

                    <div className="m360-ui-shot__scorecard">
                      <span>Estado global</span>
                      <strong>92%</strong>
                      <p>Calidad, control y trazabilidad alineados por etapa.</p>
                      <div className="m360-ui-shot__scorebars" aria-hidden>
                        <span style={{ width: '92%' }} />
                        <span style={{ width: '74%' }} />
                        <span style={{ width: '88%' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="m360-strip">
        <div className="m360-section__inner m360-strip__inner">
          <div className="m360-strip__item">
            <Workflow size={18} />
            <span>Diseño, producción y distribución coordinados en un solo flujo.</span>
          </div>
          <div className="m360-strip__item">
            <ShieldCheck size={18} />
            <span>Estándares institucionales visibles en cada decisión y entregable.</span>
          </div>
          <div className="m360-strip__item">
            <ChartNoAxesCombined size={18} />
            <span>Lectura operativa en tiempo real para actuar antes del retraso.</span>
          </div>
        </div>
      </section>

      <section className="m360-flow" id="flujo">
        <div className="m360-section__inner m360-flow__inner">
          <motion.div className="m360-flow__intro" {...getRevealProps(reduceMotion)}>
            <span className="m360-kicker">
              <Clock3 size={16} />
              Timeline operativo
            </span>
            <h2>Un recorrido vertical que ordena el proyecto, el equipo y la calidad.</h2>
            <p>
              Cada etapa aparece como una decisión concreta del proceso. La plataforma no solo
              acelera tareas: también conserva el hilo lógico, el control institucional y la
              evidencia de cómo se produjo cada curso.
            </p>
          </motion.div>

          <div className="m360-timeline">
            {timelineSteps.map((step, index) => (
              <motion.article
                key={step.title}
                className={`m360-timeline__item m360-timeline__item--${step.accent}`}
                {...getTimelineRevealProps(reduceMotion, index)}
              >
                <div className="m360-timeline__rail" aria-hidden>
                  <span className="m360-timeline__index">{String(index + 1).padStart(2, '0')}</span>
                  {index < timelineSteps.length - 1 ? <span className="m360-timeline__line" /> : null}
                </div>

                <div className="m360-timeline__body">
                  <span className="m360-timeline__eyebrow">{step.eyebrow}</span>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section className="m360-library" id="biblioteca">
        <div className="m360-section__inner m360-library__inner">
          <motion.div className="m360-library__copy" {...getRevealProps(reduceMotion)}>
            <span className="m360-kicker m360-kicker--light">
              <LibraryBig size={16} />
              Biblioteca integrada
            </span>
            <h2>Curación asistida para incorporar mejores recursos sin salir del flujo.</h2>
            <p>
              Integra material educativo a partir de la curación asistida de recursos disponibles
              en bases de datos académicas y científicas.
            </p>

            <div className="m360-library__features">
              <div>
                <CheckCircle2 size={18} />
                <span>Recursos científicos, académicos y abiertos vinculados al curso.</span>
              </div>
              <div>
                <CheckCircle2 size={18} />
                <span>Selección guiada para reutilizar contenidos con criterio pedagógico.</span>
              </div>
              <div>
                <CheckCircle2 size={18} />
                <span>Integración inmediata en diseño, producción y validación.</span>
              </div>
            </div>
          </motion.div>

          <motion.div className="m360-library__visual" {...getRevealProps(reduceMotion, 0.08)}>
            <div className="m360-ui-shot m360-ui-shot--dark">
              <div className="m360-ui-shot__searchbar">
                <span>Buscar evidencia, artículos y recursos</span>
                <strong>+ 14 fuentes conectadas</strong>
              </div>

              <div className="m360-library-grid">
                {libraryCards.map((card) => (
                  <article key={card.title} className="m360-library-card">
                    <span>{card.tag}</span>
                    <strong>{card.title}</strong>
                    <p>{card.source}</p>
                  </article>
                ))}
              </div>

              <div className="m360-ui-shot__drawer">
                <div>
                  <small>Sugerencia IA</small>
                  <strong>Recursos alineados con la actividad de aprendizaje del módulo 2.</strong>
                </div>
                <FileCheck2 size={18} />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="m360-analytics" id="analitica">
        <div className="m360-section__inner m360-analytics__inner">
          <motion.div className="m360-analytics__visual" {...getRevealProps(reduceMotion)}>
            <div className="m360-ui-shot m360-ui-shot--analytics">
              <div className="m360-analytics-shot__stats">
                {analyticsStats.map((item) => (
                  <article key={item.label} className={`m360-stat m360-stat--${item.tone}`}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </article>
                ))}
              </div>

              <div className="m360-analytics-shot__board">
                <div className="m360-analytics-shot__chart">
                  <div className="m360-analytics-shot__curve" aria-hidden>
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="m360-analytics-shot__footer">
                    <small>Progreso por curso</small>
                    <strong>Lectura semanal en tiempo real</strong>
                  </div>
                </div>

                <div className="m360-analytics-shot__list">
                  {analyticsRows.map((row) => (
                    <div key={row.label} className="m360-progress-row">
                      <div>
                        <span>{row.label}</span>
                        <strong>{row.value}</strong>
                      </div>
                      <div className="m360-progress-row__track" aria-hidden>
                        <span
                          className={`m360-progress-row__fill m360-progress-row__fill--${row.tone}`}
                          style={{ width: row.value }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div className="m360-analytics__copy" {...getRevealProps(reduceMotion, 0.08)}>
            <span className="m360-kicker">
              <ChartNoAxesCombined size={16} />
              Analítica accionable
            </span>
            <h2>Visibilidad operativa para detectar alertas antes de que se conviertan en atraso.</h2>
            <p>
              Visualiza en tiempo real el progreso de producción por curso, identificando alertas
              tempranas y comparte los tableros con los stakeholders del proyecto.
            </p>

            <div className="m360-analytics__notes">
              <div>
                <MonitorSmartphone size={18} />
                <span>Lectura por curso, etapa, equipo y estado de avance.</span>
              </div>
              <div>
                <MessagesSquare size={18} />
                <span>Conversación ejecutiva con datos listos para compartir.</span>
              </div>
              <div>
                <ShieldCheck size={18} />
                <span>Alertas tempranas para actuar sobre carga, riesgo y calidad.</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="m360-cta" id="contacto">
        <div className="m360-section__inner m360-cta__inner">
          <motion.div className="m360-cta__copy" {...getRevealProps(reduceMotion)}>
            <span className="m360-kicker">
              <Sparkles size={16} />
              Nueva forma de operar
            </span>
            <h2>Preparemos a tu equipo para una nueva forma de trabajar en tiempos de IA.</h2>
            <p>
              Maturity360 conecta criterio pedagógico, producción y control institucional en una
              sola operación más clara, más rápida y más gobernable.
            </p>
          </motion.div>

          <motion.div className="m360-cta__actions" {...getRevealProps(reduceMotion, 0.08)}>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="m360-button m360-button--primary"
            >
              <span>Solicitar una demo</span>
              <ArrowRight size={18} />
            </a>
          </motion.div>
        </div>
      </section>

      <footer className="m360-footer">
        <div className="m360-section__inner m360-footer__inner">
          <p>Soluciones digitales con sentido humano.</p>
          <a href="https://www.algoritmot.com/educacion" target="_blank" rel="noreferrer">
            Producto desarrollado por Algoritmo T
          </a>
        </div>
      </footer>
    </main>
  );
}
