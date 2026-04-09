import {
  ArrowRight,
  Bot,
  BookOpen,
  Brain,
  CheckCircle2,
  CircleCheckBig,
  Clock3,
  FileCheck2,
  Film,
  LayoutGrid,
  MonitorSmartphone,
  Sparkles,
  ShieldCheck,
  Workflow,
  UsersRound,
  ChartNoAxesCombined,
  Presentation,
  LibraryBig,
  MessagesSquare,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { BrandingSettings } from '../types.js';

const whatsappUrl =
  'https://api.whatsapp.com/send/?phone=573006590161&text&type=phone_number&app_absent=0';

interface LandingPageProps {
  branding: BrandingSettings;
}

const teamCards = [
  {
    icon: Brain,
    title: 'Equipo académico',
    eyebrow: 'Profesores y diseñadores instruccionales',
    copy:
      'Transforma lineamientos, resultados y criterios en productos coherentes, claros y listos para validar.',
    bullets: [
      'Planes de curso y rutas de aprendizaje con estructura clara.',
      'Rúbricas y criterios pedagógicos generados y editables con IA.',
      'Revisión más rápida sin perder trazabilidad ni calidad.',
    ],
  },
  {
    icon: Film,
    title: 'Equipo de producción',
    eyebrow: 'Diseño multimedia y LMS',
    copy:
      'Coordina edición, piezas, recursos y montaje técnico para que el contenido llegue con consistencia comunicativa.',
    bullets: [
      'Recursos educativos listos para producir y versionar.',
      'Flujos visuales y técnicos alineados con el producto.',
      'Menos retrabajo gracias a validaciones tempranas.',
    ],
  },
  {
    icon: ChartNoAxesCombined,
    title: 'Equipo administrativo',
    eyebrow: 'Gestión de proyecto y toma de decisiones',
    copy:
      'Visualiza progreso, cargas, riesgos y tiempos para gobernar la producción desde una sola capa operativa.',
    bullets: [
      'Seguimiento por etapa, rol y estado del producto.',
      'Alertas, bloqueos y cumplimiento de cronograma.',
      'Lectura ejecutiva para decidir con mejor información.',
    ],
  },
];

const flowSteps = [
  {
    icon: LayoutGrid,
    title: 'Orquestación',
    text: 'Cada curso se estructura en productos, etapas y responsables con trazabilidad completa.',
  },
  {
    icon: Bot,
    title: 'Generación con IA',
    text: 'La IA acelera borradores, criterios de calidad, síntesis y curaduría de contenidos.',
  },
  {
    icon: FileCheck2,
    title: 'Validación pedagógica',
    text: 'Checklist, comentarios y edición fina para asegurar calidad instruccional real.',
  },
  {
    icon: MonitorSmartphone,
    title: 'Producción y publicación',
    text: 'Entrega consistente para multimedia, LMS, QA y cierre operativo.',
  },
];

const deliverables = [
  'Planes de curso',
  'Rutas de aprendizaje',
  'Actividades',
  'Rúbricas',
  'Recursos educativos',
  'Curación de contenidos',
];

const trustPillars = [
  'Estándares pedagógicos',
  'Estándares tecnológicos',
  'Estándares comunicativos',
  'Trazabilidad de decisiones',
  'Feedback por fragmentos',
  'Descarga en .docx y .pdf',
];

export function LandingPage({ branding }: LandingPageProps) {
  return (
    <main className="landing-page">
      <div className="landing-page__backdrop" aria-hidden />
      <header className="landing-nav">
        <Link to="/" className="landing-brand" aria-label={branding.platformName}>
          <span className="landing-brand__mark">{branding.shortMark}</span>
          <span className="landing-brand__copy">
            <strong>{branding.platformName}</strong>
            <span>Producción académica con IA</span>
          </span>
        </Link>

        <nav className="landing-nav__links" aria-label="Secciones de la landing">
          <a href="#solucion">Solución</a>
          <a href="#equipos">Equipos</a>
          <a href="#flujo">Flujo</a>
          <a href="#entregables">Entregables</a>
        </nav>

        <div className="landing-nav__actions">
          <Link to="/login" className="landing-link-button">
            Ingresar
          </Link>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="landing-cta-button landing-cta-button--compact"
          >
            Hablar por WhatsApp
          </a>
        </div>
      </header>

      <section className="landing-hero surface">
        <div className="landing-hero__copy">
          <span className="landing-eyebrow">
            <Sparkles size={16} />
            IA + tecnología para producción educativa
          </span>
          <h1>
            Maturity 360 acelera el 100% del flujo de contenidos educativos con calidad
            pedagógica, tecnológica y comunicativa.
          </h1>
          <p>
            Diseñada para equipos académicos, de producción y administrativos, la plataforma
            convierte la creación de cursos en una operación clara, medible y colaborativa:
            desde planes de curso y rutas de aprendizaje hasta actividades, rúbricas, recursos
            educativos y curación de contenidos.
          </p>

          <div className="landing-hero__actions">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="landing-cta-button"
            >
              <span>Solicitar una demo</span>
              <ArrowRight size={18} />
            </a>
            <Link to="/login" className="landing-secondary-button">
              Entrar a la plataforma
            </Link>
          </div>

          <div className="landing-hero__highlights">
            <div>
              <strong>100%</strong>
              <span>del flujo de producción conectado</span>
            </div>
            <div>
              <strong>3 equipos</strong>
              <span>académico, producción y administración</span>
            </div>
            <div>
              <strong>IA aplicada</strong>
              <span>para generar, revisar y escalar más rápido</span>
            </div>
          </div>
        </div>

        <div className="landing-hero__visual" id="solucion">
          <div className="landing-mockup landing-mockup--top">
            <div className="landing-mockup__header">
              <span>Flujo inteligente</span>
              <CircleCheckBig size={18} />
            </div>
            <div className="landing-mockup__metrics">
              <article>
                <strong>36</strong>
                <span>productos trazados</span>
              </article>
              <article>
                <strong>12</strong>
                <span>criterios de calidad</span>
              </article>
              <article>
                <strong>4</strong>
                <span>etapas activas</span>
              </article>
            </div>
          </div>

          <div className="landing-mockup landing-mockup--grid">
            <div className="landing-mockup__tile landing-mockup__tile--academic">
              <BookOpen size={18} />
              <span>Académico</span>
            </div>
            <div className="landing-mockup__tile landing-mockup__tile--production">
              <Film size={18} />
              <span>Producción</span>
            </div>
            <div className="landing-mockup__tile landing-mockup__tile--admin">
              <Presentation size={18} />
              <span>Administración</span>
            </div>
            <div className="landing-mockup__tile landing-mockup__tile--ai">
              <Bot size={18} />
              <span>IA asistida</span>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-band">
        <div className="landing-band__item">
          <ShieldCheck size={18} />
          <span>Estándares pedagógicos, tecnológicos y comunicativos</span>
        </div>
        <div className="landing-band__item">
          <Workflow size={18} />
          <span>Flujo completo con trazabilidad por etapa y responsable</span>
        </div>
        <div className="landing-band__item">
          <LibraryBig size={18} />
          <span>Recursos, curación y evidencias en una sola plataforma</span>
        </div>
      </section>

      <section className="landing-section" id="equipos">
        <div className="landing-section__heading">
          <span className="landing-eyebrow">
            <UsersRound size={16} />
            Equipos sincronizados
          </span>
          <h2>La IA potencia a cada equipo sin romper el trabajo colaborativo.</h2>
          <p>
            Cada perfil entra con una vista y responsabilidades claras, pero todos comparten la
            misma fuente de verdad: los productos del curso y su estado real.
          </p>
        </div>

        <div className="landing-team-grid">
          {teamCards.map((team) => {
            const Icon = team.icon;

            return (
              <article key={team.title} className="landing-team-card surface">
                <div className="landing-team-card__icon">
                  <Icon size={22} />
                </div>
                <span className="landing-team-card__eyebrow">{team.eyebrow}</span>
                <h3>{team.title}</h3>
                <p>{team.copy}</p>
                <ul>
                  {team.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      <section className="landing-section landing-section--split" id="flujo">
        <div className="landing-flow-card surface">
          <span className="landing-eyebrow">
            <Clock3 size={16} />
            Operación continua
          </span>
          <h2>Un flujo de trabajo que reduce fricción, retrabajo y tiempos muertos.</h2>
          <div className="landing-flow-list">
            {flowSteps.map((step, index) => {
              const Icon = step.icon;

              return (
                <article key={step.title} className="landing-flow-step">
                  <div className="landing-flow-step__index">{index + 1}</div>
                  <div className="landing-flow-step__icon">
                    <Icon size={18} />
                  </div>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="landing-standards surface">
          <span className="landing-eyebrow">
            <CheckCircle2 size={16} />
            Criterios y entregables
          </span>
          <h2>El sistema ordena todo lo que debe existir para producir con calidad.</h2>
          <div className="landing-pill-grid" id="entregables">
            {deliverables.map((item) => (
              <span key={item} className="landing-pill">
                {item}
              </span>
            ))}
          </div>

          <div className="landing-trust-grid">
            {trustPillars.map((item) => (
              <div key={item} className="landing-trust-item">
                <span />
                <p>{item}</p>
              </div>
            ))}
          </div>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="landing-cta-button landing-cta-button--full"
          >
            <span>Hablemos por WhatsApp</span>
            <ArrowRight size={18} />
          </a>
        </div>
      </section>

      <section className="landing-footer-cta surface">
        <div>
          <span className="landing-eyebrow">
            <MessagesSquare size={16} />
            ¿Listos para empezar?
          </span>
          <h2>Maturity 360 convierte la producción educativa en un sistema más rápido, claro y gobernable.</h2>
        </div>
        <div className="landing-footer-cta__actions">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="landing-cta-button"
          >
            <span>Solicitar una demo</span>
            <ArrowRight size={18} />
          </a>
          <Link to="/login" className="landing-secondary-button">
            Acceder al sistema
          </Link>
        </div>
      </section>
    </main>
  );
}
