/**
 * H5PAIPlayer — Native React renderer for AI-generated H5P content.
 * Renders QuestionSet, Flashcards, Accordion, TrueFalse, Blanks, Summary, SingleChoiceSet.
 */

import { useState } from 'react';
import { CheckCircle2, XCircle, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import type {
  AIGeneratedContent,
  QuizContent,
  FlashcardsContent,
  AccordionContent,
  TrueFalseContent,
  BlanksContent,
  SummaryContent,
  SingleChoiceContent,
} from '../../api/h5p/ai-generate.js';

interface H5PAIPlayerProps {
  content: AIGeneratedContent;
}

export function H5PAIPlayer({ content }: H5PAIPlayerProps) {
  switch (content.type) {
    case 'H5P.QuestionSet':    return <QuizPlayer content={content} />;
    case 'H5P.Flashcards':     return <FlashcardsPlayer content={content} />;
    case 'H5P.Accordion':      return <AccordionPlayer content={content} />;
    case 'H5P.TrueFalse':      return <TrueFalsePlayer content={content} />;
    case 'H5P.Blanks':         return <BlanksPlayer content={content} />;
    case 'H5P.Summary':        return <SummaryPlayer content={content} />;
    case 'H5P.SingleChoiceSet':return <SingleChoicePlayer content={content} />;
    default:                   return <div className="p-8 text-center text-slate-400">Tipo de contenido no soportado</div>;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared styles
// ─────────────────────────────────────────────────────────────────────────────

const TEAL = 'var(--library-teal)';
const TEAL_GRADIENT = 'var(--library-teal-gradient)';

function PlayerShell({ title, children, footer }: { title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="rounded-[20px] border border-slate-200 overflow-hidden bg-white shadow-sm">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2.5" style={{ background: 'linear-gradient(135deg, #f0fdfa, #e0f2fe)' }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-black flex-shrink-0" style={{ background: TEAL_GRADIENT }}>H5</div>
        <h3 className="text-sm font-bold text-slate-700 truncate flex-1">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
      {footer && <div className="px-5 pb-5">{footer}</div>}
    </div>
  );
}

function ScoreBar({ correct, total }: { correct: number; total: number }) {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const color = pct >= 70 ? '#16a34a' : pct >= 50 ? '#ca8a04' : '#dc2626';
  return (
    <div className="p-4 rounded-2xl border text-center" style={{ borderColor: `${color}30`, background: `${color}08` }}>
      <div className="text-3xl font-black" style={{ color }}>{pct}%</div>
      <div className="text-xs font-semibold mt-0.5" style={{ color }}>{correct} / {total} correctas</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QuestionSet
// ─────────────────────────────────────────────────────────────────────────────

function QuizPlayer({ content }: { content: QuizContent }) {
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState<(number | null)[]>(Array(content.questions.length).fill(null));
  const [showResults, setShowResults] = useState(false);

  const q = content.questions[current];
  const isLast = current === content.questions.length - 1;
  const userAnswer = answered[current];
  const hasAnswered = userAnswer !== null;

  function confirm() {
    if (selected === null) return;
    const next = [...answered];
    next[current] = selected;
    setAnswered(next);
  }

  function advance() {
    if (isLast) {
      setShowResults(true);
    } else {
      setCurrent((c) => c + 1);
      setSelected(null);
    }
  }

  function restart() {
    setCurrent(0);
    setSelected(null);
    setAnswered(Array(content.questions.length).fill(null));
    setShowResults(false);
  }

  const correctCount = answered.filter((a, i) => a === content.questions[i].correct).length;

  if (showResults) {
    return (
      <PlayerShell title={content.title}>
        <div className="space-y-4">
          <ScoreBar correct={correctCount} total={content.questions.length} />
          <div className="space-y-2">
            {content.questions.map((q, i) => {
              const isCorrect = answered[i] === q.correct;
              return (
                <div key={i} className={`flex items-start gap-2 p-3 rounded-xl text-xs ${isCorrect ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                  {isCorrect ? <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0 mt-0.5" /> : <XCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />}
                  <div>
                    <p className="font-semibold text-slate-700">{q.question}</p>
                    {!isCorrect && <p className="text-emerald-700 mt-0.5">Correcta: {q.options[q.correct]}</p>}
                    {q.explanation && <p className="text-slate-500 mt-0.5 italic">{q.explanation}</p>}
                  </div>
                </div>
              );
            })}
          </div>
          <button onClick={restart} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: TEAL_GRADIENT }}>
            <RotateCcw size={14} /> Reintentar
          </button>
        </div>
      </PlayerShell>
    );
  }

  return (
    <PlayerShell
      title={content.title}
      footer={
        <div className="flex items-center gap-3">
          {!hasAnswered ? (
            <button onClick={confirm} disabled={selected === null} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition-all" style={{ background: TEAL_GRADIENT }}>
              Comprobar
            </button>
          ) : (
            <button onClick={advance} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all" style={{ background: TEAL_GRADIENT }}>
              {isLast ? 'Ver resultados' : 'Siguiente →'}
            </button>
          )}
          <span className="text-xs text-slate-400 font-medium">{current + 1} / {content.questions.length}</span>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm font-semibold text-slate-800 leading-relaxed">{q.question}</p>
        <div className="space-y-2">
          {q.options.map((opt, i) => {
            let cls = 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100 cursor-pointer';
            if (hasAnswered) {
              if (i === q.correct) cls = 'border-emerald-400 bg-emerald-50 cursor-default';
              else if (i === userAnswer && i !== q.correct) cls = 'border-red-400 bg-red-50 cursor-default';
              else cls = 'border-slate-200 bg-slate-50 cursor-default opacity-60';
            } else if (selected === i) {
              cls = 'border-teal-400 bg-teal-50 cursor-pointer';
            }
            return (
              <button key={i} onClick={() => !hasAnswered && setSelected(i)} className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm transition-all ${cls}`}>
                <span className="w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-[10px] font-black" style={{ borderColor: 'currentColor' }}>{String.fromCharCode(65 + i)}</span>
                <span>{opt}</span>
                {hasAnswered && i === q.correct && <CheckCircle2 size={14} className="text-emerald-600 ml-auto flex-shrink-0" />}
                {hasAnswered && i === userAnswer && i !== q.correct && <XCircle size={14} className="text-red-500 ml-auto flex-shrink-0" />}
              </button>
            );
          })}
        </div>
        {hasAnswered && q.explanation && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 leading-relaxed">
            💡 {q.explanation}
          </div>
        )}
      </div>
    </PlayerShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Flashcards
// ─────────────────────────────────────────────────────────────────────────────

function FlashcardsPlayer({ content }: { content: FlashcardsContent }) {
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const card = content.cards[current];

  return (
    <PlayerShell title={content.title}>
      {content.description && <p className="text-xs text-slate-500 mb-4 leading-relaxed">{content.description}</p>}
      <div className="space-y-4">
        <div
          onClick={() => setFlipped((f) => !f)}
          className="relative min-h-[160px] rounded-2xl border-2 cursor-pointer transition-all hover:shadow-md flex items-center justify-center p-6 text-center"
          style={{ borderColor: flipped ? TEAL : '#e2e8f0', background: flipped ? '#f0fdfa' : '#f8fafc' }}
        >
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: flipped ? TEAL : '#94a3b8' }}>
              {flipped ? 'Reverso' : 'Frente — clic para voltear'}
            </div>
            <p className="text-sm font-semibold text-slate-800 leading-relaxed">{flipped ? card.back : card.front}</p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <button onClick={() => { setCurrent((c) => Math.max(0, c - 1)); setFlipped(false); }} disabled={current === 0} className="px-4 py-2 rounded-xl text-xs font-bold border-2 border-slate-200 text-slate-500 hover:border-slate-300 disabled:opacity-40 transition-all">← Anterior</button>
          <span className="text-xs text-slate-400 font-medium">{current + 1} / {content.cards.length}</span>
          <button onClick={() => { setCurrent((c) => Math.min(content.cards.length - 1, c + 1)); setFlipped(false); }} disabled={current === content.cards.length - 1} className="px-4 py-2 rounded-xl text-xs font-bold border-2 border-slate-200 text-slate-500 hover:border-slate-300 disabled:opacity-40 transition-all">Siguiente →</button>
        </div>
      </div>
    </PlayerShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Accordion
// ─────────────────────────────────────────────────────────────────────────────

function AccordionPlayer({ content }: { content: AccordionContent }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <PlayerShell title={content.title}>
      <div className="space-y-2">
        {content.panels.map((panel, i) => (
          <div key={i} className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
            >
              <span className="text-sm font-semibold text-slate-700">{panel.title}</span>
              {open === i ? <ChevronUp size={16} className="text-slate-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-slate-400 flex-shrink-0" />}
            </button>
            {open === i && (
              <div
                className="px-4 pb-4 text-sm text-slate-600 leading-relaxed border-t border-slate-100"
                dangerouslySetInnerHTML={{ __html: panel.content }}
              />
            )}
          </div>
        ))}
      </div>
    </PlayerShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// True / False
// ─────────────────────────────────────────────────────────────────────────────

function TrueFalsePlayer({ content }: { content: TrueFalseContent }) {
  const [answers, setAnswers] = useState<(boolean | null)[]>(Array(content.statements.length).fill(null));
  const [submitted, setSubmitted] = useState(false);

  const correctCount = submitted ? answers.filter((a, i) => a === content.statements[i].correct).length : 0;

  return (
    <PlayerShell title={content.title} footer={
      !submitted ? (
        <button onClick={() => setSubmitted(true)} disabled={answers.some((a) => a === null)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition-all" style={{ background: TEAL_GRADIENT }}>
          Comprobar respuestas
        </button>
      ) : (
        <div className="flex items-center gap-4">
          <ScoreBar correct={correctCount} total={content.statements.length} />
          <button onClick={() => { setAnswers(Array(content.statements.length).fill(null)); setSubmitted(false); }} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-600 border-2 border-slate-200 hover:border-slate-300 transition-all">
            <RotateCcw size={12} /> Reintentar
          </button>
        </div>
      )
    }>
      <div className="space-y-3">
        {content.statements.map((stmt, i) => {
          const userAnswer = answers[i];
          const isCorrect = submitted && userAnswer === stmt.correct;
          const isWrong = submitted && userAnswer !== null && userAnswer !== stmt.correct;
          return (
            <div key={i} className={`p-3 rounded-xl border-2 transition-all ${isCorrect ? 'border-emerald-300 bg-emerald-50' : isWrong ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
              <p className="text-sm text-slate-700 mb-2 leading-relaxed">{stmt.text}</p>
              <div className="flex items-center gap-2">
                {(['Verdadero', 'Falso'] as const).map((label) => {
                  const val = label === 'Verdadero';
                  const active = userAnswer === val;
                  return (
                    <button key={label} onClick={() => !submitted && setAnswers((prev) => { const n = [...prev]; n[i] = val; return n; })}
                      disabled={submitted}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${active ? 'text-white' : 'border-slate-200 text-slate-500'}`}
                      style={active ? { background: TEAL_GRADIENT, borderColor: 'transparent' } : {}}
                    >
                      {label}
                    </button>
                  );
                })}
                {submitted && isWrong && stmt.explanation && (
                  <span className="text-[10px] text-slate-500 italic ml-auto">{stmt.explanation}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </PlayerShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fill in the Blanks
// ─────────────────────────────────────────────────────────────────────────────

function BlanksPlayer({ content }: { content: BlanksContent }) {
  type BlankState = { answers: string[]; submitted: boolean };
  const [states, setStates] = useState<BlankState[]>(
    content.sentences.map((s) => ({
      answers: Array((s.text.match(/\[([^\]]+)\]/g) ?? []).length).fill(''),
      submitted: false,
    })),
  );

  function parseSentence(text: string) {
    const parts: Array<{ type: 'text' | 'blank'; value: string }> = [];
    let match: RegExpExecArray | null;
    const re = /\[([^\]]+)\]/g;
    let lastIndex = 0;
    re.lastIndex = 0;
    while ((match = re.exec(text)) !== null) {
      if (match.index > lastIndex) parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
      parts.push({ type: 'blank', value: match[1] });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) parts.push({ type: 'text', value: text.slice(lastIndex) });
    return parts;
  }

  return (
    <PlayerShell title={content.title}>
      <div className="space-y-5">
        {content.sentences.map((sentence, si) => {
          const parts = parseSentence(sentence.text);
          const state = states[si];
          let blankIndex = 0;
          return (
            <div key={si} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-sm text-slate-700 leading-relaxed flex flex-wrap items-center gap-1">
                {parts.map((part, pi) => {
                  if (part.type === 'text') return <span key={pi}>{part.value}</span>;
                  const bi = blankIndex++;
                  const userVal = state.answers[bi] ?? '';
                  const correct = part.value.toLowerCase();
                  const isCorrect = state.submitted && userVal.trim().toLowerCase() === correct;
                  const isWrong = state.submitted && userVal.trim().toLowerCase() !== correct;
                  return (
                    <input key={pi} type="text" value={userVal}
                      onChange={(e) => {
                        const next = [...state.answers];
                        next[bi] = e.target.value;
                        setStates((prev) => { const n = [...prev]; n[si] = { ...n[si], answers: next }; return n; });
                      }}
                      disabled={state.submitted}
                      placeholder="___"
                      className={`inline-block px-2 py-0.5 rounded-lg border-2 text-sm font-semibold outline-none min-w-[80px] text-center transition-all ${
                        isCorrect ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                          : isWrong ? 'border-red-400 bg-red-50 text-red-700'
                          : 'border-teal-300 bg-white focus:border-teal-500'
                      }`}
                      style={{ width: `${Math.max(80, (part.value.length + 2) * 10)}px` }}
                    />
                  );
                })}
              </p>
              <div className="flex items-center gap-3 mt-3">
                {!state.submitted ? (
                  <button onClick={() => setStates((prev) => { const n = [...prev]; n[si] = { ...n[si], submitted: true }; return n; })}
                    className="px-4 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: TEAL_GRADIENT }}>
                    Comprobar
                  </button>
                ) : (
                  <>
                    <button onClick={() => setStates((prev) => { const n = [...prev]; n[si] = { answers: Array(state.answers.length).fill(''), submitted: false }; return n; })}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-slate-500 hover:border-slate-300">
                      <RotateCcw size={11} /> Reintentar
                    </button>
                    {state.submitted && (
                      <span className="text-xs text-slate-500">
                        Respuestas: {parseSentence(sentence.text).filter((p) => p.type === 'blank').map((p) => p.value).join(', ')}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </PlayerShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary (Key Points)
// ─────────────────────────────────────────────────────────────────────────────

function SummaryPlayer({ content }: { content: SummaryContent }) {
  return (
    <PlayerShell title={content.title}>
      <div className="space-y-3">
        {content.intro && (
          <p className="text-sm text-slate-600 leading-relaxed pb-2 border-b border-slate-100">{content.intro}</p>
        )}
        {content.points.map((point, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-teal-200 hover:bg-teal-50/30 transition-colors">
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0 mt-0.5" style={{ background: TEAL_GRADIENT }}>
              {i + 1}
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">{point}</p>
          </div>
        ))}
      </div>
    </PlayerShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Single Choice Set (rapid fire)
// ─────────────────────────────────────────────────────────────────────────────

function SingleChoicePlayer({ content }: { content: SingleChoiceContent }) {
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const choice = content.choices[current];
  const isLast = current === content.choices.length - 1;

  function pick(i: number) {
    if (selected !== null) return;
    setSelected(i);
    if (i === 0) setScore((s) => s + 1);
  }

  function next() {
    if (isLast) { setDone(true); return; }
    setCurrent((c) => c + 1);
    setSelected(null);
  }

  if (done) {
    return (
      <PlayerShell title={content.title}>
        <div className="space-y-4">
          <ScoreBar correct={score} total={content.choices.length} />
          <button onClick={() => { setCurrent(0); setSelected(null); setScore(0); setDone(false); }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: TEAL_GRADIENT }}>
            <RotateCcw size={14} /> Reintentar
          </button>
        </div>
      </PlayerShell>
    );
  }

  return (
    <PlayerShell title={content.title} footer={
      selected !== null && (
        <button onClick={next} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all" style={{ background: TEAL_GRADIENT }}>
          {isLast ? 'Ver resultado' : 'Siguiente →'}
        </button>
      )
    }>
      <div className="space-y-4">
        <p className="text-sm font-semibold text-slate-800 leading-relaxed">{choice.question}</p>
        <div className="space-y-2">
          {choice.answers.map((ans, i) => {
            const isCorrect = i === 0;
            let cls = 'border-slate-200 bg-slate-50 hover:border-slate-300 cursor-pointer';
            if (selected !== null) {
              if (isCorrect) cls = 'border-emerald-400 bg-emerald-50 cursor-default';
              else if (selected === i) cls = 'border-red-400 bg-red-50 cursor-default';
              else cls = 'border-slate-200 bg-slate-50 cursor-default opacity-50';
            }
            return (
              <button key={i} onClick={() => pick(i)} className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm transition-all ${cls}`}>
                <span>{ans}</span>
                {selected !== null && isCorrect && <CheckCircle2 size={14} className="text-emerald-600 ml-auto flex-shrink-0" />}
                {selected === i && !isCorrect && <XCircle size={14} className="text-red-500 ml-auto flex-shrink-0" />}
              </button>
            );
          })}
        </div>
        <div className="text-right text-xs text-slate-400">{current + 1} / {content.choices.length}</div>
      </div>
    </PlayerShell>
  );
}
