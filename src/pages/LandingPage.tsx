import {
  ArrowRight,
  Bot,
  ChartNoAxesCombined,
  CheckCircle2,
  CircleCheckBig,
  Clock3,
  FileCheck2,
  FileText,
  Globe,
  PlayCircle,
  LayoutGrid,
  LibraryBig,
  Menu,
  MessagesSquare,
  MonitorSmartphone,
  ShieldCheck,
  Sparkles,
  Workflow,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import type { BrandingSettings, HomeContentSettings } from '../types.js';

const whatsappUrl =
  'https://api.whatsapp.com/send/?phone=573006590161&text&type=phone_number&app_absent=0';

interface LandingPageProps {
  branding: BrandingSettings;
  homeContent: HomeContentSettings;
}

const timelineAccents = ['coral', 'gold', 'ocean', 'sage', 'ink', 'coral', 'ocean', 'sage'] as const;
const libraryCardIcons = [FileText, Globe, PlayCircle];
const analyticsStatTones = ['ocean', 'coral', 'sage'] as const;
const analyticsRowTones = ['ocean', 'gold', 'coral', 'sage'] as const;

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

export function LandingPage({ branding, homeContent }: LandingPageProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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

      <header className={`m360-nav ${isMenuOpen ? 'm360-nav--open' : ''}`}>
        <Link to="/" className="m360-brand" aria-label={branding.platformName}>
          {renderBrandMark()}
          <span className="m360-brand__copy">
            <strong>{platformLabel}</strong>
            <span>{homeContent.navBrandTagline}</span>
          </span>
        </Link>

        <button 
          className="m360-nav__toggle" 
          aria-label="Abrir menú" 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        <nav className={`m360-nav__links ${isMenuOpen ? 'is-open' : ''}`} aria-label="Secciones principales">
          <a href="#flujo" onClick={() => setIsMenuOpen(false)}>{homeContent.navFlowLabel}</a>
          <a href="#biblioteca" onClick={() => setIsMenuOpen(false)}>{homeContent.navLibraryLabel}</a>
          <a href="#analitica" onClick={() => setIsMenuOpen(false)}>{homeContent.navAnalyticsLabel}</a>
          <a href="#contacto" onClick={() => setIsMenuOpen(false)}>{homeContent.navContactLabel}</a>
        </nav>

        <div className={`m360-nav__actions ${isMenuOpen ? 'is-open' : ''}`}>
          <Link to="/login" className="m360-button m360-button--ghost">
            {homeContent.navLoginLabel}
          </Link>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="m360-button m360-button--primary"
          >
            {homeContent.navDemoLabel}
          </a>
        </div>
      </header>

      <section className="m360-hero" id="inicio">
        <div className="m360-section__inner m360-hero__inner">
          <motion.div className="m360-hero__copy" {...getRevealProps(reduceMotion)}>
            <span className="m360-kicker">
              <Sparkles size={16} />
              {homeContent.heroKicker}
            </span>

            <h1>{homeContent.heroTitle}</h1>

            <p className="m360-hero__lead">{homeContent.heroLead}</p>

            <div className="m360-hero__actions">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="m360-button m360-button--primary"
              >
                <span>{homeContent.heroPrimaryCta}</span>
                <ArrowRight size={18} />
              </a>
              <Link to="/login" className="m360-button m360-button--ghost">
                {homeContent.heroSecondaryCta}
              </Link>
            </div>

            <div className="m360-hero__signals">
              {homeContent.heroSignals.map((signal) => (
                <div key={signal.title}>
                  <strong>{signal.title}</strong>
                  <span>{signal.description}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div className="m360-hero__visual" {...getRevealProps(reduceMotion, 0.08)}>
            <div className="m360-ui-shot m360-ui-shot--hero">
              <div className="m360-ui-shot__topbar">
                <span className="m360-ui-shot__chip">{homeContent.heroStatusChip}</span>
                <span className="m360-ui-shot__status">
                  <CircleCheckBig size={16} />
                  {homeContent.heroStatusText}
                </span>
              </div>

              <div className="m360-ui-shot__workspace">
                <aside className="m360-ui-shot__sidebar">
                  <div className="m360-ui-shot__brand-mini">{branding.shortMark}</div>
                  <span className="is-active" style={{ background: 'transparent', color: '#18b7d2', paddingLeft: 0 }}>{homeContent.heroSidebarDashboard}</span>
                  <span>{homeContent.heroSidebarCourses}</span>
                  <span>{homeContent.heroSidebarLibrary}</span>
                  <span>{homeContent.heroSidebarAnalytics}</span>
                </aside>

                <div className="m360-ui-shot__main">
                  <div className="m360-ui-shot__panel m360-ui-shot__panel--headline">
                    <div>
                      <small>{homeContent.heroCourseLabel}</small>
                      <strong>{homeContent.heroCourseTitle}</strong>
                    </div>
                    <span>{homeContent.heroCourseProgressLabel}</span>
                  </div>

                  <div className="m360-ui-shot__hero-grid">
                    <div className="m360-ui-shot__stage-stack">
                      <article>
                        <LayoutGrid size={18} />
                        <div>
                          <strong>{homeContent.heroStageOneTitle}</strong>
                          <span>{homeContent.heroStageOneDescription}</span>
                        </div>
                      </article>
                      <article>
                        <Bot size={18} />
                        <div>
                          <strong>{homeContent.heroStageTwoTitle}</strong>
                          <span>{homeContent.heroStageTwoDescription}</span>
                        </div>
                      </article>
                      <article>
                        <ShieldCheck size={18} />
                        <div>
                          <strong>{homeContent.heroStageThreeTitle}</strong>
                          <span>{homeContent.heroStageThreeDescription}</span>
                        </div>
                      </article>
                    </div>

                    <div className="m360-ui-shot__scorecard">
                      <span>{homeContent.heroGlobalStatusLabel}</span>
                      <strong>{homeContent.heroCourseProgressValue}</strong>
                      <p>{homeContent.heroCourseProgressDescription}</p>
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
            <span>{homeContent.stripItems[0]}</span>
          </div>
          <div className="m360-strip__item">
            <ShieldCheck size={18} />
            <span>{homeContent.stripItems[1]}</span>
          </div>
          <div className="m360-strip__item">
            <ChartNoAxesCombined size={18} />
            <span>{homeContent.stripItems[2]}</span>
          </div>
        </div>
      </section>

      <section className="m360-flow" id="flujo">
        <div className="m360-section__inner m360-flow__inner">
          <motion.div className="m360-flow__intro" {...getRevealProps(reduceMotion)}>
            <span className="m360-kicker">
              <Clock3 size={16} />
              {homeContent.flowKicker}
            </span>
            <h2>{homeContent.flowTitle}</h2>
            <p>{homeContent.flowLead}</p>
          </motion.div>

          <div className="m360-timeline">
            {homeContent.timelineSteps.map((step, index) => (
              <motion.article
                key={step.title}
                className={`m360-timeline__item m360-timeline__item--${timelineAccents[index % timelineAccents.length]}`}
                {...getTimelineRevealProps(reduceMotion, index)}
              >
                <div className="m360-timeline__rail" aria-hidden>
                  <span className="m360-timeline__index">{String(index + 1).padStart(2, '0')}</span>
                  {index < homeContent.timelineSteps.length - 1 ? <span className="m360-timeline__line" /> : null}
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
              {homeContent.libraryKicker}
            </span>
            <h2>{homeContent.libraryTitle}</h2>
            <p>{homeContent.libraryLead}</p>

            <div className="m360-library__features">
              <div>
                <CheckCircle2 size={18} />
                <span>{homeContent.libraryFeatures[0]}</span>
              </div>
              <div>
                <CheckCircle2 size={18} />
                <span>{homeContent.libraryFeatures[1]}</span>
              </div>
              <div>
                <CheckCircle2 size={18} />
                <span>{homeContent.libraryFeatures[2]}</span>
              </div>
            </div>
          </motion.div>

          <motion.div className="m360-library__visual" {...getRevealProps(reduceMotion, 0.08)}>
            <div className="m360-ui-shot m360-ui-shot--light m360-ui-shot--library">
              <div className="m360-ui-shot__searchbar m360-ui-shot__searchbar--light">
                <span>{homeContent.librarySearchLabel}</span>
                <strong>{homeContent.librarySearchSources}</strong>
              </div>

              <div className="m360-library-grid">
                {homeContent.libraryCards.map((card, index) => {
                  const Icon = libraryCardIcons[index % libraryCardIcons.length];
                  return (
                  <article key={card.title} className="m360-library-card m360-library-card--light">
                    <div className="m360-library-card__header">
                       <span>{card.tag}</span>
                       <Icon size={20} className="m360-library-card__icon" />
                    </div>
                    <strong>{card.title}</strong>
                    <p>{card.source}</p>
                  </article>
                  );
                })}
              </div>

              <div className="m360-ui-shot__drawer m360-ui-shot__drawer--light">
                <div>
                  <small>{homeContent.librarySuggestionLabel}</small>
                  <strong>{homeContent.librarySuggestionText}</strong>
                </div>
                <FileCheck2 size={18} className="m360-ui-shot__drawer-icon" />
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
                {homeContent.analyticsStats.map((item, index) => (
                  <article key={item.label} className={`m360-stat m360-stat--${analyticsStatTones[index % analyticsStatTones.length]}`}>
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
                    <small>{homeContent.analyticsChartLabel}</small>
                    <strong>{homeContent.analyticsChartTitle}</strong>
                  </div>
                </div>

                <div className="m360-analytics-shot__list">
                  {homeContent.analyticsRows.map((row, index) => (
                    <div key={row.label} className="m360-progress-row">
                      <div>
                        <span>{row.label}</span>
                        <strong>{row.value}</strong>
                      </div>
                      <div className="m360-progress-row__track" aria-hidden>
                        <span
                          className={`m360-progress-row__fill m360-progress-row__fill--${analyticsRowTones[index % analyticsRowTones.length]}`}
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
              {homeContent.analyticsKicker}
            </span>
            <h2>{homeContent.analyticsTitle}</h2>
            <p>{homeContent.analyticsLead}</p>

            <div className="m360-analytics__notes">
              <div>
                <MonitorSmartphone size={18} />
                <span>{homeContent.analyticsNotes[0]}</span>
              </div>
              <div>
                <MessagesSquare size={18} />
                <span>{homeContent.analyticsNotes[1]}</span>
              </div>
              <div>
                <ShieldCheck size={18} />
                <span>{homeContent.analyticsNotes[2]}</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="m360-cta" id="contacto" style={{ 
          position: 'relative', 
          backgroundImage: 'url(https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1920&q=80)', 
          backgroundSize: 'cover', 
          backgroundPosition: 'center', 
          padding: '120px 0',
          color: 'white'
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.85)' }} aria-hidden />
        <div className="m360-section__inner m360-cta__inner" style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: '1fr', textAlign: 'center', justifyItems: 'center', gap: '32px' }}>
          <motion.div className="m360-cta__copy" {...getRevealProps(reduceMotion)} style={{ maxWidth: '800px' }}>
            <span className="m360-kicker m360-kicker--light" style={{ margin: '0 auto 24px' }}>
              <Sparkles size={16} />
              {homeContent.ctaKicker}
            </span>
            <h2 style={{ color: 'white' }}>{homeContent.ctaTitle}</h2>
            <p style={{ color: 'rgba(255,255,255,0.85)', margin: '20px auto 0' }}>
              {homeContent.ctaLead}
            </p>
          </motion.div>

          <motion.div className="m360-cta__actions" {...getRevealProps(reduceMotion, 0.08)}>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="m360-button m360-button--primary"
            >
              <span>{homeContent.ctaButtonLabel}</span>
              <ArrowRight size={18} />
            </a>
          </motion.div>
        </div>
      </section>

      <footer className="m360-footer">
        <div className="m360-section__inner m360-footer__inner">
          <p>{homeContent.footerText}</p>
          <a href={homeContent.footerLinkUrl} target="_blank" rel="noreferrer">
            {homeContent.footerLinkLabel}
          </a>
        </div>
      </footer>
    </main>
  );
}
