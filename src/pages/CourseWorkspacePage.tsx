import {
  Flag,
  MoveRight,
  PencilLine,
  Plus,
  Save,
  Settings,
  Trash2,
  History,
  FileUp,
  Search,
  Sparkles,
  Loader2,
  CheckCircle2,
  FileText,
  RefreshCcw,
  Layers,
  BarChart3,
  Globe,
  PenTool,
  BookOpen,
  Target,
  File,
  AlertCircle,
  Video,
  Mic,
  MonitorPlay,
  ClipboardCheck,
  ChevronDown,
  Bold,
  Italic,
  List,
  ListOrdered,
  Underline,
  Heading3,
  MessageSquareText,
  ClipboardList,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ModalFrame } from '../components/ModalFrame.js';
import { SidePanel } from '../components/SidePanel.js';
import { useModalStore } from '../store/modalStore.js';
import { useSystemDialog } from '../components/SystemDialogProvider.js';
import { ProgressRing } from '../components/ProgressRing.js';
import { VerticalStageTimeline } from '../components/VerticalStageTimeline.js';
import type {
  AppData,
  AuthUser,
  Course,
  CourseMetadataMutationInput,
  CourseProduct,
  CourseProductMutationInput,
  CourseProductStatus,
  CourseProductStage,
  CourseStageNoteKey,
  CourseStageNoteMutationInput,
  CourseMutationInput,
  LibraryResource,
  ProductWritingAsset,
  ProductWritingData,
  ProductWritingSection,
  ProductPhasePlan,
  ProductPlanningPhase,
  Role,
  ProductValidationData,
  ProductValidationChecklistItem,
  StageCheckpointStatus,
  Task,
  TaskMutationInput,
  TeamMember,
  TeamMemberMutationInput,
} from '../types.js';
import {
  buildDefaultValidationData,
  normalizeValidationChecklistStatus,
} from '../data/productValidationDefaults.js';
import { formatDate } from '../utils/format.js';
import { getCourseBySlug, getStageMeta } from '../utils/domain.js';
import {
  getFirstInstitutionStructure,
  getInstitutionAcademicPeriods,
  getInstitutionCourseTypes,
  getInstitutionFaculties,
  getInstitutionPedagogicalGuidelines,
  getInstitutionPrograms,
} from '../utils/institutions.js';
import {
  canManageArchitecture,
  canCreateCourseProducts,
  canCreateTasks,
  canDeleteCourseProducts,
  canDeleteTasks,
  canEditCourseProduct,
  canEditPlanningWorkspace,
  canEditStageNote,
  canManageCourses,
  canManageMicrocurriculo,
} from '../utils/permissions.js';

interface CourseWorkspacePageProps {
  role: Role;
  userRole: Role;
  viewer: AuthUser;
  appData: AppData;
  isLoading?: boolean;
  refreshAppData: () => void;
  mutateAppData: (nextData: AppData | ((current: AppData) => AppData)) => void;
}

type CourseSection =
  | 'summary'
  | 'microcurriculo'
  | 'arquitectura'
  | 'planeacion'
  | 'escritura'
  | 'validacion'
  | 'multimedia'
  | 'lms'
  | 'qa'
  | 'entrega'
  | 'history';

type WritingWorkspaceRoute = 'upload' | 'ai' | 'manual';

const validCourseSections: CourseSection[] = [
  'summary',
  'microcurriculo',
  'arquitectura',
  'planeacion',
  'escritura',
  'validacion',
  'multimedia',
  'lms',
  'qa',
  'entrega',
  'history',
];

const writingWorkspaceRoutes: WritingWorkspaceRoute[] = ['upload', 'ai', 'manual'];

const WRITING_LAUNCH_STORAGE_KEY = 'maturity-writing-launch-v1';
const WRITING_LAUNCH_MAX_AGE = 1000 * 60 * 20;
const WRITING_EXTRACTION_REQUEST_TIMEOUT_MS = 70000;
const WRITING_SAVE_REQUEST_TIMEOUT_MS = 20000;
const WRITING_INLINE_EXTRACTION_MAX_BYTES = 2 * 1024 * 1024;
const WRITING_CLIENT_EXTRACTION_TIMEOUT_MS = 120000;
const WRITING_UPLOAD_ALLOWED_EXTENSIONS = new Set(['pdf', 'docx']);
const WRITING_AI_GENERATION_REQUEST_TIMEOUT_MS = 45000;
const WRITING_AI_GENERATION_MAX_ATTEMPTS = 2;
const WRITING_AI_GENERATION_COOLDOWN_MS = 500;
const WRITING_AI_RETRYABLE_STATUSES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const WRITING_AI_RETRY_DELAYS_MS = [900, 1600] as const;

interface WritingLaunchSnapshot {
  courseSlug: string;
  productId: string;
  createdAt: number;
  course: Course;
  users: AuthUser[];
  libraryResources: LibraryResource[];
}

function readWritingLaunchSnapshot(courseSlug: string, productId: string) {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(WRITING_LAUNCH_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<WritingLaunchSnapshot> | null;

    if (
      !parsed ||
      parsed.courseSlug !== courseSlug ||
      parsed.productId !== productId ||
      typeof parsed.createdAt !== 'number' ||
      !parsed.course
    ) {
      return null;
    }

    if (Date.now() - parsed.createdAt > WRITING_LAUNCH_MAX_AGE) {
      window.localStorage.removeItem(WRITING_LAUNCH_STORAGE_KEY);
      return null;
    }

    return {
      courseSlug: parsed.courseSlug,
      productId: parsed.productId,
      createdAt: parsed.createdAt,
      course: parsed.course,
      users: Array.isArray(parsed.users) ? parsed.users : [],
      libraryResources: Array.isArray(parsed.libraryResources) ? parsed.libraryResources : [],
    } satisfies WritingLaunchSnapshot;
  } catch {
    return null;
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function hasHtmlMarkup(value: string) {
  return /<\/?[a-z][\s\S]*>/iu.test(value);
}

function hasStructuredRichHtmlBlocks(value: string) {
  return /<(p|ul|ol|li|blockquote|h3|h4)\b/i.test(value);
}

function normalizePlainTextToHtml(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

const structuredInstructionLabels = [
  'Ficha técnica',
  'Estrategias sugeridas para el cierre',
  'Instrucciones de redacción y enfoque',
  'Especificación / instrucción',
  'Propósito comunicativo',
  'Estilo visual y narrativo',
  'Recursos narrativos obligatorios',
  'Aspecto',
  'Función',
  'Duración máxima',
  'Inicio',
  'Desarrollo',
  'Cierre',
  'Tono',
] as const;

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeLegacyStructuredText(value: string) {
  const normalized = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  if (!normalized) {
    return '';
  }

  const hasStructuredSignal =
    /AspectoEspecificaci[oó]n\s*\/\s*instrucci[oó]n/i.test(normalized) ||
    structuredInstructionLabels.some((label) =>
      normalized.toLocaleLowerCase().includes(label.toLocaleLowerCase()),
    ) ||
    /\d+\.\s+[A-ZÁÉÍÓÚÑ]/u.test(normalized);

  if (!hasStructuredSignal) {
    return normalizePlainTextToHtml(normalized);
  }

  let working = normalized;

  working = working.replace(/AspectoEspecificaci[oó]n\s*\/\s*instrucci[oó]n/giu, 'Aspecto\nEspecificación / instrucción');
  working = working.replace(
    /([a-záéíóúñ0-9])(?=(Aspecto|Funci[oó]n|Prop[oó]sito comunicativo|Duraci[oó]n m[aá]xima|Inicio|Desarrollo|Cierre|Tono|Ficha t[eé]cnica|Estilo visual y narrativo|Recursos narrativos obligatorios|Estrategias sugeridas para el cierre))/giu,
    '$1\n',
  );

  structuredInstructionLabels.forEach((label) => {
    const pattern = new RegExp(`([^\\n])(${escapeRegex(label)})(?=[A-ZÁÉÍÓÚÑ0-9])`, 'gu');
    working = working.replace(pattern, '$1\n$2 ');
  });

  working = working.replace(/([^\n])((?:\d+)\.\s+[A-ZÁÉÍÓÚÑ])/gu, '$1\n\n$2');
  working = working.replace(/\n{3,}/g, '\n\n');

  const paragraphs = working
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const blocks: string[] = [];
  const sortedLabels = [...structuredInstructionLabels].sort((left, right) => right.length - left.length);

  paragraphs.forEach((paragraph) => {
    const lines = paragraph
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    let textBuffer: string[] = [];
    let listBuffer: string[] = [];

    const flushTextBuffer = () => {
      if (textBuffer.length === 0) {
        return;
      }

      blocks.push(`<p>${escapeHtml(textBuffer.join(' '))}</p>`);
      textBuffer = [];
    };

    const flushListBuffer = () => {
      if (listBuffer.length === 0) {
        return;
      }

      blocks.push(
        `<ul>${listBuffer.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`,
      );
      listBuffer = [];
    };

    lines.forEach((line) => {
      const numberedMatch = line.match(/^(\d+\.\s+.+)$/u);
      if (numberedMatch) {
        flushTextBuffer();
        flushListBuffer();
        blocks.push(`<h3>${escapeHtml(numberedMatch[1])}</h3>`);
        return;
      }

      const label = sortedLabels.find((item) => line.startsWith(item));

      if (label) {
        flushTextBuffer();
        flushListBuffer();
        const rest = line.slice(label.length).trim().replace(/^[:\-–]\s*/, '');
        blocks.push(`<h4>${escapeHtml(label)}</h4>`);
        if (rest) {
          textBuffer.push(rest);
        }
        return;
      }

      if (line === '•') {
        flushTextBuffer();
        return;
      }

      if (line.startsWith('• ')) {
        flushTextBuffer();
        listBuffer.push(line.replace(/^•\s*/, ''));
        return;
      }

      flushListBuffer();
      textBuffer.push(line);
    });

    flushTextBuffer();
    flushListBuffer();
  });

  return blocks.join('');
}

function stripHtmlToText(value: string) {
  const raw = value.trim();

  if (!raw) {
    return '';
  }

  if (!hasHtmlMarkup(raw)) {
    return raw;
  }

  if (typeof window === 'undefined') {
    return raw
      .replace(/<br\s*\/?>/giu, '\n')
      .replace(/<\/(p|div|li|ul|ol|blockquote|h[1-6])>/giu, '\n')
      .replace(/<li>/giu, '• ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${raw}</div>`, 'text/html');
  const root = doc.body.firstElementChild;

  return root?.textContent?.replace(/\u00a0/g, ' ').replace(/\s+\n/g, '\n').trim() ?? '';
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

class ClientExtractionTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClientExtractionTimeoutError';
  }
}

function withClientTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new ClientExtractionTimeoutError(message));
    }, timeoutMs);

    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function normalizeUploadExtractedText(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function extractUploadedFileTextInBrowser(
  file: File,
  onProgress?: (progress: number) => void,
) {
  const extension = file.name.split('.').pop()?.trim().toLowerCase() ?? '';
  const buffer = await file.arrayBuffer();

  if (extension === 'docx') {
    const mammoth = await import('mammoth');
    const parsed = await mammoth.extractRawText({ arrayBuffer: buffer });
    onProgress?.(90);
    return normalizeUploadExtractedText(parsed.value ?? '');
  }

  if (extension === 'pdf') {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loadingTask = (pdfjs as any).getDocument({
      data: buffer,
      disableWorker: true,
      useWorkerFetch: false,
      isEvalSupported: false,
    });
    const document = await loadingTask.promise;
    const maxPages = Math.min(document.numPages || 0, 16);
    const chunks: string[] = [];

    if (!maxPages) {
      return '';
    }

    for (let pageIndex = 1; pageIndex <= maxPages; pageIndex += 1) {
      const page = await document.getPage(pageIndex);
      const textContent = await page.getTextContent();
      const lines = (textContent.items ?? [])
        .map((item: any) => (typeof item?.str === 'string' ? item.str : ''))
        .join(' ');
      if (lines.trim()) {
        chunks.push(lines.trim());
      }
      onProgress?.(Math.round((pageIndex / maxPages) * 90));
    }

    return normalizeUploadExtractedText(chunks.join('\n\n'));
  }

  return '';
}

function sanitizeRichHtml(value: string) {
  const raw = value.trim();

  if (!raw) {
    return '';
  }

  if (!hasHtmlMarkup(raw)) {
    return normalizeLegacyStructuredText(raw);
  }

  const plainText = stripHtmlToText(raw);

  if (
    hasBrokenInstructionMarkup(raw) ||
    hasBrokenInstructionMarkup(plainText) ||
    hasFragmentedInstructionHtml(raw)
  ) {
    return normalizeLegacyStructuredText(plainText || raw);
  }

  const sanitizeNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return escapeHtml(node.textContent ?? '');
    }

    if (!(node instanceof HTMLElement)) {
      return '';
    }

    const tag = node.tagName.toLowerCase();
    const children = Array.from(node.childNodes)
      .map((child) => sanitizeNode(child))
      .join('');

    switch (tag) {
      case 'br':
        return '<br>';
      case 'p':
      case 'ul':
      case 'ol':
      case 'li':
      case 'strong':
      case 'b':
      case 'em':
      case 'i':
      case 'u':
      case 'blockquote':
      case 'h3':
      case 'h4':
        return `<${tag}>${children}</${tag}>`;
      case 'a': {
        const href = (node.getAttribute('href') || '').trim();
        const safeHref =
          href.startsWith('http://') ||
          href.startsWith('https://') ||
          href.startsWith('mailto:') ||
          href.startsWith('#') ||
          href.startsWith('/')
            ? href
            : '';
        const attrs = safeHref
          ? ` href="${escapeHtml(safeHref)}" target="_blank" rel="noreferrer"`
          : '';
        return `<a${attrs}>${children}</a>`;
      }
      case 'div': {
        const trimmedChildren = children.trim();
        if (!trimmedChildren) {
          return '';
        }
        return trimmedChildren;
      }
      case 'span':
        return children;
      default:
        return children;
    }
  };

  const sanitizeDomRichHtml = (markup: string) => {
    if (typeof window === 'undefined') {
      return markup;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${markup}</div>`, 'text/html');
    const root = doc.body.firstElementChild;

    const isBlockMarkup = (chunk: string) =>
      /^<(p|ul|ol|blockquote|h3|h4)\b/i.test(chunk.trim());

    const rootChildren = Array.from(root?.childNodes ?? []);
    const blocks: string[] = [];
    let inlineBuffer = '';

    const flushInlineBuffer = () => {
      const trimmed = inlineBuffer.trim();

      if (!trimmed) {
        inlineBuffer = '';
        return;
      }

      blocks.push(`<p>${trimmed}</p>`);
      inlineBuffer = '';
    };

    rootChildren.forEach((child) => {
      const normalizedChild = sanitizeNode(child).trim();

      if (!normalizedChild) {
        return;
      }

      if (isBlockMarkup(normalizedChild)) {
        flushInlineBuffer();
        blocks.push(normalizedChild);
        return;
      }

      inlineBuffer += normalizedChild;
    });

    flushInlineBuffer();

    return blocks.join('').trim();
  };

  if (hasStructuredRichHtmlBlocks(raw)) {
    const sanitized = sanitizeDomRichHtml(raw);
    return sanitized || normalizePlainTextToHtml(stripHtmlToText(raw));
  }

  if (typeof window === 'undefined') {
    return normalizePlainTextToHtml(plainText);
  }

  const sanitized = sanitizeDomRichHtml(raw);

  return sanitized || normalizePlainTextToHtml(stripHtmlToText(raw));
}

function hasBrokenInstructionMarkup(value: string) {
  return (
    /AspectoEspecificaci[oó]n\s*\/\s*instrucci[oó]n/iu.test(value) ||
    /(?:Funci[oó]n|Prop[oó]sito comunicativo|Duraci[oó]n m[aá]xima|Inicio|Desarrollo|Cierre|Tono)(?=[A-ZÁÉÍÓÚÑ0-9])/u.test(
      value,
    ) ||
    /<\/(?:strong|b|h3|h4)>(?=[A-ZÁÉÍÓÚÑ0-9])/iu.test(value) ||
    /<\/h[34]>\s*(?!<(?:p|ul|ol|blockquote|h3|h4)\b)[^<\s]/iu.test(value)
  );
}

function hasFragmentedInstructionHtml(value: string) {
  const paragraphMatches = Array.from(value.matchAll(/<p>([\s\S]*?)<\/p>/giu));
  const shortParagraphs = paragraphMatches.filter((match) => {
    const text = stripHtmlToText(match[1] ?? '').replace(/\s+/g, ' ').trim();
    return text.length > 0 && text.length <= 36;
  }).length;

  return /<p>\s*•\s*<\/p>/iu.test(value) || (/<h[34]\b/iu.test(value) && shortParagraphs >= 4);
}

function renderRichTextContent(text: string, emptyText: string, className = '') {
  const sanitized = sanitizeRichHtml(text);

  if (!sanitized) {
    return <p className={`rich-copy rich-copy--empty ${className}`.trim()}>{emptyText}</p>;
  }

  return (
    <div
      className={`rich-html ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}

function renderInstructionContent(text: string, emptyText: string, className = '') {
  const raw = text.trim();
  const source = sanitizeRichHtml(raw);

  if (!source) {
    return <p className={`rich-copy rich-copy--empty ${className}`.trim()}>{emptyText}</p>;
  }

  return (
    <div
      className={`rich-html rich-html--instruction ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: source }}
    />
  );
}

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  minHeight?: number;
  disabled?: boolean;
}

function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = 220,
  disabled = false,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    const editor = editorRef.current;

    if (!editor || isFocused) {
      return;
    }

    const normalized = sanitizeRichHtml(value);

    if (editor.innerHTML !== normalized) {
      editor.innerHTML = normalized;
    }
  }, [isFocused, value]);

  const syncValue = () => {
    if (disabled) {
      return;
    }

    onChange(sanitizeRichHtml(editorRef.current?.innerHTML ?? ''));
  };

  const applyCommand = (command: string, commandValue?: string) => {
    if (typeof document === 'undefined' || disabled) {
      return;
    }

    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    syncValue();
  };

  return (
    <div className={`rich-editor${disabled ? ' rich-editor--disabled' : ''}`}>
      <div className="rich-editor__toolbar" role="toolbar" aria-label="Formato del texto">
        <button type="button" className="rich-editor__tool" disabled={disabled} onClick={() => applyCommand('formatBlock', '<p>')}>
          <span>Párrafo</span>
        </button>
        <button type="button" className="rich-editor__tool" disabled={disabled} onClick={() => applyCommand('formatBlock', '<h3>')}>
          <Heading3 size={15} />
          <span>Título</span>
        </button>
        <button type="button" className="rich-editor__tool" disabled={disabled} onClick={() => applyCommand('bold')}>
          <Bold size={15} />
          <span>Negrita</span>
        </button>
        <button type="button" className="rich-editor__tool" disabled={disabled} onClick={() => applyCommand('italic')}>
          <Italic size={15} />
          <span>Cursiva</span>
        </button>
        <button type="button" className="rich-editor__tool" disabled={disabled} onClick={() => applyCommand('underline')}>
          <Underline size={15} />
          <span>Subrayado</span>
        </button>
        <button type="button" className="rich-editor__tool" disabled={disabled} onClick={() => applyCommand('insertUnorderedList')}>
          <List size={15} />
          <span>Lista</span>
        </button>
        <button type="button" className="rich-editor__tool" disabled={disabled} onClick={() => applyCommand('insertOrderedList')}>
          <ListOrdered size={15} />
          <span>Numerada</span>
        </button>
      </div>
      <div className="rich-editor__surface">
        <div
          ref={editorRef}
          className="rich-editor__content"
          contentEditable={!disabled}
          suppressContentEditableWarning
          aria-disabled={disabled}
          role="textbox"
          aria-multiline="true"
          data-placeholder={placeholder}
          style={{ minHeight }}
          onFocus={() => {
            if (!disabled) {
              setIsFocused(true);
            }
          }}
          onBlur={() => {
            if (disabled) {
              return;
            }

            setIsFocused(false);
            syncValue();
          }}
          onInput={() => {
            if (!disabled) {
              syncValue();
            }
          }}
        />
      </div>
    </div>
  );
}

function isCourseSection(value: string | undefined): value is CourseSection {
  return Boolean(value && validCourseSections.includes(value as CourseSection));
}

function isWritingWorkspaceRoute(value: string | undefined): value is WritingWorkspaceRoute {
  return Boolean(value && writingWorkspaceRoutes.includes(value as WritingWorkspaceRoute));
}

function buildCourseSectionPath(slug: string, section: CourseSection) {
  return section === 'summary' ? `/courses/${slug}` : `/courses/${slug}/${section}`;
}

function buildWritingWorkspacePath(
  slug: string,
  route?: WritingWorkspaceRoute | null,
) {
  const base = `/courses/${slug}/escritura`;
  return route ? `${base}/${route}` : base;
}

function buildValidationWorkspacePath(slug: string, productId?: string | null) {
  const base = `/courses/${slug}/validacion`;
  return productId ? `${base}/producto/${productId}` : base;
}

function badgeClass(status: string) {
  switch (status) {
    case 'Listo':
    case 'Resuelta':
    case 'Resuelto':
      return 'badge badge--sage';
    case 'En revisión':
    case 'En ajuste':
      return 'badge badge--gold';
    case 'Pendiente':
    case 'Riesgo':
    case 'En curso':
      return 'badge badge--ocean';
    case 'Bloqueado':
      return 'badge badge--coral';
    default:
      return 'badge badge--outline';
  }
}

function checkpointStatusLabel(status: StageCheckpointStatus) {
  switch (status) {
    case 'done':
      return 'Completada';
    case 'active':
      return 'Activa';
    case 'blocked':
      return 'Bloqueada';
    default:
      return 'Pendiente';
  }
}

function checkpointBadgeClass(status: StageCheckpointStatus) {
  switch (status) {
    case 'done':
      return 'badge badge--sage';
    case 'active':
      return 'badge badge--gold';
    case 'blocked':
      return 'badge badge--coral';
    default:
      return 'badge badge--outline';
  }
}



function uniqueOptions(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right, 'es'),
  );
}

function syncCourseStructureFields(
  appData: AppData,
  form: CourseMutationInput,
): CourseMutationInput {
  const fallbackStructure = getFirstInstitutionStructure(appData.institution);
  const institution =
    form.institution.trim() ||
    fallbackStructure?.institution ||
    appData.institution.institutions[0] ||
    appData.institution.displayName ||
    '';
  const facultyOptions = uniqueOptions(getInstitutionFaculties(appData.institution, institution));
  const programOptions = uniqueOptions(getInstitutionPrograms(appData.institution, institution));
  const academicPeriodOptions = uniqueOptions(
    getInstitutionAcademicPeriods(appData.institution, institution),
  );
  const courseTypeOptions = uniqueOptions(getInstitutionCourseTypes(appData.institution, institution));

  return {
    ...form,
    institution,
    faculty:
      facultyOptions.includes(form.faculty) || !form.faculty.trim()
        ? form.faculty.trim() || facultyOptions[0] || ''
        : facultyOptions[0] || '',
    program:
      programOptions.includes(form.program) || !form.program.trim()
        ? form.program.trim() || programOptions[0] || ''
        : programOptions[0] || '',
    academicPeriod:
      academicPeriodOptions.includes(form.academicPeriod) || !form.academicPeriod.trim()
        ? form.academicPeriod.trim() || academicPeriodOptions[0] || ''
        : academicPeriodOptions[0] || '',
    courseType:
      courseTypeOptions.includes(form.courseType) || !form.courseType.trim()
        ? form.courseType.trim() || courseTypeOptions[0] || ''
        : courseTypeOptions[0] || '',
  };
}

function makeCourseForm(course: Course): CourseMutationInput {
  return {
    title: course.title,
    code: course.code,
    institution: course.metadata.institution,
    faculty: course.faculty,
    program: course.program,
    academicPeriod: course.metadata.academicPeriod,
    courseType: course.metadata.courseType,
    modality: course.modality,
    credits: course.credits,
    stageId: course.stageId,
    status: course.status,
    summary: course.summary,
    nextMilestone: course.nextMilestone,
  };
}

function buildEmptyCourseForm(stageId: string): CourseMutationInput {
  return {
    title: '',
    code: '',
    institution: '',
    faculty: '',
    program: '',
    academicPeriod: '',
    courseType: '',
    modality: '',
    credits: 1,
    stageId,
    status: 'En curso',
    summary: '',
    nextMilestone: '',
  };
}

function makeTaskForm(courseSlug: string, stageId: string): TaskMutationInput {
  return {
    title: '',
    courseSlug,
    productId: undefined,
    role: 'Experto',
    stageId,
    dueDate: new Date().toISOString().slice(0, 10),
    priority: 'Media',
    status: 'Pendiente',
    summary: '',
  };
}

function makeTaskDrafts(tasks: Task[]) {
  return Object.fromEntries(
    tasks.map((task) => [
      task.id,
      {
        title: task.title,
        courseSlug: task.courseSlug,
        productId: task.productId,
        role: task.role,
        stageId: task.stageId,
        dueDate: task.dueDate,
        priority: task.priority,
        status: task.status,
        summary: task.summary,
      },
    ]),
  ) as Record<string, TaskMutationInput>;
}



function makeMetadataForm(course: Course): CourseMetadataMutationInput {
  return {
    institution: course.metadata.institution,
    shortName: course.metadata.shortName,
    semester: course.metadata.semester,
    academicPeriod: course.metadata.academicPeriod,
    courseType: course.metadata.courseType,
    learningOutcomes: course.metadata.learningOutcomes,
    topics: course.metadata.topics,
    units: Array.isArray(course.metadata.units) ? course.metadata.units : [],
    methodology: course.metadata.methodology,
    evaluation: Array.isArray(course.metadata.evaluation) ? course.metadata.evaluation : typeof course.metadata.evaluation === 'string' ? [course.metadata.evaluation] : [],
    bibliography: course.metadata.bibliography,
    targetCloseDate: course.metadata.targetCloseDate,
    currentVersion: course.metadata.currentVersion,
    priority: course.metadata.priority,
    riskLevel: course.metadata.riskLevel,
  };
}



function makeTeamMemberForm(): TeamMemberMutationInput {
  return {
    name: '',
    role: 'Coordinador',
    focus: '',
    initials: '',
  };
}

function makeTeamMemberDrafts(team: TeamMember[]) {
  return Object.fromEntries(
    team.map((member) => [
      member.id,
      {
        name: member.name,
        role: member.role,
        focus: member.focus,
        initials: member.initials,
      },
    ]),
  ) as Record<string, TeamMemberMutationInput>;
}



function defaultProductFormat(stage: CourseProductStage): CourseProductMutationInput['format'] {
  switch (stage) {
    case 'microcurriculo':
      return 'Sílabus';
    case 'arquitectura':
      return 'Lineamiento';
    case 'escritura':
      return 'Actividad';
    case 'validacion':
      return 'Documento';
    case 'multimedia':
      return 'HTML';
    case 'qa':
      return 'Rúbrica';
    case 'entrega':
      return 'Documento';
    default:
      return 'Documento';
  }
}

function defaultProductOwner(stage: CourseProductStage): Role {
  switch (stage) {
    case 'microcurriculo':
      return 'Coordinador';
    case 'arquitectura':
      return 'Diseñador instruccional';
    case 'escritura':
      return 'Experto';
    case 'validacion':
      return 'Diseñador instruccional';
    case 'multimedia':
      return 'Diseñador multimedia';
    case 'qa':
      return 'Analista QA';
    case 'entrega':
      return 'Coordinador';
    default:
      return 'Coordinador';
  }
}

function makeCourseProductForm(
  stage: CourseProductStage = 'microcurriculo',
  owner?: Role,
  section?: string,
): CourseProductMutationInput {
  return {
    title: '',
    stage,
    format: defaultProductFormat(stage),
    owner: owner ?? defaultProductOwner(stage),
    status: 'Borrador',
    summary: '',
    body: '',
    tags: [],
    version: 'v0.1',
    section,
    phasePlan: normalizeProductPhasePlanDraft([]),
    validationData: buildDefaultValidationData(stage),
  };
}

function makeCourseProductDrafts(products: CourseProduct[]) {
  return Object.fromEntries(
    products.map((product) => [
      product.id,
      {
        title: product.title,
        stage: product.stage,
        format: product.format,
        owner: product.owner,
        status: product.status,
        summary: product.summary,
        body: product.body,
        tags: product.tags,
        version: product.version,
        section: product.section,
        phasePlan: normalizeProductPhasePlanDraft(product.phasePlan),
        validationData: product.validationData ?? buildDefaultValidationData(product.stage),
      },
    ]),
  ) as Record<string, CourseProductMutationInput>;
}

function productStageLabel(stage: CourseProductStage) {
  switch (stage) {
    case 'microcurriculo':
      return 'Microcurrículo';
    case 'arquitectura':
      return 'Arquitectura';
    case 'planeacion':
      return 'Planeación';
    case 'escritura':
      return 'Escritura';
    case 'validacion':
      return 'Validación';
    case 'multimedia':
      return 'Multimedia';
    case 'qa':
      return 'QA';
    case 'entrega':
      return 'Entrega';
    default:
      return 'Producto';
  }
}

function productStatusBadgeClass(status: CourseProduct['status']) {
  switch (status) {
    case 'Aprobado':
      return 'badge badge--sage';
    case 'En revisión':
      return 'badge badge--gold';
    default:
      return 'badge badge--outline';
  }
}

function productFormatsForStage(
  stage: CourseProductStage,
): CourseProductMutationInput['format'][] {
  switch (stage) {
    case 'microcurriculo':
      return ['Sílabus', 'Documento'];
    case 'arquitectura':
      return ['Lineamiento', 'Documento'];
    case 'escritura':
      return ['Actividad', 'Recurso', 'Documento'];
    case 'validacion':
      return ['Lectura', 'Documento'];
    case 'multimedia':
      return ['HTML', 'Pódcast', 'Lectura', 'Infografía'];
    case 'qa':
      return ['Rúbrica', 'Documento'];
    case 'entrega':
      return ['Documento'];
    default:
      return ['Documento'];
  }
}

function joinTags(tags: string[]) {
  return tags.join(', ');
}

function splitTags(value: string): string[] {
  return value
    .split(',')
    .map((item: string) => item.trim())
    .filter(Boolean);
}

function makeStageNoteDrafts(course: Course | undefined) {
  if (!course) {
    return {
      microcurriculo: { status: 'Pendiente', summary: '', evidence: [], blockers: [] },
      arquitectura: { status: 'Pendiente', summary: '', evidence: [], blockers: [] },
      planeacion: { status: 'Pendiente', summary: '', evidence: [], blockers: [] },
      escritura: { status: 'Pendiente', summary: '', evidence: [], blockers: [] },
      validacion: { status: 'Pendiente', summary: '', evidence: [], blockers: [] },
      multimedia: { status: 'Pendiente', summary: '', evidence: [], blockers: [] },
      lms: { status: 'Pendiente', summary: '', evidence: [], blockers: [] },
      qa: { status: 'Pendiente', summary: '', evidence: [], blockers: [] },
      entrega: { status: 'Pendiente', summary: '', evidence: [], blockers: [] },
    } satisfies Record<CourseStageNoteKey, CourseStageNoteMutationInput>;
  }

  return {
    microcurriculo: {
      status: 'Listo',
      summary: 'Base curricular consolidada',
      evidence: [],
      blockers: [],
    },
    arquitectura: {
      status: course.stageNotes.arquitectura?.status ?? 'Pendiente',
      summary: course.stageNotes.arquitectura?.summary ?? '',
      evidence: course.stageNotes.arquitectura?.evidence ?? [],
      blockers: course.stageNotes.arquitectura?.blockers ?? [],
    },
    planeacion: {
      status: course.stageNotes.planeacion?.status ?? 'Pendiente',
      summary: course.stageNotes.planeacion?.summary ?? '',
      evidence: course.stageNotes.planeacion?.evidence ?? [],
      blockers: course.stageNotes.planeacion?.blockers ?? [],
    },
    escritura: {
      status: course.stageNotes.escritura?.status ?? 'Pendiente',
      summary: course.stageNotes.escritura?.summary ?? '',
      evidence: course.stageNotes.escritura?.evidence ?? [],
      blockers: course.stageNotes.escritura?.blockers ?? [],
    },
    validacion: {
      status: course.stageNotes.validacion?.status ?? 'Pendiente',
      summary: course.stageNotes.validacion?.summary ?? '',
      evidence: course.stageNotes.validacion?.evidence ?? [],
      blockers: course.stageNotes.validacion?.blockers ?? [],
    },
    multimedia: {
      status: course.stageNotes.multimedia.status,
      summary: course.stageNotes.multimedia.summary,
      evidence: course.stageNotes.multimedia.evidence,
      blockers: course.stageNotes.multimedia.blockers,
    },
    lms: {
      status: course.stageNotes.lms.status,
      summary: course.stageNotes.lms.summary,
      evidence: course.stageNotes.lms.evidence,
      blockers: course.stageNotes.lms.blockers,
    },
    qa: {
      status: course.stageNotes.qa?.status ?? 'Pendiente',
      summary: course.stageNotes.qa?.summary ?? '',
      evidence: course.stageNotes.qa?.evidence ?? [],
      blockers: course.stageNotes.qa?.blockers ?? [],
    },
    entrega: {
      status: course.stageNotes.entrega?.status ?? 'Pendiente',
      summary: course.stageNotes.entrega?.summary ?? '',
      evidence: course.stageNotes.entrega?.evidence ?? [],
      blockers: course.stageNotes.entrega?.blockers ?? [],
    },
  } satisfies Record<CourseStageNoteKey, CourseStageNoteMutationInput>;
}

function joinLines(values: string[]): string {
  return values.join('\n');
}

function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((item: string) => item.trim())
    .filter(Boolean);
}

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim();
}

function normalizeArchitectureProductFormat(rawFormat: string): CourseProductMutationInput['format'] {
  const value = rawFormat.trim().toLocaleLowerCase();

  if (value.includes('video')) return 'Video';
  if (value.includes('podcast') || value.includes('pódcast')) return 'Pódcast';
  if (value.includes('infografia') || value.includes('infografía')) return 'Infografía';
  if (value.includes('rubrica') || value.includes('rúbrica')) return 'Rúbrica';
  if (value.includes('lectura')) return 'Lectura';
  if (value.includes('evaluacion') || value.includes('evaluación') || value.includes('examen')) {
    return 'Evaluación';
  }
  if (value.includes('taller')) return 'Taller';
  if (value.includes('actividad')) return 'Actividad';
  if (value.includes('html')) return 'HTML';
  if (value.includes('pdf')) return 'PDF';
  if (value.includes('lineamiento')) return 'Lineamiento';
  if (value.includes('silabus') || value.includes('sílabus')) return 'Sílabus';
  if (value.includes('recurso')) return 'Recurso';
  if (value.includes('red')) return 'RED';
  return 'Documento';
}

function resolveArchitectureSectionLabel(
  rawSection: string,
  title: string,
  summary: string,
  unitLabels: string[],
  unitTitleHints: string[],
  fallbackUnitIndex?: number,
) {
  const normalizedSection = normalizeSearchText(rawSection);
  const normalizedTitle = normalizeSearchText(title);
  const normalizedSummary = normalizeSearchText(summary);

  if (normalizedSection === 'introduccion') {
    return 'Introducción';
  }

  if (normalizedSection === 'cierre') {
    return 'Cierre';
  }

  const explicitUnitMatch = normalizedSection.match(/unidad\s*(\d+)/);
  if (explicitUnitMatch) {
    const unitIndex = Number(explicitUnitMatch[1]) - 1;
    if (unitIndex >= 0 && unitIndex < unitLabels.length) {
      return unitLabels[unitIndex];
    }
  }

  for (let index = 0; index < unitLabels.length; index += 1) {
    const label = unitLabels[index];
    const normalizedLabel = normalizeSearchText(label);
    const normalizedUnitTitle = normalizeSearchText(unitTitleHints[index] ?? '');

    if (
      normalizedSection === normalizedLabel ||
      (normalizedUnitTitle && normalizedSection === normalizedUnitTitle)
    ) {
      return label;
    }
  }

  const combined = [normalizedTitle, normalizedSummary].filter(Boolean).join(' ');

  if (
    combined.includes('introduccion') ||
    combined.includes('bienvenida') ||
    combined.includes('encuadre') ||
    combined.includes('diagnostico') ||
    combined.includes('diagnóstico')
  ) {
    return 'Introducción';
  }

  if (
    combined.includes('cierre') ||
    combined.includes('final') ||
    combined.includes('despedida') ||
    combined.includes('retroalimentacion final') ||
    combined.includes('retroalimentación final')
  ) {
    return 'Cierre';
  }

  for (let index = 0; index < unitLabels.length; index += 1) {
    const label = unitLabels[index];
    const normalizedLabel = normalizeSearchText(label);
    const normalizedUnitTitle = normalizeSearchText(unitTitleHints[index] ?? '');

    if (
      normalizedTitle.includes(normalizedLabel) ||
      normalizedSummary.includes(normalizedLabel) ||
      (normalizedUnitTitle &&
        (normalizedTitle.includes(normalizedUnitTitle) ||
          normalizedSummary.includes(normalizedUnitTitle)))
    ) {
      return label;
    }
  }

  if (typeof fallbackUnitIndex === 'number' && unitLabels[fallbackUnitIndex]) {
    return unitLabels[fallbackUnitIndex];
  }

  return rawSection.trim() || 'Introducción';
}

const productPlanningPhases: Array<{
  phase: ProductPlanningPhase;
  label: string;
  ownerRole: Role;
}> = [
  { phase: 'escritura', label: 'Escritura', ownerRole: 'Experto' },
  { phase: 'validacion', label: 'Validación instruccional', ownerRole: 'Diseñador instruccional' },
  { phase: 'multimedia', label: 'Producción multimedia', ownerRole: 'Diseñador multimedia' },
  { phase: 'lms', label: 'Montaje LMS', ownerRole: 'Gestor LMS' },
  { phase: 'qa', label: 'QA', ownerRole: 'Analista QA' },
];

function normalizeProductPhasePlanDraft(phasePlan?: ProductPhasePlan[]) {
  return productPlanningPhases.map(({ phase }) => {
    const current = phasePlan?.find((item) => item.phase === phase);
    return (
      current ?? {
        phase,
        startDate: '',
        endDate: '',
      }
    );
  });
}

function countConfiguredPlanningPhases(phasePlan: ProductPhasePlan[]) {
  return phasePlan.filter(
    (item) => item.startDate.trim() && item.endDate.trim() && item.assigneeId?.trim(),
  ).length;
}

function parsePlanningDate(dateString?: string | null) {
  if (!dateString?.trim()) {
    return null;
  }

  const parsed = new Date(dateString.includes('T') ? dateString : `${dateString}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function diffPlanningDays(start: Date, end: Date) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
}

const writingSectionTemplatesByFormat: Record<string, string[]> = {
  video: ['Título', 'Inicio o introducción', 'Desarrollo', 'Cierre'],
  documento: ['Título', 'Introducción', 'Desarrollo', 'Conclusiones', 'Bibliografía'],
  evaluacion: ['Título', 'Instrucciones', 'Preguntas', 'Retroalimentación'],
  actividad: ['Título', 'Contexto', 'Instrucciones', 'Entregable esperado', 'Criterios de evaluación'],
  lectura: ['Título', 'Introducción', 'Desarrollo', 'Conclusiones', 'Bibliografía'],
  infografia: ['Título', 'Mensaje central', 'Desarrollo visual', 'Cierre', 'Fuentes'],
  podcast: ['Título', 'Apertura', 'Desarrollo', 'Cierre'],
  guia: ['Título', 'Introducción', 'Desarrollo', 'Cierre', 'Bibliografía'],
};

function normalizeWritingTemplateKey(format: string) {
  return format
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function slugifyWritingSectionTitle(title: string) {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim();
}

function inferWritingSectionTitlesFromText(text: string, format: string) {
  const plain = stripHtmlToText(text)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  const foundTitles: string[] = [];
  const seen = new Set<string>();
  const knownHeadings = [
    'titulo',
    'introduccion',
    'inicio',
    'apertura',
    'desarrollo',
    'cierre',
    'conclusiones',
    'bibliografia',
    'fuentes',
    'preguntas',
    'retroalimentacion',
    'contexto',
    'instrucciones',
    'entregable esperado',
    'criterios de evaluacion',
    'mensaje central',
    'desarrollo visual',
  ];

  plain.split('\n').forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      return;
    }

    const headingMatch = line.match(/^(?:\d+[\).\s-]+)?([A-ZÁÉÍÓÚÑ][^:]{2,80})(?::|\s*$)/u);
    if (!headingMatch) {
      return;
    }

    const normalized = headingMatch[1]
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

    if (!knownHeadings.some((keyword) => normalized.includes(keyword))) {
      return;
    }

    const title = headingMatch[1].trim();
    const key = slugifyWritingSectionTitle(title);
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    foundTitles.push(title);
  });

  if (foundTitles.length > 1) {
    return foundTitles;
  }

  const template =
    writingSectionTemplatesByFormat[normalizeWritingTemplateKey(format)] ??
    ['Título', 'Introducción', 'Desarrollo', 'Cierre'];

  return template;
}

function buildWritingSectionsFromTemplate(titles: string[], instructionHtml: string) {
  const normalizedInstructionHtml = sanitizeRichHtml(instructionHtml);
  const plainInstructionText = stripHtmlToText(normalizedInstructionHtml)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  return titles.map((title, index) => {
    const headingPattern = new RegExp(
      `(?:^|\\n)(?:\\d+[.)\\s-]+)?${escapeRegex(title)}:?\\s*([\\s\\S]*?)(?=(?:\\n(?:\\d+[.)\\s-]+)?(?:${titles
        .filter((candidate) => candidate !== title)
        .map((candidate) => escapeRegex(candidate))
        .join('|')}):?\\s*)|$)`,
      'i',
    );
    const match = plainInstructionText.match(headingPattern);
    const sectionInstruction = match?.[1]?.trim() || plainInstructionText;

    return {
      id: slugifyWritingSectionTitle(title) || `section-${index + 1}`,
      title,
      instructions: sectionInstruction,
      content: '',
    } satisfies ProductWritingSection;
  });
}

function createWritingDraftTextFromSections(sections: ProductWritingSection[]) {
  return sections
    .map((section) => {
      const cleanContent = section.content.trim();
      if (!cleanContent) {
        return '';
      }
      return `<section data-section="${escapeHtml(section.title)}"><h3>${escapeHtml(section.title)}</h3>${cleanContent}</section>`;
    })
    .filter(Boolean)
    .join('');
}

function rebalanceWritingTitleAndIntroSections(
  sections: ProductWritingSection[],
  now: string,
) {
  const titleIndex = sections.findIndex((section) => /t[ií]tulo/i.test(section.title));
  const introIndex = sections.findIndex((section) =>
    /(introducci[oó]n|inicio|apertura)/i.test(section.title),
  );

  if (titleIndex < 0 || introIndex < 0 || titleIndex === introIndex) {
    return sections;
  }

  const titlePlain = stripHtmlToText(sections[titleIndex].content)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
  const introPlain = stripHtmlToText(sections[introIndex].content).trim();

  if (!titlePlain) {
    return sections;
  }

  const introMarker = /\b(?:introducci[oó]n|inicio|apertura)\s*:/i;
  const markerMatch = introMarker.exec(titlePlain);

  if (markerMatch && (introPlain.length === 0 || introPlain.length < 24)) {
    const titlePart = titlePlain.slice(0, markerMatch.index).trim();
    const introPart = titlePlain
      .slice(markerMatch.index)
      .replace(introMarker, '')
      .trim();

    if (introPart) {
      sections[titleIndex].content = titlePart
        ? normalizePlainTextToHtml(titlePart)
        : '';
      sections[titleIndex].updatedAt = titlePart ? now : sections[titleIndex].updatedAt;
      sections[introIndex].content = normalizePlainTextToHtml(introPart);
      sections[introIndex].updatedAt = now;
      return sections;
    }
  }

  if (!introPlain) {
    const paragraphParts = titlePlain
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

    if (paragraphParts.length > 1) {
      const titlePart = paragraphParts[0];
      const introPart = paragraphParts.slice(1).join('\n\n').trim();
      if (introPart) {
        sections[titleIndex].content = normalizePlainTextToHtml(titlePart);
        sections[titleIndex].updatedAt = now;
        sections[introIndex].content = normalizePlainTextToHtml(introPart);
        sections[introIndex].updatedAt = now;
      }
    }
  }

  return sections;
}

function hydrateWritingSectionsFromText(
  baseSections: ProductWritingSection[],
  sourceText: string,
): ProductWritingSection[] {
  const cleanText = sourceText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  if (!cleanText) {
    return baseSections;
  }

  const nextSections = baseSections.map((section) => ({ ...section, content: '' }));
  const now = new Date().toISOString();

  if (nextSections.length === 1) {
    nextSections[0].content = normalizePlainTextToHtml(cleanText);
    nextSections[0].updatedAt = now;
    return nextSections;
  }

  const normalizedLines = cleanText.split('\n');
  let currentSectionIndex = 0;
  const sectionMatchers = nextSections.map((section) => {
    const variants = [
      section.title,
      section.title.replace(/\s+o\s+/gi, ' '),
      section.title.replace(/\s*\/\s*/g, ' '),
    ];
    return new RegExp(
      `^(?:\\d+[.)\\s-]+)?(?:${variants.map((variant) => escapeRegex(variant)).join('|')})(?::)?$`,
      'i',
    );
  });

  const buffers = nextSections.map(() => [] as string[]);
  normalizedLines.forEach((line) => {
    const trimmed = line.trim();
    const matchedIndex = sectionMatchers.findIndex((pattern) => pattern.test(trimmed));
    if (matchedIndex >= 0) {
      currentSectionIndex = matchedIndex;
      return;
    }

    buffers[currentSectionIndex].push(line);
  });

  const hasSpecificBuckets = buffers.some((buffer, index) => index > 0 && buffer.join('').trim());
  if (!hasSpecificBuckets) {
    const paragraphs = cleanText
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

    if (paragraphs.length <= 1 || nextSections.length <= 1) {
      nextSections[0].content = normalizePlainTextToHtml(cleanText);
      nextSections[0].updatedAt = now;
      return rebalanceWritingTitleAndIntroSections(nextSections, now);
    }

    const chunks = nextSections.map(() => [] as string[]);
    paragraphs.forEach((paragraph, index) => {
      const bucket = Math.min(
        nextSections.length - 1,
        Math.floor((index / Math.max(paragraphs.length, 1)) * nextSections.length),
      );
      chunks[bucket].push(paragraph);
    });

    nextSections.forEach((section, index) => {
      const chunkText = chunks[index].join('\n\n').trim();
      if (chunkText) {
        section.content = normalizePlainTextToHtml(chunkText);
        section.updatedAt = now;
      }
    });

    return rebalanceWritingTitleAndIntroSections(nextSections, now);
  }

  const hydrated = nextSections.map((section, index) => ({
    ...section,
    content: normalizePlainTextToHtml(buffers[index].join('\n').trim()),
    updatedAt: buffers[index].join('').trim() ? now : section.updatedAt,
  }));

  return rebalanceWritingTitleAndIntroSections(hydrated, now);
}

function countFilledWritingSections(sections: ProductWritingSection[]) {
  return sections.filter((section) => stripHtmlToText(section.content).trim()).length;
}

function buildSuggestedWritingPrompt(product: CourseProduct, sections: ProductWritingSection[]) {
  const sectionSummary = sections.map((section) => section.title).join(', ');
  const sectionInstructions = sections
    .map((section) => `${section.title}: ${section.instructions || 'Desarrolla esta parte con claridad y coherencia.'}`)
    .join('\n');

  return [
    `Redacta el producto "${product.title}" en formato ${product.format}.`,
    `Respeta esta estructura de secciones: ${sectionSummary}.`,
    'Produce una versión lista para revisión académica, clara, rigurosa y coherente con las instrucciones del producto.',
    'Desarrolla cada sección por separado y evita omitir apartados.',
    '',
    'Guía estructural por sección:',
    sectionInstructions,
  ]
    .join('\n')
    .trim();
}

function getProductPlanningWindow(phasePlan: ProductPhasePlan[]) {
  const startDates = phasePlan
    .map((item) => parsePlanningDate(item.startDate))
    .filter((item): item is Date => Boolean(item));
  const endDates = phasePlan
    .map((item) => parsePlanningDate(item.endDate))
    .filter((item): item is Date => Boolean(item));

  if (!startDates.length || !endDates.length) {
    return {
      start: null,
      end: null,
    };
  }

  return {
    start: new Date(Math.min(...startDates.map((item) => item.getTime()))),
    end: new Date(Math.max(...endDates.map((item) => item.getTime()))),
  };
}

function getPlanningAssigneeNames(phasePlan: ProductPhasePlan[]) {
  return Array.from(
    new Set(
      phasePlan
        .map((item) => item.assigneeName?.trim() ?? '')
        .filter(Boolean),
    ),
  );
}

function buildWritingSectionsFromProduct(product: CourseProduct): ProductWritingSection[] {
  const instructionHtml = product.body?.trim() || product.summary?.trim() || '';
  const inferredTitles = inferWritingSectionTitlesFromText(instructionHtml, product.format);
  return buildWritingSectionsFromTemplate(inferredTitles, instructionHtml);
}

function normalizeWritingDraft(product: CourseProduct): ProductWritingData {
  const current = product.writingData;
  return {
    mode: current.mode ?? 'manual',
    submittedAsset: current.submittedAsset,
    supportAssets: current.supportAssets ?? [],
    libraryResourceIds: current.libraryResourceIds ?? [],
    aiPrompt: current.aiPrompt ?? '',
    extractedText: current.extractedText ?? '',
    draftText: current.draftText ?? '',
    sections:
      current.sections && current.sections.length > 0
        ? current.sections
        : buildWritingSectionsFromProduct(product),
    lastSavedAt: current.lastSavedAt,
    lastGeneratedAt: current.lastGeneratedAt,
  };
}

function getWritingPhase(product: CourseProduct) {
  return product.phasePlan.find((phase) => phase.phase === 'escritura');
}

function hasWritingProgress(product: CourseProduct) {
  const writingData = product.writingData;

  return Boolean(
    writingData.draftText.trim() ||
      writingData.extractedText.trim() ||
      writingData.submittedAsset ||
      writingData.lastSavedAt ||
      writingData.lastGeneratedAt ||
      (writingData.supportAssets ?? []).length > 0 ||
      (writingData.sections ?? []).some((section) => section.content.trim()),
  );
}

function getWritingActionLabel(product: CourseProduct) {
  if (product.status === 'Aprobado' || product.status === 'En revisión') {
    return 'Revisar';
  }

  return hasWritingProgress(product) ? 'Continuar' : 'Iniciar';
}




export function CourseWorkspacePage({
  role,
  userRole,
  viewer,
  appData,
  isLoading,
  refreshAppData,
  mutateAppData,
}: CourseWorkspacePageProps) {
  const { slug = '', section: sectionParam, workspaceRoute, productId } = useParams<{
    slug?: string;
    section?: string;
    workspaceRoute?: string;
    productId?: string;
  }>();
  const [searchParams] = useSearchParams();
  const { showAlert, showConfirm } = useSystemDialog();
  const navigate = useNavigate();
  const activeSection: CourseSection = isCourseSection(sectionParam) ? sectionParam : 'summary';
  const activeWritingRoute =
    activeSection === 'escritura' && isWritingWorkspaceRoute(workspaceRoute)
      ? workspaceRoute
      : null;
  const validationProductId =
    activeSection === 'validacion' ? (productId?.trim() ?? '') : '';
  const writingProductQueryId = searchParams.get('product')?.trim() ?? '';
  const persistedCourse = getCourseBySlug(appData, slug);
  const [writingLaunchSnapshot, setWritingLaunchSnapshot] = useState<WritingLaunchSnapshot | null>(() =>
    activeSection === 'escritura' && writingProductQueryId
      ? readWritingLaunchSnapshot(slug, writingProductQueryId)
      : null,
  );
  const course =
    persistedCourse ??
    (activeSection === 'escritura' && isLoading ? writingLaunchSnapshot?.course ?? null : null);
  const fallbackStageId = appData.stages[0]?.id ?? 'configuracion';
  const currentStageId = course?.stageId ?? fallbackStageId;
  const currentCourseSlug = course?.slug ?? slug;
  const stage = course ? getStageMeta(appData, course.stageId) : undefined;
  const relatedTasks = course
    ? appData.tasks.filter((task) => task.courseSlug === course.slug)
    : [];
  const myTasks =
    role === 'Administrador' || role === 'Auditor'
      ? relatedTasks
      : relatedTasks.filter((task) => task.role === role);
  const visibleTasks = canCreateTasks(userRole) ? relatedTasks : myTasks;


  const { activeModal, isOpen: isGlobalModalOpen, open: openModal, close: closeModal } = useModalStore();
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [planningProductId, setPlanningProductId] = useState<string | null>(null);
  const [isEditingCourse, setIsEditingCourse] = useState(false);
  const [isEditingCourseMetadata, setIsEditingCourseMetadata] = useState(false);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isTeamComposerOpen, setIsTeamComposerOpen] = useState(false);
  const [productComposerStage, setProductComposerStage] = useState<CourseProductStage | null>(null);
  const [courseError, setCourseError] = useState<string | null>(null);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [productError, setProductError] = useState<string | null>(null);
  const [planningError, setPlanningError] = useState<string | null>(null);
  const [stageNoteError, setStageNoteError] = useState<string | null>(null);
  const [validationCommentDrafts, setValidationCommentDrafts] = useState<
    Record<string, { fragment: string; comment: string }>
  >({});
  const [isCourseSaving, setIsCourseSaving] = useState(false);
  const [isMetadataSaving, setIsMetadataSaving] = useState(false);
  const [isTaskSaving, setIsTaskSaving] = useState(false);
  const [isTeamSaving, setIsTeamSaving] = useState<string | null>(null);
  const [isProductSaving, setIsProductSaving] = useState<string | null>(null);
  const [isPlanningSaving, setIsPlanningSaving] = useState(false);
  const [isStageNoteSaving, setIsStageNoteSaving] = useState<CourseStageNoteKey | null>(null);
  const [stageNoteDrafts, setStageNoteDrafts] = useState<
    Record<CourseStageNoteKey, CourseStageNoteMutationInput>
  >(() => makeStageNoteDrafts(course ?? undefined));
  const [courseForm, setCourseForm] = useState<CourseMutationInput>(() =>
    course
      ? syncCourseStructureFields(appData, makeCourseForm(course))
      : syncCourseStructureFields(appData, buildEmptyCourseForm(currentStageId)),
  );

  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [activeAddSection, setActiveAddSection] = useState<string>('');
  const [editingArchitectureProductId, setEditingArchitectureProductId] = useState<string | null>(null);
  const [architectureEditorMode, setArchitectureEditorMode] = useState<'create' | 'edit' | 'move'>('create');
  const [newTaskForm, setNewTaskForm] = useState<TaskMutationInput>(() =>
    makeTaskForm(currentCourseSlug, currentStageId),
  );

  // Microcurriculo Assistant States
  const [microStep, setMicroStep] = useState<1 | 2 | 3>(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ url: string; key: string } | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [hasRestartedAnalysis, setHasRestartedAnalysis] = useState(false);
  const [isVerifyingAnalysis, setIsVerifyingAnalysis] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [isGeneratingArchitecture, setIsGeneratingArchitecture] = useState(false);
  const [architectureStep, setArchitectureStep] = useState('');
  const [architectureProgress, setArchitectureProgress] = useState(0);
  const [isGuidelinesModalOpen, setIsGuidelinesModalOpen] = useState(false);
  const [architecturePreviewProductId, setArchitecturePreviewProductId] = useState<string | null>(null);
  const validationFragmentRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [writingError, setWritingError] = useState<string | null>(null);
  const [isWritingSaving, setIsWritingSaving] = useState(false);
  const [isWritingExtracting, setIsWritingExtracting] = useState(false);
  const [isWritingUploadingSupport, setIsWritingUploadingSupport] = useState(false);
  const [writingGeneratingSectionId, setWritingGeneratingSectionId] = useState<string | null>(null);
  const [writingUploadProgress, setWritingUploadProgress] = useState(0);
  const [writingProcessingProgress, setWritingProcessingProgress] = useState(0);
  const [writingKnowledgeProgress, setWritingKnowledgeProgress] = useState(0);
  const [writingGenerationProgress, setWritingGenerationProgress] = useState(0);
  const [isWritingGeneratingAll, setIsWritingGeneratingAll] = useState(false);
  const [isWritingFinalizing, setIsWritingFinalizing] = useState(false);
  const [isWritingInstructionsPanelOpen, setIsWritingInstructionsPanelOpen] = useState(false);
  const [planningSectionFilter, setPlanningSectionFilter] = useState('Todas');
  const [planningProductFilter, setPlanningProductFilter] = useState('');
  const [planningStartFilter, setPlanningStartFilter] = useState('');
  const [planningEndFilter, setPlanningEndFilter] = useState('');
  const [planningOwnerFilter, setPlanningOwnerFilter] = useState('');
  const [metadataForm, setMetadataForm] = useState<CourseMetadataMutationInput>(() =>
    course ? makeMetadataForm(course) : makeMetadataForm({
      id: '',
      slug: '',
      title: '',
      code: '',
      faculty: '',
      program: '',
      modality: '',
      credits: 0,
      stageId: fallbackStageId,
      status: 'En curso',
      progress: 0,
      summary: '',
      nextMilestone: '',
      updatedAt: new Date().toISOString().slice(0, 10),
      pulse: { velocity: 0, quality: 0, alignment: 0 },
      team: [],
      deliverables: [],
      modules: [],
      observations: [],
      schedule: [],
      stageChecklist: [],
      assistants: [],
      metadata: {
        institution: '',
        shortName: '',
        semester: '',
        academicPeriod: '',
        courseType: '',
        learningOutcomes: [],
        topics: [],
        units: [],
        methodology: '',
        evaluation: [],
        bibliography: [],
        targetCloseDate: new Date().toISOString().slice(0, 10),
        currentVersion: 'v1.0',
        priority: 'Media',
        riskLevel: 'Bajo',
        route: '',
      },
      auditLog: [],
      stageNotes: {
        microcurriculo: {
          owner: 'Diseñador instruccional',
          heading: 'Microcurrículo y base curricular',
          status: 'Pendiente',
          summary: '',
          evidence: [],
          blockers: [],
          updatedAt: new Date().toISOString().slice(0, 10),
        },
        arquitectura: {
          owner: 'Diseñador instruccional',
          heading: 'Arquitectura de aprendizaje',
          status: 'Pendiente',
          summary: '',
          evidence: [],
          blockers: [],
          updatedAt: new Date().toISOString().slice(0, 10),
        },
        planeacion: {
          owner: 'Coordinador',
          heading: 'Planeación operativa',
          status: 'Pendiente',
          summary: '',
          evidence: [],
          blockers: [],
          updatedAt: new Date().toISOString().slice(0, 10),
        },
        escritura: {
          owner: 'Experto',
          heading: 'Escritura y autoría',
          status: 'Pendiente',
          summary: '',
          evidence: [],
          blockers: [],
          updatedAt: new Date().toISOString().slice(0, 10),
        },
        validacion: {
          owner: 'Diseñador instruccional',
          heading: 'Validación instruccional',
          status: 'Pendiente',
          summary: '',
          evidence: [],
          blockers: [],
          updatedAt: new Date().toISOString().slice(0, 10),
        },
        multimedia: {
          owner: 'Diseñador multimedia',
          heading: 'Producción multimedia',
          status: 'Pendiente',
          summary: '',
          evidence: [],
          blockers: [],
          updatedAt: new Date().toISOString().slice(0, 10),
        },
        lms: {
          owner: 'Gestor LMS',
          heading: 'Montaje LMS',
          status: 'Pendiente',
          summary: '',
          evidence: [],
          blockers: [],
          updatedAt: new Date().toISOString().slice(0, 10),
        },
        qa: {
          owner: 'Analista QA',
          heading: 'QA y validación final',
          status: 'Pendiente',
          summary: '',
          evidence: [],
          blockers: [],
          updatedAt: new Date().toISOString().slice(0, 10),
        },
        entrega: {
          owner: 'Coordinador',
          heading: 'Entrega final y cierre',
          status: 'Pendiente',
          summary: '',
          evidence: [],
          blockers: [],
          updatedAt: new Date().toISOString().slice(0, 10),
        },
      },
      products: [],
    }),
  );
  const [writingDraft, setWritingDraft] = useState<ProductWritingData | null>(null);
  const [activeWritingSectionTab, setActiveWritingSectionTab] = useState<string | null>(null);
  const activeWritingProductIdRef = useRef<string | null>(null);
  const writingUploadInputRef = useRef<HTMLInputElement | null>(null);
  const [newTeamMemberForm, setNewTeamMemberForm] = useState<TeamMemberMutationInput>(() =>
    makeTeamMemberForm(),
  );
  const [newProductForm, setNewProductForm] = useState<CourseProductMutationInput>(() =>
    makeCourseProductForm('microcurriculo', userRole),
  );
  const [taskDrafts, setTaskDrafts] = useState<Record<string, TaskMutationInput>>(() =>
    makeTaskDrafts(relatedTasks),
  );
  const [teamDrafts, setTeamDrafts] = useState<Record<string, TeamMemberMutationInput>>(() =>
    makeTeamMemberDrafts(course?.team ?? []),
  );
  const [productDrafts, setProductDrafts] = useState<Record<string, CourseProductMutationInput>>(() =>
    makeCourseProductDrafts(course?.products ?? []),
  );
  const [planningPhaseDraft, setPlanningPhaseDraft] = useState<ProductPhasePlan[]>(() =>
    normalizeProductPhasePlanDraft([]),
  );
  const currentInstitution =
    courseForm.institution ||
    course?.metadata.institution ||
    getFirstInstitutionStructure(appData.institution)?.institution ||
    appData.institution.displayName;
  const institutionOptions = uniqueOptions(
    appData.institution.institutions.length > 0
      ? appData.institution.institutions
      : appData.courses.map((item) => item.metadata.institution || ''),
  );
  const academicPeriodOptions = uniqueOptions(
    getInstitutionAcademicPeriods(appData.institution, currentInstitution),
  );
  const courseTypeOptions = uniqueOptions(
    getInstitutionCourseTypes(appData.institution, currentInstitution),
  );
  getInstitutionPedagogicalGuidelines(
    appData.institution,
    currentInstitution,
  );

  function updateCourseDraftField<Key extends keyof CourseMutationInput>(
    key: Key,
    value: CourseMutationInput[Key],
  ) {
    setCourseForm((current) => {
      const nextForm =
        key === 'institution'
          ? syncCourseStructureFields(appData, {
              ...current,
              institution: value as CourseMutationInput['institution'],
              faculty: '',
              program: '',
              academicPeriod: '',
              courseType: '',
            })
          : {
              ...current,
              [key]: value,
            };

      setMetadataForm((currentMetadata) => ({
        ...currentMetadata,
        institution: nextForm.institution,
        academicPeriod: nextForm.academicPeriod,
        courseType: nextForm.courseType,
      }));

      return nextForm;
    });
  }

  function toggleProductComposer(stageId: CourseProductStage) {
    setProductError(null);

    if (productComposerStage === stageId) {
      setProductComposerStage(null);
      return;
    }

    setNewProductForm(
      makeCourseProductForm(
        stageId,
        userRole,
        stageId === 'arquitectura' ? architectureSectionOptions[0] ?? 'Introducción' : undefined,
      ),
    );
    setProductComposerStage(stageId);
  }

  function closeWorkspaceOverlay() {
    closeModal();
    closeModal();
    setIsTeamComposerOpen(false);
    setProductComposerStage(null);
  }

  useEffect(() => {
    if (activeSection === 'microcurriculo' && course && !analysisResult && !hasRestartedAnalysis) {
      if (
        (course.metadata.learningOutcomes && course.metadata.learningOutcomes.length > 0) ||
        (course.metadata.units && course.metadata.units.length > 0) ||
        (course.summary && course.summary.trim() !== '')
      ) {
        setMicroStep(3);
        setAnalysisResult({
          facultad: course.faculty || '',
          programa: course.program || '',
          semestre: course.metadata.semester || '',
          tipoCurso: course.metadata.courseType || '',
          creditos: course.credits || 0,
          descripcionCurso: course.summary || '',
          resultadosAprendizaje: Array.isArray(course.metadata.learningOutcomes) ? course.metadata.learningOutcomes : [],
          unidades: Array.isArray(course.metadata.units) ? course.metadata.units : [],
          metodologia: course.metadata.methodology || '',
          evaluacion: Array.isArray(course.metadata.evaluation) ? course.metadata.evaluation : [],
          bibliografia: Array.isArray(course.metadata.bibliography) ? course.metadata.bibliography : [],
        });
      }
    }
  }, [activeSection, course, analysisResult, hasRestartedAnalysis]);

  useEffect(() => {
    if (!course) {
      const fallbackInstitution =
        getFirstInstitutionStructure(appData.institution)?.institution ||
        appData.institution.displayName ||
        '';

      setCourseForm(syncCourseStructureFields(appData, buildEmptyCourseForm(currentStageId)));
      setMetadataForm((current) => ({
        ...current,
        institution: fallbackInstitution,
        shortName: '',
        semester: '',
        academicPeriod:
          getInstitutionAcademicPeriods(appData.institution, fallbackInstitution)[0] || '',
        courseType: getInstitutionCourseTypes(appData.institution, fallbackInstitution)[0] || '',
        learningOutcomes: [],
        topics: [],
        units: [],
        methodology: '',
        evaluation: [],
        bibliography: [],
        targetCloseDate: new Date().toISOString().slice(0, 10),
        currentVersion: 'v1.0',
        priority: 'Media',
        riskLevel: 'Bajo',
      }));
      setTaskDrafts({});
      setTeamDrafts({});
      setProductDrafts({});
      setValidationCommentDrafts({});
      setProductComposerStage(null);
      closeModal();
      setStageNoteDrafts(makeStageNoteDrafts(undefined));
      return;
    }

    setCourseForm(syncCourseStructureFields(appData, makeCourseForm(course)));
    setMetadataForm(makeMetadataForm(course));
    setTaskDrafts(makeTaskDrafts(relatedTasks));
    setTeamDrafts(makeTeamMemberDrafts(course.team));
    setProductDrafts(makeCourseProductDrafts(course.products));
    setValidationCommentDrafts({});
    setProductComposerStage(null);
    closeModal();
    setStageNoteDrafts(makeStageNoteDrafts(course));
  }, [
    appData,
    appData.tasks,
    course,
    currentCourseSlug,
    currentStageId,
  ]);

  useEffect(() => {
    setCourseForm((current) => syncCourseStructureFields(appData, current));
  }, [appData]);

  useEffect(() => {
    if (!sectionParam) {
      return;
    }

    if (!isCourseSection(sectionParam)) {
      navigate(buildCourseSectionPath(currentCourseSlug, 'summary'), { replace: true });
    }
  }, [currentCourseSlug, navigate, sectionParam]);

  useEffect(() => {
    const nextError = courseError
      ? {
          title: 'No fue posible actualizar el curso',
          message: courseError,
          clear: () => setCourseError(null),
        }
      : metadataError
        ? {
            title: 'No fue posible guardar la ficha operativa',
            message: metadataError,
            clear: () => setMetadataError(null),
          }
        : taskError
          ? {
              title: 'No fue posible completar la operación sobre la tarea',
              message: taskError,
              clear: () => setTaskError(null),
            }
          : teamError
            ? {
                title: 'No fue posible completar la operación sobre el equipo',
                message: teamError,
                clear: () => setTeamError(null),
              }
            : productError
              ? {
                  title: 'No fue posible completar la operación sobre el producto',
                  message: productError,
                  clear: () => setProductError(null),
                }
              : stageNoteError
                ? {
                    title: 'No fue posible guardar la bitácora de etapa',
                    message: stageNoteError,
                    clear: () => setStageNoteError(null),
                  }
                : null;

    if (!nextError) {
      return;
    }

    let active = true;

    void showAlert({
      title: nextError.title,
      message: nextError.message,
      tone: 'error',
      confirmLabel: 'Entendido',
    }).then(() => {
      if (active) {
        nextError.clear();
      }
    });

    return () => {
      active = false;
    };
  }, [
    courseError,
    metadataError,
    productError,
    showAlert,
    stageNoteError,
    taskError,
    teamError,
  ]);

  if (!course) {
    if (isLoading) {
      return (
        <div className="page-stack h-full min-h-[80vh] flex flex-col items-center justify-center">
          <section className="flex w-full flex-col items-center justify-center gap-4 text-center animate-in fade-in duration-500">
            <Loader2 className="animate-spin text-ocean w-12 h-12" />
            <div className="flex flex-col gap-1">
              <h3 className="font-medium text-lg text-primary">Cargando expediente del curso...</h3>
              <p className="text-sm text-secondary max-w-[300px]">Conectando de forma segura con la base de datos.</p>
            </div>
          </section>
        </div>
      );
    }

    return (
      <section className="surface empty-state">
        <strong>Curso no encontrado</strong>
        <p>La ruta solicitada todavía no existe dentro del MVP actual.</p>
        <Link to="/courses" className="cta-button">
          <span>Volver al portafolio</span>
          <MoveRight size={16} />
        </Link>
      </section>
    );
  }

  const currentCourse = course;
  const architectureProducts = currentCourse.products.filter((product) => product.stage === 'arquitectura');
  const canManageWritingWorkspace = userRole === 'Administrador' || userRole === 'Coordinador';
  const courseLibraryResources =
    appData.libraryResources.length > 0
      ? appData.libraryResources.filter((resource) => resource.courseSlug === currentCourse.slug)
      : activeSection === 'escritura' && isLoading
        ? (writingLaunchSnapshot?.libraryResources ?? []).filter(
            (resource) => resource.courseSlug === currentCourse.slug,
          )
        : [];
  const writingWorkQueue = architectureProducts
    .filter((product) => {
      if (canManageWritingWorkspace) {
        return true;
      }

      if (role !== 'Experto') {
        return false;
      }

      return getWritingPhase(product)?.assigneeId === viewer.id;
    })
    .slice()
    .sort((left, right) => {
      const leftEnd = parsePlanningDate(getWritingPhase(left)?.endDate);
      const rightEnd = parsePlanningDate(getWritingPhase(right)?.endDate);

      if (leftEnd && rightEnd) {
        return leftEnd.getTime() - rightEnd.getTime();
      }

      if (leftEnd) {
        return -1;
      }

      if (rightEnd) {
        return 1;
      }

      return left.title.localeCompare(right.title, 'es');
    });
  const queriedWritingProduct =
    activeSection === 'escritura' && writingProductQueryId
      ? architectureProducts.find((product) => product.id === writingProductQueryId) ?? null
      : null;
  const canAccessQueriedWritingProduct = Boolean(
    queriedWritingProduct &&
      (canManageWritingWorkspace ||
        (role === 'Experto' && getWritingPhase(queriedWritingProduct)?.assigneeId === viewer.id)),
  );
  const selectedWritingProduct = canAccessQueriedWritingProduct ? queriedWritingProduct : null;
  const canEditSelectedWritingProduct = Boolean(
    selectedWritingProduct &&
      (canManageWritingWorkspace || (role === 'Experto' && getWritingPhase(selectedWritingProduct)?.assigneeId === viewer.id)),
  );
  const isWritingProductWorkspaceRoute =
    activeSection === 'escritura' && Boolean(writingProductQueryId);
  const selectedValidationProduct =
    validationProductId && activeSection === 'validacion'
      ? currentCourse.products.find(
          (product) => product.id === validationProductId && product.stage === 'validacion',
        ) ?? null
      : null;
  const canEditSelectedValidationProduct = Boolean(
    selectedValidationProduct &&
      canEditCourseProduct(userRole, selectedValidationProduct.owner, selectedValidationProduct.stage),
  );
  const isValidationProductWorkspaceRoute =
    activeSection === 'validacion' && Boolean(validationProductId);
  const architecturePreviewProduct = architecturePreviewProductId
    ? architectureProducts.find((product) => product.id === architecturePreviewProductId) ?? null
    : null;
  const planningProduct = planningProductId
    ? architectureProducts.find((product) => product.id === planningProductId) ?? null
    : null;
  const fallbackUsers =
    !persistedCourse && activeSection === 'escritura' && isLoading
      ? writingLaunchSnapshot?.users ?? []
      : [];
  const availableUsers = appData.users.length > 0 ? appData.users : fallbackUsers;
  const activeUsers = availableUsers.filter(
    (user) => user.status !== 'Inactivo' && user.status !== 'Suspendido',
  );

  useEffect(() => {
    if (activeSection !== 'escritura' || !writingProductQueryId) {
      setWritingLaunchSnapshot(null);
      return;
    }

    setWritingLaunchSnapshot(readWritingLaunchSnapshot(slug, writingProductQueryId));
  }, [activeSection, slug, writingProductQueryId]);

  useEffect(() => {
    if (selectedWritingProduct) {
      if (activeWritingProductIdRef.current !== selectedWritingProduct.id) {
        setWritingDraft(normalizeWritingDraft(selectedWritingProduct));
        setActiveWritingSectionTab(null);
      }
      activeWritingProductIdRef.current = selectedWritingProduct.id;
      setWritingError(null);
      return;
    }

    activeWritingProductIdRef.current = null;
    setWritingDraft(null);
    setActiveWritingSectionTab(null);
    setIsWritingInstructionsPanelOpen(false);

    if (activeSection === 'escritura' && writingProductQueryId && !isLoading) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('product');
      const serialized = nextParams.toString();
      const nextPath = buildWritingWorkspacePath(slug, null);
      navigate(serialized ? `${nextPath}?${serialized}` : nextPath, { replace: true });
    }
  }, [
    activeSection,
    isLoading,
    navigate,
    searchParams,
    selectedWritingProduct,
    slug,
    writingProductQueryId,
  ]);

  useEffect(() => {
    if (!writingDraft) {
      setActiveWritingSectionTab(null);
      return;
    }

    const hasActive = writingDraft.sections.some((section) => section.id === activeWritingSectionTab);
    if (!hasActive) {
      setActiveWritingSectionTab(writingDraft.sections[0]?.id ?? null);
    }
  }, [activeWritingSectionTab, writingDraft]);

  useEffect(() => {
    if (activeSection !== 'escritura' || !writingProductQueryId) {
      return;
    }

    if (workspaceRoute && !isWritingWorkspaceRoute(workspaceRoute)) {
      const serialized = searchParams.toString();
      const nextPath = buildWritingWorkspacePath(slug, null);
      navigate(serialized ? `${nextPath}?${serialized}` : nextPath, { replace: true });
    }
  }, [activeSection, navigate, searchParams, slug, workspaceRoute, writingProductQueryId]);

  useEffect(() => {
    if (!selectedWritingProduct || !activeWritingRoute || activeWritingRoute === writingDraft?.mode) {
      return;
    }

    setWritingDraft((current) => (current ? { ...current, mode: activeWritingRoute } : current));
  }, [activeWritingRoute, selectedWritingProduct, writingDraft?.mode]);

  const taskProductOptions = currentCourse.products
    .slice()
    .sort((left, right) => left.title.localeCompare(right.title));
  const experienceSettings = appData.experience;
  const workflowSettings = appData.workflow;
  const currentStageIndex = appData.stages.findIndex((item) => item.id === currentCourse.stageId);
  const currentCheckpoint = currentCourse.stageChecklist[currentStageIndex];
  const relatedResources = (
    appData.libraryResources.length > 0
      ? appData.libraryResources
      : activeSection === 'escritura' && isLoading
        ? writingLaunchSnapshot?.libraryResources ?? []
        : []
  ).filter((resource) => resource.courseSlug === currentCourse.slug);
  const canOperateMicrocurriculo = canManageMicrocurriculo(userRole);
  const canOperateArchitecture = canManageArchitecture(userRole);
  const canEditPlanning = canEditPlanningWorkspace(userRole);
  const blockingCheckpoints = currentCourse.stageChecklist.filter(
    (checkpoint, index) => index <= currentStageIndex && checkpoint.status === 'blocked',
  );
  const criticalObservations = currentCourse.observations.filter(
    (observation) => observation.status !== 'Resuelta' && observation.severity === 'Alta',
  );
  const checkpointRequirementMet = workflowSettings.handoffRequiresCheckpoint
    ? Boolean(currentCheckpoint && currentCheckpoint.status === 'done')
    : true;
  const blockedCheckpointRequirementMet = workflowSettings.handoffBlocksOnBlockedCheckpoints
    ? blockingCheckpoints.length === 0
    : true;
  const criticalObservationRequirementMet = workflowSettings.handoffBlocksOnCriticalObservations
    ? criticalObservations.length === 0
    : true;
  const handoffBlockingCount =
    (workflowSettings.handoffBlocksOnBlockedCheckpoints ? blockingCheckpoints.length : 0) +
    (workflowSettings.handoffBlocksOnCriticalObservations ? criticalObservations.length : 0);
  const isHandoffReady =
    checkpointRequirementMet &&
    blockedCheckpointRequirementMet &&
    criticalObservationRequirementMet;
  const deliverablesOpenCount = currentCourse.deliverables.filter(
    (deliverable) => deliverable.status !== 'Listo',
  ).length;
  const totalActivities = currentCourse.modules.reduce((sum, module) => sum + module.activities, 0);
  const pendingObservationsCount = currentCourse.observations.filter(
    (observation) => observation.status !== 'Resuelta',
  ).length;
  const resolvedObservationsCount = currentCourse.observations.length - pendingObservationsCount;
  const curatedResources = relatedResources.filter((resource) => resource.kind === 'Curado');
  const ownedResources = relatedResources.filter((resource) => resource.kind === 'Propio');
  const upcomingMilestones = currentCourse.schedule
    .slice()
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate))
    .slice(0, 4);
  const teamCoverage = appData.roles
    .map((roleName) => ({
      role: roleName,
      member: currentCourse.team.find((member) => member.role === roleName),
    }))
    .filter((item) => item.member);

  function countProductsByStage(stageId: CourseProductStage) {
    return currentCourse.products.filter((product) => product.stage === stageId).length;
  }

  const planeacionStatus =
    currentCourse.team.length === 0
      ? 'Pendiente'
      : upcomingMilestones.length === 0
        ? 'En curso'
        : teamCoverage.length >= 3
          ? 'Completado'
          : 'En curso';
  const notificationStatus =
    currentCourse.status === 'Entregado'
      ? 'Completado'
      : isHandoffReady
        ? 'En curso'
        : !checkpointRequirementMet || handoffBlockingCount > 0
          ? 'Pendiente'
          : 'En curso';
  const workflowStages = [
    {
      key: 'microcurriculum',
      stageId: 'microcurriculo',
      section: 'microcurriculo' as CourseSection,
      title: 'Microcurrículo',
      owner: 'Diseñador instruccional',
      status: 'Completado',
      summary: 'Base curricular y sílabus',
      actionLabel: 'Abrir microcurrículo',
    },
    {
      key: 'arquitectura',
      stageId: 'arquitectura',
      section: 'arquitectura' as CourseSection,
      title: 'Arquitectura',
      owner: 'Diseñador instruccional',
      status: currentCourse.stageNotes.arquitectura?.status ?? 'Pendiente',
      summary: 'Estructura modular y blueprints',
      actionLabel: 'Abrir arquitectura',
    },
    {
      key: 'planeacion',
      stageId: 'planeacion',
      section: 'planeacion' as CourseSection,
      title: 'Planeación',
      owner: 'Coordinador',
      status: planeacionStatus,
      summary: 'Hitos y asignaciones de equipo',
      actionLabel: 'Abrir planeación',
    },
    {
      key: 'writing',
      stageId: 'escritura',
      section: 'escritura' as CourseSection,
      title: 'Escritura',
      owner: 'Experto / Autor',
      status: currentCourse.stageNotes.escritura?.status ?? 'En curso',
      summary: 'Producción de contenidos base',
      actionLabel: 'Abrir fase escritura',
    },
    {
      key: 'validation',
      stageId: 'validacion',
      section: 'validacion' as CourseSection,
      title: 'Validación instruccional',
      owner: 'Diseñador instruccional',
      status: currentCourse.stageNotes.validacion?.status ?? 'Pendiente',
      summary: 'Revisión pedagógica',
      actionLabel: 'Abrir validación',
    },
    {
      key: 'multimedia',
      stageId: 'multimedia',
      section: 'multimedia' as CourseSection,
      title: 'Producción multimedia',
      owner: 'Diseñador gráfico / Realizador',
      status: currentCourse.stageNotes.multimedia?.status ?? 'Pendiente',
      summary: 'Diseño y piezas audiovisuales',
      actionLabel: 'Abrir multimedia',
    },
    {
      key: 'lms',
      stageId: 'lms',
      section: 'lms' as CourseSection,
      title: 'LMS',
      owner: 'Gestor LMS',
      status: currentCourse.stageNotes.lms?.status ?? 'Pendiente',
      summary: 'Montaje en plataforma',
      actionLabel: 'Abrir montaje',
    },
    {
      key: 'qa',
      stageId: 'qa',
      section: 'qa' as CourseSection,
      title: 'QA',
      owner: 'Analista QA',
      status: currentCourse.stageNotes.qa?.status ?? 'Pendiente',
      summary: 'Control de calidad final',
      actionLabel: 'Abrir QA',
    },
    {
      key: 'delivery',
      stageId: 'entrega',
      section: 'entrega' as CourseSection,
      title: 'Entrega',
      owner: 'Coordinador',
      status: currentCourse.stageNotes.entrega?.status ?? notificationStatus,
      summary: 'Cierre y notificación',
      actionLabel: 'Abrir entrega',
    },
  ];

  const isWorkflowPage = activeSection === 'summary';
  const isFocusedStudio =
    !isWorkflowPage && experienceSettings.studioMode === 'Profundo';
  const focusedStageMeta =
    activeSection === 'summary'
      ? null
      : activeSection === 'microcurriculo'
        ? {
            eyebrow: 'Microcurrículo',
            title: 'Zona dedicada del microcurrículo',
            description:
              'Trabaja la base curricular del curso sin distraerte con indicadores globales. Aquí viven sílabus, resultados, metodología y referencias.',
            stats: [
              { label: 'Resultados', value: String(currentCourse.metadata.learningOutcomes.length) },
              { label: 'Temas', value: String(currentCourse.metadata.topics.length) },
              { label: 'Versión', value: currentCourse.metadata.currentVersion },
            ],
          }
        : activeSection === 'arquitectura'
          ? {
              eyebrow: 'Arquitectura',
              title: 'Zona dedicada de arquitectura',
              description:
                'Diseña módulos, actividades y la lógica instruccional del curso desde una sola capa de trabajo.',
              stats: [
                { label: 'Módulos', value: String(currentCourse.modules.length) },
                { label: 'Actividades', value: String(totalActivities) },
                { label: 'Blueprints', value: String(countProductsByStage('arquitectura')) },
              ],
            }
          : activeSection === 'planeacion'
            ? {
                eyebrow: 'Planeación',
                title: 'Zona dedicada de planeación',
                description:
                  'Programa cada producto del curso por fases, fechas y responsables reales.',
                stats: [
                  { label: 'Productos', value: String(architectureProducts.length) },
                  {
                    label: 'Fases planificadas',
                    value: String(
                      architectureProducts.reduce(
                        (total, product) => total + countConfiguredPlanningPhases(product.phasePlan),
                        0,
                      ),
                    ),
                  },
                  {
                    label: 'Productos listos',
                    value: String(
                      architectureProducts.filter(
                        (product) => countConfiguredPlanningPhases(product.phasePlan) === productPlanningPhases.length,
                      ).length,
                    ),
                  },
                ],
              }
          : activeSection === 'escritura'
            ? {
                eyebrow: 'Escritura',
                title: 'Zona dedicada de escritura',
                description:
                  'Fase de autoría sobre productos planificados, con instrucciones claras y ventanas de trabajo por experto.',
                stats: [
                  { label: 'Productos', value: String(writingWorkQueue.length) },
                  {
                    label: 'Con fecha final',
                    value: String(
                      writingWorkQueue.filter((product) => Boolean(getWritingPhase(product)?.endDate)).length,
                    ),
                  },
                  {
                    label: 'Listos para escribir',
                    value: String(
                      writingWorkQueue.filter((product) => Boolean(product.body.trim())).length,
                    ),
                  },
                ],
              }
          : activeSection === 'validacion'
            ? {
                eyebrow: 'Validación instruccional',
                title: 'Zona dedicada de validación',
                description:
                  'Bandeja editorial para revisar productos, validar criterios y dejar comentarios por fragmento.',
                stats: [
                  {
                    label: 'Productos',
                    value: String(currentCourse.products.filter((product) => product.stage === 'validacion').length),
                  },
                  {
                    label: 'Checklists',
                    value: `${currentCourse.products
                      .filter((product) => product.stage === 'validacion')
                      .reduce(
                        (sum, product) => sum + getValidationMetrics(product).completed,
                        0,
                      )}/${currentCourse.products
                      .filter((product) => product.stage === 'validacion')
                      .reduce(
                        (sum, product) => sum + getValidationMetrics(product).total,
                        0,
                      )}`,
                  },
                  {
                    label: 'Comentarios',
                    value: String(
                      currentCourse.products
                        .filter((product) => product.stage === 'validacion')
                        .reduce(
                          (sum, product) => sum + getValidationMetrics(product).openComments,
                          0,
                        ),
                    ),
                  },
                ],
              }
          : activeSection === 'multimedia'
            ? {
                eyebrow: 'Producción multimedia',
                title: 'Zona dedicada de producción',
                description:
                  'Diseño gráfico, piezas audiovisuales y recursos multimedia asociados al curso.',
                stats: [
                  { label: 'Recursos', value: String(curatedResources.length + ownedResources.length) },
                  { label: 'Entregables', value: String(deliverablesOpenCount) },
                  { label: 'Productos', value: String(countProductsByStage('escritura')) },
                ],
              }
          : activeSection === 'lms'
            ? {
                eyebrow: 'LMS',
                title: 'Zona dedicada de montaje',
                description:
                  'Implementa y documenta el montaje técnico del curso con evidencias, checklist y ajustes de plataforma.',
                stats: [
                  {
                    label: 'Checkpoints',
                    value: String(
                      currentCourse.stageChecklist.filter(
                        (checkpoint) => checkpoint.owner === 'Gestor LMS',
                      ).length,
                    ),
                  },
                  { label: 'Bloqueos', value: String(currentCourse.stageNotes.lms.blockers.length) },
                  { label: 'Evidencias', value: String(currentCourse.stageNotes.lms.evidence.length) },
                ],
              }
          : activeSection === 'qa'
            ? {
                eyebrow: 'QA',
                title: 'Zona dedicada de control de calidad',
                description:
                  'Gestión de hallazgos finales y pruebas de usuario antes del lanzamiento oficial.',
                stats: [
                  { label: 'Observaciones', value: String(pendingObservationsCount) },
                  { label: 'Bloqueos', value: String(blockingCheckpoints.length) },
                  { label: 'Check', value: 'Auditado' },
                ],
              }
          : activeSection === 'entrega'
            ? {
                eyebrow: 'Entrega',
                title: 'Zona de entrega final',
                description:
                  'Cierre del proyecto, transferencia al cliente y notificación de culminación.',
                stats: [
                  { label: 'Estado', value: currentCourse.status },
                  { label: 'Cierre', value: currentCourse.metadata.targetCloseDate },
                  { label: 'Historial', value: 'Disponible' },
                ],
              }
          : null;
  const showFocusedStageHeader =
    !isWorkflowPage && experienceSettings.showFocusedStageHeader && Boolean(focusedStageMeta);
  const architectureSectionOptions = [
    'Introducción',
    ...(currentCourse?.metadata.units.map((_, index) => `Unidad ${index + 1}`) ?? []),
    'Cierre',
  ];

  function goToSection(section: CourseSection) {
    navigate(buildCourseSectionPath(currentCourseSlug, section));
  }

  function cleanPreviewLine(line: string) {
    return line
      .replace(/^#+\s*/, '')
      .replace(/^\d+[\.\)]\s*/, '')
      .replace(/^[-*]\s*/, '')
      .replace(/^\[[^\]]+\]\s*/, '')
      .trim();
  }

  function extractPreviewItems(body: string): string[] {
    const lines: string[] = splitLines(stripHtmlToText(body));
    const bulletLines: string[] = lines.filter((line: string) => /^[-*]\s+/.test(line) || /^\d+[\.\)]\s+/.test(line));
    const source: string[] = bulletLines.length > 0 ? bulletLines : lines;

    return source.map((line: string) => cleanPreviewLine(line)).filter(Boolean);
  }

  function productTemplateActionLabel(stageId: CourseProductStage) {
    switch (stageId) {
      case 'microcurriculo':
        return 'Cargar sílabus base';
      case 'arquitectura':
        return 'Cargar blueprint';
      case 'escritura':
        return 'Construir por módulos';
      case 'validacion':
        return 'Cargar checklist base';
      case 'multimedia':
        return 'Cargar storyboard';
      case 'qa':
        return 'Cargar rúbrica base';
      default:
        return 'Cargar base';
    }
  }

  function defaultProductSummary(stageId: CourseProductStage) {
    switch (stageId) {
      case 'microcurriculo':
        return 'Documento marco del curso con ficha académica, resultados, metodología y referencias.';
      case 'arquitectura':
        return 'Define la experiencia de aprendizaje, la secuencia pedagógica y la lógica modular del curso.';
      case 'escritura':
        return 'Agrupa la autoría del curso: actividades, instrucciones, recursos y materiales de trabajo.';
      case 'validacion':
        return 'Consolida la revisión instruccional, la checklist de calidad y los comentarios a fragmentos.';
      case 'multimedia':
        return 'Organiza piezas propias como HTML, audio, lecturas e infografías listas para producción.';
      case 'qa':
        return 'Establece los criterios de revisión, control de calidad y cierre del curso.';
      default:
        return 'Producto editable del expediente del curso.';
    }
  }

  function buildProductTemplate(
    stageId: CourseProductStage,
    format: CourseProductMutationInput['format'],
  ): string {
    switch (stageId) {
      case 'microcurriculo':
        return [
          '# Identificación del curso',
          `Institución: ${currentCourse.metadata.institution}`,
          `Programa: ${currentCourse.program}`,
          `Curso: ${currentCourse.title}`,
          `Código: ${currentCourse.code}`,
          `Modalidad: ${currentCourse.modality}`,
          `Créditos: ${currentCourse.credits}`,
          '',
          '# Resultados de aprendizaje',
          ...currentCourse.metadata.learningOutcomes.map((item: string) => `- ${item}`),
          '',
          '# Temas clave',
          ...currentCourse.metadata.topics.map((item: string) => `- ${item}`),
          '',
          '# Metodología',
          currentCourse.metadata.methodology,
          '',
          '# Evaluación',
          currentCourse.metadata.evaluation,
          '',
          '# Bibliografía base',
          ...currentCourse.metadata.bibliography.map((item: string) => `- ${item}`),
        ].join('\n');
      case 'arquitectura':
        return currentCourse.modules
          .map(
            (module, index) =>
              [
                `# Unidad ${index + 1}: ${module.title}`,
                `Objetivo de aprendizaje: ${module.learningGoal}`,
                `Actividades previstas: ${module.activities}`,
                `Recursos propios previstos: ${module.ownResources}`,
                `Recursos curados previstos: ${module.curatedResources}`,
                `Avance actual: ${module.completion}%`,
              ].join('\n'),
          )
          .join('\n\n');
      case 'escritura':
        return currentCourse.modules
          .map((module, index) => {
            const activities = Array.from(
              { length: Math.max(module.activities, 1) },
              (_, activityIndex) => `- Actividad ${activityIndex + 1}: describir propósito, instrucción y evidencia`,
            );

            return [
              `# Módulo ${index + 1}: ${module.title}`,
              `Objetivo: ${module.learningGoal}`,
              'Actividades:',
              ...activities,
              `Recursos propios de apoyo: ${module.ownResources}`,
              `Recursos curados de apoyo: ${module.curatedResources}`,
            ].join('\n');
          })
          .join('\n\n');
      case 'validacion':
        return currentCourse.modules
          .map(
            (module, index) =>
              [
                `# Producto ${index + 1}: ${module.title}`,
                `Propósito pedagógico: ${module.learningGoal}`,
                '',
                '# Checklist de validación',
                '- Propósito y alcance claros',
                '- Estructura pedagógica completa',
                '- Instrucciones accionables',
                '- Coherencia formal y lingüística',
                '',
                '# Comentarios por fragmento',
                '- Fragmento observado:',
                '- Ajuste esperado:',
                '- Estado de revisión:',
              ].join('\n'),
          )
          .join('\n\n');
      case 'multimedia': {
        const multimediaPieces =
          format === 'HTML'
            ? [
                '- HTML interactivo: experiencia principal',
                '- Lectura extendida: apoyo descargable',
                '- Infografía: resumen visual',
              ]
            : format === 'Pódcast'
              ? [
                  '- Pódcast principal: guion narrativo',
                  '- Cápsula de audio: refuerzo conceptual',
                  '- Pieza visual de portada: pendiente',
                ]
              : format === 'Infografía'
                ? [
                    '- Infografía vertical: estructura principal',
                    '- Pieza social complementaria: pendiente',
                    '- Texto alternativo accesible: pendiente',
                  ]
                : [
                    '- Lectura central',
                    '- Pieza complementaria',
                    '- Adaptación móvil',
                  ];

        return [
          `# Paquete ${format}`,
          'Objetivo de la pieza:',
          `${currentCourse.summary}`,
          '',
          '# Componentes',
          ...multimediaPieces,
          '',
          '# Consideraciones de experiencia',
          '- Legibilidad móvil',
          '- Coherencia con arquitectura del curso',
          '- Accesibilidad y contraste',
        ].join('\n');
      }
      case 'qa':
        return [
          '# Rúbrica de validación',
          '- Coherencia entre resultados, actividades y evaluación',
          '- Calidad instruccional y claridad de instrucciones',
          '- Uso pertinente de recursos curados y propios',
          '- Legibilidad, accesibilidad y consistencia visual',
          '- Preparación del curso para cierre y handoff',
        ].join('\n');
      default:
        return '';
    }
  }

  function applyTemplateToComposer(stageId: CourseProductStage) {
    setNewProductForm((current) => ({
      ...current,
      stage: stageId,
      summary: current.summary.trim() || defaultProductSummary(stageId),
      body: buildProductTemplate(stageId, current.format),
    }));
  }

  function applyTemplateToDraft(productId: string) {
    const draft = productDrafts[productId];

    if (!draft) {
      return;
    }

    setProductDrafts((current) => ({
      ...current,
      [productId]: {
        ...draft,
        summary: draft.summary.trim() || defaultProductSummary(draft.stage),
        body: buildProductTemplate(draft.stage, draft.format),
      },
    }));
  }

  function getValidationData(product: Pick<CourseProductMutationInput, 'stage' | 'validationData'>) {
    return product.validationData ?? buildDefaultValidationData(product.stage);
  }

  function getValidationMetrics(product: Pick<CourseProductMutationInput, 'stage' | 'validationData'>) {
    const validationData = getValidationData(product);
    const completed = validationData.checklist.filter((item) => item.status === 'Cumple').length;
    const total = validationData.checklist.length;
    const openComments = validationData.comments.filter((item) => item.status === 'Abierto').length;

    return {
      completed,
      total,
      progress: total > 0 ? Math.round((completed / total) * 100) : 0,
      openComments,
    };
  }

  function updateValidationCommentDraft(
    productId: string,
    patch: Partial<{ fragment: string; comment: string }>,
  ) {
    setValidationCommentDrafts((current) => ({
      ...current,
      [productId]: {
        fragment: current[productId]?.fragment ?? '',
        comment: current[productId]?.comment ?? '',
        ...patch,
      },
    }));
  }

  function updateValidationProductDraft(
    productId: string,
    updater: (validationData: ProductValidationData) => ProductValidationData,
  ) {
    setProductDrafts((current) => {
      const draft = current[productId];

      if (!draft) {
        return current;
      }

      return {
        ...current,
        [productId]: {
          ...draft,
          validationData: updater(getValidationData(draft)),
        },
      };
    });
  }

  function updateValidationChecklistItem(
    productId: string,
    itemId: string,
    patch: Partial<ProductValidationChecklistItem>,
  ) {
    const now = new Date().toISOString();

    updateValidationProductDraft(productId, (validationData) => ({
      ...validationData,
      checklist: validationData.checklist.map((item) =>
        item.id === itemId
          ? {
              ...item,
              ...patch,
              status: patch.status ? normalizeValidationChecklistStatus(patch.status) : item.status,
              updatedAt: now,
            }
          : item,
      ),
      lastReviewedAt: now,
    }));
  }

  function updateValidationReviewerNotes(productId: string, notes: string) {
    const now = new Date().toISOString();

    updateValidationProductDraft(productId, (validationData) => ({
      ...validationData,
      reviewerNotes: notes,
      lastReviewedAt: now,
    }));
  }

  function captureValidationFragment(productId: string) {
    const selection = typeof window !== 'undefined' ? window.getSelection() : null;
    const fragmentRoot = validationFragmentRefs.current[productId];

    if (!selection || selection.rangeCount === 0 || !fragmentRoot) {
      return;
    }

    const range = selection.getRangeAt(0);
    const ancestor = range.commonAncestorContainer;
    const ancestorElement =
      ancestor instanceof Element ? ancestor : ancestor.parentElement ?? null;

    if (!ancestorElement || !fragmentRoot.contains(ancestorElement)) {
      return;
    }

    const fragment = selection.toString().replace(/\s+/g, ' ').trim();

    if (!fragment) {
      return;
    }

    updateValidationCommentDraft(productId, { fragment });
  }

  function addValidationComment(productId: string) {
    const draft = productDrafts[productId];
    const composer = validationCommentDrafts[productId];

    if (!draft || !composer?.fragment.trim() || !composer?.comment.trim()) {
      return;
    }

    const now = new Date().toISOString();

    updateValidationProductDraft(productId, (validationData) => ({
      ...validationData,
      comments: [
        {
          id: crypto.randomUUID(),
          fragment: composer.fragment.trim(),
          comment: composer.comment.trim(),
          author: userRole,
          status: 'Abierto',
          createdAt: now,
          updatedAt: now,
        },
        ...validationData.comments,
      ],
      lastReviewedAt: now,
    }));

    updateValidationCommentDraft(productId, { fragment: '', comment: '' });
  }

  function toggleValidationCommentStatus(productId: string, commentId: string) {
    const now = new Date().toISOString();

    updateValidationProductDraft(productId, (validationData) => ({
      ...validationData,
      comments: validationData.comments.map((comment) =>
        comment.id === commentId
          ? {
              ...comment,
              status: comment.status === 'Abierto' ? 'Resuelto' : 'Abierto',
              updatedAt: now,
              resolvedAt: comment.status === 'Abierto' ? now : undefined,
            }
          : comment,
      ),
      lastReviewedAt: now,
    }));
  }

  function renderValidationWorkbench(
    productId: string,
    product: Pick<CourseProductMutationInput, 'stage' | 'validationData'>,
    summaryHtml: string,
    bodyHtml: string,
    isEditable: boolean,
  ) {
    const validationData = getValidationData(product);
    const fragmentDraft = validationCommentDrafts[productId] ?? { fragment: '', comment: '' };
    const checklistOptions: ProductValidationChecklistItem['status'][] = [
      'Cumple',
      'Parcial',
      'No cumple',
      'No aplica',
    ];
    const checklistCompleted = validationData.checklist.filter(
      (item) => item.status === 'Cumple',
    ).length;
    const checklistTotal = validationData.checklist.length;
    const pendingComments = validationData.comments.filter((item) => item.status === 'Abierto').length;

    return (
      <div className="surface-muted validation-workbench">
        <div className="section-heading section-heading--compact">
          <div>
            <span className="eyebrow">Checklist de validación</span>
            <h3>Revisión por fragmentos y criterios de calidad</h3>
          </div>
          <div className="action-row">
            <span className="badge badge--sage">
              {checklistCompleted}/{checklistTotal} cumplidos
            </span>
            <span className="badge badge--gold">{pendingComments} comentarios abiertos</span>
          </div>
        </div>

        <div className="validation-workbench__layout">
          <div className="validation-workbench__column">
            <div className="validation-workbench__block">
              <div className="section-heading section-heading--compact">
                <div>
                  <span className="eyebrow">Checklist</span>
                  <h3>Criterios de aprobación</h3>
                </div>
                <ClipboardList size={18} />
              </div>

              <div className="list-stack">
                {validationData.checklist.map((item) => (
                  <div key={item.id} className="list-item validation-checklist-item">
                    <div className="validation-checklist-item__content">
                      <strong>{item.label}</strong>
                      <div className="field__control field__control--inline">
                        <select
                          value={item.status}
                          disabled={!isEditable}
                          onChange={(event) =>
                            updateValidationChecklistItem(
                              productId,
                              item.id,
                              { status: event.target.value as ProductValidationChecklistItem['status'] },
                            )
                          }
                        >
                          {checklistOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="field__control">
                      <textarea
                        className="modern-textarea validation-checklist-item__notes"
                        value={item.notes ?? ''}
                        disabled={!isEditable}
                        onChange={(event) =>
                          updateValidationChecklistItem(productId, item.id, {
                            notes: event.target.value,
                          })
                        }
                        placeholder="Observación breve sobre este criterio"
                        rows={2}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="validation-workbench__block">
              <div className="section-heading section-heading--compact">
                <div>
                  <span className="eyebrow">Notas del revisor</span>
                  <h3>Resumen de observaciones</h3>
                </div>
                <MessageSquareText size={18} />
              </div>

              <textarea
                className="modern-textarea validation-notes"
                value={validationData.reviewerNotes}
                disabled={!isEditable}
                onChange={(event) => updateValidationReviewerNotes(productId, event.target.value)}
                placeholder="Sintetiza aquí el criterio global de revisión..."
                rows={4}
              />
            </div>
          </div>

          <div className="validation-workbench__column validation-workbench__column--wide">
            <div className="validation-workbench__block">
              <div className="section-heading section-heading--compact">
                <div>
                  <span className="eyebrow">Vista de revisión</span>
                  <h3>Selecciona un fragmento del producto para comentarlo</h3>
                </div>
                {isEditable ? (
                  <button
                    type="button"
                    className="ghost-button ghost-button--compact"
                    onClick={() => captureValidationFragment(productId)}
                  >
                    <span>Usar selección</span>
                  </button>
                ) : null}
              </div>

              <div
                ref={(node) => {
                  validationFragmentRefs.current[productId] = node;
                }}
                className="validation-preview"
                onMouseUp={() => captureValidationFragment(productId)}
              >
                <div className="validation-preview__pane">
                  <span className="eyebrow">Resumen</span>
                  {renderRichTextContent(
                    summaryHtml,
                    'Sin resumen disponible.',
                    'rich-html--compact',
                  )}
                </div>
                <div className="validation-preview__pane">
                  <span className="eyebrow">Contenido</span>
                  {renderRichTextContent(bodyHtml, 'Sin contenido disponible.', 'rich-html--panel')}
                </div>
              </div>
            </div>

            <div className="validation-workbench__block">
              <div className="section-heading section-heading--compact">
                <div>
                  <span className="eyebrow">Comentarios</span>
                  <h3>Fragmentos específicos para resolver</h3>
                </div>
                <span className="badge badge--outline">{validationData.comments.length} notas</span>
              </div>

              {isEditable ? (
                <div className="validation-comment-composer">
                  <label className="field field--full">
                    <span>Fragmento seleccionado</span>
                    <div className="field__control">
                      <textarea
                        className="modern-textarea"
                        value={fragmentDraft.fragment}
                        onChange={(event) =>
                          updateValidationCommentDraft(productId, { fragment: event.target.value })
                        }
                        placeholder="Selecciona un fragmento en la vista de revisión o escríbelo manualmente"
                        rows={3}
                      />
                    </div>
                  </label>

                  <label className="field field--full">
                    <span>Comentario para el experto</span>
                    <div className="field__control">
                      <textarea
                        className="modern-textarea"
                        value={fragmentDraft.comment}
                        onChange={(event) =>
                          updateValidationCommentDraft(productId, { comment: event.target.value })
                        }
                        placeholder="Describe con precisión qué debe ajustar el experto"
                        rows={4}
                      />
                    </div>
                  </label>

                  <div className="action-row">
                    <button
                      type="button"
                      className="cta-button"
                      disabled={!fragmentDraft.fragment.trim() || !fragmentDraft.comment.trim()}
                      onClick={() => addValidationComment(productId)}
                    >
                      <span>Agregar comentario</span>
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="list-stack">
                {validationData.comments.length === 0 ? (
                  <div className="empty-state">
                    <strong>Sin comentarios todavía</strong>
                    <p>Selecciona un fragmento para dejar observaciones puntuales sobre el producto.</p>
                  </div>
                ) : (
                  validationData.comments.map((comment) => (
                    <div key={comment.id} className="list-item validation-comment-item">
                      <div>
                        <div className="validation-comment-item__fragment">
                          <span className={badgeClass(comment.status)}>{comment.status}</span>
                          <strong>{comment.fragment}</strong>
                        </div>
                        <p>{comment.comment}</p>
                        <div className="list-item__meta">
                          <span>{comment.author}</span>
                          <span>{formatDate(comment.updatedAt || comment.createdAt)}</span>
                        </div>
                      </div>
                      {isEditable ? (
                        <button
                          type="button"
                          className="ghost-button ghost-button--compact"
                          onClick={() => toggleValidationCommentStatus(productId, comment.id)}
                        >
                          {comment.status === 'Abierto' ? 'Resolver' : 'Reabrir'}
                        </button>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderValidationStageBoard() {
    const validationProducts = currentCourse.products
      .filter((product) => product.stage === 'validacion')
      .slice()
      .sort((left, right) => {
        if (left.status === right.status) {
          return left.title.localeCompare(right.title, 'es');
        }

        const statusPriority: Record<CourseProductStatus, number> = {
          Borrador: 0,
          'En revisión': 1,
          Aprobado: 2,
        };

        return statusPriority[right.status] - statusPriority[left.status];
      });
    const readyToReviewCount = validationProducts.filter((product) => product.status !== 'Borrador').length;
    const approvedCount = validationProducts.filter((product) => product.status === 'Aprobado').length;
    const checklistCompleted = validationProducts.reduce(
      (sum, product) => sum + getValidationMetrics(product).completed,
      0,
    );
    const checklistTotal = validationProducts.reduce(
      (sum, product) => sum + getValidationMetrics(product).total,
      0,
    );
    const openComments = validationProducts.reduce(
      (sum, product) => sum + getValidationMetrics(product).openComments,
      0,
    );

    return (
      <section className="page-stack validation-board">
        <article className="surface section-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Validación instruccional</span>
              <h3>Bandeja de productos listos para revisar</h3>
            </div>
            <div className="action-row">
              <span className="badge badge--outline">{readyToReviewCount} listos para revisar</span>
              <span className="badge badge--sage">{approvedCount} aprobados</span>
            </div>
          </div>
          <p className="section-lead">
            Abre cada producto para validar criterios, comentar fragmentos concretos y ajustar la
            versión editorial sin salir del expediente del curso.
          </p>

          <div className="module-grid module-grid--summary validation-board__summary">
            <div className="module-card">
              <div className="module-card__top">
                <strong>{validationProducts.length}</strong>
                <span>productos</span>
              </div>
              <p>Productos disponibles para la revisión instruccional por curso.</p>
            </div>
            <div className="module-card">
              <div className="module-card__top">
                <strong>{checklistTotal > 0 ? Math.round((checklistCompleted / checklistTotal) * 100) : 0}%</strong>
                <span>cobertura</span>
              </div>
              <p>Avance acumulado de los criterios marcados como cumplidos.</p>
            </div>
            <div className="module-card">
              <div className="module-card__top">
                <strong>{openComments}</strong>
                <span>comentarios abiertos</span>
              </div>
              <p>Observaciones ancladas a fragmentos específicos del contenido.</p>
            </div>
          </div>
        </article>

        <article className="surface section-card">
          <div className="section-heading section-heading--compact">
            <div>
              <span className="eyebrow">Productos</span>
              <h3>Selecciona un producto para abrir su checklist</h3>
            </div>
          </div>

          {validationProducts.length === 0 ? (
            <div className="empty-state">
              <strong>No hay productos registrados para validación</strong>
              <p>Cuando existan productos en esta etapa aparecerán aquí listos para revisar.</p>
            </div>
          ) : (
            <div className="validation-board__grid">
              {validationProducts.map((product) => {
                const metrics = getValidationMetrics(product);

                return (
                  <button
                    key={product.id}
                    type="button"
                    className="validation-product-card"
                    onClick={() => goToValidationProduct(product.id)}
                  >
                    <div className="validation-product-card__copy">
                      <div className="validation-product-card__head">
                        <span className="badge badge--outline">{product.format}</span>
                        <span className={productStatusBadgeClass(product.status)}>{product.status}</span>
                      </div>
                      <h4>{product.title}</h4>
                      <p>{stripHtmlToText(product.summary) || 'Sin descripción registrada.'}</p>

                      <div className="validation-product-card__meta">
                        <span>{product.owner}</span>
                        <span>{product.version}</span>
                        <span>{metrics.openComments} comentarios</span>
                      </div>
                    </div>

                    <div className="validation-product-card__ring">
                      <ProgressRing
                        value={metrics.progress}
                        label="Checklist"
                        detail={`${metrics.completed}/${metrics.total} criterios`}
                      />
                    </div>

                    <div className="validation-product-card__cta">
                      <span>Revisar producto</span>
                      <MoveRight size={16} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </article>
      </section>
    );
  }

  function renderValidationProductWorkspace() {
    if (!validationProductId || !selectedValidationProduct) {
      if (activeSection === 'validacion' && validationProductId && isLoading) {
        return (
          <section className="page-stack">
            <article className="surface section-card">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Validación instruccional</span>
                  <h3>Preparando producto</h3>
                </div>
              </div>
              <p className="section-lead">
                Estamos cargando el expediente del producto solicitado para abrir su checklist y su
                espacio de revisión.
              </p>
            </article>
          </section>
        );
      }

      return (
        <section className="page-stack">
          <article className="surface empty-state">
            <strong>No fue posible abrir este producto</strong>
            <p>
              El producto solicitado ya no existe, no pertenece a este curso o no está disponible
              para validación.
            </p>
            <button type="button" className="cta-button" onClick={closeValidationProductWorkspace}>
              <span>Volver a la bandeja</span>
              <MoveRight size={16} />
            </button>
          </article>
        </section>
      );
    }

    const draft = productDrafts[selectedValidationProduct.id];
    const metrics = getValidationMetrics(draft ?? selectedValidationProduct);
    const validationStageFormats = productFormatsForStage('validacion');
    const currentValidationProductId = selectedValidationProduct.id;

    if (!draft) {
      return (
        <section className="page-stack">
          <article className="surface section-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Validación instruccional</span>
                <h3>Preparando edición</h3>
              </div>
            </div>
            <p className="section-lead">
              Estamos sincronizando el editor con la versión actual del producto.
            </p>
          </article>
        </section>
      );
    }

    return (
      <section className="page-stack validation-product-shell">
        <article className="surface section-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Validación instruccional</span>
              <h3>{draft.title}</h3>
            </div>
            <div className="action-row">
              <Link to={buildValidationWorkspacePath(currentCourse.slug, null)} className="ghost-button">
                <span>Volver a la bandeja</span>
              </Link>
              <button
                type="button"
                className="cta-button"
                disabled={!canEditSelectedValidationProduct || isProductSaving === currentValidationProductId}
                onClick={() => void handleProductSave(currentValidationProductId)}
              >
                <Save size={16} />
                <span>{isProductSaving === currentValidationProductId ? 'Guardando…' : 'Guardar cambios'}</span>
              </button>
            </div>
          </div>

          <div className="validation-product-head__meta">
            <span className={productStatusBadgeClass(draft.status)}>{draft.status}</span>
            <span className="badge badge--outline">{draft.format}</span>
            <span className="badge badge--outline">{draft.version}</span>
            <span>{metrics.completed}/{metrics.total} criterios</span>
            <span>{metrics.openComments} comentarios abiertos</span>
          </div>

          <div className="form-grid">
            <label className="field field--full">
              <span>Título</span>
              <div className="field__control">
                <input
                  value={draft.title}
                  disabled={!canEditSelectedValidationProduct}
                  onChange={(event) => updateProductDraft(currentValidationProductId, 'title', event.target.value)}
                />
              </div>
            </label>

            <label className="field">
              <span>Formato</span>
              <div className="field__control">
                <select
                  value={draft.format}
                  disabled={!canEditSelectedValidationProduct}
                  onChange={(event) =>
                    updateProductDraft(
                      currentValidationProductId,
                      'format',
                      event.target.value as CourseProductMutationInput['format'],
                    )
                  }
                >
                  {validationStageFormats.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </label>

            <label className="field">
              <span>Estado</span>
              <div className="field__control">
                <select
                  value={draft.status}
                  disabled={!canEditSelectedValidationProduct}
                  onChange={(event) =>
                    updateProductDraft(
                      currentValidationProductId,
                      'status',
                      event.target.value as CourseProductMutationInput['status'],
                    )
                  }
                >
                  {['Borrador', 'En revisión', 'Aprobado'].map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </label>

            <label className="field">
              <span>Responsable</span>
              <div className="field__control">
                <select
                  value={draft.owner}
                  disabled={!canEditSelectedValidationProduct}
                  onChange={(event) =>
                    updateProductDraft(currentValidationProductId, 'owner', event.target.value as Role)
                  }
                >
                  {appData.roles.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </label>

            <label className="field">
              <span>Versión</span>
              <div className="field__control">
                <input
                  value={draft.version}
                  disabled={!canEditSelectedValidationProduct}
                  onChange={(event) => updateProductDraft(currentValidationProductId, 'version', event.target.value)}
                />
              </div>
            </label>

            <label className="field field--full">
              <span>Etiquetas</span>
              <div className="field__control">
                <input
                  value={joinTags(draft.tags)}
                  disabled={!canEditSelectedValidationProduct}
                  onChange={(event) =>
                    updateProductDraft(currentValidationProductId, 'tags', splitTags(event.target.value))
                  }
                />
              </div>
            </label>

            <label className="field field--full">
              <span>Descripción</span>
              <RichTextEditor
                value={draft.summary}
                onChange={(value) => updateProductDraft(currentValidationProductId, 'summary', value)}
                placeholder="Describe qué evalúa este producto y cuál es su alcance pedagógico."
                minHeight={180}
                disabled={!canEditSelectedValidationProduct}
              />
            </label>

            <label className="field field--full">
              <span>Instrucciones</span>
              <RichTextEditor
                value={draft.body}
                onChange={(value) => updateProductDraft(currentValidationProductId, 'body', value)}
                placeholder="Define aquí la estructura, checklist y criterios que deben verificarse."
                minHeight={260}
                disabled={!canEditSelectedValidationProduct}
              />
            </label>
          </div>
        </article>

        {renderValidationWorkbench(
          currentValidationProductId,
          draft,
          draft.summary,
          draft.body,
          canEditSelectedValidationProduct,
        )}
      </section>
    );
  }

  function renderProductSupportPanel(
    product: Pick<CourseProductMutationInput, 'stage' | 'format' | 'body'>,
    onLoadTemplate?: () => void,
  ) {
    const previewItems = extractPreviewItems(product.body).slice(0, 6);
    const isArchitectureProduct = product.stage === 'arquitectura';

    return (
      <div className="surface-muted product-guide">
        <div className="section-heading section-heading--compact">
          <div>
            <span className="eyebrow">{isArchitectureProduct ? 'Guía del producto' : 'Guía estructurada'}</span>
            <h3>{isArchitectureProduct ? 'Descripción e instrucciones' : 'Edición asistida del producto'}</h3>
          </div>

          {onLoadTemplate ? (
            <button type="button" className="ghost-button" onClick={onLoadTemplate}>
              <span>{productTemplateActionLabel(product.stage)}</span>
            </button>
          ) : null}
        </div>

        {product.stage === 'microcurriculo' ? (
          <>
            <div className="module-grid module-grid--summary">
              <div className="module-card">
                <div className="module-card__top">
                  <strong>{currentCourse.metadata.institution}</strong>
                  <span>institución</span>
                </div>
                <p>{currentCourse.program} · {currentCourse.code}</p>
              </div>

              <div className="module-card">
                <div className="module-card__top">
                  <strong>{currentCourse.metadata.learningOutcomes.length}</strong>
                  <span>resultados</span>
                </div>
                <p>La ficha operativa ya entrega la base curricular para el sílabus.</p>
              </div>

              <div className="module-card">
                <div className="module-card__top">
                  <strong>{currentCourse.metadata.topics.length}</strong>
                  <span>temas clave</span>
                </div>
                <p>Los temas y referencias pueden convertirse en una versión completa del documento base.</p>
              </div>
            </div>

            <div className="list-stack">
              <div className="list-item">
                <div>
                  <strong>Metodología vigente</strong>
                  <p>{currentCourse.metadata.methodology}</p>
                </div>
              </div>
            </div>
          </>
        ) : null}

        {product.stage === 'arquitectura' ? (
          <div className="list-stack">
            {currentCourse.modules.map((module) => (
              <div key={module.id} className="list-item">
                <div>
                  <strong>{module.title}</strong>
                  <p>{module.learningGoal}</p>
                </div>
                <div className="list-item__meta">
                  <span>{module.activities} actividades</span>
                  <span>{module.completion}% avance</span>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {product.stage === 'escritura' ? (
          <div className="list-stack">
            {currentCourse.modules.map((module) => (
              <div key={module.id} className="list-item">
                <div>
                  <strong>{module.title}</strong>
                  <p>{module.learningGoal}</p>
                </div>
                <div className="list-item__meta">
                  <span>{module.activities} actividades</span>
                  <span>{module.ownResources} propios · {module.curatedResources} curados</span>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {product.stage === 'validacion' ? (
          <div className="list-stack">
            {currentCourse.modules.map((module) => (
              <div key={module.id} className="list-item">
                <div>
                  <strong>{module.title}</strong>
                  <p>Curación prevista para reforzar {module.learningGoal.toLowerCase()}.</p>
                </div>
                <div className="list-item__meta">
                  <span>{module.curatedResources} recursos curados</span>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {product.stage === 'multimedia' ? (
          <>
            <div className="module-grid module-grid--summary">
              <div className="module-card">
                <div className="module-card__top">
                  <strong>{product.format}</strong>
                  <span>salida principal</span>
                </div>
                <p>La pieza se piensa para experiencia tecnológica, legible y adaptable a móvil.</p>
              </div>

              <div className="module-card">
                <div className="module-card__top">
                  <strong>{previewItems.length}</strong>
                  <span>bloques detectados</span>
                </div>
                <p>La vista previa identifica componentes del paquete antes de pasar a LMS.</p>
              </div>

              <div className="module-card">
                <div className="module-card__top">
                  <strong>{ownedResources.length}</strong>
                  <span>activos propios</span>
                </div>
                <p>El expediente combina recursos del curso con entregables multimedia específicos.</p>
              </div>
            </div>

            <div className="module-grid module-grid--summary">
              {previewItems.length === 0 ? (
                <div className="empty-state">
                  <strong>Sin preview disponible todavía</strong>
                  <p>Carga un storyboard base para visualizar las piezas previstas.</p>
                </div>
              ) : (
                previewItems.map((item, index) => (
                  <div key={`${product.format}-${index}`} className="module-card">
                    <div className="module-card__top">
                      <strong>Pieza {index + 1}</strong>
                      <span>{product.format}</span>
                    </div>
                    <p>{item}</p>
                  </div>
                ))
              )}
            </div>
          </>
        ) : null}

        {product.stage === 'qa' ? (
          <>
            <div className="module-grid module-grid--summary">
              <div className="module-card">
                <div className="module-card__top">
                  <strong>{pendingObservationsCount}</strong>
                  <span>hallazgos abiertos</span>
                </div>
                <p>La rúbrica dialoga con el estado real del curso y sus observaciones vivas.</p>
              </div>

              <div className="module-card">
                <div className="module-card__top">
                  <strong>{blockingCheckpoints.length}</strong>
                  <span>bloqueos</span>
                </div>
                <p>Los criterios de validación ayudan a destrabar el paso hacia el cierre o el handoff.</p>
              </div>

              <div className="module-card">
                <div className="module-card__top">
                  <strong>{previewItems.length}</strong>
                  <span>criterios</span>
                </div>
                <p>La rúbrica se visualiza como checklist vivo dentro del expediente del curso.</p>
              </div>
            </div>

            <div className="list-stack">
              {previewItems.length === 0 ? (
                <div className="empty-state">
                  <strong>Sin criterios visibles todavía</strong>
                  <p>Carga una rúbrica base para empezar la validación estructurada del curso.</p>
                </div>
              ) : (
                previewItems.map((item, index) => (
                  <div key={`qa-${index}`} className="list-item">
                    <div>
                      <strong>Criterio {index + 1}</strong>
                      <p>{item}</p>
                    </div>
                    <div className="list-item__meta">
                      <span>{index < resolvedObservationsCount ? 'Revisado' : 'Pendiente'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : null}
      </div>
    );
  }

  function parseHeadingSections(body: string) {
    const sections: Record<string, string[]> = {};
    let currentHeading: string | null = null;

    body.split('\n').forEach((rawLine) => {
      const line = rawLine.trimEnd();

      if (/^#\s+/.test(line)) {
        currentHeading = cleanPreviewLine(line);
        sections[currentHeading] = [];
        return;
      }

      if (currentHeading) {
        sections[currentHeading].push(line);
      }
    });

    return sections;
  }

  function parseGeneralStructuredProduct(body: string) {
    const sections = parseHeadingSections(body);
    const parsedOutcomes = extractPreviewItems(sections['Resultados de aprendizaje']?.join('\n') ?? '');
    const parsedTopics = extractPreviewItems(sections['Temas clave']?.join('\n') ?? '');
    const parsedBibliography = extractPreviewItems(sections['Bibliografía base']?.join('\n') ?? '');

    return {
      outcomes: parsedOutcomes.length > 0 ? parsedOutcomes : currentCourse.metadata.learningOutcomes,
      topics: parsedTopics.length > 0 ? parsedTopics : currentCourse.metadata.topics,
      methodology:
        sections['Metodología']?.join('\n').trim() || currentCourse.metadata.methodology,
      evaluation:
        extractPreviewItems(sections['Evaluación']?.join('\n') ?? '').length > 0
          ? extractPreviewItems(sections['Evaluación']?.join('\n') ?? '')
          : Array.isArray(currentCourse.metadata.evaluation) ? currentCourse.metadata.evaluation : typeof currentCourse.metadata.evaluation === 'string' ? [currentCourse.metadata.evaluation] : [],
      bibliography:
        parsedBibliography.length > 0 ? parsedBibliography : currentCourse.metadata.bibliography,
    };
  }

  function buildGeneralStructuredBody(input: {
    outcomes: string[];
    topics: string[];
    methodology: string;
    evaluation: string[];
    bibliography: string[];
  }) {
    return [
      '# Identificación del curso',
      `Institución: ${currentCourse.metadata.institution}`,
      `Programa: ${currentCourse.program}`,
      `Curso: ${currentCourse.title}`,
      `Código: ${currentCourse.code}`,
      `Modalidad: ${currentCourse.modality}`,
      `Créditos: ${currentCourse.credits}`,
      '',
      '# Resultados de aprendizaje',
      ...input.outcomes.map((item) => `- ${item}`),
      '',
      '# Temas clave',
      ...input.topics.map((item) => `- ${item}`),
      '',
      '# Metodología',
      input.methodology,
      '',
      '# Evaluación',
      ...input.evaluation.map((item) => `- ${item}`),
      '',
      '# Bibliografía base',
      ...input.bibliography.map((item) => `- ${item}`),
    ].join('\n');
  }

  function parseProductionStructuredProduct(body: string) {
    const blocks = body
      .split(/\n(?=#\s+(?:Módulo|Unidad)\s+\d+:)/)
      .map((block: string) => block.trim())
      .filter(Boolean);

    return currentCourse.modules.map((module, index: number) => {
      const block = blocks[index] ?? '';
      const lines = splitLines(block);
      const activitiesStart = lines.findIndex((line: string) => line.startsWith('Actividades:'));
      const activities = lines
        .slice(activitiesStart >= 0 ? activitiesStart + 1 : 0)
        .filter((line: string) => /^[-*]\s+/.test(line))
        .map((line: string) =>
          cleanPreviewLine(line)
            .replace(/^Actividad\s+\d+:\s*/i, '')
            .trim(),
        )
        .filter(Boolean);

      return {
        moduleId: module.id,
        title: module.title,
        objective: module.learningGoal,
        ownResources: module.ownResources,
        curatedResources: module.curatedResources,
        activities:
          activities.length > 0
            ? activities
            : Array.from({ length: Math.max(module.activities, 1) }, (_: unknown, activityIndex: number) =>
                `Actividad ${activityIndex + 1} por desarrollar`,
              ),
      };
    });
  }

  function buildProductionStructuredBody(
    modules: Array<{
      title: string;
      objective: string;
      ownResources: number;
      curatedResources: number;
      activities: string[];
    }>,
  ) {
    return modules
      .map((module: { title: string; objective: string; ownResources: number; curatedResources: number; activities: string[] }, index: number) =>
        [
          `# Módulo ${index + 1}: ${module.title}`,
          `Objetivo: ${module.objective}`,
          'Actividades:',
          ...module.activities.map((activity: string) => `- ${activity}`),
          `Recursos propios de apoyo: ${module.ownResources}`,
          `Recursos curados de apoyo: ${module.curatedResources}`,
        ].join('\n'),
      )
      .join('\n\n');
  }

  type QaCriterionStatus = 'Pendiente' | 'Ajuste' | 'Cumple';

  function parseQaStructuredProduct(body: string) {
    const criteria = splitLines(body)
      .filter((line: string) => /^[-*]\s+/.test(line))
      .map((line: string) => {
        const cleaned = line.replace(/^[-*]\s*/, '').trim();
        const match = cleaned.match(/^\[(Pendiente|Ajuste|Cumple)\|([0-4])\]\s+(.+)$/);

        if (match) {
          return {
            status: match[1] as QaCriterionStatus,
            score: Number.parseInt(match[2], 10),
            label: match[3].trim(),
          };
        }

        return {
          status: 'Pendiente' as QaCriterionStatus,
          score: 0,
          label: cleaned,
        };
      })
      .filter((criterion: { label: string }) => criterion.label);

    return criteria.length > 0
      ? criteria
      : [
          { status: 'Pendiente' as QaCriterionStatus, score: 0, label: 'Coherencia pedagógica' },
          { status: 'Pendiente' as QaCriterionStatus, score: 0, label: 'Calidad de actividades y recursos' },
          { status: 'Pendiente' as QaCriterionStatus, score: 0, label: 'Legibilidad y accesibilidad' },
        ];
  }

  function buildQaStructuredBody(
    criteria: Array<{
      status: QaCriterionStatus;
      score: number;
      label: string;
    }>,
  ) {
    return [
      '# Rúbrica de validación',
      ...criteria.map((criterion: { status: QaCriterionStatus; score: number; label: string }) => `- [${criterion.status}|${criterion.score}] ${criterion.label}`),
    ].join('\n');
  }

  function renderStructuredProductEditor(
    product: CourseProductMutationInput,
    onPatch: (patch: Partial<CourseProductMutationInput>) => void,
  ) {
    if (product.stage === 'microcurriculo') {
      const structured = parseGeneralStructuredProduct(product.body);

      return (
        <div className="surface-muted structured-editor">
          <div className="section-heading section-heading--compact">
            <div>
              <span className="eyebrow">Editor nativo</span>
              <h3>Sílabus por secciones</h3>
            </div>
          </div>

          <div className="list-stack">
            <div className="list-item">
              <div>
                <strong>Identificación institucional</strong>
                <p>
                  {currentCourse.metadata.institution} · {currentCourse.program} · {currentCourse.code}
                </p>
              </div>
              <div className="list-item__meta">
                <span>{currentCourse.modality}</span>
                <span>{currentCourse.credits} créditos</span>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="form-group">
              <label className="form-label flex items-center gap-2">
                <Target size={14} className="text-coral" />
                <span>Resultados de aprendizaje</span>
              </label>
              <textarea
                rows={4}
                className="modern-textarea"
                value={joinLines(structured.outcomes)}
                onChange={(event) =>
                  onPatch({
                    body: buildGeneralStructuredBody({
                      ...structured,
                      outcomes: splitLines(event.target.value),
                    }),
                  })
                }
                placeholder="Un resultado por línea..."
              />
            </div>

            <div className="form-group">
              <label className="form-label flex items-center gap-2">
                <Layers size={14} className="text-ocean" />
                <span>Temas clave / Núcleos temáticos</span>
              </label>
              <textarea
                rows={4}
                className="modern-textarea"
                value={joinLines(structured.topics)}
                onChange={(event) =>
                  onPatch({
                    body: buildGeneralStructuredBody({
                      ...structured,
                      topics: splitLines(event.target.value),
                    }),
                  })
                }
                placeholder="Un tema por línea..."
              />
            </div>

            <div className="form-group">
              <label className="form-label flex items-center gap-2">
                <PenTool size={14} className="text-sage" />
                <span>Metodología pedagógica</span>
              </label>
              <textarea
                rows={4}
                className="modern-textarea"
                value={structured.methodology}
                onChange={(event) =>
                  onPatch({
                    body: buildGeneralStructuredBody({
                      ...structured,
                      methodology: event.target.value,
                    }),
                  })
                }
                placeholder="Descripción de la estrategia de enseñanza..."
              />
            </div>

            <div className="form-group">
              <label className="form-label flex items-center gap-2">
                <ClipboardCheck size={14} className="text-gold" />
                <span>Evaluación y seguimiento</span>
              </label>
              <textarea
                rows={4}
                className="modern-textarea"
                value={joinLines(structured.evaluation)}
                onChange={(event) =>
                  onPatch({
                    body: buildGeneralStructuredBody({
                      ...structured,
                      evaluation: splitLines(event.target.value),
                    }),
                  })
                }
                placeholder="Criterios y momentos de evaluación..."
              />
            </div>

            <div className="form-group">
              <label className="form-label flex items-center gap-2">
                <BookOpen size={14} className="text-ink" />
                <span>Bibliografía base</span>
              </label>
              <textarea
                rows={4}
                className="modern-textarea italic"
                value={joinLines(structured.bibliography)}
                onChange={(event) =>
                  onPatch({
                    body: buildGeneralStructuredBody({
                      ...structured,
                      bibliography: splitLines(event.target.value),
                    }),
                  })
                }
                placeholder="Referencias principales..."
              />
            </div>
          </div>
        </div>
      );
    }

    if (product.stage === 'escritura') {
      const modules = parseProductionStructuredProduct(product.body);

      return (
        <div className="surface-muted structured-editor">
          <div className="section-heading section-heading--compact">
            <div>
              <span className="eyebrow">Editor nativo</span>
              <h3>Actividades por módulo</h3>
            </div>
          </div>

          <div className="structured-editor__stack">
            {modules.map((module, moduleIndex) => (
              <article key={module.moduleId} className="structured-module-card">
                <div className="structured-module-card__head">
                  <div>
                    <strong>{module.title}</strong>
                    <p>{module.objective}</p>
                  </div>
                  <div className="list-item__meta">
                    <span>{module.ownResources} propios</span>
                    <span>{module.curatedResources} curados</span>
                  </div>
                </div>

                <div className="structured-editor__stack">
                  {module.activities.map((activity, activityIndex) => (
                    <div key={`${module.moduleId}-${activityIndex}`} className="task-editor task-editor--timeline">
                      <label className="field field--full">
                        <span>Actividad {activityIndex + 1}</span>
                        <div className="field__control field__control--textarea">
                          <textarea
                            rows={3}
                            value={activity}
                            onChange={(event) => {
                              const nextModules = modules.map((currentModule: { moduleId: string; title: string; objective: string; ownResources: number; curatedResources: number; activities: string[] }, currentIndex: number) =>
                                currentIndex === moduleIndex
                                  ? {
                                      ...currentModule,
                                      activities: currentModule.activities.map((item: string, currentActivityIndex: number) =>
                                        currentActivityIndex === activityIndex ? event.target.value : item,
                                      ),
                                    }
                                  : currentModule,
                              );

                              onPatch({
                                body: buildProductionStructuredBody(nextModules),
                              });
                            }}
                          />
                        </div>
                      </label>

                      <div className="task-editor__sidebar">
                        <button
                          type="button"
                          className="danger-button danger-button--ghost"
                          disabled={module.activities.length <= 1}
                          onClick={() => {
                            const nextModules = modules.map((currentModule: { moduleId: string; title: string; objective: string; ownResources: number; curatedResources: number; activities: string[] }, currentIndex: number) =>
                              currentIndex === moduleIndex
                                ? {
                                    ...currentModule,
                                    activities: currentModule.activities.filter(
                                      (_: string, currentActivityIndex: number) => currentActivityIndex !== activityIndex,
                                    ),
                                  }
                                : currentModule,
                            );

                            onPatch({
                              body: buildProductionStructuredBody(nextModules),
                            });
                          }}
                        >
                          <Trash2 size={16} />
                          <span>Eliminar</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="action-row">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      const nextModules = modules.map((currentModule, currentIndex) =>
                        currentIndex === moduleIndex
                          ? {
                              ...currentModule,
                              activities: [
                                ...currentModule.activities,
                                `Nueva actividad ${currentModule.activities.length + 1}`,
                              ],
                            }
                          : currentModule,
                      );

                      onPatch({
                        body: buildProductionStructuredBody(nextModules),
                      });
                    }}
                  >
                    <Plus size={16} />
                    <span>Agregar actividad</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      );
    }

    if (product.stage === 'qa') {
      const criteria = parseQaStructuredProduct(product.body);
      const averageScore =
        criteria.length > 0
          ? (criteria.reduce((sum: number, criterion: { score: number }) => sum + criterion.score, 0) / criteria.length).toFixed(1)
          : '0.0';

      return (
        <div className="surface-muted structured-editor">
          <div className="section-heading section-heading--compact">
            <div>
              <span className="eyebrow">Editor nativo</span>
              <h3>Rúbrica por criterio</h3>
            </div>
            <span className="badge badge--outline">Promedio {averageScore}/4</span>
          </div>

          <div className="criteria-grid">
            {criteria.map((criterion, index) => (
              <article key={`criterion-${index}`} className="criteria-card">
                <label className="field field--full">
                  <span>Criterio {index + 1}</span>
                  <div className="field__control">
                    <input
                      value={criterion.label}
                      onChange={(event) => {
                        const nextCriteria = criteria.map((item: { label: string; status: QaCriterionStatus; score: number }, currentIndex: number) =>
                          currentIndex === index ? { ...item, label: event.target.value } : item,
                        );

                        onPatch({
                          body: buildQaStructuredBody(nextCriteria),
                        });
                      }}
                    />
                  </div>
                </label>

                <div className="criteria-card__meta">
                  <label className="field">
                    <span>Estado</span>
                    <div className="field__control">
                      <select
                        value={criterion.status}
                        onChange={(event) => {
                          const nextCriteria = criteria.map((item: { label: string; status: QaCriterionStatus; score: number }, currentIndex: number) =>
                            currentIndex === index
                              ? { ...item, status: event.target.value as QaCriterionStatus }
                              : item,
                          );

                          onPatch({
                            body: buildQaStructuredBody(nextCriteria),
                          });
                        }}
                      >
                        {['Pendiente', 'Ajuste', 'Cumple'].map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                  </label>

                  <label className="field">
                    <span>Puntaje</span>
                    <div className="field__control">
                      <select
                        value={criterion.score}
                        onChange={(event) => {
                          const nextCriteria = criteria.map((item: { label: string; status: QaCriterionStatus; score: number }, currentIndex: number) =>
                            currentIndex === index
                              ? {
                                  ...item,
                                  score: Number.parseInt(event.target.value, 10) || 0,
                                }
                              : item,
                          );

                          onPatch({
                            body: buildQaStructuredBody(nextCriteria),
                          });
                        }}
                      >
                        {[0, 1, 2, 3, 4].map((score) => (
                          <option key={score} value={score}>
                            {score}
                          </option>
                        ))}
                      </select>
                    </div>
                  </label>
                </div>

                <div className="action-row">
                  <button
                    type="button"
                    className="danger-button danger-button--ghost"
                    disabled={criteria.length <= 1}
                    onClick={() => {
                      const nextCriteria = criteria.filter((_: unknown, currentIndex: number) => currentIndex !== index);

                      onPatch({
                        body: buildQaStructuredBody(nextCriteria),
                      });
                    }}
                  >
                    <Trash2 size={16} />
                    <span>Eliminar criterio</span>
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="action-row">
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                onPatch({
                  body: buildQaStructuredBody([
                    ...criteria,
                    {
                      status: 'Pendiente',
                      score: 0,
                      label: `Nuevo criterio ${criteria.length + 1}`,
                    },
                  ]),
                });
              }}
            >
              <Plus size={16} />
              <span>Agregar criterio</span>
            </button>
          </div>
        </div>
      );
    }

    return null;
  }

  async function handleCourseSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCourseSaving(true);
    setCourseError(null);

    const originalAppData = { ...appData };

    try {
      // Optimistic update
      mutateAppData((current) => ({
        ...current,
        courses: current.courses.map((c) =>
          c.slug === currentCourse.slug
            ? {
                ...c,
                ...courseForm,
                metadata: { ...c.metadata, ...courseForm },
                updatedAt: new Date().toISOString().slice(0, 10),
              }
            : c,
        ),
      }));

      const response = await fetch(`/api/courses?slug=${encodeURIComponent(currentCourse.slug)}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(courseForm),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible actualizar el curso.');
      }

      refreshAppData();
      setIsEditingCourse(false);
    } catch (error) {
      // Rollback
      mutateAppData(originalAppData);
      setCourseError(error instanceof Error ? error.message : 'No fue posible actualizar el curso.');
    } finally {
      setIsCourseSaving(false);
    }
  }

  async function handleMetadataSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsMetadataSaving(true);
    setMetadataError(null);

    const originalAppData = { ...appData };

    try {
      // Optimistic update
      mutateAppData((current) => ({
        ...current,
        courses: current.courses.map((c) =>
          c.slug === currentCourse.slug
            ? {
                ...c,
                metadata: { ...c.metadata, ...metadataForm },
                updatedAt: new Date().toISOString().slice(0, 10),
              }
            : c,
        ),
      }));

      const response = await fetch(
        `/api/course-metadata?slug=${encodeURIComponent(currentCourse.slug)}`,
        {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify(metadataForm),
        },
      );

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible actualizar la ficha operativa.');
      }

      refreshAppData();
    } catch (error) {
      // Rollback
      mutateAppData(originalAppData);
      setMetadataError(
        error instanceof Error ? error.message : 'No fue posible actualizar la ficha operativa.',
      );
    } finally {
      setIsMetadataSaving(false);
    }
  }

  async function handleCourseDelete() {
    const confirmed = await showConfirm({
      title: `Eliminar ${currentCourse.title}`,
      message: `Vas a eliminar el curso "${currentCourse.title}" y sus tareas asociadas. Esta acción no se puede deshacer.`,
      tone: 'warning',
      confirmLabel: 'Eliminar curso',
      cancelLabel: 'Cancelar',
    });

    if (!confirmed) {
      return;
    }

    const response = await fetch('/api/courses', {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        slug: currentCourse.slug,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setCourseError(payload.error ?? 'No fue posible eliminar el curso.');
      return;
    }

    refreshAppData();
    window.location.assign('/courses');
  }

  async function handleTaskCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsTaskSaving(true);
    setTaskError(null);

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(newTaskForm),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible crear la tarea.');
      }

      refreshAppData();
      setNewTaskForm(makeTaskForm(currentCourse.slug, currentCourse.stageId));
      closeModal();
    } catch (error) {
      setTaskError(error instanceof Error ? error.message : 'No fue posible crear la tarea.');
    } finally {
      setIsTaskSaving(false);
    }
  }

  async function handleTaskSave(taskId: string) {
    const draft = taskDrafts[taskId];

    if (!draft) {
      return;
    }

    setTaskError(null);

    const response = await fetch('/api/tasks', {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        id: taskId,
        ...draft,
      }),
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setTaskError(payload.error ?? 'No fue posible guardar la tarea.');
      return;
    }

    refreshAppData();
  }

  async function handleTaskDelete(taskId: string) {
    const confirmed = await showConfirm({
      title: 'Eliminar tarea',
      message: 'La tarea será eliminada permanentemente. ¿Quieres continuar?',
      tone: 'warning',
      confirmLabel: 'Eliminar tarea',
      cancelLabel: 'Cancelar',
    });

    if (!confirmed) {
      return;
    }

    const response = await fetch('/api/tasks', {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        id: taskId,
      }),
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setTaskError(payload.error ?? 'No fue posible eliminar la tarea.');
      return;
    }

    refreshAppData();
  }

  function updateTaskDraft<Key extends keyof TaskMutationInput>(
    taskId: string,
    key: Key,
    value: TaskMutationInput[Key],
  ) {
    setTaskDrafts((current) => ({
      ...current,
      [taskId]: {
        ...current[taskId],
        [key]: value,
      },
    }));
  }



  async function handleTeamMemberCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTeamError(null);
    setIsTeamSaving('new');

    try {
      const response = await fetch('/api/team-members', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          courseSlug: currentCourse.slug,
          ...newTeamMemberForm,
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible agregar el responsable.');
      }

      refreshAppData();
      setNewTeamMemberForm(makeTeamMemberForm());
      setIsTeamComposerOpen(false);
    } catch (error) {
      setTeamError(
        error instanceof Error ? error.message : 'No fue posible agregar el responsable.',
      );
    } finally {
      setIsTeamSaving(null);
    }
  }

  async function handleTeamMemberSave(memberId: string) {
    const draft = teamDrafts[memberId];

    if (!draft) {
      return;
    }

    setTeamError(null);
    setIsTeamSaving(memberId);

    try {
      const response = await fetch('/api/team-members', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          courseSlug: currentCourse.slug,
          id: memberId,
          ...draft,
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible guardar el responsable.');
      }

      refreshAppData();
    } catch (error) {
      setTeamError(
        error instanceof Error ? error.message : 'No fue posible guardar el responsable.',
      );
    } finally {
      setIsTeamSaving(null);
    }
  }

  async function handleTeamMemberDelete(memberId: string) {
    const confirmed = await showConfirm({
      title: 'Retirar responsable',
      message: 'Este responsable será retirado del equipo visible del curso. ¿Quieres continuar?',
      tone: 'warning',
      confirmLabel: 'Retirar responsable',
      cancelLabel: 'Cancelar',
    });

    if (!confirmed) {
      return;
    }

    setTeamError(null);
    setIsTeamSaving(memberId);

    try {
      const response = await fetch('/api/team-members', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          courseSlug: currentCourse.slug,
          id: memberId,
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible retirar el responsable.');
      }

      refreshAppData();
    } catch (error) {
      setTeamError(
        error instanceof Error ? error.message : 'No fue posible retirar el responsable.',
      );
    } finally {
      setIsTeamSaving(null);
    }
  }

  function updateTeamDraft<Key extends keyof TeamMemberMutationInput>(
    memberId: string,
    key: Key,
    value: TeamMemberMutationInput[Key],
  ) {
    setTeamDrafts((current) => ({
      ...current,
      [memberId]: {
        ...current[memberId],
        [key]: value,
      },
    }));
  }



  async function handleProductCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProductError(null);
    setIsProductSaving('new');

    try {
      const response = await fetch('/api/course-products', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          courseSlug: currentCourse.slug,
          ...newProductForm,
          tags: newProductForm.tags.map((tag) => tag.trim()).filter(Boolean),
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible crear el producto.');
      }

      refreshAppData();
      setProductComposerStage(null);
      setNewProductForm(
        makeCourseProductForm(
          newProductForm.stage,
          userRole,
          newProductForm.stage === 'arquitectura'
            ? architectureSectionOptions[0] ?? 'Introducción'
            : undefined,
        ),
      );
    } catch (error) {
      setProductError(error instanceof Error ? error.message : 'No fue posible crear el producto.');
    } finally {
      setIsProductSaving(null);
    }
  }

  async function handleGenerateArchitecture() {
    if (!currentCourse) return;

    const confirmed = await showConfirm({
      title: 'Actualizar arquitectura con IA',
      message: 'La IA analizará el microcurrículo y los lineamientos pedagógicos para proponer una estructura de productos. Los productos actuales se mantendrán y se añadirán los nuevos sugeridos.',
      tone: 'default',
      confirmLabel: 'Generar Arquitectura',
      cancelLabel: 'Cancelar',
    });

    if (!confirmed) return;

    setIsGeneratingArchitecture(true);
    setArchitectureProgress(5);
    setArchitectureStep('Iniciando diseño instruccional...');

    try {
      const response = await fetch('/api/generate-architecture', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          courseSlug: currentCourse.slug,
          institutionStructureId: currentCourse.institutionStructureId 
        }),
      });

      if (!response.ok) {
        let message = 'Error al conectar con el Arquitecto IA.';

        try {
          const payload = (await response.json()) as { error?: string; message?: string };
          message = payload.error ?? payload.message ?? message;
        } catch {
          try {
            const text = await response.text();
            if (text.trim()) {
              message = text.trim();
            }
          } catch {
            // Conserva el mensaje por defecto cuando no haya cuerpo legible.
          }
        }

        throw new Error(message);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No fue posible abrir el canal de la IA.');

      let streamBuffer = '';
      let generatedCount = 0;
      const unitLabels = (currentCourse.metadata.units ?? []).map((_, index) => `Unidad ${index + 1}`);
      const unitTitleHints = (currentCourse.metadata.units ?? []).map((unit) => unit.tituloUnidad ?? '');
      type SuggestedArchitectureItem = {
        title?: unknown;
        description?: unknown;
        summary?: unknown;
        instructions?: unknown;
        body?: unknown;
        format?: unknown;
        section?: unknown;
      };

      const processArchitectureEvent = async (rawChunk: string) => {
        if (!rawChunk.trim()) {
          return;
        }

        const dataLine = rawChunk
          .split('\n')
          .find((line) => line.startsWith('data: '));

        if (!dataLine) {
          return;
        }

        let payload: {
          progress?: number;
          step?: string;
          complete?: boolean;
          data?: {
            introduccion?: Array<Record<string, unknown>>;
            unidades?: Array<Record<string, unknown>>;
            cierre?: Array<Record<string, unknown>>;
          };
          error?: string;
        };

        try {
          payload = JSON.parse(dataLine.slice(6).trim());
        } catch (error) {
          console.error('Architecture event parse error:', error);
          return;
        }

        if (typeof payload.progress === 'number') {
          setArchitectureProgress(payload.progress);
        }

        if (payload.step) {
          setArchitectureStep(payload.step);
        }

        if (payload.error) {
          throw new Error(payload.error);
        }

        if (payload.complete && payload.data) {
          const suggested = payload.data;
          const introSuggested: SuggestedArchitectureItem[] = (suggested.introduccion ?? []).map((item) => ({
            ...item,
            section: 'Introducción',
          }));
          const closureSuggested: SuggestedArchitectureItem[] = (suggested.cierre ?? []).map((item) => ({
            ...item,
            section: 'Cierre',
          }));
          const rawUnitSuggested = [...(suggested.unidades ?? [])] as SuggestedArchitectureItem[];

          const normalizedUnitSuggested: SuggestedArchitectureItem[] = rawUnitSuggested.map((item, index) => {
            const normalizedSection = resolveArchitectureSectionLabel(
              String(item.section ?? ''),
              String(item.title ?? ''),
              String(item.summary ?? ''),
              unitLabels,
              unitTitleHints,
              unitLabels.length > 0 ? index % unitLabels.length : undefined,
            );

            return {
              ...item,
              section: normalizedSection,
            };
          });

          const allSuggested = [
            ...introSuggested,
            ...normalizedUnitSuggested,
            ...closureSuggested,
          ];

          generatedCount = allSuggested.length;

          for (const item of allSuggested) {
            const title = String(item.title ?? '').trim();
            if (!title) {
              continue;
            }

            await fetch('/api/course-products', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                courseSlug: currentCourse.slug,
                title,
                summary: String(item.description ?? item.summary ?? '').trim(),
                format: normalizeArchitectureProductFormat(String(item.format ?? '')),
                stage: 'arquitectura',
                owner: userRole,
                status: 'Borrador',
                body: String(item.instructions ?? item.body ?? '').trim(),
                tags: [],
                version: '1.0',
                section: String(item.section ?? '').trim(),
              })
            }).then(async (createResponse) => {
              if (!createResponse.ok) {
                const payload = (await createResponse.json().catch(() => null)) as { error?: string } | null;
                throw new Error(payload?.error ?? 'No fue posible guardar uno de los productos sugeridos.');
              }
            });
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        streamBuffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

        const chunks = streamBuffer.split('\n\n');
        streamBuffer = chunks.pop() ?? '';

        for (const chunk of chunks) {
          await processArchitectureEvent(chunk);
        }

        if (done) {
          if (streamBuffer.trim()) {
            await processArchitectureEvent(streamBuffer);
          }
          break;
        }
      }

      refreshAppData();
      void showAlert({
        tone: 'success',
        title: 'Arquitectura actualizada',
        message:
          generatedCount > 0
            ? `Se integraron ${generatedCount} productos sugeridos a la arquitectura del curso.`
            : 'La IA completó la revisión, pero no propuso productos nuevos para integrar.',
      });
    } catch (error) {
       const message = error instanceof Error ? error.message : 'Falla crítica en el Arquitecto IA.';
       void showAlert({ tone: 'error', title: 'Error de Arquitectura', message });
    } finally {
      setIsGeneratingArchitecture(false);
      setArchitectureStep('');
      setArchitectureProgress(0);
    }
  }

  function handleQuickAddProduct(sectionName: string) {
    if (!currentCourse) return;

    setEditingArchitectureProductId(null);
    setArchitectureEditorMode('create');
    setNewProductForm({
      title: '',
      summary: '',
      format: 'Video',
      stage: 'arquitectura',
      owner: userRole,
      status: 'Borrador',
      body: '',
      tags: [],
      version: '1.0',
      section: sectionName,
      phasePlan: normalizeProductPhasePlanDraft([]),
    });
    setActiveAddSection(sectionName);
    setIsAddProductModalOpen(true);
  }

  function openArchitectureProductEditor(
    product: CourseProduct,
    mode: 'edit' | 'move' = 'edit',
  ) {
    setEditingArchitectureProductId(product.id);
    setArchitectureEditorMode(mode);
    setActiveAddSection(product.section ?? 'Introducción');
    setNewProductForm({
      title: product.title,
      summary: product.summary,
      format: product.format,
      stage: 'arquitectura',
      owner: product.owner,
      status: product.status,
      body: product.body,
      tags: product.tags,
      version: product.version,
      section: product.section ?? 'Introducción',
      phasePlan: normalizeProductPhasePlanDraft(product.phasePlan),
    });
    setIsAddProductModalOpen(true);
  }

  async function handleSubmitArchitectureProduct() {
     if (!currentCourse || !newProductForm.title) return;

     const saveKey = editingArchitectureProductId ?? 'new';
     setIsProductSaving(saveKey);
     try {
       const response = await fetch('/api/course-products', {
         method: editingArchitectureProductId ? 'PATCH' : 'POST',
         credentials: 'same-origin',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           courseSlug: currentCourse.slug,
           ...(editingArchitectureProductId ? { id: editingArchitectureProductId } : {}),
           ...newProductForm,
         })
       });

       const payload = (await response.json().catch(() => null)) as { error?: string } | null;

       if (!response.ok) {
         throw new Error(
           payload?.error ??
             (editingArchitectureProductId
               ? 'Error al actualizar el producto'
               : 'Error al crear el producto'),
         );
       }
       
       setIsAddProductModalOpen(false);
       setEditingArchitectureProductId(null);
       setArchitectureEditorMode('create');
       refreshAppData();
     } catch (error) {
       const message =
         error instanceof Error
           ? error.message
           : editingArchitectureProductId
             ? 'Error al actualizar producto'
             : 'Error al crear producto';
       setProductError(message);
     } finally {
       setIsProductSaving(null);
     }
  }

  async function handleProductSave(productId: string) {
    const draft = productDrafts[productId];

    if (!draft) {
      return;
    }

    setProductError(null);
    setIsProductSaving(productId);

    try {
      const response = await fetch('/api/course-products', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          courseSlug: currentCourse.slug,
          id: productId,
          ...draft,
          summary: sanitizeRichHtml(draft.summary),
          body: sanitizeRichHtml(draft.body),
          tags: draft.tags.map((tag) => tag.trim()).filter(Boolean),
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible guardar el producto.');
      }

      refreshAppData();
      void showAlert({
        title: 'Producto guardado',
        message: 'Los cambios se guardaron correctamente y quedaron disponibles en el expediente del curso.',
        tone: 'success',
      });
    } catch (error) {
      setProductError(
        error instanceof Error ? error.message : 'No fue posible guardar el producto.',
      );
    } finally {
      setIsProductSaving(null);
    }
  }

  async function handleProductDelete(productId: string) {
    const confirmed = await showConfirm({
      title: 'Eliminar producto',
      message: 'Este producto será retirado del expediente editable del curso. ¿Quieres continuar?',
      tone: 'warning',
      confirmLabel: 'Eliminar producto',
      cancelLabel: 'Cancelar',
    });

    if (!confirmed) {
      return;
    }

    setProductError(null);
    setIsProductSaving(productId);

    try {
      const response = await fetch('/api/course-products', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          courseSlug: currentCourse.slug,
          id: productId,
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible eliminar el producto.');
      }

      refreshAppData();
    } catch (error) {
      setProductError(
        error instanceof Error ? error.message : 'No fue posible eliminar el producto.',
      );
    } finally {
      setIsProductSaving(null);
    }
  }

  async function handleClearArchitecture() {
    const architectureProducts = currentCourse.products.filter(
      (product) => product.stage === 'arquitectura',
    );

    if (architectureProducts.length === 0) {
      void showAlert({
        title: 'Arquitectura vacía',
        message: 'No hay productos de arquitectura para eliminar.',
        tone: 'warning',
      });
      return;
    }

    const confirmed = await showConfirm({
      title: 'Limpiar arquitectura',
      message:
        'Si continúas, se eliminarán todos los productos creados en Arquitectura para este curso. Esta acción limpia introducción, unidades y cierre.',
      tone: 'warning',
      confirmLabel: 'Sí, borrar todo',
      cancelLabel: 'Cancelar',
    });

    if (!confirmed) {
      return;
    }

    setProductError(null);
    setIsProductSaving('architecture:clear');

    try {
      for (const product of architectureProducts) {
        const response = await fetch('/api/course-products', {
          method: 'DELETE',
          credentials: 'same-origin',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            courseSlug: currentCourse.slug,
            id: product.id,
          }),
        });

        const payload = (await response.json().catch(() => null)) as { error?: string } | null;

        if (!response.ok) {
          throw new Error(payload?.error ?? `No fue posible eliminar "${product.title}".`);
        }
      }

      refreshAppData();
      void showAlert({
        title: 'Arquitectura limpiada',
        message: `Se eliminaron ${architectureProducts.length} productos de la arquitectura del curso.`,
        tone: 'success',
      });
    } catch (error) {
      setProductError(
        error instanceof Error ? error.message : 'No fue posible limpiar la arquitectura.',
      );
    } finally {
      setIsProductSaving(null);
    }
  }

  function openPlanningProductModal(product: CourseProduct) {
    setPlanningError(null);
    setPlanningProductId(product.id);
    setPlanningPhaseDraft(normalizeProductPhasePlanDraft(product.phasePlan));
  }

  function closePlanningProductModal() {
    setPlanningProductId(null);
    setPlanningError(null);
    setPlanningPhaseDraft(normalizeProductPhasePlanDraft([]));
  }

  function updatePlanningPhaseDraft(
    phase: ProductPlanningPhase,
    key: keyof Omit<ProductPhasePlan, 'phase'>,
    value: string,
  ) {
    setPlanningPhaseDraft((current) =>
      current.map((item) =>
        item.phase === phase
          ? {
              ...item,
              [key]: value || undefined,
            }
          : item,
      ),
    );
  }

  async function handlePlanningSave() {
    if (!planningProduct) {
      return;
    }

    setPlanningError(null);
    setIsPlanningSaving(true);

    try {
      const phasePlan = planningPhaseDraft.map((item) => {
        const assignee = activeUsers.find((user) => user.id === item.assigneeId);
        return {
          phase: item.phase,
          startDate: item.startDate,
          endDate: item.endDate,
          assigneeId: item.assigneeId?.trim() || undefined,
          assigneeName: assignee?.name ?? item.assigneeName ?? undefined,
        };
      });

      const response = await fetch('/api/course-products', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          courseSlug: currentCourse.slug,
          id: planningProduct.id,
          phasePlan,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? 'No fue posible guardar la planeación del producto.');
      }

      refreshAppData();
      closePlanningProductModal();
    } catch (error) {
      setPlanningError(
        error instanceof Error ? error.message : 'No fue posible guardar la planeación del producto.',
      );
    } finally {
      setIsPlanningSaving(false);
    }
  }

  function closeWritingEditor() {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('product');
    const serialized = nextParams.toString();
    const nextPath = buildWritingWorkspacePath(currentCourse.slug, null);
    navigate(serialized ? `${nextPath}?${serialized}` : nextPath, { replace: true });
    setWritingError(null);
    setIsWritingInstructionsPanelOpen(false);
    setActiveWritingSectionTab(null);
  }

  function closeValidationProductWorkspace() {
    const nextPath = buildValidationWorkspacePath(currentCourse.slug, null);
    navigate(nextPath, { replace: true });
  }

  function goToValidationProduct(productId: string) {
    navigate(buildValidationWorkspacePath(currentCourse.slug, productId));
  }

  function navigateWritingModeRoute(mode: WritingWorkspaceRoute | null) {
    const nextPath = buildWritingWorkspacePath(currentCourse.slug, mode);
    const nextParams = new URLSearchParams(searchParams);

    if (writingProductQueryId) {
      nextParams.set('product', writingProductQueryId);
    } else {
      nextParams.delete('product');
    }

    const serialized = nextParams.toString();
    navigate(serialized ? `${nextPath}?${serialized}` : nextPath, { replace: true });
  }

  function stashWritingLaunchSnapshot(product: CourseProduct) {
    if (typeof window === 'undefined') {
      return;
    }

    const snapshot: WritingLaunchSnapshot = {
      courseSlug: currentCourse.slug,
      productId: product.id,
      createdAt: Date.now(),
      course: currentCourse,
      users: appData.users,
      libraryResources: appData.libraryResources.filter(
        (resource) => resource.courseSlug === currentCourse.slug,
      ),
    };

    try {
      window.localStorage.setItem(WRITING_LAUNCH_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      /* noop */
    }
  }

  function updateWritingDraft(updater: (current: ProductWritingData) => ProductWritingData) {
    setWritingDraft((current) => (current ? updater(current) : current));
  }

  function updateWritingSection(sectionId: string, key: keyof ProductWritingSection, value: string) {
    updateWritingDraft((current) => {
      const sections = current.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              [key]: value,
              updatedAt: new Date().toISOString(),
            }
          : section,
      );

      return {
        ...current,
        sections,
        draftText: createWritingDraftTextFromSections(sections),
      };
    });
  }

  function uploadFileToR2WithProgress(
    file: File,
    folder: string,
    onProgress: (progress: number) => void,
  ) {
    return new Promise<ProductWritingAsset>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/uploads', true);
      xhr.withCredentials = true;

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) {
          return;
        }

        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      };

      xhr.onload = () => {
        try {
          const payload = JSON.parse(xhr.responseText || '{}') as {
            error?: string;
            key?: string;
            url?: string;
          };

          if (xhr.status < 200 || xhr.status >= 300 || !payload.key || !payload.url) {
            reject(new Error(payload.error ?? `No fue posible cargar "${file.name}" a R2.`));
            return;
          }

          onProgress(100);
          resolve({
            key: payload.key,
            url: payload.url,
            name: file.name,
            contentType: file.type,
            size: file.size,
            uploadedAt: new Date().toISOString(),
          });
        } catch (error) {
          reject(error instanceof Error ? error : new Error(`No fue posible cargar "${file.name}".`));
        }
      };

      xhr.onerror = () => {
        reject(new Error(`No fue posible cargar "${file.name}" por un error de red.`));
      };

      const formData = new FormData();
      formData.append('file', file);
      formData.append('scope', 'course');
      formData.append('folder', folder);
      xhr.send(formData);
    });
  }

  async function requestWritingSectionGeneration(
    section: ProductWritingSection,
    options?: {
      supportAssets?: ProductWritingAsset[];
      libraryResourceIds?: string[];
      timeoutMs?: number;
    },
  ) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      options?.timeoutMs ?? WRITING_AI_GENERATION_REQUEST_TIMEOUT_MS,
    );

    try {
      const response = await fetch('/api/course-writing', {
        method: 'POST',
        credentials: 'same-origin',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          action: 'generate-section',
          courseSlug: currentCourse.slug,
          productId: selectedWritingProduct?.id,
          sectionId: section.id,
          sectionTitle: section.title,
          sectionInstructions: section.instructions,
          supportAssets: options?.supportAssets ?? writingDraft?.supportAssets ?? [],
          libraryResourceIds: options?.libraryResourceIds ?? writingDraft?.libraryResourceIds ?? [],
          aiPrompt: writingDraft?.aiPrompt,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; product?: CourseProduct }
        | null;

      if (!response.ok) {
        const error = new Error(
          payload?.error ?? `No fue posible generar "${section.title}".`,
        ) as Error & { retryable?: boolean; status?: number };
        error.retryable = WRITING_AI_RETRYABLE_STATUSES.has(response.status);
        error.status = response.status;
        throw error;
      }

      return payload;
    } catch (rawError) {
      if (rawError instanceof Error && rawError.name === 'AbortError') {
        const timeoutError = new Error(
          `La generación de "${section.title}" tardó demasiado.`,
        ) as Error & { retryable?: boolean; status?: number };
        timeoutError.retryable = true;
        timeoutError.status = 408;
        throw timeoutError;
      }

      const error = rawError as Error & { retryable?: boolean; status?: number };
      if (typeof error.retryable !== 'boolean') {
        error.retryable = true;
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async function saveWritingDraftToServer(
    writingData: ProductWritingData,
    options?: {
      timeoutMs?: number;
      fallbackError?: string;
    },
  ) {
    if (!selectedWritingProduct) {
      throw new Error('Producto de escritura no seleccionado.');
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      options?.timeoutMs ?? WRITING_SAVE_REQUEST_TIMEOUT_MS,
    );

    try {
      const response = await fetch('/api/course-writing', {
        method: 'POST',
        credentials: 'same-origin',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          action: 'save',
          courseSlug: currentCourse.slug,
          productId: selectedWritingProduct.id,
          writingData: {
            ...writingData,
            lastSavedAt: new Date().toISOString(),
          },
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; product?: CourseProduct }
        | null;

      if (!response.ok) {
        throw new Error(
          payload?.error ?? options?.fallbackError ?? 'No fue posible guardar el producto en escritura.',
        );
      }

      return payload?.product ? normalizeWritingDraft(payload.product) : null;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async function handleGenerateWritingProduct() {
    if (!selectedWritingProduct || !writingDraft || writingDraft.sections.length === 0) {
      return;
    }

    setWritingError(null);
    setIsWritingGeneratingAll(true);
    setWritingGenerationProgress(0);

    try {
      const pendingSections = writingDraft.sections.filter(
        (section) => stripHtmlToText(section.content).trim().length === 0,
      );
      const sectionsToGenerate =
        pendingSections.length > 0 ? pendingSections : writingDraft.sections;
      const total = sectionsToGenerate.length;
      const progressBase =
        writingDraft.sections.length > 0
          ? Math.round(((writingDraft.sections.length - total) / writingDraft.sections.length) * 100)
          : 0;
      const failedSections: string[] = [];
      setWritingGenerationProgress(progressBase);

      for (let index = 0; index < total; index += 1) {
        const section = sectionsToGenerate[index];
        setWritingGeneratingSectionId(section.id);
        const stepStart = progressBase + Math.round((index / total) * (100 - progressBase));
        const stepTarget = progressBase + Math.round(((index + 1) / total) * (100 - progressBase));
        setWritingGenerationProgress((current) => Math.max(current, stepStart));

        let stepTicker: number | null = window.setInterval(() => {
          setWritingGenerationProgress((current) => {
            if (current >= stepTarget - 1) {
              return current;
            }
            return Math.min(stepTarget - 1, current + 1);
          });
        }, 250);

        let sectionCompleted = false;
        let sectionErrorMessage = '';

        for (let attempt = 1; attempt <= WRITING_AI_GENERATION_MAX_ATTEMPTS; attempt += 1) {
          const shouldUseLiteContext = attempt >= 2;
          try {
            const payload = await requestWritingSectionGeneration(section, {
              supportAssets: shouldUseLiteContext ? [] : writingDraft.supportAssets,
              libraryResourceIds: shouldUseLiteContext ? [] : writingDraft.libraryResourceIds,
              timeoutMs: Math.round(
                WRITING_AI_GENERATION_REQUEST_TIMEOUT_MS * (shouldUseLiteContext ? 0.8 : 1),
              ),
            });

            if (payload?.product) {
              setWritingDraft(normalizeWritingDraft(payload.product));
            }

            sectionCompleted = true;
            break;
          } catch (rawError) {
            const error = rawError as Error & { retryable?: boolean };
            sectionErrorMessage = error.message || `No fue posible generar "${section.title}".`;
            const canRetry =
              error.retryable !== false && attempt < WRITING_AI_GENERATION_MAX_ATTEMPTS;

            if (!canRetry) {
              break;
            }

            await sleep(
              WRITING_AI_RETRY_DELAYS_MS[Math.min(attempt - 1, WRITING_AI_RETRY_DELAYS_MS.length - 1)],
            );
          }
        }

        if (stepTicker !== null) {
          window.clearInterval(stepTicker);
          stepTicker = null;
        }

        if (!sectionCompleted) {
          failedSections.push(section.title);
          setWritingError(sectionErrorMessage || `No fue posible generar "${section.title}".`);
        }

        setWritingGenerationProgress(stepTarget);

        if (index < total - 1) {
          await sleep(WRITING_AI_GENERATION_COOLDOWN_MS);
        }
      }

      if (failedSections.length > 0) {
        throw new Error(
          `No se pudieron completar ${failedSections.length} secciones: ${failedSections.join(', ')}. ` +
            'Puedes reintentar la generación; el sistema conserva el avance logrado.',
        );
      }

      refreshAppData();
      void showAlert({
        title: 'Producto generado',
        message: `La IA completó ${total}/${total} secciones pendientes del producto.`,
        tone: 'success',
      });
    } catch (error) {
      setWritingError(
        error instanceof Error ? error.message : 'No fue posible generar el producto con IA.',
      );
    } finally {
      setWritingGeneratingSectionId(null);
      setIsWritingGeneratingAll(false);
    }
  }

  async function handleWritingSave() {
    if (!selectedWritingProduct || !writingDraft) {
      return;
    }

    setWritingError(null);
    setIsWritingSaving(true);

    try {
      const savedDraft = await saveWritingDraftToServer(writingDraft, {
        fallbackError: 'No fue posible guardar el producto en escritura.',
      });

      if (savedDraft) {
        setWritingDraft(savedDraft);
      }

      refreshAppData();
      void showAlert({
        title: 'Producto guardado',
        message: 'La escritura del producto quedó actualizada en el expediente del curso.',
        tone: 'success',
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setWritingError(
          'El guardado tardó demasiado. Verifica tu conexión e inténtalo de nuevo.',
        );
        return;
      }
      setWritingError(
        error instanceof Error ? error.message : 'No fue posible guardar el producto en escritura.',
      );
    } finally {
      setIsWritingSaving(false);
    }
  }

  async function handleFinalizeWritingProduct() {
    if (!selectedWritingProduct || !writingDraft || !canEditSelectedWritingProduct) {
      return;
    }

    const filledSections = countFilledWritingSections(writingDraft.sections);
    const totalSections = writingDraft.sections.length;
    const pendingSections = Math.max(0, totalSections - filledSections);
    const confirmed = await showConfirm({
      title: 'Finalizar producto',
      message:
        pendingSections > 0
          ? `Todavía faltan ${pendingSections} secciones por completar. Si finalizas ahora, el producto pasará a Validación instruccional para revisión del diseñador instruccional.`
          : 'El producto está listo para pasar a Validación instruccional. Se guardará y se abrirá su checklist de revisión.',
      tone: pendingSections > 0 ? 'warning' : 'success',
      confirmLabel: 'Finalizar producto',
      cancelLabel: 'Seguir editando',
    });

    if (!confirmed) {
      return;
    }

    setWritingError(null);
    setIsWritingFinalizing(true);

    try {
      const savedDraft = await saveWritingDraftToServer(writingDraft, {
        fallbackError: 'No fue posible finalizar el producto.',
      });
      const finalDraft = savedDraft ?? writingDraft;
      const finalBody =
        createWritingDraftTextFromSections(finalDraft.sections).trim() ||
        finalDraft.draftText.trim();

      const response = await fetch('/api/course-products', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          courseSlug: currentCourse.slug,
          id: selectedWritingProduct.id,
          stage: 'validacion',
          owner: 'Diseñador instruccional',
          status: 'En revisión',
          summary: selectedWritingProduct.summary,
          body: finalBody,
          writingData: finalDraft,
          validationData: buildDefaultValidationData('validacion'),
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; product?: CourseProduct }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? 'No fue posible enviar el producto a validación.');
      }

      if (payload?.product) {
        mutateAppData((current) => ({
          ...current,
          courses: current.courses.map((course) =>
            course.slug !== currentCourse.slug
              ? course
              : {
                  ...course,
                  products: course.products.map((product) =>
                    product.id === payload.product?.id ? payload.product! : product,
                  ),
                  updatedAt: new Date().toISOString().slice(0, 10),
                },
          ),
        }));
      }

      navigate(buildValidationWorkspacePath(currentCourse.slug, selectedWritingProduct.id), {
        replace: true,
      });
      refreshAppData();
      void showAlert({
        title: 'Producto finalizado',
        message:
          'El producto quedó enviado a Validación instruccional para checklist, comentarios y revisión editorial.',
        tone: 'success',
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setWritingError('La finalización tardó demasiado. Inténtalo de nuevo.');
        return;
      }

      setWritingError(
        error instanceof Error ? error.message : 'No fue posible enviar el producto a validación.',
      );
    } finally {
      setIsWritingFinalizing(false);
    }
  }

  async function handleWritingSubmissionUpload(file: File) {
    if (!selectedWritingProduct || !writingDraft) {
      return;
    }

    const extension = file.name.split('.').pop()?.trim().toLowerCase() ?? '';
    if (!WRITING_UPLOAD_ALLOWED_EXTENSIONS.has(extension)) {
      setWritingError('Formato no soportado para digitalización. Usa PDF o DOCX.');
      return;
    }

    setWritingError(null);
    setIsWritingExtracting(true);
    setWritingUploadProgress(0);
    setWritingProcessingProgress(0);
    let controller: AbortController | null = null;
    let timeoutId: number | null = null;
    let processingTicker: number | null = null;
    let uploadedAsset: ProductWritingAsset | null = null;
    let inlineExtractionBase64: string | undefined;
    let extractedTextOverride: string | undefined;
    let completed = false;

    try {
      uploadedAsset = await uploadFileToR2WithProgress(
        file,
        `${currentCourse.slug}-writing`,
        setWritingUploadProgress,
      );
      updateWritingDraft((current) => ({
        ...current,
        mode: 'upload',
        submittedAsset: uploadedAsset ?? current.submittedAsset,
      }));

      setWritingProcessingProgress(22);
      try {
        const clientExtractedText = await withClientTimeout(
          extractUploadedFileTextInBrowser(file, (progress) => {
            setWritingProcessingProgress((current) =>
              Math.max(current, Math.min(90, Math.max(22, progress))),
            );
          }),
          WRITING_CLIENT_EXTRACTION_TIMEOUT_MS,
          'La extracción local del documento tardó demasiado.',
        );

        if (clientExtractedText.trim()) {
          extractedTextOverride = clientExtractedText;
          setWritingProcessingProgress((current) => Math.max(current, 90));
        }
      } catch {
        // Si la extracción local falla, seguimos con fallback server-side.
      }

      if (extractedTextOverride?.trim()) {
        try {
          const extractedText = extractedTextOverride.trim();
          const baseSections =
            writingDraft.sections.length > 0
              ? writingDraft.sections
              : buildWritingSectionsFromProduct(selectedWritingProduct);
          const hydratedSections = hydrateWritingSectionsFromText(baseSections, extractedText);
          const writingData: ProductWritingData = {
            ...writingDraft,
            mode: 'upload',
            submittedAsset: uploadedAsset,
            extractedText,
            draftText: createWritingDraftTextFromSections(hydratedSections),
            sections: hydratedSections,
            lastSavedAt: new Date().toISOString(),
          };

          const fastPathController = new AbortController();
          const fastPathTimeoutId = window.setTimeout(
            () => fastPathController.abort(),
            WRITING_SAVE_REQUEST_TIMEOUT_MS,
          );
          setWritingProcessingProgress((current) => Math.max(current, 96));

          try {
            const response = await fetch('/api/course-writing', {
              method: 'POST',
              credentials: 'same-origin',
              signal: fastPathController.signal,
              headers: {
                'content-type': 'application/json',
              },
              body: JSON.stringify({
                action: 'save',
                courseSlug: currentCourse.slug,
                productId: selectedWritingProduct.id,
                writingData,
              }),
            });

            const payload = (await response.json().catch(() => null)) as
              | { error?: string; product?: CourseProduct }
              | null;

            if (!response.ok) {
              throw new Error(payload?.error ?? 'No fue posible guardar la digitalización del documento.');
            }

            const normalized = normalizeWritingDraft(payload?.product ?? {
              ...selectedWritingProduct,
              writingData,
            });
            setWritingDraft(normalized);
            const completedSections = countFilledWritingSections(normalized.sections);
            setWritingProcessingProgress(100);
            completed = true;
            refreshAppData();
            void showAlert({
              title: 'Documento procesado',
              message:
                completedSections > 0
                  ? `Digitalización completa. ${completedSections}/${normalized.sections.length} secciones quedaron con contenido editable.`
                  : 'Digitalización completa. Revisa y ajusta el contenido por secciones.',
              tone: 'success',
            });
            return;
          } finally {
            window.clearTimeout(fastPathTimeoutId);
          }
        } catch {
          setWritingProcessingProgress((current) => Math.max(current, 74));
          // Reintentamos con el flujo server-side si la ruta rápida no termina correctamente.
        }
      }

      if (file.size <= WRITING_INLINE_EXTRACTION_MAX_BYTES) {
        const fileBuffer = await file.arrayBuffer();
        inlineExtractionBase64 = arrayBufferToBase64(fileBuffer);
      }

      setWritingProcessingProgress((current) => Math.max(current, 18));
      processingTicker = window.setInterval(() => {
        setWritingProcessingProgress((current) => {
          if (current >= 92) {
            return current;
          }
          if (current < 45) {
            return Math.min(92, current + 7);
          }
          if (current < 72) {
            return Math.min(92, current + 4);
          }
          return Math.min(92, current + 2);
        });
      }, 800);
      controller = new AbortController();
      timeoutId = window.setTimeout(() => controller?.abort(), WRITING_EXTRACTION_REQUEST_TIMEOUT_MS);

      const response = await fetch('/api/course-writing', {
        method: 'POST',
        credentials: 'same-origin',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          action: 'extract-upload',
          courseSlug: currentCourse.slug,
          productId: selectedWritingProduct.id,
          asset: uploadedAsset,
          extractedTextOverride,
          assetContentBase64: inlineExtractionBase64,
        }),
      });
      setWritingProcessingProgress(72);

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; warning?: string; product?: CourseProduct }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? 'No fue posible digitalizar el producto cargado.');
      }

      if (payload?.product) {
        const normalized = normalizeWritingDraft(payload.product);
        setWritingDraft(normalized);
        if (!payload?.warning) {
          const completedSections = countFilledWritingSections(normalized.sections);
          void showAlert({
            title: 'Documento procesado',
            message:
              completedSections > 0
                ? `Digitalización completa. ${completedSections}/${normalized.sections.length} secciones quedaron con contenido editable.`
                : 'Digitalización completa. Revisa y ajusta el contenido por secciones.',
            tone: 'success',
          });
        }
      }
      if (payload?.warning) {
        setWritingError(payload.warning);
      }
      setWritingProcessingProgress(100);
      completed = true;

      refreshAppData();
    } catch (error) {
      if (uploadedAsset) {
        updateWritingDraft((current) => ({
          ...current,
          mode: 'upload',
          submittedAsset: uploadedAsset ?? current.submittedAsset,
        }));
      }

      if (error instanceof Error && error.name === 'AbortError') {
        setWritingError(
          'La digitalización tardó más de lo esperado. El archivo quedó cargado y puedes continuar editando por secciones.',
        );
        return;
      }

      setWritingError(
        error instanceof Error ? error.message : 'No fue posible digitalizar el producto cargado.',
      );
    } finally {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      if (processingTicker !== null) {
        window.clearInterval(processingTicker);
      }
      setIsWritingExtracting(false);
      if (!completed) {
        setWritingUploadProgress(0);
        setWritingProcessingProgress(0);
      }
    }
  }

  async function handleResetWritingUploadProcess() {
    if (!selectedWritingProduct || !writingDraft) {
      return;
    }

    const confirmed = await showConfirm({
      title: 'Reiniciar proceso de carga',
      message:
        'Se limpiará el texto digitalizado y las secciones volverán a estado pendiente para que cargues un nuevo documento.',
      tone: 'warning',
      confirmLabel: 'Reiniciar',
      cancelLabel: 'Cancelar',
    });

    if (!confirmed) {
      return;
    }

    setWritingError(null);
    setIsWritingSaving(true);

    try {
      const clearedSections = writingDraft.sections.map((section) => ({
        ...section,
        content: '',
        updatedAt: undefined,
      }));

      const savedDraft = await saveWritingDraftToServer(
        {
          ...writingDraft,
          submittedAsset: null,
          extractedText: '',
          draftText: '',
          sections: clearedSections,
        },
        {
          fallbackError: 'No fue posible reiniciar el proceso de carga.',
          timeoutMs: WRITING_SAVE_REQUEST_TIMEOUT_MS,
        },
      );

      if (savedDraft) {
        setWritingDraft(savedDraft);
      }

      setWritingUploadProgress(0);
      setWritingProcessingProgress(0);
      refreshAppData();

      void showAlert({
        title: 'Proceso reiniciado',
        message: 'Ya puedes cargar un nuevo documento para digitalizar.',
        tone: 'success',
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setWritingError('El reinicio tardó demasiado. Intenta nuevamente en unos segundos.');
        return;
      }
      setWritingError(
        error instanceof Error ? error.message : 'No fue posible reiniciar el proceso de carga.',
      );
    } finally {
      setIsWritingSaving(false);
    }
  }

  async function handleWritingSupportUpload(files: FileList | null) {
    if (!selectedWritingProduct || !writingDraft || !files?.length) {
      return;
    }

    setWritingError(null);
    setIsWritingUploadingSupport(true);
    setWritingKnowledgeProgress(0);

    try {
      const incomingFiles = Array.from(files);
      const currentSourceCount =
        writingDraft.supportAssets.length + writingDraft.libraryResourceIds.length;

      if (currentSourceCount + incomingFiles.length > 10) {
        throw new Error('Puedes trabajar con máximo 10 fuentes de conocimiento por producto.');
      }

      const uploadedAssets: ProductWritingAsset[] = [];

      for (let index = 0; index < incomingFiles.length; index += 1) {
        const file = incomingFiles[index];
        const asset = await uploadFileToR2WithProgress(
          file,
          `${currentCourse.slug}-knowledge`,
          (progress) => {
            const stepBase = (index / incomingFiles.length) * 100;
            const stepProgress = progress / incomingFiles.length;
            setWritingKnowledgeProgress(Math.round(Math.min(100, stepBase + stepProgress)));
          },
        );
        uploadedAssets.push(asset);
      }

      const nextSupportAssets = [...writingDraft.supportAssets, ...uploadedAssets];
      const savedDraft = await saveWritingDraftToServer(
        {
          ...writingDraft,
          mode: 'ai',
          supportAssets: nextSupportAssets,
        },
        {
          fallbackError: 'No fue posible guardar los documentos de apoyo.',
          timeoutMs: WRITING_SAVE_REQUEST_TIMEOUT_MS,
        },
      );

      if (savedDraft) {
        setWritingDraft(savedDraft);
      }
      setWritingKnowledgeProgress(100);

      refreshAppData();
    } catch (error) {
      setWritingError(
        error instanceof Error ? error.message : 'No fue posible cargar los documentos de apoyo.',
      );
    } finally {
      setIsWritingUploadingSupport(false);
    }
  }

  async function handleGenerateWritingSection(section: ProductWritingSection) {
    if (!selectedWritingProduct || !writingDraft) {
      return;
    }

    setWritingError(null);
    setWritingGeneratingSectionId(section.id);

    try {
      let payload: { error?: string; product?: CourseProduct } | null = null;
      for (let attempt = 1; attempt <= WRITING_AI_GENERATION_MAX_ATTEMPTS; attempt += 1) {
        try {
          payload = await requestWritingSectionGeneration(section, {
            supportAssets: attempt >= 2 ? [] : writingDraft.supportAssets,
            libraryResourceIds: attempt >= 2 ? [] : writingDraft.libraryResourceIds,
            timeoutMs: Math.round(
              WRITING_AI_GENERATION_REQUEST_TIMEOUT_MS * (attempt >= 2 ? 0.8 : 1),
            ),
          });
          break;
        } catch (rawError) {
          const error = rawError as Error & { retryable?: boolean };
          const canRetry =
            error.retryable !== false && attempt < WRITING_AI_GENERATION_MAX_ATTEMPTS;
          if (!canRetry) {
            throw error;
          }
          await sleep(WRITING_AI_RETRY_DELAYS_MS[Math.min(attempt - 1, WRITING_AI_RETRY_DELAYS_MS.length - 1)]);
        }
      }

      if (payload?.product) {
        setWritingDraft(normalizeWritingDraft(payload.product));
      }

      refreshAppData();
      void showAlert({
        title: 'Sección generada',
        message: `La sección "${section.title}" quedó actualizada.`,
        tone: 'success',
      });
    } catch (error) {
      setWritingError(
        error instanceof Error ? error.message : `No fue posible generar "${section.title}".`,
      );
    } finally {
      setWritingGeneratingSectionId(null);
    }
  }

  function renderWritingEditorBody(isDedicatedWorkspace: boolean) {
    if (!selectedWritingProduct || !writingDraft) {
      return null;
    }

    const filledSections = countFilledWritingSections(writingDraft.sections);
    const totalSections = writingDraft.sections.length;
    const pendingSections = Math.max(0, totalSections - filledSections);
    const isWritingReadyForValidation = totalSections > 0 && pendingSections === 0;
    const totalKnowledgeSources =
      writingDraft.supportAssets.length + writingDraft.libraryResourceIds.length;
    const suggestedWritingPrompt = buildSuggestedWritingPrompt(
      selectedWritingProduct,
      writingDraft.sections,
    );
    const aiPromptValue = writingDraft.aiPrompt?.trim() || suggestedWritingPrompt;
    const activeWritingMode = activeWritingRoute;
    const generatingSectionTitle =
      writingDraft.sections.find((section) => section.id === writingGeneratingSectionId)?.title ?? '';
    const generationCompletionRatio =
      totalSections > 0 ? Math.round((filledSections / totalSections) * 100) : 0;

    const renderStepBadge = (status: 'done' | 'active' | 'pending') => {
      if (status === 'done') {
        return <span className="badge badge--sage">Listo</span>;
      }
      if (status === 'active') {
        return <span className="badge badge--ocean">En curso</span>;
      }
      return <span className="badge badge--outline">Pendiente</span>;
    };

    const renderStepList = (
      steps: Array<{
        key: string;
        title: string;
        detail: string;
        status: 'done' | 'active' | 'pending';
        progress?: number;
      }>,
    ) => (
      <div className="writing-steps">
        {steps.map((step, index) => (
          <article key={step.key} className={`writing-step writing-step--${step.status}`}>
            <div className="writing-step__head">
              <span className="writing-step__index">Paso {index + 1}</span>
              {renderStepBadge(step.status)}
            </div>
            <strong>{step.title}</strong>
            <p>{step.detail}</p>
            {typeof step.progress === 'number' ? (
              <div className="writing-progress-wrap">
                <div className="writing-progress">
                  <div className="writing-progress__bar" style={{ width: `${Math.max(0, Math.min(100, step.progress))}%` }} />
                </div>
                <span className="writing-progress__value">{Math.max(0, Math.min(100, Math.round(step.progress)))}%</span>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    );

    const renderSectionEditors = (options?: {
      modeLabel?: string;
      allowGenerate?: boolean;
    }) => {
      const activeSection =
        writingDraft.sections.find((section) => section.id === activeWritingSectionTab) ??
        writingDraft.sections[0];

      if (!activeSection) {
        return null;
      }

      return (
        <div className="writing-structured-workspace">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Documento online</span>
              <h4>Estructura editable del producto</h4>
            </div>
            <span className="badge badge--outline">
              {filledSections}/{totalSections} secciones con contenido
            </span>
          </div>
          <p className="field-help">
            {options?.modeLabel
              ? `Trabaja este producto desde la opción "${options.modeLabel}" siguiendo cada sección explícita.`
              : 'Edita el producto por secciones explícitas según su estructura de trabajo.'}
          </p>

          <div className="writing-section-tabs" role="tablist" aria-label="Secciones del producto">
            {writingDraft.sections.map((section, index) => {
              const isActive = section.id === activeSection.id;
              const isFilled = stripHtmlToText(section.content).trim().length > 0;

              return (
                <button
                  key={section.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`writing-section-tab ${isActive ? 'is-active' : ''}`}
                  onClick={() => setActiveWritingSectionTab(section.id)}
                >
                  <span className="writing-section-tab__index">Sección {index + 1}</span>
                  <strong>{section.title}</strong>
                  <small>{isFilled ? 'Con contenido' : 'Pendiente'}</small>
                </button>
              );
            })}
          </div>

          <article className="writing-structured-card writing-structured-card--active-tab">
            <div className="writing-structured-card__head">
              <div>
                <span className="eyebrow">Sección activa</span>
                <h4>{activeSection.title}</h4>
              </div>
              {options?.allowGenerate && canEditSelectedWritingProduct ? (
                <button
                  type="button"
                  className="ghost-button"
                  disabled={writingGeneratingSectionId === activeSection.id || isWritingGeneratingAll}
                  onClick={() => void handleGenerateWritingSection(activeSection)}
                >
                  <Sparkles size={16} />
                  <span>
                    {writingGeneratingSectionId === activeSection.id ? 'Generando…' : 'Generar sección'}
                  </span>
                </button>
              ) : null}
            </div>
            <RichTextEditor
              value={activeSection.content}
              onChange={(value) => updateWritingSection(activeSection.id, 'content', value)}
              placeholder={`Desarrolla aquí la sección "${activeSection.title}".`}
              minHeight={280}
            />
          </article>
        </div>
      );
    };

    const uploadSteps = [
      {
        key: 'upload',
        title: 'Cargar documento',
        detail: writingDraft.submittedAsset
          ? writingDraft.submittedAsset.name
          : 'Sube un .docx o .pdf a R2 con indicador de progreso.',
        status: writingDraft.submittedAsset
          ? ('done' as const)
          : isWritingExtracting
            ? ('active' as const)
            : ('pending' as const),
        progress: writingDraft.submittedAsset ? 100 : writingUploadProgress,
      },
      {
        key: 'process',
        title: 'Procesar documento',
        detail:
          writingDraft.extractedText || filledSections > 0
            ? 'El documento ya fue digitalizado y convertido a texto editable.'
            : isWritingExtracting
              ? `Extrayendo contenido y organizando secciones (${Math.max(1, Math.min(99, writingProcessingProgress))}%).`
              : 'El sistema extrae texto procesable para el editor online.',
        status:
          writingDraft.extractedText || filledSections > 0
            ? ('done' as const)
            : isWritingExtracting
              ? ('active' as const)
              : ('pending' as const),
        progress: writingDraft.extractedText || filledSections > 0 ? 100 : writingProcessingProgress,
      },
      {
        key: 'edit',
        title: 'Ver y editar documento',
        detail: filledSections > 0
          ? `${filledSections} de ${totalSections} secciones listas para edición online.`
          : 'Revisa el documento procesado por secciones y ajústalo en línea.',
        status: filledSections > 0 ? ('done' as const) : ('pending' as const),
      },
    ];

    const aiSteps = [
      {
        key: 'sources',
        title: 'Elegir fuentes de conocimiento',
        detail:
          totalKnowledgeSources > 0
            ? `${totalKnowledgeSources}/10 fuentes cargadas o seleccionadas.`
            : 'Combina biblioteca y archivos propios. Máximo 10 fuentes.',
        status:
          totalKnowledgeSources > 0
            ? ('done' as const)
            : isWritingUploadingSupport
              ? ('active' as const)
              : ('pending' as const),
        progress: totalKnowledgeSources > 0 ? 100 : writingKnowledgeProgress,
      },
      {
        key: 'prompt',
        title: 'Configurar prompt',
        detail: aiPromptValue ? 'La IA usará un prompt guiado por instrucciones estructurales.' : 'Agrega o acepta un prompt sugerido.',
        status: aiPromptValue ? ('done' as const) : ('pending' as const),
      },
      {
        key: 'generate',
        title: 'Generar producto',
        detail:
          isWritingGeneratingAll
            ? generatingSectionTitle
              ? `Generando sección "${generatingSectionTitle}" (${Math.max(1, Math.min(99, writingGenerationProgress))}%).`
              : `La IA está construyendo el producto por secciones (${Math.max(1, Math.min(99, writingGenerationProgress))}%).`
            : generationCompletionRatio >= 100
              ? 'La generación por IA completó todas las secciones.'
              : generationCompletionRatio > 0
                ? `Generación parcial completada (${generationCompletionRatio}%). Puedes continuar o reintentar.`
            : 'Genera todas las secciones con base en instrucciones y fuentes.',
        status:
          isWritingGeneratingAll
            ? ('active' as const)
            : generationCompletionRatio >= 100
              ? ('done' as const)
              : ('pending' as const),
        progress: isWritingGeneratingAll
          ? writingGenerationProgress
          : Math.max(writingGenerationProgress, generationCompletionRatio),
      },
      {
        key: 'review',
        title: 'Ver o editar producto',
        detail: `${filledSections}/${totalSections} secciones disponibles para revisión y ajuste.`,
        status:
          filledSections === totalSections && totalSections > 0
            ? ('done' as const)
            : filledSections > 0
              ? ('active' as const)
              : ('pending' as const),
      },
    ];

    const manualSteps = [
      {
        key: 'structure',
        title: 'Revisar estructura',
        detail: `${totalSections} secciones explícitas detectadas para este producto.`,
        status: ('done' as const),
      },
      {
        key: 'draft',
        title: 'Redactar por secciones',
        detail:
          filledSections > 0
            ? `${filledSections} secciones ya tienen contenido en borrador.`
            : 'Redacta el producto sección por sección siguiendo las instrucciones.',
        status: filledSections > 0 ? ('active' as const) : ('pending' as const),
      },
      {
        key: 'review',
        title: 'Revisar documento final',
        detail:
          filledSections === totalSections && totalSections > 0
            ? 'Todas las secciones quedaron diligenciadas para revisión.'
            : 'Completa las secciones necesarias antes de revisión final.',
        status:
          filledSections === totalSections && totalSections > 0
            ? ('done' as const)
            : ('pending' as const),
      },
    ];

    const writingModes: Array<{
      id: ProductWritingData['mode'];
      title: string;
      eyebrow: string;
      description: string;
      steps: string[];
    }> = [
      {
        id: 'upload',
        title: 'Subir producto',
        eyebrow: 'Opción 1',
        description: 'Carga un archivo real, deja que el sistema lo procese y luego edítalo online por secciones.',
        steps: ['Cargar', 'Procesar', 'Editar'],
      },
      {
        id: 'ai',
        title: 'Generarlo con IA',
        eyebrow: 'Opción 2',
        description: 'Usa fuentes de conocimiento y un prompt guiado para construir el producto por partes.',
        steps: ['Fuentes', 'Prompt', 'Generar', 'Editar'],
      },
      {
        id: 'manual',
        title: 'Redactar desde 0',
        eyebrow: 'Opción 3',
        description: 'Redacta el producto desde cero con una estructura explícita derivada de sus instrucciones.',
        steps: ['Estructura', 'Redacción', 'Revisión'],
      },
    ];
    const activeModeDefinition =
      writingModes.find((mode) => mode.id === activeWritingMode) ?? null;

    return (
      <>
        <article className="surface section-card">
          <div className={isDedicatedWorkspace ? 'writing-product-shell__hero' : 'section-heading'}>
            <div>
              <span className="eyebrow">Escritura del producto</span>
              <h3>{selectedWritingProduct.title}</h3>
            </div>
            <div className="writing-product-shell__actions">
              <button
                type="button"
                className={isWritingInstructionsPanelOpen ? 'filter-chip filter-chip--active' : 'filter-chip'}
                onClick={() => setIsWritingInstructionsPanelOpen(true)}
              >
                <BookOpen size={16} />
                <span>Ver instrucciones</span>
              </button>
              <button type="button" className="ghost-button" onClick={closeWritingEditor}>
                <span>{isDedicatedWorkspace ? 'Volver a la bandeja' : 'Volver'}</span>
              </button>
            </div>
          </div>
          <div className="writing-editor__summary">
            <div className="writing-editor__summary-head">
              <span className="badge badge--outline">{selectedWritingProduct.section ?? 'Introducción'}</span>
              <span className="badge badge--outline">{selectedWritingProduct.format}</span>
              <span className={productStatusBadgeClass(selectedWritingProduct.status)}>
                {selectedWritingProduct.status}
              </span>
              <span className={isWritingReadyForValidation ? 'badge badge--sage' : 'badge badge--gold'}>
                {isWritingReadyForValidation
                  ? 'Listo para validar'
                  : `${pendingSections} secciones pendientes`}
              </span>
            </div>
            {renderRichTextContent(
              selectedWritingProduct.summary,
              'Sin descripción del producto.',
              'writing-editor__summary-copy',
            )}
          </div>

          <div className="writing-editor__meta">
            <article className="surface-soft writing-editor__meta-card">
              <span className="eyebrow">Fecha de inicio</span>
              <strong>{getWritingPhase(selectedWritingProduct)?.startDate ? formatDate(getWritingPhase(selectedWritingProduct)?.startDate ?? '') : 'Sin fecha'}</strong>
            </article>
            <article className="surface-soft writing-editor__meta-card">
              <span className="eyebrow">Fecha final</span>
              <strong>{getWritingPhase(selectedWritingProduct)?.endDate ? formatDate(getWritingPhase(selectedWritingProduct)?.endDate ?? '') : 'Sin fecha'}</strong>
            </article>
            <article className="surface-soft writing-editor__meta-card">
              <span className="eyebrow">Responsable</span>
              <strong>{getWritingPhase(selectedWritingProduct)?.assigneeName || 'Sin asignación'}</strong>
            </article>
          </div>

          {writingError ? <p className="form-error">{writingError}</p> : null}

          {!activeWritingMode ? (
            <div className="writing-mode-selector">
              <div className="writing-mode-selector__intro">
                <span className="eyebrow">Elige una ruta de trabajo</span>
                <h4>Selecciona cómo quieres construir este producto</h4>
                <p>
                  Primero elige una de las tres opciones. La experiencia se personalizará por pasos
                  según esa elección y no mostrará información de las demás rutas.
                </p>
              </div>
              <div className="writing-mode-cards">
                {writingModes.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    className={`writing-mode-card writing-mode-card--${mode.id}`}
                    disabled={!canEditSelectedWritingProduct}
                    onClick={() => {
                      navigateWritingModeRoute(mode.id);
                      updateWritingDraft((current) => ({
                        ...current,
                        mode: mode.id,
                      }));
                    }}
                  >
                    <span className="eyebrow">{mode.eyebrow}</span>
                    <strong>{mode.title}</strong>
                    <p>{mode.description}</p>
                    <div className="writing-mode-card__steps">
                      {mode.steps.map((step) => (
                        <span key={step}>{step}</span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="writing-editor__layout writing-editor__layout--solo writing-editor__layout--flow">
              <section className="writing-editor__workspace">
                <article className="surface-soft writing-mode-active">
                  <div>
                    <span className="eyebrow">{activeModeDefinition?.eyebrow ?? 'Ruta activa'}</span>
                    <h4>{activeModeDefinition?.title ?? 'Ruta de trabajo'}</h4>
                    <p>{activeModeDefinition?.description ?? ''}</p>
                  </div>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => navigateWritingModeRoute(null)}
                  >
                    <span>Cambiar opción</span>
                  </button>
                </article>

                {activeWritingMode === 'upload' ? (
                <article className="surface section-card section-card--compact writing-flow-card">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">Opción 1</span>
                      <h4>Subir producto y digitalizar</h4>
                    </div>
                  </div>
                  <p className="field-help">
                    Carga un archivo `.docx` o `.pdf`. El sistema lo almacenará en R2 y lo
                    convertirá a texto editable para revisión posterior.
                  </p>
                  {renderStepList(uploadSteps)}

                  {canEditSelectedWritingProduct ? (
                    <label className="field">
                      <span>Archivo del producto</span>
                      <div className="field__control">
                        <input
                          ref={writingUploadInputRef}
                          type="file"
                          accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          disabled={isWritingExtracting}
                          onChange={(event) => {
                            const input = event.currentTarget;
                            const file = event.target.files?.[0];
                            if (file) {
                              void handleWritingSubmissionUpload(file);
                            }
                            input.value = '';
                          }}
                        />
                      </div>
                    </label>
                  ) : null}

                  {canEditSelectedWritingProduct ? (
                    <div className="writing-upload-actions">
                      <button
                        type="button"
                        className="ghost-button"
                        disabled={isWritingExtracting}
                        onClick={() => writingUploadInputRef.current?.click()}
                      >
                        Cargar nuevo documento
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        disabled={isWritingExtracting || isWritingSaving}
                        onClick={() => void handleResetWritingUploadProcess()}
                      >
                        Reiniciar proceso
                      </button>
                    </div>
                  ) : null}

                  {writingDraft.submittedAsset ? (
                    <div className="writing-editor__asset">
                      <strong>{writingDraft.submittedAsset.name}</strong>
                      <a href={writingDraft.submittedAsset.url} target="_blank" rel="noreferrer">
                        Ver archivo cargado
                      </a>
                    </div>
                  ) : null}

                  {writingDraft.extractedText ? (
                    <article className="surface-soft writing-flow-note">
                      <span className="eyebrow">Texto procesado</span>
                      <p>
                        El archivo ya fue digitalizado. Continúa trabajando su versión online por
                        secciones.
                      </p>
                    </article>
                  ) : null}

                  {renderSectionEditors({
                    modeLabel: 'Subir producto',
                  })}
                </article>
              ) : null}

              {activeWritingMode === 'ai' ? (
                <article className="surface section-card section-card--compact writing-flow-card">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">Opción 2</span>
                      <h4>Generar producto con asistente IA</h4>
                    </div>
                  </div>
                  <p className="field-help">
                    Adjunta documentos base o selecciona recursos de la biblioteca. La IA redacta
                    cada parte usando las instrucciones del producto.
                  </p>
                  {renderStepList(aiSteps)}

                  <div className="writing-step-stage">
                    <div className="section-heading">
                      <div>
                        <span className="eyebrow">Paso 1</span>
                        <h4>Fuentes de conocimiento</h4>
                      </div>
                      <span className="badge badge--outline">{totalKnowledgeSources}/10 fuentes</span>
                    </div>
                    {canEditSelectedWritingProduct ? (
                      <label className="field">
                        <span>Documentos base</span>
                        <div className="field__control">
                          <input
                            type="file"
                            multiple
                            accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            disabled={isWritingUploadingSupport || totalKnowledgeSources >= 10}
                            onChange={(event) => {
                              void handleWritingSupportUpload(event.target.files);
                            }}
                          />
                        </div>
                      </label>
                    ) : null}

                    {writingDraft.supportAssets.length > 0 ? (
                      <div className="tag-token-list">
                        {writingDraft.supportAssets.map((asset) => (
                          <span key={asset.key} className="tag-token">
                            {asset.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="field-help">Todavía no hay documentos base cargados.</p>
                    )}

                    <div className="form-section">
                      <strong>Recursos de biblioteca para la IA</strong>
                      {courseLibraryResources.length > 0 ? (
                        <div className="role-picker-panel">
                          {courseLibraryResources.map((resource) => {
                            const isSelected = writingDraft.libraryResourceIds.includes(resource.id);
                            const disableSelection =
                              !isSelected && totalKnowledgeSources >= 10;

                            return (
                              <label key={resource.id} className="checkbox-card">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  disabled={!canEditSelectedWritingProduct || disableSelection}
                                  onChange={(event) =>
                                    updateWritingDraft((current) => ({
                                      ...current,
                                      libraryResourceIds: event.target.checked
                                        ? [...current.libraryResourceIds, resource.id]
                                        : current.libraryResourceIds.filter((id) => id !== resource.id),
                                    }))
                                  }
                                />
                                <span>
                                  {resource.title} · {resource.unit}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="field-help">No hay recursos de biblioteca vinculados a este curso.</p>
                      )}
                    </div>
                  </div>

                  <div className="writing-step-stage">
                    <div className="section-heading">
                      <div>
                        <span className="eyebrow">Paso 2</span>
                        <h4>Prompt de generación</h4>
                      </div>
                      <button
                        type="button"
                        className="ghost-button"
                        disabled={!canEditSelectedWritingProduct}
                        onClick={() =>
                          updateWritingDraft((current) => ({
                            ...current,
                            aiPrompt: suggestedWritingPrompt,
                          }))
                        }
                      >
                        <span>Usar prompt sugerido</span>
                      </button>
                    </div>
                    <label className="field">
                      <span>Prompt adicional</span>
                      <div className="field__control">
                        <textarea
                          rows={8}
                          value={writingDraft.aiPrompt ?? ''}
                          readOnly={!canEditSelectedWritingProduct}
                          onChange={(event) =>
                            updateWritingDraft((current) => ({
                              ...current,
                              aiPrompt: event.target.value,
                            }))
                          }
                          placeholder={suggestedWritingPrompt}
                        />
                      </div>
                    </label>
                  </div>

                  <div className="writing-step-stage">
                    <div className="section-heading">
                      <div>
                        <span className="eyebrow">Paso 3</span>
                        <h4>Generar producto</h4>
                      </div>
                      {canEditSelectedWritingProduct ? (
                        <button
                          type="button"
                          className="cta-button"
                          disabled={isWritingGeneratingAll}
                          onClick={() => void handleGenerateWritingProduct()}
                        >
                          <Sparkles size={16} />
                          <span>{isWritingGeneratingAll ? 'Generando…' : 'Generar producto'}</span>
                        </button>
                      ) : null}
                    </div>
                    <p className="field-help">
                      La IA generará el producto por secciones, usando fuentes cargadas, recursos
                      de biblioteca y el prompt estructural.
                      {' '}
                      {isWritingGeneratingAll
                        ? `Progreso actual: ${Math.max(1, Math.min(99, Math.round(writingGenerationProgress)))}%.`
                        : writingGenerationProgress > 0
                          ? `Último avance: ${Math.max(0, Math.min(100, Math.round(writingGenerationProgress)))}%.`
                          : ''}
                    </p>
                    <div className="writing-progress">
                      <div className="writing-progress__bar" style={{ width: `${Math.max(0, Math.min(100, writingGenerationProgress))}%` }} />
                    </div>
                  </div>

                  <div className="writing-step-stage">
                    <div className="section-heading">
                      <div>
                        <span className="eyebrow">Paso 4</span>
                        <h4>Ver o editar producto</h4>
                      </div>
                    </div>
                    {renderSectionEditors({
                      modeLabel: 'Generarlo con IA',
                      allowGenerate: true,
                    })}
                  </div>
                </article>
              ) : null}

              {activeWritingMode === 'manual' ? (
                <article className="surface section-card section-card--compact writing-flow-card">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">Opción 3</span>
                      <h4>Redactar desde cero</h4>
                    </div>
                  </div>
                  <p className="field-help">
                    Usa las instrucciones del producto como guía y redacta directamente el producto.
                  </p>
                  {renderStepList(manualSteps)}
                  {renderSectionEditors({
                    modeLabel: 'Redactar desde cero',
                  })}
                </article>
              ) : null}
              </section>
            </div>
          )}

          <div className="writing-editor__footer">
            <button type="button" className="ghost-button" onClick={closeWritingEditor}>
              Volver a la bandeja
            </button>
            {canEditSelectedWritingProduct ? (
              <>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={isWritingSaving || isWritingFinalizing}
                  onClick={() => void handleWritingSave()}
                >
                  <Save size={16} />
                  <span>{isWritingSaving ? 'Guardando…' : 'Guardar escritura'}</span>
                </button>
                <button
                  type="button"
                  className="cta-button"
                  disabled={isWritingSaving || isWritingFinalizing}
                  onClick={() => void handleFinalizeWritingProduct()}
                >
                  <CheckCircle2 size={16} />
                  <span>{isWritingFinalizing ? 'Finalizando…' : 'Finalizar producto'}</span>
                </button>
              </>
            ) : null}
          </div>
        </article>

        <SidePanel
          isOpen={isWritingInstructionsPanelOpen}
          title={selectedWritingProduct.title}
          description="Guía operativa y técnica para desarrollar este producto."
          sideLabel="Guía"
          sideDescription="INSTRUCCIONES"
          width="xl"
          onClose={() => setIsWritingInstructionsPanelOpen(false)}
        >
          <div className="page-stack">
            <article className="surface section-card section-card--compact">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Instrucciones</span>
                  <h4>Guía del producto</h4>
                </div>
              </div>
              {renderInstructionContent(
                selectedWritingProduct.body?.trim() || '',
                'Sin instrucciones del producto.',
                'rich-html--panel rich-html--instruction'
              )}
            </article>
          </div>
        </SidePanel>
      </>
    );
  }

  function renderDedicatedWritingWorkspace() {
    if (activeSection === 'escritura' && writingProductQueryId && isLoading && !selectedWritingProduct) {
      return (
        <section className="page-stack">
          <article className="surface section-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Escritura del producto</span>
                <h3>Preparando editor</h3>
              </div>
            </div>
            <p className="section-lead">
              Estamos cargando el expediente del curso y resolviendo el producto solicitado.
            </p>
          </article>
        </section>
      );
    }

    if (activeSection === 'escritura' && writingProductQueryId && !isLoading && !selectedWritingProduct) {
      return (
        <section className="page-stack">
          <article className="surface empty-state">
            <strong>No fue posible abrir este producto</strong>
            <p>
              El producto solicitado ya no existe, no pertenece a este curso o no tienes acceso a
              su expediente de escritura.
            </p>
            <button type="button" className="cta-button" onClick={closeWritingEditor}>
              <span>Volver a la bandeja</span>
              <MoveRight size={16} />
            </button>
          </article>
        </section>
      );
    }

    if (selectedWritingProduct && !writingDraft) {
      return (
        <section className="page-stack">
          <article className="surface section-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Escritura del producto</span>
                <h3>Abriendo {selectedWritingProduct.title}</h3>
              </div>
            </div>
            <p className="section-lead">
              Estamos preparando el editor, las instrucciones y el estado actual del expediente.
            </p>
          </article>
        </section>
      );
    }

    return (
      <section className="page-stack writing-product-shell">
        {renderWritingEditorBody(true)}
      </section>
    );
  }

  function renderWritingWorkspace() {
    return (
      <section className="page-stack">
        <article className="surface section-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Escritura por producto</span>
              <h3>Cola editorial del experto</h3>
            </div>
          </div>
          <p className="section-lead">
            Aquí aparecen los productos creados en arquitectura y ya planificados para la fase de
            escritura. Se ordenan por fecha final y se presentan como una cola compacta para abrir
            la escritura del producto en una pestaña dedicada.
          </p>
        </article>

        <article className="surface section-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Bandeja</span>
              <h3>{role === 'Experto' ? 'Productos asignados para redactar' : 'Seguimiento de escritura'}</h3>
            </div>
          </div>

          {writingWorkQueue.length === 0 ? (
            <div className="empty-state">
              <strong>No hay productos disponibles en escritura</strong>
              <p>
                {role === 'Experto'
                  ? 'Cuando el coordinador te asigne productos en planeación, aparecerán aquí ordenados por fecha final.'
                  : 'La etapa de escritura mostrará aquí los productos planificados para autoría.'}
              </p>
            </div>
          ) : (
            <div className="writing-queue">
              {writingWorkQueue.map((product) => {
                const writingPhase = getWritingPhase(product);
                const dueLabel = writingPhase?.endDate ? formatDate(writingPhase.endDate) : 'Sin fecha final';
                const startLabel = writingPhase?.startDate ? formatDate(writingPhase.startDate) : 'Sin fecha inicial';
                const assigneeLabel = writingPhase?.assigneeName?.trim() || 'Sin responsable';
                const actionLabel = getWritingActionLabel(product);
                const editorHref = `${buildWritingWorkspacePath(currentCourse.slug, null)}?product=${encodeURIComponent(product.id)}`;

                return (
                  <a
                    key={product.id}
                    href={editorHref}
                    target="_blank"
                    rel="noreferrer"
                    className="writing-queue__item"
                    onClick={() => stashWritingLaunchSnapshot(product)}
                  >
                    <div className="writing-queue__head">
                      <div>
                        <span className="badge badge--outline">{product.section ?? 'Introducción'}</span>
                        <h4>{product.title}</h4>
                      </div>
                      <div className="writing-queue__meta">
                        <span className="badge badge--outline">{product.format}</span>
                        <span className={productStatusBadgeClass(product.status)}>{product.status}</span>
                      </div>
                    </div>

                    <div className="writing-queue__schedule">
                      <div>
                        <span className="eyebrow">Inicio</span>
                        <strong>{startLabel}</strong>
                      </div>
                      <div>
                        <span className="eyebrow">Fecha final</span>
                        <strong>{dueLabel}</strong>
                      </div>
                      <div>
                        <span className="eyebrow">Responsable</span>
                        <strong>{assigneeLabel}</strong>
                      </div>
                    </div>

                    <div className="writing-queue__cta">
                      <span>{actionLabel}</span>
                      <MoveRight size={16} />
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </article>
      </section>
    );
  }

  function updateProductDraft<Key extends keyof CourseProductMutationInput>(
    productId: string,
    key: Key,
    value: CourseProductMutationInput[Key],
  ) {
    setProductDrafts((current) => ({
      ...current,
      [productId]: {
        ...current[productId],
        [key]: value,
      },
    }));
  }

  async function handleStageNoteSave(key: CourseStageNoteKey) {
    const draft = stageNoteDrafts[key];

    if (!draft) {
      return;
    }

    setStageNoteError(null);
    setIsStageNoteSaving(key);

    try {
      const response = await fetch('/api/stage-notes', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          courseSlug: currentCourse.slug,
          key,
          ...draft,
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible guardar la bitácora de etapa.');
      }

      refreshAppData();
    } catch (error) {
      setStageNoteError(
        error instanceof Error ? error.message : 'No fue posible guardar la bitácora de etapa.',
      );
    } finally {
      setIsStageNoteSaving(null);
    }
  }

  function updateStageNoteDraft<Key extends keyof CourseStageNoteMutationInput>(
    noteKey: CourseStageNoteKey,
    key: Key,
    value: CourseStageNoteMutationInput[Key],
  ) {
    setStageNoteDrafts((current) => ({
      ...current,
      [noteKey]: {
        ...current[noteKey],
        [key]: value,
      },
    }));
  }





  function renderStageNoteEditor(
    noteKey: CourseStageNoteKey,
    eyebrow: string,
    title: string,
    description: string,
  ) {
    const note = currentCourse.stageNotes[noteKey];
    const draft = stageNoteDrafts[noteKey];
    const canEdit = canEditStageNote(userRole, note.owner);
    const isEditorOpen = activeModal === `stage-note:${noteKey}`;

    return (
      <>
        <article className="surface section-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{eyebrow}</span>
              <h3>{title}</h3>
            </div>
            <div className="action-row">
              <span className={badgeClass(draft.status)}>{draft.status}</span>
              {canEdit ? (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => openModal(`stage-note:${noteKey}`)}
                >
                  <PencilLine size={16} />
                  <span>Editar bitácora</span>
                </button>
              ) : null}
            </div>
          </div>

          <div className="list-stack">
            <div className="list-item">
              <div>
                <strong>Responsable de etapa</strong>
                <p>{note.owner}</p>
              </div>
              <div className="list-item__meta">
                <span>Último ajuste {formatDate(note.updatedAt)}</span>
                <span>{note.heading}</span>
              </div>
            </div>

            <div className="list-item">
              <div>
                <strong>Lectura operativa</strong>
                <p>{description}</p>
              </div>
              <div className="list-item__meta">
                <span>{draft.evidence.length} evidencias</span>
                <span>{draft.blockers.length} bloqueos</span>
              </div>
            </div>

            <div className="list-item">
              <div>
                <strong>Resumen vigente</strong>
                <p>{draft.summary}</p>
              </div>
            </div>

            <div className="list-item">
              <div>
                <strong>Evidencias</strong>
                <p>{draft.evidence.join(' · ') || 'Sin evidencias registradas todavía.'}</p>
              </div>
            </div>

            <div className="list-item">
              <div>
                <strong>Bloqueos</strong>
                <p>{draft.blockers.join(' · ') || 'Sin bloqueos activos.'}</p>
              </div>
            </div>
          </div>
        </article>

        {canEdit && isEditorOpen ? (
          <SidePanel
            isOpen={canEdit && isEditorOpen}
            title={title}
            description="La bitácora se edita en un panel lateral para preservar el foco de la página principal."
            sideLabel="Ficha"
            sideDescription="OPERATIVA"
            width="xl"
            onClose={closeWorkspaceOverlay}
            footer={
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  className="cta-button"
                  disabled={isStageNoteSaving === noteKey}
                  onClick={() => void handleStageNoteSave(noteKey)}
                >
                  <Save size={16} />
                  <span>{isStageNoteSaving === noteKey ? 'Guardando…' : 'Guardar bitácora'}</span>
                </button>
                <button type="button" className="filter-chip" onClick={closeWorkspaceOverlay}>
                  <span>Cancelar</span>
                </button>
              </div>
            }
          >
            <div className="editor-card editor-card--task modal-stack-clean">
              <div className="form-grid">
                <label className="field">
                  <span>Estado</span>
                  <div className="field__control">
                    <select
                      value={draft.status}
                      onChange={(event) =>
                        updateStageNoteDraft(
                          noteKey,
                          'status',
                          event.target.value as CourseStageNoteMutationInput['status'],
                        )
                      }
                    >
                      {['Pendiente', 'En curso', 'Listo'].map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>

                <label className="field field--full">
                  <span>Resumen</span>
                  <div className="field__control field__control--textarea">
                    <textarea
                      rows={4}
                      value={draft.summary}
                      onChange={(event) => updateStageNoteDraft(noteKey, 'summary', event.target.value)}
                    />
                  </div>
                </label>

                <label className="field field--full">
                  <span>Evidencias</span>
                  <div className="field__control field__control--textarea">
                    <textarea
                      rows={4}
                      value={joinLines(draft.evidence)}
                      onChange={(event) =>
                        updateStageNoteDraft(noteKey, 'evidence', splitLines(event.target.value))
                      }
                      placeholder="Una evidencia por línea"
                    />
                  </div>
                </label>

                <label className="field field--full">
                  <span>Bloqueos o dependencias</span>
                  <div className="field__control field__control--textarea">
                    <textarea
                      rows={3}
                      value={joinLines(draft.blockers)}
                      onChange={(event) =>
                        updateStageNoteDraft(noteKey, 'blockers', splitLines(event.target.value))
                      }
                      placeholder="Un bloqueo por línea"
                    />
                  </div>
                </label>
              </div>

              {stageNoteError && isStageNoteSaving === null ? (
                <p className="form-error">{stageNoteError}</p>
              ) : null}
            </div>
          </SidePanel>
        ) : null}
      </>
    );
  }

  async function handleMicroFileDelete() {
    if (!uploadedFile) return;
    try {
      await fetch(`/api/files?key=${encodeURIComponent(uploadedFile.key)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      setUploadedFile(null);
      setMicroStep(1);
    } catch (error) {
      console.error('Delete error:', error);
    }
  }

  async function handleMicroAnalysis() {
    if (!uploadedFile) return;
    setIsAnalyzing(true);
    setAnalysisProgress(5);
    setAnalysisStatus('Estableciendo conexión segura...');
    
    try {
      const response = await fetch('/api/analyze-microcurriculo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: uploadedFile.key }),
      });

      if (!response.ok || !response.body) {
        throw new Error('El servidor devolvió un error inesperado al conectar el stream de datos.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const messages = buffer.split('\n\n');
        buffer = messages.pop() || ''; 

        for (const msg of messages) {
          if (msg.startsWith('data: ')) {
            const payload = JSON.parse(msg.substring(6));
            
            if (payload.error) throw new Error(payload.error);
            
            if (payload.complete || payload.progress === 100) {
              setAnalysisResult(payload.data);
              setMicroStep(3);
            } else if (payload.progress) {
              setAnalysisProgress(payload.progress);
              setAnalysisStatus(payload.step);
            }
          }
        }
      }
    } catch (error) {
      showAlert({
        title: 'Error de Análisis',
        message: error instanceof Error ? error.message : 'No fue posible analizar el archivo.',
        tone: 'error'
      });
      setMicroStep(1);
    } finally {
      setIsAnalyzing(false);
    }
  }

  function renderMicrocurriculoWizard() {
    if (!course) return null;

    if (!canOperateMicrocurriculo) {
      return (
        <div className="surface section-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Microcurrículo</span>
              <h3>Consulta del Microcurrículo</h3>
            </div>
            <span className="badge badge--outline">Solo lectura</span>
          </div>

          <div className="empty-state">
            <strong>El análisis y la edición están restringidos</strong>
            <p>
              Solo el coordinador o el administrador pueden ejecutar análisis, revisar archivos y
              editar la información extraída. Desde este rol puedes consultar el microcurrículo ya
              consolidado.
            </p>
            <button
              type="button"
              className="ghost-button"
              onClick={() => setIsVerifyingAnalysis(true)}
              disabled={!analysisResult}
            >
              <Search size={16} />
              <span>Ver microcurrículo</span>
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="surface section-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Paso {microStep} de 3</span>
            <h3>Configuración del Microcurrículo</h3>
          </div>
          <div className="wizard-stepper">
            <button 
              type="button"
              className={`step-dot ${microStep >= 1 ? 'is-active' : ''} cursor-pointer transition-transform hover:scale-110`} 
              onClick={() => setMicroStep(1)} 
            />
            <div className={`step-line ${microStep >= 2 ? 'is-active' : ''}`} />
            <button 
              type="button"
              className={`step-dot ${microStep >= 2 ? 'is-active' : ''} ${uploadedFile ? 'cursor-pointer transition-transform hover:scale-110' : 'opacity-50 cursor-not-allowed'}`} 
              disabled={!uploadedFile}
              onClick={() => { if (uploadedFile) setMicroStep(2); }} 
            />
            <div className={`step-line ${microStep >= 3 ? 'is-active' : ''}`} />
            <button 
              type="button"
              className={`step-dot ${microStep >= 3 ? 'is-active' : ''} ${analysisResult ? 'cursor-pointer transition-transform hover:scale-110' : 'opacity-50 cursor-not-allowed'}`} 
              disabled={!analysisResult}
              onClick={() => { if (analysisResult) setMicroStep(3); }} 
            />
          </div>
        </div>

        <div className="wizard-content py-8">
          {microStep === 1 && (
            <div className="assistant-dropzone">
              <input
                type="file"
                id="micro-upload"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  const formData = new FormData();
                  formData.append('file', file);
                  formData.append('scope', 'course');
                  formData.append('folder', course.slug);

                  try {
                    setIsAnalyzing(true);
                    const res = await fetch('/api/uploads', {
                      method: 'POST',
                      body: formData
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error);
                    
                    setUploadedFile({ url: data.url, key: data.key });
                    setMicroStep(2);
                  } catch (err: any) {
                    showAlert({ title: 'Error de Carga', message: err.message, tone: 'error' });
                  } finally {
                    setIsAnalyzing(false);
                  }
                }}
              />
              <label htmlFor="micro-upload" className="dropzone-label">
                <div className="dropzone-icon">
                  <FileUp size={48} className="text-ocean" />
                </div>
                <strong>Arrastre aquí o cargue el microcurrículo del curso</strong>
                <p className="text-muted text-sm mt-2">Soporta PDF, Word (DOC/DOCX) y Excel (XLS/XLSX)</p>
              </label>
            </div>
          )}

          {microStep === 2 && uploadedFile && (
            <div className="analysis-board">
              <div className="analysis-card">
                <FileText size={32} className="text-ocean" />
                <div className="flex-1">
                  <strong>Documento cargado correctamente</strong>
                  <p className="text-xs text-muted font-mono">{uploadedFile.key.split('/').pop()}</p>
                </div>
                <button className="danger-button danger-button--ghost" onClick={handleMicroFileDelete}>
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="flex flex-col items-center justify-center py-12 gap-6 w-full">
                {analysisResult && !isAnalyzing ? (
                  <div className="w-full max-w-sm mb-4 animate-in fade-in py-6 px-4 bg-sage/10 rounded-xl border border-sage/20 text-center flex flex-col items-center">
                    <CheckCircle2 size={32} className="mb-2 text-sage" />
                    <strong className="text-secondary text-lg">Análisis estructurado listo</strong>
                    <p className="text-sm text-muted mt-1 mb-6">El documento ya fue analizado previamente.</p>
                    <button className="cta-button w-full justify-center" onClick={() => setMicroStep(3)}>
                      Continuar a revisión final <MoveRight size={16} className="ml-2" />
                    </button>
                    <button className="ghost-button w-full justify-center mt-3 text-xs" onClick={handleMicroAnalysis}>
                      <RefreshCcw size={14} className="mr-1 inline-block" /> Extraer de nuevo
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-center text-muted max-w-md">
                      {isAnalyzing ? 'El sistema está procesando el archivo en tiempo real. Por favor, manten la ventana abierta.' : 'El asistente de IA está listo para extraer la información académica, resultados de aprendizaje y unidades del documento.'}
                    </p>
                    
                    {isAnalyzing && (
                      <div className="w-full max-w-sm mb-2 animate-in fade-in duration-500">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-ocean font-medium">{analysisStatus}</span>
                          <span className="text-ocean font-bold">{analysisProgress}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                          <div 
                            className="bg-ocean h-full rounded-full transition-all duration-300 ease-out" 
                            style={{ width: `${analysisProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    
                    <button 
                      className="cta-button cta-button--large outline-none" 
                      onClick={handleMicroAnalysis}
                      disabled={isAnalyzing}
                    >
                      {isAnalyzing ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                      <span>{isAnalyzing ? analysisStatus : 'Importar y Analizar Datos'}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {microStep === 3 && analysisResult && (
            <div className="success-board flex items-center justify-center min-h-[400px] w-full bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="flex flex-col items-center justify-center py-12 gap-5 w-full max-w-md animate-in zoom-in-95 duration-500">
                <div className="flex justify-center w-full mb-2">
                  <div className="relative">
                    <div className="absolute inset-0 bg-sage rounded-full opacity-20 animate-ping"></div>
                    <CheckCircle2 size={96} className="text-sage relative z-10 animate-bounce" />
                  </div>
                </div>
                <div className="text-center">
                  <h4 className="text-2xl text-secondary mb-2">Análisis Completado</h4>
                  <p className="text-muted leading-relaxed">Se ha extraído, depurado y validado la información académica del microcurrículo exitosamente.</p>
                </div>
                <div className="flex gap-4 mt-6">
                   <button 
                     className="ghost-button" 
                     onClick={async () => {
                       const confirmed = await showConfirm({
                         title: 'Reiniciar Análisis',
                         message: 'El análisis actual se eliminará de forma permanente y se iniciará un proceso nuevo en el paso 1. ¿Estás seguro que deseas continuar?',
                         confirmLabel: 'Aceptar',
                         tone: 'warning'
                       });
                       if (confirmed) {
                         setHasRestartedAnalysis(true);
                         setMicroStep(1);
                         setAnalysisResult(null);
                         setUploadedFile(null);
                       }
                     }}
                   >
                    Reiniciar análisis
                  </button>
                   <button className="ghost-button" onClick={() => setMicroStep(2)}>
                    Revisar archivo
                  </button>
                  <button className="cta-button" onClick={() => setIsVerifyingAnalysis(true)}>
                    <Search size={16} />
                    <span>Verificar / Editar Información</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderProductStudio(
    productStage: CourseProductStage,
    eyebrow: string,
    title: string,
    description: string,
  ) {
    const stageProducts = currentCourse.products.filter((product) => product.stage === productStage);
    const stageFormats = productFormatsForStage(productStage);
    const overlayId = `products:${productStage}`;
    const isOverlayOpen = activeModal === overlayId;
    const isComposerOpen = isOverlayOpen && productComposerStage === productStage;
    const stageApprovedCount = stageProducts.filter((product) => product.status === 'Aprobado').length;
    const validationChecklistCompleted = stageProducts.reduce(
      (sum, product) =>
        sum +
        (getValidationData(product).checklist.filter((item) => item.status === 'Cumple').length),
      0,
    );
    const validationChecklistTotal = stageProducts.reduce(
      (sum, product) => sum + getValidationData(product).checklist.length,
      0,
    );
    const validationOpenComments = stageProducts.reduce(
      (sum, product) =>
        sum + getValidationData(product).comments.filter((comment) => comment.status === 'Abierto').length,
      0,
    );

    return (
      <>
        <article className="surface section-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{eyebrow}</span>
              <h3>{title}</h3>
            </div>
            <div className="action-row">
              {canCreateCourseProducts(userRole, productStage) ? (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    setProductError(null);
                    setProductComposerStage(null);
                    openModal(overlayId);
                  }}
                >
                  <PencilLine size={16} />
                  <span>Gestionar productos</span>
                </button>
              ) : null}
              <span className="badge badge--outline">
                {stageApprovedCount}/{stageProducts.length} aprobados
              </span>
            </div>
          </div>

          <p className="handoff-copy">{description}</p>

          <div className="module-grid module-grid--summary">
            <div className="module-card">
              <div className="module-card__top">
                <strong>{stageProducts.length}</strong>
                <span>productos</span>
              </div>
              <p>Esta etapa produce artefactos editables y trazables dentro del expediente del curso.</p>
            </div>

            <div className="module-card">
              <div className="module-card__top">
                <strong>{stageApprovedCount}</strong>
                <span>aprobados</span>
              </div>
              <p>La validación queda registrada por versión, responsable y estado del contenido.</p>
            </div>

            {productStage === 'validacion' ? (
              <>
                <div className="module-card">
                  <div className="module-card__top">
                    <strong>{validationChecklistCompleted}/{validationChecklistTotal}</strong>
                    <span>criterios</span>
                  </div>
                  <p>Checklist de validación instruccional por producto.</p>
                </div>
                <div className="module-card">
                  <div className="module-card__top">
                    <strong>{validationOpenComments}</strong>
                    <span>comentarios</span>
                  </div>
                  <p>Observaciones ancladas a fragmentos concretos del producto.</p>
                </div>
              </>
            ) : null}
          </div>

          <div className="list-stack">
            {stageProducts.length === 0 ? (
              <div className="empty-state">
                <strong>Sin productos registrados en esta etapa</strong>
                <p>Cuando el equipo empiece a producir artefactos, aparecerán aquí como resumen compacto.</p>
              </div>
            ) : (
              stageProducts.map((product) => (
                <div key={product.id} className="list-item">
                  <div>
                    <span className={productStatusBadgeClass(product.status)}>{product.status}</span>
                    <strong>{product.title}</strong>
                    <p>{stripHtmlToText(product.summary)}</p>
                  </div>
                  <div className="list-item__meta">
                    <span>{product.owner}</span>
                    <span>{product.version}</span>
                    <span>{product.format}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        {isOverlayOpen ? (
          <SidePanel
            isOpen={isOverlayOpen}
            title={title}
            description="La edición detallada de productos vive en un panel lateral para mantener limpia la vista operativa."
            sideLabel="Prod"
            sideDescription="ESTUDIO"
            width="xl"
            onClose={closeWorkspaceOverlay}
          >
            <div className="page-stack modal-stack-clean">
              {canCreateCourseProducts(userRole, productStage) ? (
                <div className="toolbar-header">
                  <button
                    type="button"
                    className={isComposerOpen ? 'filter-chip filter-chip--active' : 'filter-chip'}
                    onClick={() => toggleProductComposer(productStage)}
                  >
                    <Plus size={16} />
                    <span>{isComposerOpen ? 'Cerrar formulario' : 'Nuevo producto'}</span>
                  </button>
                </div>
              ) : null}

              {isComposerOpen ? (
                <form className="editor-card editor-card--task" onSubmit={handleProductCreate}>
                  {productStage === 'arquitectura' ? (
                    <>
                      <div className="surface-muted product-guide">
                        <div className="section-heading section-heading--compact">
                          <div>
                            <span className="eyebrow">Producto base</span>
                            <h3>Arquitectura lista para trazabilidad</h3>
                          </div>
                        </div>
                        <p className="handoff-copy">
                          Cada producto de arquitectura define una pieza trazable del curso. Luego podrás
                          asignarle responsables, fechas y seguimiento independiente en las etapas
                          siguientes.
                        </p>
                      </div>

                      <div className="form-grid">
                        <label className="field">
                          <span>Sección</span>
                          <div className="field__control">
                            <select
                              value={newProductForm.section ?? architectureSectionOptions[0] ?? 'Introducción'}
                              onChange={(event) =>
                                setNewProductForm((current) => ({
                                  ...current,
                                  stage: productStage,
                                  section: event.target.value,
                                }))
                              }
                            >
                              {architectureSectionOptions.map((item) => (
                                <option key={item} value={item}>
                                  {item}
                                </option>
                              ))}
                            </select>
                          </div>
                        </label>

                        <label className="field">
                          <span>Formato</span>
                          <div className="field__control">
                            <select
                              value={newProductForm.format}
                              onChange={(event) =>
                                setNewProductForm((current) => ({
                                  ...current,
                                  stage: productStage,
                                  format: event.target.value as CourseProductMutationInput['format'],
                                }))
                              }
                            >
                              {stageFormats.map((item) => (
                                <option key={item} value={item}>
                                  {item}
                                </option>
                              ))}
                            </select>
                          </div>
                        </label>

                        <label className="field field--full">
                          <span>Nombre del producto</span>
                          <div className="field__control">
                            <input
                              value={newProductForm.title}
                              onChange={(event) =>
                                setNewProductForm((current) => ({
                                  ...current,
                                  title: event.target.value,
                                }))
                              }
                              placeholder="Ej: Video de bienvenida, guía de aprendizaje, lectura base..."
                              required
                            />
                          </div>
                        </label>

                        <label className="field field--full">
                          <span>Descripción</span>
                          <RichTextEditor
                            value={newProductForm.summary}
                            onChange={(value) =>
                              setNewProductForm((current) => ({
                                ...current,
                                stage: productStage,
                                summary: value,
                              }))
                            }
                            placeholder="Describe qué es este producto y cuál es su propósito dentro del curso."
                            minHeight={180}
                          />
                        </label>
                      </div>
                    </>
                  ) : (
                    <>
                      {renderProductSupportPanel(newProductForm, () => applyTemplateToComposer(productStage))}
                      {renderStructuredProductEditor(newProductForm, (patch) =>
                        setNewProductForm((current) => ({
                          ...current,
                          stage: productStage,
                          ...patch,
                        }))
                      )}

                      <div className="form-grid">
                        <label className="field">
                          <span>Título</span>
                          <div className="field__control">
                            <input
                              value={newProductForm.title}
                              onChange={(event) =>
                                setNewProductForm((current) => ({
                                  ...current,
                                  title: event.target.value,
                                }))
                              }
                              required
                            />
                          </div>
                        </label>

                        <label className="field">
                          <span>Formato</span>
                          <div className="field__control">
                            <select
                              value={newProductForm.format}
                              onChange={(event) =>
                                setNewProductForm((current) => ({
                                  ...current,
                                  stage: productStage,
                                  format: event.target.value as CourseProductMutationInput['format'],
                                }))
                              }
                            >
                              {stageFormats.map((item) => (
                                <option key={item} value={item}>
                                  {item}
                                </option>
                              ))}
                            </select>
                          </div>
                        </label>

                        <label className="field">
                          <span>Responsable</span>
                          <div className="field__control">
                            <select
                              value={newProductForm.owner}
                              onChange={(event) =>
                                setNewProductForm((current) => ({
                                  ...current,
                                  stage: productStage,
                                  owner: event.target.value as Role,
                                }))
                              }
                            >
                              {appData.roles.map((item) => (
                                <option key={item} value={item}>
                                  {item}
                                </option>
                              ))}
                            </select>
                          </div>
                        </label>

                        <label className="field">
                          <span>Estado</span>
                          <div className="field__control">
                            <select
                              value={newProductForm.status}
                              onChange={(event) =>
                                setNewProductForm((current) => ({
                                  ...current,
                                  stage: productStage,
                                  status: event.target.value as CourseProductMutationInput['status'],
                                }))
                              }
                            >
                              {['Borrador', 'En revisión', 'Aprobado'].map((item) => (
                                <option key={item} value={item}>
                                  {item}
                                </option>
                              ))}
                            </select>
                          </div>
                        </label>

                        <label className="field">
                          <span>Versión</span>
                          <div className="field__control">
                            <input
                              value={newProductForm.version}
                              onChange={(event) =>
                                setNewProductForm((current) => ({
                                  ...current,
                                  stage: productStage,
                                  version: event.target.value,
                                }))
                              }
                              required
                            />
                          </div>
                        </label>

                        <label className="field field--full">
                          <span>Etiquetas</span>
                          <div className="field__control">
                            <input
                              value={joinTags(newProductForm.tags)}
                              onChange={(event) =>
                                setNewProductForm((current) => ({
                                  ...current,
                                  stage: productStage,
                                  tags: splitTags(event.target.value),
                                }))
                              }
                              placeholder="sílabus, currículo, recursos"
                            />
                          </div>
                        </label>

                        <label className="field field--full">
                          <span>Descripción</span>
                          <RichTextEditor
                            value={newProductForm.summary}
                            onChange={(value) =>
                              setNewProductForm((current) => ({
                                ...current,
                                stage: productStage,
                                summary: value,
                              }))
                            }
                            placeholder="Describe el producto y su propósito dentro del curso."
                            minHeight={180}
                          />
                        </label>

                        <label className="field field--full">
                          <span>Instrucciones</span>
                          <RichTextEditor
                            value={newProductForm.body}
                            onChange={(value) =>
                              setNewProductForm((current) => ({
                                ...current,
                                stage: productStage,
                                body: value,
                              }))
                            }
                            placeholder="Define aquí las instrucciones, estructura esperada y criterios de producción del producto."
                            minHeight={260}
                          />
                        </label>
                      </div>
                    </>
                  )}

                  <div className="action-row">
                    <button type="submit" className="cta-button" disabled={isProductSaving === 'new'}>
                      <span>{isProductSaving === 'new' ? 'Creando…' : 'Crear producto'}</span>
                    </button>
                  </div>
                </form>
              ) : null}

              {productError && isProductSaving !== 'new' ? <p className="form-error">{productError}</p> : null}

              <div className="list-stack">
                {stageProducts.length === 0 ? (
                  <div className="empty-state">
                    <strong>Sin productos registrados en esta etapa</strong>
                    <p>Cuando el equipo empiece a producir artefactos, aparecerán aquí como contenido editable.</p>
                  </div>
                ) : (
                  stageProducts.map((product) => {
                    const draft = productDrafts[product.id];
                    const isEditable = canEditCourseProduct(userRole, product.owner, product.stage);

                    if (!draft || !isEditable) {
                      return (
                        <div key={product.id} className="task-editor">
                          <div>
                            <div className="task-editor__header">
                              <span className={productStatusBadgeClass(product.status)}>{product.status}</span>
                              <strong>{product.title}</strong>
                            </div>

                            {renderProductSupportPanel(product)}

                            <div className="list-stack">
                              <div className="list-item">
                                <div>
                                  <strong>Descripción</strong>
                                  {renderRichTextContent(
                                    product.summary,
                                    'Sin descripción registrada.',
                                    'rich-html--compact',
                                  )}
                                </div>
                                <div className="list-item__meta">
                                  <span>{product.format}</span>
                                  <span>{product.version}</span>
                                </div>
                              </div>

                              <div className="list-item">
                                <div>
                                  <strong>Instrucciones</strong>
                                  {renderRichTextContent(
                                    product.body,
                                    'Sin instrucciones registradas.',
                                    'rich-html--panel',
                                  )}
                                </div>
                              </div>
                            </div>

                            {product.stage === 'validacion' ? (
                              renderValidationWorkbench(
                                product.id,
                                product,
                                product.summary,
                                product.body,
                                false,
                              )
                            ) : null}
                          </div>

                          <div className="task-editor__sidebar">
                            <div className="task-item__meta">
                              <span>{product.owner}</span>
                              <span>{formatDate(product.updatedAt)}</span>
                            </div>
                            <div className="task-item__meta">
                              <span>{productStageLabel(product.stage)}</span>
                              <span>{joinTags(product.tags) || 'Sin tags'}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={product.id} className="task-editor">
                        <div>
                          <div className="task-editor__header">
                            <span className={productStatusBadgeClass(draft.status)}>{draft.status}</span>
                            <strong>{product.title}</strong>
                          </div>

                          {productStage === 'arquitectura' ? (
                            <>
                              <div className="surface-muted product-guide">
                                <div className="section-heading section-heading--compact">
                                  <div>
                                    <span className="eyebrow">Producto trazable</span>
                                    <h3>Base editable del proceso</h3>
                                  </div>
                                </div>
                                <p className="handoff-copy">
                                  Este producto será base para responsables, fechas y seguimiento independiente
                                  en las etapas siguientes. Desde aquí puedes corregir ubicación, nombre,
                                  formato o propósito.
                                </p>
                              </div>

                              <div className="form-grid">
                                <label className="field">
                                  <span>Sección</span>
                                  <div className="field__control">
                                    <select
                                      value={draft.section ?? architectureSectionOptions[0] ?? 'Introducción'}
                                      onChange={(event) =>
                                        updateProductDraft(product.id, 'section', event.target.value)
                                      }
                                    >
                                      {architectureSectionOptions.map((item) => (
                                        <option key={item} value={item}>
                                          {item}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </label>

                                <label className="field">
                                  <span>Formato</span>
                                  <div className="field__control">
                                    <select
                                      value={draft.format}
                                      onChange={(event) =>
                                        updateProductDraft(
                                          product.id,
                                          'format',
                                          event.target.value as CourseProductMutationInput['format'],
                                        )
                                      }
                                    >
                                      {stageFormats.map((item) => (
                                        <option key={item} value={item}>
                                          {item}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </label>

                                <label className="field field--full">
                                  <span>Nombre del producto</span>
                                  <div className="field__control">
                                    <input
                                      value={draft.title}
                                      onChange={(event) =>
                                        updateProductDraft(product.id, 'title', event.target.value)
                                      }
                                    />
                                  </div>
                                </label>

                                <label className="field field--full">
                                  <span>Descripción</span>
                                  <RichTextEditor
                                    value={draft.summary}
                                    onChange={(value) =>
                                      updateProductDraft(product.id, 'summary', value)
                                    }
                                    placeholder="Describe el producto y su propósito dentro del curso."
                                    minHeight={180}
                                  />
                                </label>
                              </div>
                            </>
                          ) : (
                            <>
                              {renderProductSupportPanel(draft, () => applyTemplateToDraft(product.id))}
                              {renderStructuredProductEditor(draft, (patch) =>
                                setProductDrafts((current) => ({
                                  ...current,
                                  [product.id]: {
                                    ...current[product.id],
                                    ...patch,
                                  },
                                }))
                              )
                              }

                              <div className="form-grid">
                                <label className="field">
                                  <span>Título</span>
                                  <div className="field__control">
                                    <input
                                      value={draft.title}
                                      onChange={(event) =>
                                        updateProductDraft(product.id, 'title', event.target.value)
                                      }
                                    />
                                  </div>
                                </label>

                                <label className="field">
                                  <span>Formato</span>
                                  <div className="field__control">
                                    <select
                                      value={draft.format}
                                      onChange={(event) =>
                                        updateProductDraft(
                                          product.id,
                                          'format',
                                          event.target.value as CourseProductMutationInput['format'],
                                        )
                                      }
                                    >
                                      {stageFormats.map((item) => (
                                        <option key={item} value={item}>
                                          {item}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </label>

                                <label className="field">
                                  <span>Responsable</span>
                                  <div className="field__control">
                                    <select
                                      value={draft.owner}
                                      onChange={(event) =>
                                        updateProductDraft(
                                          product.id,
                                          'owner',
                                          event.target.value as Role,
                                        )
                                      }
                                    >
                                      {appData.roles.map((item) => (
                                        <option key={item} value={item}>
                                          {item}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </label>

                                <label className="field">
                                  <span>Estado</span>
                                  <div className="field__control">
                                    <select
                                      value={draft.status}
                                      onChange={(event) =>
                                        updateProductDraft(
                                          product.id,
                                          'status',
                                          event.target.value as CourseProductMutationInput['status'],
                                        )
                                      }
                                    >
                                      {['Borrador', 'En revisión', 'Aprobado'].map((item) => (
                                        <option key={item} value={item}>
                                          {item}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </label>

                                <label className="field">
                                  <span>Versión</span>
                                  <div className="field__control">
                                    <input
                                      value={draft.version}
                                      onChange={(event) =>
                                        updateProductDraft(product.id, 'version', event.target.value)
                                      }
                                    />
                                  </div>
                                </label>

                                <label className="field field--full">
                                  <span>Etiquetas</span>
                                  <div className="field__control">
                                    <input
                                      value={joinTags(draft.tags)}
                                      onChange={(event) =>
                                        updateProductDraft(product.id, 'tags', splitTags(event.target.value))
                                      }
                                    />
                                  </div>
                                </label>

                                <label className="field field--full">
                                  <span>Descripción</span>
                                  <RichTextEditor
                                    value={draft.summary}
                                    onChange={(value) =>
                                      updateProductDraft(product.id, 'summary', value)
                                    }
                                    placeholder="Describe el producto y su propósito dentro del curso."
                                    minHeight={180}
                                  />
                                </label>

                                <label className="field field--full">
                                  <span>Instrucciones</span>
                                  <RichTextEditor
                                    value={draft.body}
                                    onChange={(value) =>
                                      updateProductDraft(product.id, 'body', value)
                                    }
                                    placeholder="Detalla cómo debe producirse este artefacto, su estructura, alcance, criterios técnicos y nivel de profundidad."
                                    minHeight={260}
                                  />
                                </label>
                              </div>

                              {product.stage === 'validacion' ? (
                                renderValidationWorkbench(
                                  product.id,
                                  draft,
                                  draft.summary,
                                  draft.body,
                                  true,
                                )
                              ) : null}
                            </>
                          )}
                        </div>

                        <div className="task-editor__sidebar">
                          <div className="task-item__meta">
                            <span>{draft.owner}</span>
                            <span>{formatDate(product.updatedAt)}</span>
                          </div>
                          <div className="task-item__meta">
                            <span>{productStageLabel(draft.stage)}</span>
                            <span>{draft.section || draft.format}</span>
                          </div>

                          <button
                            type="button"
                            className="ghost-button"
                            disabled={isProductSaving === product.id}
                            onClick={() => void handleProductSave(product.id)}
                          >
                            <Save size={16} />
                            <span>{isProductSaving === product.id ? 'Guardando…' : 'Guardar'}</span>
                          </button>

                          {canDeleteCourseProducts(userRole) ? (
                            <button
                              type="button"
                              className="danger-button danger-button--ghost"
                              disabled={isProductSaving === product.id}
                              onClick={() => void handleProductDelete(product.id)}
                            >
                              <Trash2 size={16} />
                              <span>Eliminar</span>
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </SidePanel>
        ) : null}
      </>
    );
  }

  function renderArchitectureVisualizer() {
    if (!currentCourse) return null;

    const products = (currentCourse.products || []).filter((product) => product.stage === 'arquitectura');
    const units = currentCourse.metadata.units || [];
    const unitLabels = units.map((_, index) => `Unidad ${index + 1}`);
    const unitTitleHints = units.map((unit) => unit.tituloUnidad ?? '');
    
    const getResolvedSection = (product: CourseProduct) =>
      resolveArchitectureSectionLabel(
        product.section ?? '',
        product.title,
        product.summary,
        unitLabels,
        unitTitleHints,
      );

    const introProducts = products.filter((product) => getResolvedSection(product) === 'Introducción');
    
    const closureProducts = products.filter((product) => getResolvedSection(product) === 'Cierre');

    const unitProductsMap = units.map((unit, idx) => {
       const uNumber = idx + 1;
       const unitLabel = `Unidad ${uNumber}`;
       return {
         unit,
         products: products.filter((product) => getResolvedSection(product) === unitLabel),
       };
    });

    const institutionStructure = appData.institution.structures.find(
      (s) => s.id === currentCourse.institutionStructureId,
    );
    const guidelines = institutionStructure?.pedagogicalGuidelines || [];

    return (
      <div className="architecture-viewport-full architecture-map animate-in fade-in slide-in-from-bottom-4 duration-700">
        <header className="architecture-header">
          <div className="flex items-center gap-4">
             <button 
               type="button"
               className="action-pill action-pill--guidelines" 
               onClick={() => setIsGuidelinesModalOpen(true)}
             >
               <ClipboardCheck size={16} />
               <span>Lineamientos Institucionales</span>
             </button>

             {canOperateArchitecture || canDeleteCourseProducts(userRole) ? (
               <div className="h-6 w-px bg-border/40 mx-2" />
             ) : null}

             {canOperateArchitecture ? (
               <button 
                 type="button"
                 className="cta-button shadow-lg shadow-ocean/20" 
                 onClick={() => void handleGenerateArchitecture()}
                 disabled={isGeneratingArchitecture}
               >
                 {isGeneratingArchitecture ? (
                   <RefreshCcw size={16} className="animate-spin" />
                 ) : (
                   <Sparkles size={16} />
                 )}
                 <span>{isGeneratingArchitecture ? 'Generando arquitectura...' : 'Propuesta IA (Lineamientos)'}</span>
               </button>
             ) : null}

             {canDeleteCourseProducts(userRole) ? (
               <button 
                 type="button"
                 className="ghost-button ml-auto"
                 onClick={() => void handleClearArchitecture()}
                 disabled={isProductSaving === 'architecture:clear'}
               >
                 <Trash2 size={14} />
                 <span>
                   {isProductSaving === 'architecture:clear'
                     ? 'Limpiando arquitectura...'
                     : 'Limpiar arquitectura'}
                 </span>
               </button>
             ) : null}
          </div>
        </header>

        <div className="architecture-grid architecture-grid--tripartite">
          {/* Columna 1: Introducción */}
          <div className="architecture-column">
            <div className="architecture-group">
              <div className="architecture-group__head">
                <h4 className="flex items-center"><BookOpen size={18} className="mr-2 text-ocean" /> Introducción</h4>
                {canOperateArchitecture ? (
                  <button className="icon-button icon-button--mini" onClick={() => handleQuickAddProduct('Introducción')}>
                    <Plus size={14} />
                  </button>
                ) : null}
              </div>
              <div className="architecture-product-list">
                 {introProducts.length > 0 ? (
                   introProducts.map(product => renderArchitectureProductCard(product))
                 ) : (
                   <div className="empty-block">Sin recursos de inicio</div>
                 )}
              </div>
            </div>
          </div>

          {/* Columna 2: Desarrollo (Unidades Académicas) */}
          <div className="architecture-column architecture-column--main">
             <div className="grid grid-cols-2 gap-6">
                {unitProductsMap.map((entry, idx) => (
                    <div key={idx} className="architecture-group">
                      <div className="architecture-group__head">
                        <h4 className="flex items-center truncate">
                          <Layers size={18} className="mr-2 text-gold shrink-0" />
                          <span className="truncate">Unidad {idx + 1}</span>
                        </h4>
                        {canOperateArchitecture ? (
                          <button className="icon-button icon-button--mini" onClick={() => handleQuickAddProduct(`Unidad ${idx + 1}`)}>
                            <Plus size={14} />
                          </button>
                        ) : null}
                      </div>
                      <div className="architecture-product-list">
                        {entry.products.length > 0 ? (
                          entry.products.map(product => renderArchitectureProductCard(product))
                        ) : (
                          <div className="empty-block">Pendiente recursos</div>
                        )}
                      </div>
                    </div>
                ))}
                {units.length === 0 && (
                   <div className="col-span-2 empty-state-block">
                      <Sparkles size={32} className="text-muted mb-4 opacity-40" />
                      <p>Extrae los datos del microcurrículo para mapear el desarrollo aquí.</p>
                   </div>
                )}
             </div>
          </div>

          {/* Columna 3: Cierre */}
          <div className="architecture-column">
            <div className="architecture-group">
              <div className="architecture-group__head">
                <h4 className="flex items-center"><MonitorPlay size={18} className="mr-2 text-sage" /> Cierre</h4>
                {canOperateArchitecture ? (
                  <button className="icon-button icon-button--mini" onClick={() => handleQuickAddProduct('Cierre')}>
                    <Plus size={14} />
                  </button>
                ) : null}
              </div>
              <div className="architecture-product-list">
                {closureProducts.length > 0 ? (
                   closureProducts.map(product => renderArchitectureProductCard(product))
                ) : (
                   <div className="empty-block">Pendiente cierre</div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {isGuidelinesModalOpen ? (
          <SidePanel
            isOpen={isGuidelinesModalOpen}
            title="Lineamientos institucionales"
            description="Marco normativo y pedagógico que rige el diseño de productos para este curso."
            sideLabel="Norma"
            sideDescription="PEDAGÓGICA"
            width="xl"
            onClose={() => setIsGuidelinesModalOpen(false)}
          >
            <div className="page-stack">
              <div className="list-stack">
                {guidelines.length > 0 ? (
                  guidelines.map((text, index) => (
                    <div key={index} className="list-item">
                      <div className="flex items-start gap-3">
                        <div className="status-dot status-dot--history mt-1" />
                        <p className="text-sm leading-relaxed">{text}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-block">
                    No hay lineamientos específicos configurados para esta institución.
                  </div>
                )}
              </div>
            </div>
          </SidePanel>
        ) : null}

        {architecturePreviewProduct ? (
          <SidePanel
            isOpen={Boolean(architecturePreviewProduct)}
            title={architecturePreviewProduct.title}
            description="Ficha ampliada del producto dentro de la arquitectura del curso."
            sideLabel="Prod"
            sideDescription="DETALLE"
            width="xl"
            onClose={() => setArchitecturePreviewProductId(null)}
            footer={
              <div className="flex justify-end gap-3 w-full">
                <button
                  type="button"
                  className="filter-chip"
                  onClick={() => setArchitecturePreviewProductId(null)}
                >
                  Cerrar
                </button>
                {canEditCourseProduct(userRole, architecturePreviewProduct.owner, architecturePreviewProduct.stage) ? (
                  <>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => {
                        setArchitecturePreviewProductId(null);
                        openArchitectureProductEditor(architecturePreviewProduct, 'move');
                      }}
                    >
                      <MoveRight size={16} />
                      <span>Mover</span>
                    </button>
                    <button
                      type="button"
                      className="cta-button"
                      onClick={() => {
                        setArchitecturePreviewProductId(null);
                        openArchitectureProductEditor(architecturePreviewProduct, 'edit');
                      }}
                    >
                      <PencilLine size={16} />
                      <span>Editar producto</span>
                    </button>
                  </>
                ) : null}
              </div>
            }
          >
            <div className="page-stack">
              <div className="institution-detail-grid">
                <div className="list-item">
                  <div>
                    <strong>Sección</strong>
                    <p>{architecturePreviewProduct.section || 'Sin sección'}</p>
                  </div>
                </div>
                <div className="list-item">
                  <div>
                    <strong>Formato</strong>
                    <p>{architecturePreviewProduct.format}</p>
                  </div>
                </div>
                <div className="list-item">
                  <div>
                    <strong>Estado</strong>
                    <p>{architecturePreviewProduct.status}</p>
                  </div>
                </div>
                <div className="list-item">
                  <div>
                    <strong>Responsable</strong>
                    <p>{architecturePreviewProduct.owner}</p>
                  </div>
                </div>
              </div>

              <div className="list-stack">
                <div className="list-item">
                  <div>
                    <strong>Descripción</strong>
                    {renderRichTextContent(
                      architecturePreviewProduct.summary || '',
                      'Sin descripción ampliada.',
                      'rich-html--compact',
                    )}
                  </div>
                </div>
                <div className="list-item">
                  <div>
                    <strong>Versión</strong>
                    <p>{architecturePreviewProduct.version}</p>
                  </div>
                </div>
                <div className="list-item">
                  <div>
                    <strong>Instrucciones</strong>
                    {renderInstructionContent(
                      architecturePreviewProduct.body?.trim() || '',
                      'Este producto todavía no tiene instrucciones registradas.',
                      'rich-html--panel',
                    )}
                  </div>
                </div>
              </div>
            </div>
          </SidePanel>
        ) : null}

        {/* Panel: Agregar Producto Manual */}
        {isAddProductModalOpen && (
          <SidePanel
            isOpen={isAddProductModalOpen}
            title={
              editingArchitectureProductId
                ? architectureEditorMode === 'move'
                  ? 'Mover producto de arquitectura'
                  : 'Editar producto de arquitectura'
                : `Nuevo producto - ${activeAddSection}`
            }
            sideLabel="Prod"
            sideDescription={editingArchitectureProductId ? 'EDITAR' : 'CREAR'}
            width="xl"
            onClose={() => {
              setIsAddProductModalOpen(false);
              setEditingArchitectureProductId(null);
              setArchitectureEditorMode('create');
            }}
            footer={
              <div className="flex justify-end gap-3 w-full">
                <button 
                  className="filter-chip" 
                  onClick={() => {
                    setIsAddProductModalOpen(false);
                    setEditingArchitectureProductId(null);
                    setArchitectureEditorMode('create');
                  }}
                  disabled={isProductSaving === (editingArchitectureProductId ?? 'new')}
                >
                  Cancelar
                </button>
                <button 
                  className="cta-button" 
                  onClick={() => void handleSubmitArchitectureProduct()}
                  disabled={isProductSaving === (editingArchitectureProductId ?? 'new') || !newProductForm.title}
                >
                  {isProductSaving === (editingArchitectureProductId ?? 'new') ? (
                    <RefreshCcw size={16} className="animate-spin mr-2" />
                  ) : (
                    editingArchitectureProductId ? <PencilLine size={16} className="mr-2" /> : <Plus size={16} className="mr-2" />
                  )}
                  <span>
                    {editingArchitectureProductId
                      ? architectureEditorMode === 'move'
                        ? 'Guardar nueva ubicación'
                        : 'Guardar cambios'
                      : 'Crear producto'}
                  </span>
                </button>
              </div>
            }
          >
            <div className="p-6 space-y-6">
              <div className="form-group">
                <label className="form-label">Nombre del producto</label>
                <input
                  type="text"
                  className="modern-input !text-lg"
                  value={newProductForm.title}
                  onChange={(e) => setNewProductForm({ ...newProductForm, title: e.target.value })}
                  placeholder="Ej: Video tutorial sobre X"
                  autoFocus
                />
              </div>

                <div className="grid grid-cols-2 gap-6">
                <div className="form-group">
                  <label className="form-label">Sección</label>
                  <div className="modern-select-wrapper">
                    <select
                      className="modern-select"
                      value={newProductForm.section ?? activeAddSection}
                      onChange={(e) =>
                        setNewProductForm({
                          ...newProductForm,
                          section: e.target.value,
                        })
                      }
                    >
                      {architectureSectionOptions.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="modern-select-icon" size={18} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Formato</label>
                  <div className="modern-select-wrapper">
                    <select
                      className="modern-select"
                      value={newProductForm.format}
                      onChange={(e) => setNewProductForm({ ...newProductForm, format: e.target.value as any })}
                    >
                      <option value="">Seleccionar formato</option>
                      <option value="Video">Video</option>
                      <option value="Pódcast">Pódcast</option>
                      <option value="Infografía">Infografía</option>
                      <option value="RED">RED</option>
                      <option value="Documento">Documento</option>
                      <option value="PDF">PDF</option>
                      <option value="Taller">Taller</option>
                      <option value="Lectura">Lectura</option>
                      <option value="Evaluación">Evaluación</option>
                    </select>
                    <ChevronDown className="modern-select-icon" size={18} />
                  </div>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Estado Inicial</label>
                  <div className="modern-input bg-muted/5 font-bold text-muted/50 italic select-none">
                    Borrador (Predeterminado)
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Descripción / Propósito</label>
                <RichTextEditor
                  value={newProductForm.summary}
                  onChange={(value) => setNewProductForm({ ...newProductForm, summary: value })}
                  placeholder="Describe brevemente qué se espera de este producto..."
                  minHeight={180}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Instrucciones</label>
                <RichTextEditor
                  value={newProductForm.body}
                  onChange={(value) => setNewProductForm({ ...newProductForm, body: value })}
                  placeholder="Detalla cómo debe desarrollarse este producto, su estructura, alcance, criterios técnicos, tono y entregables esperados."
                  minHeight={280}
                />
              </div>

              {productError && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-sm flex items-center gap-3">
                  <AlertCircle size={18} />
                  <span>{productError}</span>
                </div>
              )}
            </div>
          </SidePanel>
        )}

        {isGeneratingArchitecture && (
          <div className="architecture-overlay animate-in fade-in duration-500">
             <div className="extraction-status-card surface shadow-2xl p-10 rounded-3xl flex flex-col items-center gap-8 max-w-md w-full">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full border-4 border-panel flex items-center justify-center">
                     <Sparkles size={40} className="text-ocean animate-pulse" />
                  </div>
                  <svg className="absolute top-0 left-0 w-24 h-24 -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r="44"
                      fill="none"
                      stroke="var(--ocean)"
                      strokeWidth="6"
                      strokeDasharray="276.46"
                      strokeDashoffset={276.46 - (276.46 * architectureProgress) / 100}
                      className="transition-all duration-700 ease-out"
                    />
                  </svg>
                </div>
                <div className="text-center">
                  <span className="eyebrow block mb-2">Diseño Arquitectónico IA</span>
                  <h3 className="text-xl font-bold text-secondary mb-3">{architectureStep}</h3>
                  <p className="text-sm text-muted">Sincronizando productos con lineamientos pedagógicos institucionales.</p>
                </div>
                <div className="w-full bg-panel rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-ocean h-full transition-all duration-700" 
                    style={{ width: `${architectureProgress}%` }}
                  />
                </div>
             </div>
          </div>
        )}
      </div>
    );
  }

  function renderProductFormatIcon(format: string, size = 16) {
    const f = format.toLocaleLowerCase();
    if (f.includes('video')) return <Video size={size} className="text-ocean" />;
    if (f.includes('pódcast')) return <Mic size={size} className="text-coral" />;
    if (f.includes('infografía')) return <BarChart3 size={size} className="text-gold" />;
    if (f.includes('red')) return <Globe size={size} className="text-ocean" />;
    if (f.includes('documento') || f.includes('pdf')) return <FileText size={size} className="text-muted" />;
    if (f.includes('actividad') || f.includes('taller')) return <PenTool size={size} className="text-sage" />;
    if (f.includes('lectura')) return <BookOpen size={size} className="text-ocean" />;
    if (f.includes('evaluación') || f.includes('examen')) return <Target size={size} className="text-coral" />;
    return <File size={size} className="text-muted" />;
  }

  function renderArchitectureProductCard(product: CourseProduct) {
    const isDone = product.status === 'Aprobado';
    const isActive = product.status === 'Borrador' || product.status === 'En revisión';
    const canEdit = canEditCourseProduct(userRole, product.owner, product.stage);
    
    return (
      <div
        key={product.id}
        className={`architecture-card group animate-in fade-in transition-all duration-300 ${isDone ? 'opacity-70' : ''}`}
        onClick={() => setArchitecturePreviewProductId(product.id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setArchitecturePreviewProductId(product.id);
          }
        }}
        role="button"
        tabIndex={0}
      >
        <div className="architecture-card__inner">
          <div className="architecture-card__icon">
            {renderProductFormatIcon(product.format, 18)}
          </div>
          <div className="architecture-card__copy">
            <div className="architecture-card__title-row">
              <strong className="architecture-card__title">
                {product.title}
              </strong>
              {isDone && <CheckCircle2 size={12} className="text-sage" />}
            </div>
            <div className="architecture-card__meta">
              <span className="architecture-card__format">
                {product.format}
              </span>
              <div className="h-1 w-1 rounded-full bg-line" />
              <span className={`architecture-card__status ${isActive ? 'is-active' : 'is-muted'}`}>
                {product.status}
              </span>
            </div>
            {product.summary && (
              <p className="architecture-card__summary">
                {stripHtmlToText(product.summary)}
              </p>
            )}
          </div>
        </div>
        {(canEdit || canDeleteCourseProducts(userRole)) ? (
          <div className="architecture-card__actions">
            {canEdit ? (
              <>
                <button
                  type="button"
                  className="ghost-button ghost-button--compact"
                  onClick={(event) => {
                    event.stopPropagation();
                    openArchitectureProductEditor(product, 'edit');
                  }}
                >
                  <PencilLine size={14} />
                  <span>Editar</span>
                </button>
                <button
                  type="button"
                  className="ghost-button ghost-button--compact"
                  onClick={(event) => {
                    event.stopPropagation();
                    openArchitectureProductEditor(product, 'move');
                  }}
                >
                  <MoveRight size={14} />
                  <span>Mover</span>
                </button>
              </>
            ) : null}
            {canDeleteCourseProducts(userRole) ? (
              <button
                type="button"
                className="danger-button danger-button--ghost danger-button--compact"
                onClick={(event) => {
                  event.stopPropagation();
                  void handleProductDelete(product.id);
                }}
              >
                <Trash2 size={14} />
                <span>Eliminar</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  function renderPlanningWorkspace() {
    const unitLabels = currentCourse.metadata.units.map((_, index) => `Unidad ${index + 1}`);
    const unitTitleHints = currentCourse.metadata.units.map((unit) => unit.tituloUnidad ?? '');
    const sectionOrder = ['Introducción', ...unitLabels, 'Cierre'];
    const planningRows = architectureProducts
      .map((product) => ({
        product,
        sectionLabel: resolveArchitectureSectionLabel(
          product.section ?? '',
          product.title,
          product.summary,
          unitLabels,
          unitTitleHints,
        ),
      }))
      .sort((left, right) => {
        const leftIndex = sectionOrder.indexOf(left.sectionLabel);
        const rightIndex = sectionOrder.indexOf(right.sectionLabel);

        if (leftIndex !== rightIndex) {
          return leftIndex - rightIndex;
        }

        return left.product.title.localeCompare(right.product.title, 'es');
      });
    const filteredPlanningRows = planningRows.filter(({ product, sectionLabel }) => {
      const window = getProductPlanningWindow(product.phasePlan);
      const assigneeNames = getPlanningAssigneeNames(product.phasePlan).join(' ');
      const normalizedProductFilter = planningProductFilter.trim().toLowerCase();
      const normalizedOwnerFilter = planningOwnerFilter.trim().toLowerCase();

      if (planningSectionFilter !== 'Todas' && sectionLabel !== planningSectionFilter) {
        return false;
      }

      if (
        normalizedProductFilter &&
        !`${product.title} ${product.summary}`.toLowerCase().includes(normalizedProductFilter)
      ) {
        return false;
      }

      if (planningStartFilter && window.start?.toISOString().slice(0, 10) !== planningStartFilter) {
        return false;
      }

      if (planningEndFilter && window.end?.toISOString().slice(0, 10) !== planningEndFilter) {
        return false;
      }

      if (normalizedOwnerFilter && !assigneeNames.toLowerCase().includes(normalizedOwnerFilter)) {
        return false;
      }

      return true;
    });

    const planningWindows = filteredPlanningRows
      .map(({ product }) => getProductPlanningWindow(product.phasePlan))
      .filter((window) => window.start && window.end);
    const today = new Date();
    const timelineStart = planningWindows.length
      ? new Date(
          Math.min(
            ...planningWindows.map((window) => window.start?.getTime() ?? Number.POSITIVE_INFINITY),
          ),
        )
      : new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const timelineEnd = planningWindows.length
      ? new Date(
          Math.max(
            ...planningWindows.map((window) => window.end?.getTime() ?? Number.NEGATIVE_INFINITY),
          ),
        )
      : new Date(today.getFullYear(), today.getMonth(), today.getDate() + 28);

    if (timelineEnd.getTime() <= timelineStart.getTime()) {
      timelineEnd.setDate(timelineStart.getDate() + 7);
    }

    const totalTimelineDays = Math.max(1, diffPlanningDays(timelineStart, timelineEnd) + 1);
    const timelineTickCount = Math.min(7, totalTimelineDays);
    const timelineTicks = Array.from({ length: timelineTickCount }, (_, index) => {
      const ratio = timelineTickCount === 1 ? 0 : index / (timelineTickCount - 1);
      const offsetDays = Math.round((totalTimelineDays - 1) * ratio);
      const tickDate = new Date(timelineStart);
      tickDate.setDate(timelineStart.getDate() + offsetDays);

      return {
        key: `${tickDate.toISOString()}-${index}`,
        label: formatDate(tickDate.toISOString().slice(0, 10)),
        position: ratio * 100,
      };
    });

    return (
      <section className="page-stack">
        <article className="surface section-card section-card--compact">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Planeación operativa</span>
              <h3>Diagrama operativo por producto</h3>
            </div>
          </div>
          <p className="handoff-copy">
            Cada fila representa un producto del curso. Aquí visualizas su sección, ventana de
            trabajo y una banda temporal tipo Gantt; al abrir el producto, parametrizas fechas y
            responsables reales por fase para escritura, validación instruccional, producción
            multimedia, montaje LMS y QA.
          </p>
        </article>

        {architectureProducts.length === 0 ? (
          <article className="surface section-card">
            <div className="empty-state">
              <strong>No hay productos de arquitectura para planificar</strong>
              <p>Primero estructura la arquitectura del curso y luego vuelve a esta etapa.</p>
            </div>
          </article>
        ) : (
          <article className="surface section-card section-card--compact">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Vista Gantt</span>
                <h3>Planeación por sección y producto</h3>
              </div>
              <div className="planning-gantt__legend">
                {productPlanningPhases.map(({ phase, label }) => (
                  <span key={phase} className="planning-gantt__legend-item">
                    <span className={`planning-gantt__legend-dot planning-gantt__legend-dot--${phase}`} />
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <div className="planning-gantt__filters">
              <label className="field">
                <span>Sección</span>
                <div className="field__control">
                  <select
                    value={planningSectionFilter}
                    onChange={(event) => setPlanningSectionFilter(event.target.value)}
                  >
                    {['Todas', ...sectionOrder].map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="field">
                <span>Producto</span>
                <div className="field__control">
                  <input
                    value={planningProductFilter}
                    onChange={(event) => setPlanningProductFilter(event.target.value)}
                    placeholder="Buscar por nombre o descripción"
                  />
                </div>
              </label>

              <label className="field">
                <span>Inicio</span>
                <div className="field__control">
                  <input
                    type="date"
                    value={planningStartFilter}
                    onChange={(event) => setPlanningStartFilter(event.target.value)}
                  />
                </div>
              </label>

              <label className="field">
                <span>Final</span>
                <div className="field__control">
                  <input
                    type="date"
                    value={planningEndFilter}
                    onChange={(event) => setPlanningEndFilter(event.target.value)}
                  />
                </div>
              </label>

              <label className="field">
                <span>Responsables</span>
                <div className="field__control">
                  <input
                    value={planningOwnerFilter}
                    onChange={(event) => setPlanningOwnerFilter(event.target.value)}
                    placeholder="Buscar responsable"
                  />
                </div>
              </label>
            </div>

            <div className="planning-gantt">
              <div className="planning-gantt__table">
                <div className="planning-gantt__header">
                  <div>Sección</div>
                  <div>Producto</div>
                  <div>Inicio</div>
                  <div>Final</div>
                  <div>Responsables</div>
                  <div className="planning-gantt__axis">
                    {timelineTicks.map((tick) => (
                      <span
                        key={tick.key}
                        className="planning-gantt__axis-label"
                        style={{ left: `${tick.position}%` }}
                      >
                        {tick.label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="planning-gantt__body">
                  {filteredPlanningRows.map(({ product, sectionLabel }) => {
                    const configuredPhases = countConfiguredPlanningPhases(product.phasePlan);
                    const assigneeNames = getPlanningAssigneeNames(product.phasePlan);
                    const window = getProductPlanningWindow(product.phasePlan);
                    const hasWindow = Boolean(window.start && window.end);
                    const productStartLabel = window.start
                      ? formatDate(window.start.toISOString().slice(0, 10))
                      : 'Sin fecha';
                    const productEndLabel = window.end
                      ? formatDate(window.end.toISOString().slice(0, 10))
                      : 'Sin fecha';

                    return (
                      <button
                        key={product.id}
                        type="button"
                        className="planning-gantt__row"
                        onClick={() => {
                          if (canEditPlanning) {
                            openPlanningProductModal(product);
                          }
                        }}
                        disabled={!canEditPlanning}
                        title={
                          canEditPlanning
                            ? 'Abrir planeación del producto'
                            : 'Solo el coordinador o el administrador pueden editar la planeación'
                        }
                      >
                        <div className="planning-gantt__cell">
                          <span className="badge badge--outline">{sectionLabel}</span>
                        </div>

                        <div className="planning-gantt__cell planning-gantt__cell--product">
                            <div className="planning-gantt__product-copy">
                              <strong>{product.title}</strong>
                              <div className="planning-gantt__product-meta">
                                <span className="badge badge--outline">{product.format}</span>
                                <span className={productStatusBadgeClass(product.status)}>{product.status}</span>
                                <span>{configuredPhases}/{productPlanningPhases.length} fases</span>
                              </div>
                            <p>{stripHtmlToText(product.summary)}</p>
                            </div>
                          </div>

                        <div className="planning-gantt__cell">
                          <span>{productStartLabel}</span>
                        </div>

                        <div className="planning-gantt__cell">
                          <span>{productEndLabel}</span>
                        </div>

                        <div className="planning-gantt__cell planning-gantt__cell--owners">
                          {assigneeNames.length > 0 ? (
                            assigneeNames.slice(0, 3).map((name) => (
                              <span key={name} className="planning-gantt__owner-chip">
                                {name}
                              </span>
                            ))
                          ) : (
                            <span className="planning-gantt__muted">Sin responsables</span>
                          )}
                        </div>

                        <div className="planning-gantt__cell">
                          <div className="planning-gantt__timeline">
                            <div className="planning-gantt__timeline-grid" />
                            {hasWindow ? null : (
                              <span className="planning-gantt__timeline-empty">Sin programación</span>
                            )}
                            {productPlanningPhases.map(({ phase, label }) => {
                              const current = product.phasePlan.find((item) => item.phase === phase);
                              const start = parsePlanningDate(current?.startDate);
                              const end = parsePlanningDate(current?.endDate);

                              if (!current || !start || !end) {
                                return null;
                              }

                              const offsetDays = diffPlanningDays(timelineStart, start);
                              const durationDays = Math.max(1, diffPlanningDays(start, end) + 1);
                              const left = (offsetDays / totalTimelineDays) * 100;
                              const width = Math.max((durationDays / totalTimelineDays) * 100, 3.5);

                              return (
                                <span
                                  key={phase}
                                  className={`planning-gantt__bar planning-gantt__bar--${phase}`}
                                  style={{ left: `${left}%`, width: `${width}%` }}
                                  title={`${label}: ${current.assigneeName || 'Sin responsable'} · ${current.startDate || 'Sin inicio'} → ${current.endDate || 'Sin cierre'}`}
                                />
                              );
                            })}
                          </div>
                        </div>
                      </button>
                    ); 
                  })}
                  {filteredPlanningRows.length === 0 ? (
                    <div className="planning-gantt__empty">
                      <strong>No hay productos que coincidan con los filtros</strong>
                      <p>Ajusta sección, fechas o responsables para volver a ver la planeación.</p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </article>
        )}
      </section>
    );
  }

  if (isWritingProductWorkspaceRoute) {
    return (
      <div className="page-stack workspace-page workspace-page--focus workspace-page--writing-product">
        {renderDedicatedWritingWorkspace()}
      </div>
    );
  }

  if (isValidationProductWorkspaceRoute) {
    return (
      <div className="page-stack workspace-page workspace-page--focus workspace-page--validation-product">
        {renderValidationProductWorkspace()}
      </div>
    );
  }

  return (
    <div className={isFocusedStudio ? 'page-stack workspace-page workspace-page--focus' : 'page-stack workspace-page'}>

      <section
        className={
          isWorkflowPage
            ? 'surface section-card section-card--compact course-sections'
            : isFocusedStudio
              ? 'course-sections course-sections--focus'
              : 'surface section-card section-card--compact course-sections'
        }
      >
      {isWorkflowPage ? (
        <div className="section-heading section-heading--compact">
          <div>
            <span className="eyebrow">Workflow</span>
            <h3>Ruta operativa y expediente del curso</h3>
          </div>
        </div>
        ) : null}

        <div className="segmented-control segmented-control--wide">
          {[
            ['summary', 'Workflow'],
            ['microcurriculo', 'Microcurrículo'],
            ['arquitectura', 'Arquitectura'],
            ['planeacion', 'Planeación'],
            ['escritura', 'Escritura'],
            ['validacion', 'Validación instruccional'],
            ['multimedia', 'Producción multimedia'],
            ['lms', 'LMS'],
            ['qa', 'QA'],
            ['entrega', 'Entrega'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={
                activeSection === value
                  ? 'segmented-control__button is-active'
                  : 'segmented-control__button'
              }
              onClick={() => goToSection(value as CourseSection)}
            >
              <span>{label}</span>
            </button>
          ))}
        </div>
      </section>

      {activeSection !== 'arquitectura' && showFocusedStageHeader && focusedStageMeta ? (
        <section className="surface section-card section-card--compact workspace-focus-head">
          <div className="workspace-focus-head__top">
            <div className="workspace-focus-head__copy">
              <div className="workspace-focus-head__badges">
                <span className="eyebrow">{focusedStageMeta.eyebrow}</span>
                <span className={badgeClass(currentCourse.status)}>{currentCourse.status}</span>
                <span className={`badge badge--${stage?.tone ?? 'ink'}`}>
                  {stage?.name ?? currentCourse.stageId}
                </span>
              </div>
              <h3>{focusedStageMeta.title}</h3>
            </div>

            <div className="workspace-focus-head__actions">
              {activeSection === 'microcurriculo' && canManageCourses(userRole) ? (
                <button
                  type="button"
                  className={activeModal === "COURSE_EDITOR" ? 'filter-chip filter-chip--active' : 'filter-chip'}
                  onClick={() => openModal("COURSE_EDITOR")}
                >
                  <PencilLine size={16} />
                  <span>Editar microcurrículo</span>
                </button>
              ) : null}

              <Link to={`/courses/${currentCourse.slug}`} className="ghost-button">
                <span>Volver al workflow</span>
              </Link>
            </div>
          </div>

          <div className="workspace-focus-head__meta">
            <span className="badge badge--outline">{currentCourse.code}</span>
            <span>{currentCourse.title}</span>
            <span>{currentCourse.faculty}</span>
            <span>{currentCourse.program}</span>
            {focusedStageMeta.stats.map((item) => (
              <span key={item.label}>
                {item.label}: <strong>{item.value}</strong>
              </span>
            ))}
          </div>
        </section>
      ) : null}


      {activeSection === 'summary' ? (
        <section className="summary-workspace-grid">
          <div className="surface section-card">
            <div className="section-heading mb-8">
              <div>
                <span className="eyebrow text-coral font-bold uppercase tracking-widest">Workflow Lineal</span>
                <h3 className="text-2xl mt-1">Evolución operativa del curso</h3>
              </div>
            </div>

            <div className="timeline-rail">
              <VerticalStageTimeline
                stages={workflowStages as any}
                currentStageId={currentStageId}
                courseSlug={currentCourseSlug}
                badgeClass={badgeClass}
              />
            </div>
          </div>

          <aside className="summary-sidebar">
            <div className="surface section-card summary-actions-card">
              <div className="section-heading mb-4">
                <div>
                  <h4 className="text-sm font-semibold text-muted uppercase tracking-wider">Gestión</h4>
                </div>
              </div>

              <ProgressRing
                value={currentCourse.progress}
                label="Avance"
                detail="Sincronizado con hitos y entregables"
              />

              <div className="summary-actions-card__buttons">
                <button
                  type="button"
                  className="cta-button"
                  onClick={() => openModal("COURSE_EDITOR")}
                >
                  <Settings size={16} />
                  <span>Ver detalles</span>
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setIsHistoryModalOpen(true)}
                >
                  <History size={16} />
                  <span>Historial</span>
                </button>
              </div>
            </div>
          </aside>
        </section>
      ) : null}


      {activeSection === 'microcurriculo' ? (
        <section className="summary-workspace-grid">
          <div className="surface section-card">
            {renderMicrocurriculoWizard()}
          </div>
          <aside className="summary-sidebar">
             <div className="surface section-card section-card--compact">
               <div className="section-heading">
                 <h3>Asistencias de IA</h3>
               </div>
               <p className="text-sm text-muted">
                 El asistente de microcurrículo utiliza GPT-4o para extraer automáticamente la información base del curso desde tus documentos.
               </p>
             </div>
             {renderStageNoteEditor(
               'microcurriculo', 
               'Análisis', 
               'Bitácora pedagógica', 
               'Reflexiones sobre la coherencia del microcurrículo y hallazgos en la extracción de datos.'
             )}
          </aside>
        </section>
      ) : null}

      {activeSection === 'arquitectura' ? (
        <div className="architecture-viewport-full animate-in fade-in duration-700">
           {renderArchitectureVisualizer()}
        </div>
      ) : null}

      {activeSection === 'planeacion' ? (
        renderPlanningWorkspace()
      ) : null}

      {planningProduct ? (
        <ModalFrame
          title={`Planeación · ${planningProduct.title}`}
          description="Define la secuencia operativa del producto por fase, con responsables reales del sistema y ventanas de trabajo."
          width="xl"
          onClose={closePlanningProductModal}
          footer={
            <div className="flex justify-end gap-3 w-full">
              <button type="button" className="filter-chip" onClick={closePlanningProductModal}>
                Cancelar
              </button>
              <button
                type="button"
                className="cta-button"
                disabled={isPlanningSaving}
                onClick={() => void handlePlanningSave()}
              >
                <Save size={16} />
                <span>{isPlanningSaving ? 'Guardando…' : 'Guardar planeación'}</span>
              </button>
            </div>
          }
        >
          <div className="page-stack">
            <div className="planning-modal-summary">
              <span className="badge badge--outline">{planningProduct.format}</span>
              <span className="badge badge--outline">{planningProduct.section ?? 'Introducción'}</span>
              <p>{planningProduct.summary}</p>
            </div>

            {planningError ? <p className="form-error">{planningError}</p> : null}

            <div className="planning-modal-grid">
              {productPlanningPhases.map(({ phase, label, ownerRole }) => {
                const current = planningPhaseDraft.find((item) => item.phase === phase) ?? {
                  phase,
                  startDate: '',
                  endDate: '',
                };
                const phaseUsers = activeUsers
                  .slice()
                  .sort((left, right) => {
                    const leftPriority = left.role === ownerRole ? 0 : 1;
                    const rightPriority = right.role === ownerRole ? 0 : 1;
                    if (leftPriority !== rightPriority) {
                      return leftPriority - rightPriority;
                    }
                    return left.name.localeCompare(right.name, 'es');
                  });

                return (
                  <article key={phase} className="planning-phase-card">
                    <div className="planning-phase-card__head">
                      <div>
                        <span className="eyebrow">Fase</span>
                        <h4>{label}</h4>
                      </div>
                      <span className="badge badge--outline">{ownerRole}</span>
                    </div>

                    <div className="form-grid">
                      <label className="field">
                        <span>Fecha de inicio</span>
                        <div className="field__control">
                          <input
                            type="date"
                            value={current.startDate}
                            onChange={(event) =>
                              updatePlanningPhaseDraft(phase, 'startDate', event.target.value)
                            }
                          />
                        </div>
                      </label>

                      <label className="field">
                        <span>Fecha final</span>
                        <div className="field__control">
                          <input
                            type="date"
                            value={current.endDate}
                            onChange={(event) =>
                              updatePlanningPhaseDraft(phase, 'endDate', event.target.value)
                            }
                          />
                        </div>
                      </label>

                      <label className="field field--full">
                        <span>Responsable</span>
                        <div className="field__control">
                          <select
                            value={current.assigneeId ?? ''}
                            onChange={(event) =>
                              updatePlanningPhaseDraft(phase, 'assigneeId', event.target.value)
                            }
                          >
                            <option value="">Seleccionar usuario</option>
                            {phaseUsers.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.name} · {user.role}
                              </option>
                            ))}
                          </select>
                        </div>
                      </label>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </ModalFrame>
      ) : null}

      {activeSection === 'escritura' ? (
        renderWritingWorkspace()
      ) : null}

      {activeSection === 'validacion' ? renderValidationStageBoard() : null}

      {activeSection === 'multimedia' ? (
        <section className="workspace-grid">
          {renderProductStudio(
            'multimedia',
            'Producción multimedia',
            'Piezas y recursos gráficos',
            'Gestión de la producción visual, audiovisual e interactiva del curso.',
          )}
          {renderStageNoteEditor(
            'multimedia',
            'Multimedia',
            'Avances de producción',
            'Reportes sobre la producción de piezas gráficas y video.',
          )}
        </section>
      ) : null}

      {activeSection === 'lms' ? (
        <section className="workspace-grid">
           {renderStageNoteEditor(
            'lms',
            'LMS',
            'Montaje técnico',
            'Registro técnico del despliegue en plataforma educativa.',
          )}
           <article className="surface section-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Checklist técnico</span>
                <h3>Puntos de control LMS</h3>
              </div>
              <Flag size={18} />
            </div>

            <div className="list-stack">
              {currentCourse.stageChecklist
                .filter((checkpoint) => checkpoint.owner === 'Gestor LMS')
                .map((checkpoint) => (
                  <div key={checkpoint.id} className="list-item">
                    <div>
                      <span className={checkpointBadgeClass(checkpoint.status)}>
                        {checkpointStatusLabel(checkpoint.status)}
                      </span>
                      <strong>{checkpoint.label}</strong>
                    </div>
                    <div className="list-item__meta">
                      <span>{checkpoint.owner}</span>
                    </div>
                  </div>
                ))}
            </div>
          </article>
        </section>
      ) : null}

      {activeSection === 'qa' ? (
        <section className="workspace-grid">
           {renderStageNoteEditor(
            'qa',
            'QA',
            'Validación final',
            'Control de errores, ajustes técnicos y validación instruccional previa al lanzamiento.',
          )}
          {renderProductStudio(
            'qa',
            'QA Lab',
            'Validación y rúbricas',
            'Gestión de criterios de calidad y versionamiento de rúbricas instruccionales.',
          )}
        </section>
      ) : null}

      {activeSection === 'entrega' ? (
        <section className="workspace-grid">
           {renderStageNoteEditor(
            'entrega',
            'Entrega',
            'Cierre del curso',
            'Documentación del expediente final y transferencia oficial del curso.',
          )}
        </section>
      ) : null}

      {isHistoryModalOpen ? (
        <SidePanel
          isOpen={isHistoryModalOpen}
          title={`Expediente de cambios · ${currentCourse.title}`}
          description="Historial detallado de acciones, responsables y cronología del curso."
          sideLabel="Historial"
          sideDescription="BITÁCORA"
          width="xl"
          onClose={() => setIsHistoryModalOpen(false)}
        >
          <div className="modal-stack-clean">
            <div className="table-container bg-white border border-line rounded-[32px] overflow-hidden">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Acción</th>
                    <th>Detalle</th>
                    <th>Referencia</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {currentCourse.auditLog.length > 0 ? (
                    currentCourse.auditLog
                      .slice()
                      .reverse()
                      .map((entry) => (
                        <tr key={entry.id}>
                          <td>
                            <div className="flex items-center gap-3">
                              <div className={`status-dot status-dot--${entry.type}`} />
                              <span className="font-semibold">{entry.title}</span>
                            </div>
                          </td>
                          <td>
                            <p className="text-muted text-sm">{entry.detail}</p>
                          </td>
                          <td>
                             <span className="badge badge--outline capitalize">
                               {entry.type === 'history' ? 'Sistema' : entry.type}
                             </span>
                          </td>
                          <td className="whitespace-nowrap font-mono text-xs">
                            {formatDate(entry.happenedAt)}
                          </td>
                        </tr>
                      ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="text-center py-12 text-muted">
                        No hay registros de actividad para este curso todavía.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </SidePanel>
      ) : null}

      {activeModal === 'METADATA_EDITOR' && isGlobalModalOpen ? (
        <SidePanel
          isOpen={isGlobalModalOpen}
          title="Metadatos generales"
          description="Edita la información base del curso que alimenta reportes y buscadores."
          sideLabel="Metadatos"
          sideDescription="FICHA"
          width="xl"
          onClose={() => closeModal()}
          footer={
            <div className="flex justify-end gap-3 w-full">
              <button
                type="button"
                className="filter-chip px-6 py-2.5"
                onClick={() => closeModal()}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="cta-button"
                onClick={() => {
                  void handleMetadataSave(new Event('submit') as any);
                  closeModal();
                }}
              >
                Actualizar información
              </button>
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 modal-stack-clean">
            <div className="form-field">
              <label htmlFor="inst">Institución</label>
              <input
                id="inst"
                value={metadataForm.institution}
                onChange={(e) => setMetadataForm({ ...metadataForm, institution: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="semester">Semestre</label>
              <input
                id="semester"
                value={metadataForm.semester}
                onChange={(e) => setMetadataForm({ ...metadataForm, semester: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="period">Periodo académico</label>
              <input
                id="period"
                value={metadataForm.academicPeriod}
                onChange={(e) => setMetadataForm({ ...metadataForm, academicPeriod: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="ctype">Tipo de curso</label>
              <select
                id="ctype"
                value={metadataForm.courseType}
                onChange={(e) => setMetadataForm({ ...metadataForm, courseType: e.target.value })}
              >
                <option value="Pregrado">Pregrado</option>
                <option value="Posgrado">Posgrado</option>
                <option value="Diplomado">Diplomado</option>
                <option value="Extensión">Extensión</option>
              </select>
            </div>
          </div>
        </SidePanel>
      ) : null}


      {activeModal === 'TEAM_MANAGER' && isGlobalModalOpen ? (
        <SidePanel
          isOpen={isGlobalModalOpen}
          title="Responsables del curso"
          description="Asigna y coordina a los integrantes del equipo de maduración del curso."
          sideLabel="Equipo"
          sideDescription="GESTIÓN"
          width="xl"
          onClose={() => closeModal()}
        >
          <div className="page-stack modal-stack-clean">
            <div className="toolbar-header">
              <button
                type="button"
                className={isTeamComposerOpen ? 'filter-chip filter-chip--active' : 'filter-chip'}
                onClick={() => setIsTeamComposerOpen((current) => !current)}
              >
                <Plus size={16} />
                <span>{isTeamComposerOpen ? 'Ocultar formulario' : 'Nuevo integrante'}</span>
              </button>
            </div>

            {isTeamComposerOpen ? (
              <form className="editor-card" onSubmit={handleTeamMemberCreate}>
                <div className="form-grid">
                  <label className="field">
                    <span>Nombre completo</span>
                    <div className="field__control">
                      <input
                        value={newTeamMemberForm.name}
                        onChange={(event) =>
                          setNewTeamMemberForm((current) => ({ ...current, name: event.target.value }))
                        }
                        required
                      />
                    </div>
                  </label>

                  <label className="field">
                    <span>Rol</span>
                    <div className="field__control">
                      <select
                        value={newTeamMemberForm.role}
                        onChange={(event) =>
                          setNewTeamMemberForm((current) => ({
                            ...current,
                            role: event.target.value as Role,
                          }))
                        }
                      >
                        {appData.roles.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </div>
                  </label>
                </div>

                <div className="action-row">
                  <button type="submit" className="cta-button" disabled={isTeamSaving === 'new'}>
                    <span>{isTeamSaving === 'new' ? 'Agregando…' : 'Agregar integrante'}</span>
                  </button>
                </div>
              </form>
            ) : null}

            {teamError ? <p className="form-error">{teamError}</p> : null}

            <div className="list-stack">
              {currentCourse.team.map((member) => {
                const draft = teamDrafts[member.id];

                if (!draft) {
                  return null;
                }

                return (
                  <div key={member.id} className="team-editor">
                    <div className="form-grid">
                      <label className="field">
                        <span>Nombre</span>
                        <div className="field__control">
                          <input
                            value={draft.name}
                            onChange={(event) => updateTeamDraft(member.id, 'name', event.target.value)}
                          />
                        </div>
                      </label>

                      <label className="field">
                        <span>Rol</span>
                        <div className="field__control">
                          <select
                            value={draft.role}
                            onChange={(event) =>
                              updateTeamDraft(member.id, 'role', event.target.value as Role)
                            }
                          >
                            {appData.roles.map((item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))}
                          </select>
                        </div>
                      </label>
                    </div>

                    <div className="team-editor__actions">
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => void handleTeamMemberSave(member.id)}
                        disabled={isTeamSaving === member.id}
                      >
                        <Save size={16} />
                        <span>{isTeamSaving === member.id ? 'Guardando…' : 'Guardar'}</span>
                      </button>

                      <button
                        type="button"
                        className="danger-button danger-button--ghost"
                        onClick={() => void handleTeamMemberDelete(member.id)}
                        disabled={isTeamSaving === member.id}
                      >
                        <Trash2 size={16} />
                        <span>Eliminar</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </SidePanel>
      ) : null}

      {activeModal === 'TASK_COMPOSER' && isGlobalModalOpen ? (
        <SidePanel
          isOpen={isGlobalModalOpen}
          title="Gestión de tareas"
          description="Organiza y asigna el trabajo pendiente del curso para asegurar el avance por etapas."
          sideLabel="Tareas"
          sideDescription="OPERACIÓN"
          width="xl"
          onClose={closeModal}
        >
          <div className="page-stack">
            <div className="toolbar-header">
              <button
                type="button"
                className={isAddingTask ? 'filter-chip filter-chip--active' : 'filter-chip'}
                onClick={() => setIsAddingTask((current) => !current)}
              >
                <Plus size={16} />
                <span>{isAddingTask ? 'Ocultar formulario' : 'Nueva tarea'}</span>
              </button>
            </div>

            {isAddingTask ? (
              <form className="editor-card animate-in fade-in slide-in-from-top-2" onSubmit={handleTaskCreate}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="form-group">
                    <label className="form-label">Título de la tarea</label>
                    <input
                      className="modern-input"
                      value={newTaskForm.title}
                      onChange={(event) =>
                        setNewTaskForm((current) => ({ ...current, title: event.target.value }))
                      }
                      required
                      placeholder="Ej: Revisar guiones finales"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Producto asociado</label>
                    <div className="modern-select-wrapper">
                      <select
                        className="modern-select"
                        value={newTaskForm.productId ?? ''}
                        onChange={(event) =>
                          setNewTaskForm((current) => ({
                            ...current,
                            productId: event.target.value || undefined,
                          }))
                        }
                      >
                        <option value="">Sin vincular</option>
                        {taskProductOptions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.title}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="modern-select-icon" size={16} />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Responsable (Rol)</label>
                    <div className="modern-select-wrapper">
                      <select
                        className="modern-select"
                        value={newTaskForm.role}
                        onChange={(event) =>
                          setNewTaskForm((current) => ({
                            ...current,
                            role: event.target.value as Role,
                          }))
                        }
                      >
                        {appData.roles.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="modern-select-icon" size={16} />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Fecha límite</label>
                    <input
                      className="modern-input"
                      type="date"
                      value={newTaskForm.dueDate}
                      onChange={(event) =>
                        setNewTaskForm((current) => ({ ...current, dueDate: event.target.value }))
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Prioridad</label>
                    <div className="modern-select-wrapper">
                      <select
                        className="modern-select"
                        value={newTaskForm.priority}
                        onChange={(event) =>
                          setNewTaskForm((current) => ({
                            ...current,
                            priority: event.target.value as TaskMutationInput['priority'],
                          }))
                        }
                      >
                        <option value="Alta">Alta</option>
                        <option value="Media">Media</option>
                        <option value="Baja">Baja</option>
                      </select>
                      <ChevronDown className="modern-select-icon" size={16} />
                    </div>
                  </div>
                </div>

                <div className="form-group mt-6">
                  <label className="form-label">Resumen operativo</label>
                  <textarea
                    className="modern-textarea"
                    value={newTaskForm.summary}
                    onChange={(event) =>
                      setNewTaskForm((current) => ({ ...current, summary: event.target.value }))
                    }
                    rows={4}
                    placeholder="Describe qué se debe hacer, con qué criterio o qué producto se espera dejar listo."
                  />
                </div>

                <div className="flex justify-end mt-6">
                  <button type="submit" className="cta-button" disabled={isTaskSaving}>
                    <Plus size={18} />
                    <span>{isTaskSaving ? 'Creando…' : 'Crear tarea'}</span>
                  </button>
                </div>
              </form>
            ) : null}

            {taskError ? <p className="form-error">{taskError}</p> : null}

            <div className="list-stack">
              {visibleTasks.length === 0 ? (
                <div className="empty-state">
                  <strong>Sin tareas registradas</strong>
                  <p>Presiona "Nueva tarea" para comenzar a organizar el trabajo.</p>
                </div>
              ) : (
                visibleTasks.map((task) => {
                  const draft = taskDrafts[task.id];

                  if (!draft) {
                    return null;
                  }

                  return (
                    <div key={task.id} className="task-editor">
                      <div className="form-grid">
                        <label className="field">
                          <span>Título</span>
                          <div className="field__control">
                            <input
                              value={draft.title}
                              onChange={(event) => updateTaskDraft(task.id, 'title', event.target.value)}
                            />
                          </div>
                        </label>

                        <label className="field">
                          <span>Producto asociado</span>
                          <div className="field__control">
                            <select
                              value={draft.productId ?? ''}
                              onChange={(event) =>
                                updateTaskDraft(task.id, 'productId', event.target.value || undefined)
                              }
                            >
                              <option value="">Sin vincular</option>
                              {taskProductOptions.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.title}
                                </option>
                              ))}
                            </select>
                          </div>
                        </label>

                        <label className="field">
                          <span>Responsable</span>
                          <div className="field__control">
                            <select
                              value={draft.role}
                              onChange={(event) =>
                                updateTaskDraft(task.id, 'role', event.target.value as Role)
                              }
                            >
                              {appData.roles.map((item) => (
                                <option key={item} value={item}>
                                  {item}
                                </option>
                              ))}
                            </select>
                          </div>
                        </label>

                        <label className="field">
                          <span>Fecha límite</span>
                          <div className="field__control">
                            <input
                              type="date"
                              value={draft.dueDate}
                              onChange={(event) => updateTaskDraft(task.id, 'dueDate', event.target.value)}
                            />
                          </div>
                        </label>

                        <label className="field">
                          <span>Prioridad</span>
                          <div className="field__control">
                            <select
                              value={draft.priority}
                              onChange={(event) =>
                                updateTaskDraft(task.id, 'priority', event.target.value as TaskMutationInput['priority'])
                              }
                            >
                              <option value="Alta">Alta</option>
                              <option value="Media">Media</option>
                              <option value="Baja">Baja</option>
                            </select>
                          </div>
                        </label>

                        <label className="field">
                          <span>Estado</span>
                          <div className="field__control">
                            <select
                              value={draft.status}
                              onChange={(event) =>
                                updateTaskDraft(task.id, 'status', event.target.value as any)
                              }
                            >
                              <option value="Pendiente">Pendiente</option>
                              <option value="En revisión">En revisión</option>
                              <option value="Lista">Lista</option>
                              <option value="Bloqueada">Bloqueada</option>
                            </select>
                          </div>
                        </label>
                      </div>

                      <label className="field">
                        <span>Resumen operativo</span>
                        <div className="field__control">
                          <textarea
                            rows={3}
                            value={draft.summary}
                            onChange={(event) => updateTaskDraft(task.id, 'summary', event.target.value)}
                          />
                        </div>
                      </label>

                      <div className="task-editor__actions">
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => void handleTaskSave(task.id)}
                        >
                          <Save size={16} />
                          <span>Guardar</span>
                        </button>

                        {canDeleteTasks(userRole) ? (
                          <button
                            type="button"
                            className="danger-button danger-button--ghost"
                            onClick={() => void handleTaskDelete(task.id)}
                          >
                            <Trash2 size={16} />
                            <span>Eliminar</span>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </SidePanel>
      ) : null}

      {activeModal === "COURSE_EDITOR" && isGlobalModalOpen ? (
        <SidePanel
          isOpen={isGlobalModalOpen}
          title={`Expediente: ${currentCourse.title}`}
          description="Consulta técnica de ficha operativa, criterios académicos e indicadores de avance."
          sideLabel="Expediente"
          sideDescription="CONSULTA"
          width="xl"
          onClose={closeModal}
        >
          <div className="page-stack">
            <div className="management-layout">
              <main className="page-stack gap-12">
                <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-12">
                  <article className="detail-section">
                    <div className="section-heading mb-6 border-b border-line pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-ocean/10 text-ocean rounded-lg">
                          <FileText size={20} />
                        </div>
                        <h3 className="text-xl font-semibold tracking-tight">Información principal</h3>
                      </div>
                    </div>
                    <div className="space-y-6">
                      <div className="form-group">
                        <label className="form-label">Título del curso</label>
                        <p className="text-2xl font-bold text-ink tracking-tight">{currentCourse.title}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="form-group">
                          <label className="form-label">Código</label>
                          <p className="font-mono text-ocean font-semibold bg-ocean/5 px-3 py-1 rounded-lg w-fit">{currentCourse.code}</p>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Institución</label>
                          <p className="font-medium">{currentCourse.metadata.institution}</p>
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Resumen ejecutivo</label>
                        <p className="text-muted leading-relaxed italic border-l-4 border-line pl-4 py-2">{currentCourse.summary || "Sin resumen definido."}</p>
                      </div>
                    </div>
                  </article>

                  <article className="detail-section">
                    <div className="section-heading mb-6 border-b border-line pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-sage/10 text-sage rounded-lg">
                          <BarChart3 size={20} />
                        </div>
                        <h3 className="text-xl font-semibold tracking-tight">Perfil académico</h3>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                      <div className="form-group">
                        <label className="form-label">Facultad</label>
                        <p className="font-medium">{currentCourse.faculty}</p>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Programa</label>
                        <p className="font-medium">{currentCourse.program}</p>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Créditos</label>
                        <p className="font-bold text-lg text-sage">{currentCourse.credits}</p>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Semestre</label>
                        <p className="font-medium">{currentCourse.metadata.semester}</p>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Modalidad</label>
                        <p className="font-medium">{currentCourse.modality}</p>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Periodo</label>
                        <p className="font-medium">{currentCourse.metadata.academicPeriod}</p>
                      </div>
                    </div>
                  </article>
                </div>

                <article className="detail-section">
                  <div className="section-heading">
                    <h3>Contenido y Metodología</h3>
                  </div>
                  <div className="form-grid">
                    <div className="field field--full">
                      <span>Resultados de aprendizaje</span>
                      <div className="list-stack list-stack--compact mt-2">
                        {currentCourse.metadata.learningOutcomes.map((item, idx) => (
                          <p key={idx} className="text-sm">• {item}</p>
                        ))}
                      </div>
                    </div>

                    <div className="field field--full">
                      <span>Temas clave</span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {currentCourse.metadata.topics.map((item, idx) => (
                          <span key={idx} className="badge badge--outline">{item}</span>
                        ))}
                      </div>
                    </div>

                    <div className="field">
                      <span>Metodología</span>
                      <p>{currentCourse.metadata.methodology}</p>
                    </div>
                    <div className="field">
                      <span>Evaluación</span>
                      <p>{currentCourse.metadata.evaluation}</p>
                    </div>
                  </div>
                </article>

                <div className="flex gap-4 mt-8 pt-6 border-t border-line">
                  <button
                    type="button"
                    className="cta-button"
                    onClick={() => {
                      closeModal();
                      setIsEditingCourse(true);
                    }}
                  >
                    <PencilLine size={16} />
                    <span>Editar información profunda</span>
                  </button>
                  <button
                    type="button"
                    className="danger-button danger-button--ghost"
                    onClick={() => void handleCourseDelete()}
                  >
                    <Trash2 size={16} />
                    <span>Eliminar curso</span>
                  </button>
                  <button type="button" className="filter-chip px-6" onClick={() => closeModal()}>
                    <span>Cerrar expediente</span>
                  </button>
                </div>
              </main>

              <aside className="side-panel space-y-12">
                <div className="highlight-item bg-ink/5 border border-line p-8 rounded-[32px]">
                  <span className="text-xs font-mono font-bold uppercase tracking-widest text-muted opacity-60 mb-2 block">Estado del proyecto</span>
                  <h4 className="text-xl font-bold">Plan operativo</h4>
                  <div className="form-grid mt-4">
                    <div className="field">
                      <span className="text-sm text-muted">Etapa</span>
                      <strong className="text-lg">{appData.stages.find(s => s.id === currentCourse.stageId)?.name || currentCourse.stageId}</strong>
                    </div>
                    <div className="field">
                      <span className="text-sm text-muted">Status</span>
                      <span className={badgeClass(currentCourse.status)}>{currentCourse.status}</span>
                    </div>
                  </div>
                </div>

                <div className="highlight-item bg-ink/5 border border-line p-8 rounded-[32px]">
                  <span className="text-xs font-mono font-bold uppercase tracking-widest text-muted opacity-60 mb-2 block">Indicadores clave</span>
                  <div className="form-grid mt-4">
                    <div className="field">
                      <span className="text-sm text-muted">Prioridad</span>
                      <p className="font-semibold text-lg">{currentCourse.metadata.priority}</p>
                    </div>
                    <div className="field">
                      <span className="text-sm text-muted">Riesgo</span>
                      <p className="font-semibold text-lg">{currentCourse.metadata.riskLevel}</p>
                    </div>
                    <div className="field">
                      <span className="text-sm text-muted">Versión</span>
                      <p className="text-lg">{currentCourse.metadata.currentVersion}</p>
                    </div>
                    <div className="field">
                      <span className="text-sm text-muted">Cierre obj.</span>
                      <p className="text-lg">{formatDate(currentCourse.metadata.targetCloseDate)}</p>
                    </div>
                  </div>
                </div>

                <div className="highlight-item p-8 rounded-[32px]" style={{ background: "var(--coral-soft)", border: "1px solid rgba(199, 124, 86, 0.2)" }}>
                  <span className="text-xs font-mono font-bold uppercase tracking-widest opacity-60 mb-2 block" style={{ color: "#8d3f22" }}>Meta inmediata</span>
                  <h4 className="text-xl font-bold" style={{ color: "#8d3f22" }}>Próximo hito</h4>
                  <p className="mt-4 font-medium text-lg leading-relaxed" style={{ color: "#8d3f22" }}>{currentCourse.nextMilestone}</p>
                </div>
              </aside>
            </div>
          </div>
        </SidePanel>
      ) : null}
      {isEditingCourse && (
        <SidePanel
          isOpen={isEditingCourse}
          title={`Editar: ${courseForm.title}`}
          description="Gestión de metadatos profundos, criterios pedagógicos y parámetros operativos del curso."
          sideLabel="Ficha"
          sideDescription="MAESTRA"
          width="xl"
          onClose={() => setIsEditingCourse(false)}
        >
          <div className="page-stack">
            <div className="flex items-center gap-4 mb-8">
              <button
                type="button"
                className={!isEditingCourseMetadata ? 'filter-chip filter-chip--active' : 'filter-chip'}
                onClick={() => setIsEditingCourseMetadata(false)}
              >
                Información básica
              </button>
              <button
                type="button"
                className={isEditingCourseMetadata ? 'filter-chip filter-chip--active' : 'filter-chip'}
                onClick={() => setIsEditingCourseMetadata(true)}
              >
                Ficha operativa (Profunda)
              </button>
            </div>

            {!isEditingCourseMetadata ? (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <form className="page-stack gap-10" onSubmit={handleCourseSave}>
                  <article className="detail-section">
                    <div className="section-heading mb-6 border-b border-line pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-ocean/10 text-ocean rounded-lg">
                          <Settings size={20} />
                        </div>
                        <h3 className="text-xl font-semibold tracking-tight">Ajustes principales</h3>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      <div className="form-group lg:col-span-2">
                        <label className="form-label">Nombre del curso</label>
                        <input
                          className="modern-input !text-lg font-bold"
                          value={courseForm.title}
                          onChange={(event) => updateCourseDraftField('title', event.target.value)}
                          placeholder="Ej: Introducción a la Inteligencia Artificial"
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Código institucional</label>
                        <input
                          className="modern-input"
                          value={courseForm.code}
                          onChange={(event) => updateCourseDraftField('code', event.target.value)}
                          placeholder="Ej: IA-101"
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Modalidad</label>
                        <div className="modern-select-wrapper">
                          <select
                            className="modern-select"
                            value={courseForm.modality}
                            onChange={(event) => updateCourseDraftField('modality', event.target.value)}
                            required
                          >
                            {['Virtual', 'Presencial', 'Híbrida'].map((item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="modern-select-icon" size={16} />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Etapa actual</label>
                        <div className="modern-select-wrapper">
                          <select
                            className="modern-select"
                            value={courseForm.stageId}
                            onChange={(event) => updateCourseDraftField('stageId', event.target.value)}
                          >
                            {appData.stages.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="modern-select-icon" size={16} />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Estado oficial</label>
                        <div className="modern-select-wrapper">
                          <select
                            className="modern-select"
                            value={courseForm.status}
                            onChange={(event) =>
                              updateCourseDraftField(
                                'status',
                                event.target.value as CourseMutationInput['status'],
                              )
                            }
                          >
                            {['En curso', 'En QA', 'En riesgo', 'Bloqueado', 'Entregado'].map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="modern-select-icon" size={16} />
                        </div>
                      </div>

                      <div className="form-group lg:col-span-2">
                        <label className="form-label">Próximo hito o entrega</label>
                        <input
                          className="modern-input"
                          value={courseForm.nextMilestone}
                          onChange={(event) => updateCourseDraftField('nextMilestone', event.target.value)}
                          placeholder="Ej: Entrega de microcurrículo verificado"
                          required
                        />
                      </div>

                      <div className="form-group lg:col-span-3">
                        <label className="form-label">Resumen ejecutivo del curso</label>
                        <textarea
                          rows={4}
                          className="modern-textarea"
                          value={courseForm.summary}
                          onChange={(event) => updateCourseDraftField('summary', event.target.value)}
                          placeholder="Breve descripción del propósito y alcance del curso..."
                          required
                        />
                      </div>
                    </div>

                    {courseError ? <p className="form-error mt-4">{courseError}</p> : null}

                    <div className="flex gap-4 mt-8 pt-6 border-t border-line">
                      <button type="submit" className="cta-button" disabled={isCourseSaving}>
                        <Save size={18} />
                        <span>{isCourseSaving ? 'Guardando…' : 'Guardar cambios básicos'}</span>
                      </button>
                    </div>
                  </article>
                </form>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <form className="page-stack gap-10" onSubmit={handleMetadataSave}>
                  <article className="detail-section">
                    <div className="section-heading mb-6 border-b border-line pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gold/10 text-gold rounded-lg">
                          <ClipboardCheck size={20} />
                        </div>
                        <div>
                          <span className="eyebrow">Criterios Pedagógicos</span>
                          <h3 className="text-xl font-semibold tracking-tight">Ficha operativa profunda</h3>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      <div className="form-group">
                        <label className="form-label">Institución operativa</label>
                        <div className="modern-select-wrapper">
                          <select
                            className="modern-select"
                            value={metadataForm.institution}
                            onChange={(event) => {
                              updateCourseDraftField('institution', event.target.value);
                              setMetadataForm((current) => ({
                                ...current,
                                institution: event.target.value,
                              }));
                            }}
                            required
                          >
                            {institutionOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="modern-select-icon" size={16} />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Nombre corto / Alias</label>
                        <input
                          className="modern-input"
                          value={metadataForm.shortName}
                          onChange={(event) =>
                            setMetadataForm((current) => ({
                              ...current,
                              shortName: event.target.value,
                            }))
                          }
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Semestre / Módulo</label>
                        <input
                          className="modern-input"
                          value={metadataForm.semester}
                          onChange={(event) =>
                            setMetadataForm((current) => ({
                              ...current,
                              semester: event.target.value,
                            }))
                          }
                          placeholder="Ej: 1er Semestre"
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Periodo académico</label>
                        <div className="modern-select-wrapper">
                          <select
                            className="modern-select"
                            value={metadataForm.academicPeriod}
                            onChange={(event) => {
                              updateCourseDraftField('academicPeriod', event.target.value);
                              setMetadataForm((current) => ({
                                ...current,
                                academicPeriod: event.target.value,
                              }));
                            }}
                            required
                          >
                            {academicPeriodOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="modern-select-icon" size={16} />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Tipo de curso</label>
                        <div className="modern-select-wrapper">
                          <select
                            className="modern-select"
                            value={metadataForm.courseType}
                            onChange={(event) => {
                              updateCourseDraftField('courseType', event.target.value);
                              setMetadataForm((current) => ({
                                ...current,
                                courseType: event.target.value,
                              }));
                            }}
                            required
                          >
                            {courseTypeOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="modern-select-icon" size={16} />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Fecha de cierre objetivo</label>
                        <input
                          type="date"
                          className="modern-input"
                          value={metadataForm.targetCloseDate}
                          onChange={(event) =>
                            setMetadataForm((current) => ({
                              ...current,
                              targetCloseDate: event.target.value,
                            }))
                          }
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Versión de diseño</label>
                        <input
                          className="modern-input"
                          value={metadataForm.currentVersion}
                          onChange={(event) =>
                            setMetadataForm((current) => ({
                              ...current,
                              currentVersion: event.target.value,
                            }))
                          }
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Nivel de Prioridad</label>
                        <div className="modern-select-wrapper">
                          <select
                            className="modern-select"
                            value={metadataForm.priority}
                            onChange={(event) =>
                              setMetadataForm((current) => ({
                                ...current,
                                priority: event.target.value as CourseMetadataMutationInput['priority'],
                              }))
                            }
                          >
                            {['Alta', 'Media', 'Baja'].map((item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="modern-select-icon" size={16} />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Riesgo identificado</label>
                        <div className="modern-select-wrapper">
                          <select
                            className="modern-select"
                            value={metadataForm.riskLevel}
                            onChange={(event) =>
                              setMetadataForm((current) => ({
                                ...current,
                                riskLevel: event.target.value as CourseMetadataMutationInput['riskLevel'],
                              }))
                            }
                          >
                            {['Bajo', 'Medio', 'Alto'].map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="modern-select-icon" size={16} />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mt-12">
                      <div className="form-group">
                        <label className="form-label flex items-center gap-2">
                           <PenTool size={14} />
                           <span>Metodología pedagógica</span>
                        </label>
                        <textarea
                          rows={5}
                          className="modern-textarea"
                          value={metadataForm.methodology}
                          onChange={(event) =>
                            setMetadataForm((current) => ({
                              ...current,
                              methodology: event.target.value,
                            }))
                          }
                          placeholder="Estrategias de enseñanza, aprendizaje autónomo..."
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label flex items-center gap-2">
                           <ClipboardCheck size={14} />
                           <span>Criterios de Evaluación</span>
                        </label>
                        <textarea
                          rows={5}
                          className="modern-textarea"
                          value={joinLines(metadataForm.evaluation)}
                          onChange={(event) =>
                            setMetadataForm((current) => ({
                              ...current,
                              evaluation: splitLines(event.target.value),
                            }))
                          }
                          placeholder="Ponderación, rúbricas, momentos de evaluación... (uno por línea)"
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label flex items-center gap-2">
                           <Target size={14} />
                           <span>Resultados de aprendizaje (RAE)</span>
                        </label>
                        <textarea
                          rows={6}
                          className="modern-textarea"
                          value={joinLines(metadataForm.learningOutcomes)}
                          onChange={(event) =>
                            setMetadataForm((current: CourseMetadataMutationInput) => ({
                              ...current,
                              learningOutcomes: splitLines(event.target.value),
                            }))
                          }
                          placeholder="Defina sus resultados esperados, uno por línea..."
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label flex items-center gap-2">
                           <Layers size={14} />
                           <span>Núcleos temáticos / Temas clave</span>
                        </label>
                        <textarea
                          rows={6}
                          className="modern-textarea"
                          value={joinLines(metadataForm.topics)}
                          onChange={(event) =>
                            setMetadataForm((current) => ({
                              ...current,
                              topics: splitLines(event.target.value),
                            }))
                          }
                          placeholder="Ejes de formación, módulos principales... (uno por línea)"
                          required
                        />
                      </div>

                      <div className="form-group lg:col-span-2">
                        <label className="form-label flex items-center gap-2">
                           <BookOpen size={14} />
                           <span>Bibliografía base y complementaria</span>
                        </label>
                        <textarea
                          rows={6}
                          className="modern-textarea italic"
                          value={joinLines(metadataForm.bibliography)}
                          onChange={(event) =>
                            setMetadataForm((current: CourseMetadataMutationInput) => ({
                              ...current,
                              bibliography: splitLines(event.target.value),
                            }))
                          }
                        placeholder="Normas APA, enlaces, recursos físicos... (uno por línea)"
                        required
                      />
                    </div>
                  </div>

                  {metadataError ? <p className="form-error mt-4">{metadataError}</p> : null}

                  <div className="flex gap-4 mt-8 pt-6 border-t border-line">
                      <button type="submit" className="cta-button" disabled={isMetadataSaving}>
                        <Save size={18} />
                        <span>{isMetadataSaving ? 'Guardando…' : 'Guardar ficha operativa'}</span>
                      </button>
                      <button type="button" className="filter-chip px-6 py-3" onClick={() => setIsEditingCourse(false)}>
                        <span>Terminar edición</span>
                      </button>
                    </div>
                  </article>
                </form>
              </div>
            )}
          </div>
        </SidePanel>
      )}

      {isVerifyingAnalysis && analysisResult && !canOperateMicrocurriculo ? (
        <SidePanel
          isOpen={isVerifyingAnalysis}
          title="Ver microcurrículo"
          description="Consulta de solo lectura del microcurrículo consolidado para este curso."
          sideLabel="IA"
          sideDescription="LECTURA"
          width="xl"
          onClose={() => setIsVerifyingAnalysis(false)}
          footer={
            <div className="flex justify-end gap-3 w-full">
              <button
                type="button"
                className="filter-chip px-6 py-2.5"
                onClick={() => setIsVerifyingAnalysis(false)}
              >
                <span>Cerrar</span>
              </button>
            </div>
          }
        >
          <div className="page-stack">
            <div className="institution-detail-grid">
              <div className="list-item">
                <div>
                  <strong>Facultad</strong>
                  <p>{analysisResult.facultad || 'No especificado'}</p>
                </div>
              </div>
              <div className="list-item">
                <div>
                  <strong>Programa</strong>
                  <p>{analysisResult.programa || 'No especificado'}</p>
                </div>
              </div>
              <div className="list-item">
                <div>
                  <strong>Semestre</strong>
                  <p>{analysisResult.semestre || 'No especificado'}</p>
                </div>
              </div>
              <div className="list-item">
                <div>
                  <strong>Tipo de curso</strong>
                  <p>{analysisResult.tipoCurso || 'No especificado'}</p>
                </div>
              </div>
              <div className="list-item">
                <div>
                  <strong>Créditos</strong>
                  <p>{analysisResult.creditos || 0}</p>
                </div>
              </div>
            </div>

            <div className="list-stack">
              <div className="list-item">
                <div>
                  <strong>Descripción del curso</strong>
                  <p>{analysisResult.descripcionCurso || 'No especificado'}</p>
                </div>
              </div>
              <div className="list-item">
                <div>
                  <strong>Resultados de aprendizaje</strong>
                  <p>
                    {Array.isArray(analysisResult.resultadosAprendizaje) && analysisResult.resultadosAprendizaje.length > 0
                      ? analysisResult.resultadosAprendizaje.join(' · ')
                      : 'No especificado'}
                  </p>
                </div>
              </div>
              <div className="list-item">
                <div>
                  <strong>Unidades</strong>
                  <p>
                    {Array.isArray(analysisResult.unidades) && analysisResult.unidades.length > 0
                      ? analysisResult.unidades
                          .map((unit: any, index: number) => unit.tituloUnidad || `Unidad ${index + 1}`)
                          .join(' · ')
                      : 'No especificado'}
                  </p>
                </div>
              </div>
              <div className="list-item">
                <div>
                  <strong>Metodología</strong>
                  <p>{analysisResult.metodologia || 'No especificado'}</p>
                </div>
              </div>
              <div className="list-item">
                <div>
                  <strong>Evaluación</strong>
                  <p>
                    {Array.isArray(analysisResult.evaluacion) && analysisResult.evaluacion.length > 0
                      ? analysisResult.evaluacion.join(' · ')
                      : 'No especificado'}
                  </p>
                </div>
              </div>
              <div className="list-item">
                <div>
                  <strong>Bibliografía</strong>
                  <p>
                    {Array.isArray(analysisResult.bibliografia) && analysisResult.bibliografia.length > 0
                      ? analysisResult.bibliografia.join(' · ')
                      : 'No especificado'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </SidePanel>
      ) : null}

      {isVerifyingAnalysis && analysisResult && canOperateMicrocurriculo ? (
        <SidePanel
          isOpen={isVerifyingAnalysis}
          title="Verificar Información Extraída"
          description="Asegura que los datos capturados del documento sean correctos antes de guardarlos."
          sideLabel="IA"
          sideDescription="EXTRACCIÓN"
          width="xl"
          onClose={() => setIsVerifyingAnalysis(false)}
          footer={
            <div className="flex justify-end gap-3 w-full">
               <button 
                type="button" 
                className="filter-chip px-6 py-2.5" 
                onClick={() => setIsVerifyingAnalysis(false)}
               >
                 <span>Cancelar</span>
               </button>
               <button 
                type="button" 
                className="cta-button shadow-lg shadow-ocean/20" 
                disabled={isMetadataSaving}
                onClick={async () => {
                  if (!currentCourse) return;
                  setIsMetadataSaving(true);
                  
                  const originalAppData = { ...appData };
                  const metadataUpdate = {
                    semester: analysisResult.semestre || '',
                    courseType: analysisResult.tipoCurso || '',
                    learningOutcomes: analysisResult.resultadosAprendizaje || [],
                    topics: (analysisResult.unidades || []).map((u: any) => u.tituloUnidad).filter(Boolean),
                    units: analysisResult.unidades || [],
                    methodology: analysisResult.metodologia || '',
                    evaluation: analysisResult.evaluacion || [],
                    bibliography: analysisResult.bibliografia || [],
                  };

                  try {
                    // 1. Optimistic update
                    mutateAppData((current) => ({
                      ...current,
                      courses: current.courses.map((c) =>
                        c.slug === currentCourse.slug
                          ? {
                              ...c,
                              faculty: analysisResult.facultad || c.faculty,
                              program: analysisResult.programa || c.program,
                              credits: Number(analysisResult.creditos) || c.credits,
                              summary: (analysisResult.descripcionCurso || c.summary).slice(0, 500), // Limit summary length
                              metadata: {
                                ...c.metadata,
                                ...metadataUpdate
                              }
                            }
                          : c
                      )
                    }));

                    // 2. Persist to API
                    const [resCourse, resMeta] = await Promise.all([
                      fetch(`/api/courses?slug=${encodeURIComponent(currentCourse.slug)}`, {
                        method: 'PATCH',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({
                          faculty: analysisResult.facultad,
                          program: analysisResult.programa,
                          credits: Number(analysisResult.creditos),
                          summary: analysisResult.descripcionCurso
                        })
                      }),
                      fetch(`/api/course-metadata?slug=${encodeURIComponent(currentCourse.slug)}`, {
                        method: 'PATCH',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify(metadataUpdate)
                      })
                    ]);

                    if (!resCourse.ok || !resMeta.ok) throw new Error('Error al sincronizar con el servidor.');

                    refreshAppData();
                    setIsVerifyingAnalysis(false);
                    showAlert({
                      title: 'Expediente actualizado',
                      message: 'La información del microcurrículo se ha guardado correctamente.',
                      tone: 'success'
                    });
                  } catch (error) {
                    mutateAppData(originalAppData);
                    showAlert({ 
                      title: 'Error al guardar', 
                      message: 'No se pudo actualizar el expediente operativo. Verifique la conexión.', 
                      tone: 'error' 
                    });
                  } finally {
                    setIsMetadataSaving(false);
                  }
                }}
               >
                 {isMetadataSaving ? <RefreshCcw size={18} className="animate-spin mr-2" /> : <Save size={18} className="mr-2" />}
                 <span>{isMetadataSaving ? 'Guardando...' : 'Guardar en Expediente'}</span>
               </button>
            </div>
          }
        >
          <div className="page-stack max-w-5xl mx-auto py-4">
             <div className="management-layout">
                <main className="page-stack gap-10">
                  <article className="detail-section">
                    <div className="section-heading mb-6 border-b border-line pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-ocean/10 text-ocean rounded-lg">
                          <Settings size={20} />
                        </div>
                        <h3 className="text-xl font-semibold tracking-tight">Metodatos del curso</h3>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="form-group">
                        <label className="form-label">Facultad / Escuela</label>
                        <input 
                          className="modern-input"
                          value={analysisResult.facultad || ''} 
                          onChange={(e) => setAnalysisResult({ ...analysisResult, facultad: e.target.value })} 
                          placeholder="Ej: Facultad de Ingeniería"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Programa Académico</label>
                        <input 
                          className="modern-input"
                          value={analysisResult.programa || ''} 
                          onChange={(e) => setAnalysisResult({ ...analysisResult, programa: e.target.value })} 
                          placeholder="Ej: Maestría en IA"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Semestre / Ciclo</label>
                        <input 
                          className="modern-input"
                          value={analysisResult.semestre || ''} 
                          onChange={(e) => setAnalysisResult({ ...analysisResult, semestre: e.target.value })} 
                          placeholder="Ej: Segundo Semestre"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Tipo de curso</label>
                        <input 
                          className="modern-input"
                          value={analysisResult.tipoCurso || ''} 
                          onChange={(e) => setAnalysisResult({ ...analysisResult, tipoCurso: e.target.value })} 
                          placeholder="Ej: Teórico-Práctico"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Créditos Académicos</label>
                        <input 
                          type="number" 
                          className="modern-input"
                          value={analysisResult.creditos || 0} 
                          onChange={(e) => setAnalysisResult({ ...analysisResult, creditos: Number(e.target.value) })} 
                        />
                      </div>
                    </div>
                  </article>

                  <article className="detail-section">
                    <div className="section-heading mb-6 border-b border-line pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-sage/10 text-sage rounded-lg">
                          <Target size={20} />
                        </div>
                        <h3 className="text-xl font-semibold tracking-tight">Académico y Resultados de Aprendizaje</h3>
                      </div>
                    </div>
                    <div className="space-y-8">
                      <div className="form-group">
                        <label className="form-label">Descripción o Justificación del curso</label>
                        <textarea 
                          rows={4} 
                          className="modern-textarea"
                          value={analysisResult.descripcionCurso || ''} 
                          onChange={(e) => setAnalysisResult({ ...analysisResult, descripcionCurso: e.target.value })} 
                          placeholder="Resumen del propósito del curso..."
                        />
                      </div>
                      <div className="form-group">
                         <label className="form-label">Resultados de aprendizaje esperados (RAE)</label>
                         <div className="grid gap-3">
                            {Array.isArray(analysisResult.resultadosAprendizaje) && analysisResult.resultadosAprendizaje.map((res: string, idx: number) => (
                              <div key={idx} className="flex gap-3 items-start group">
                                <textarea 
                                  rows={2} 
                                  className="modern-textarea flex-1 min-h-[70px] bg-white/50" 
                                  value={res} 
                                  onChange={(e) => {
                                    const arr = [...analysisResult.resultadosAprendizaje];
                                    arr[idx] = e.target.value;
                                    setAnalysisResult({ ...analysisResult, resultadosAprendizaje: arr });
                                  }} 
                                />
                                <button 
                                  className="p-3 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" 
                                  onClick={() => {
                                    const arr = [...analysisResult.resultadosAprendizaje];
                                    arr.splice(idx, 1);
                                    setAnalysisResult({ ...analysisResult, resultadosAprendizaje: arr });
                                  }}
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            ))}
                            <button 
                              className="filter-chip w-fit mt-2 border-dashed" 
                              onClick={() => setAnalysisResult({...analysisResult, resultadosAprendizaje: [...(analysisResult.resultadosAprendizaje||[]), '']})}
                            >
                              <Plus size={16} className="mr-2" /> 
                              <span>Agregar resultado</span>
                            </button>
                         </div>
                      </div>
                    </div>
                  </article>

                  <article className="detail-section">
                    <div className="section-heading mb-6 border-b border-line pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gold/10 text-gold rounded-lg">
                          <ClipboardCheck size={20} />
                        </div>
                        <h3 className="text-xl font-semibold tracking-tight">Metodología y Evaluación</h3>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                      <div className="form-group">
                        <label className="form-label">Estrategia Metodológica</label>
                        <textarea 
                          rows={6} 
                          className="modern-textarea"
                          value={analysisResult.metodologia || ''} 
                          onChange={(e) => setAnalysisResult({ ...analysisResult, metodologia: e.target.value })} 
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Esquema de Evaluación</label>
                        <div className="grid gap-2">
                            {Array.isArray(analysisResult.evaluacion) && analysisResult.evaluacion.map((ev: string, idx: number) => (
                              <div key={idx} className="flex gap-2 items-center group">
                                <input 
                                  className="modern-input flex-1 py-2" 
                                  value={ev} 
                                  onChange={(e) => {
                                    const arr = [...analysisResult.evaluacion];
                                    arr[idx] = e.target.value;
                                    setAnalysisResult({ ...analysisResult, evaluacion: arr });
                                  }} 
                                />
                                <button className="text-red-500 opacity-0 group-hover:opacity-100" onClick={() => {
                                  const arr = [...analysisResult.evaluacion];
                                  arr.splice(idx, 1);
                                  setAnalysisResult({ ...analysisResult, evaluacion: arr });
                                }}><Trash2 size={16} /></button>
                              </div>
                            ))}
                         </div>
                      </div>
                    </div>
                  </article>
                </main>
             </div>
          </div>
        </SidePanel>
      ) : null}
    </div>
  );
}
