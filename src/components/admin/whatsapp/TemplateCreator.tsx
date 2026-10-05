/**
 * "Create template" form for Admin -> Marketing -> Templates.
 * Submits to Meta through /api/whatsapp-reply { action: 'templates-create' }.
 */
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  AlertCircle,
  Bold,
  CornerUpLeft,
  ExternalLink,
  Italic,
  Loader2,
  Phone,
  Plus,
  Send,
  Trash2,
  Info,
} from 'lucide-react';
import {
  CATEGORY_HELP,
  TEMPLATE_LIMITS,
  extractVariables,
  nextVariableNumber,
  renderWithExamples,
  validateTemplateDraft,
  type TemplateButtonDraft,
  type TemplateCategory,
  type TemplateDraft,
} from './templateRules';
import WhatsAppPreviewBubble from './WhatsAppPreviewBubble';
import { whatsappAdminApi, WhatsAppApiError } from '@/services/whatsappAdminApi';

const LANGUAGES: Array<{ code: string; label: string }> = [
  { code: 'en_US', label: 'English (US)' },
  { code: 'en', label: 'English' },
  { code: 'en_GB', label: 'English (UK)' },
  { code: 'hi', label: 'Hindi' },
  { code: 'te', label: 'Telugu' },
  { code: 'ta', label: 'Tamil' },
  { code: 'kn', label: 'Kannada' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'mr', label: 'Marathi' },
  { code: 'bn', label: 'Bengali' },
  { code: 'gu', label: 'Gujarati' },
];

/** Shortcuts that insert the next variable and pre-fill its label and example. */
const VARIABLE_PRESETS: Array<{ label: string; example: string }> = [
  { label: 'Customer name', example: 'Priya' },
  { label: 'Order number', example: 'SS1024' },
  { label: 'Amount', example: 'Rs. 2,499' },
  { label: 'Date', example: '12 Oct' },
];

const inputCls =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition-[border-color,box-shadow] duration-150 focus:border-amber-500 focus:outline-none focus:ring-[3px] focus:ring-amber-500/15 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500 aria-[invalid=true]:border-red-400 dark:aria-[invalid=true]:border-red-500/70';

const chipBtn =
  'inline-flex min-h-9 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 transition-[background-color,transform] duration-150 hover:bg-gray-50 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800';

const emptyDraft = (): TemplateDraft => ({
  name: '',
  language: 'en_US',
  category: 'UTILITY',
  header: { text: '' },
  body: { text: '', examples: [] },
  footer: { text: '' },
  buttons: [],
  paramLabels: [],
  auth: { addSecurityRecommendation: true, codeExpirationMinutes: 10 },
});

export const TemplateCreator = ({ onCreated }: { onCreated?: () => void }) => {
  const [draft, setDraft] = useState<TemplateDraft>(emptyDraft);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const isAuth = draft.category === 'AUTHENTICATION';
  const bodyText = draft.body?.text || '';
  const vars = useMemo(() => extractVariables(bodyText), [bodyText]);
  const varCount = vars.length ? Math.max(...vars) : 0;
  const errors = useMemo(() => ({ ...validateTemplateDraft(draft), ...serverFieldErrors }), [draft, serverFieldErrors]);
  const errorFor = (key: string) => (submitted || touched[key] ? errors[key] : undefined);
  const touch = (key: string) => setTouched((t) => (t[key] ? t : { ...t, [key]: true }));

  const update = (patch: Partial<TemplateDraft>) => {
    setServerFieldErrors({});
    setServerError(null);
    setDraft((d) => ({ ...d, ...patch }));
  };
  const setBody = (text: string, examples = draft.body?.examples || []) => update({ body: { text, examples } });
  const setExample = (i: number, value: string) => {
    const examples = [...(draft.body?.examples || [])];
    examples[i] = value;
    update({ body: { text: bodyText, examples } });
  };
  const setLabel = (i: number, value: string) => {
    const labels = [...(draft.paramLabels || [])];
    labels[i] = value;
    update({ paramLabels: labels });
  };

  /** Insert text at the caret (or replace / wrap the selection). */
  const insertAtCaret = (makeText: (selected: string) => string, after?: (draftAfter: { text: string }) => void) => {
    const ta = bodyRef.current;
    const start = ta?.selectionStart ?? bodyText.length;
    const end = ta?.selectionEnd ?? bodyText.length;
    const selected = bodyText.slice(start, end);
    const insert = makeText(selected);
    const next = bodyText.slice(0, start) + insert + bodyText.slice(end);
    after?.({ text: next });
    requestAnimationFrame(() => {
      if (!ta) return;
      ta.focus();
      const caret = start + insert.length;
      ta.setSelectionRange(caret, caret);
    });
    return next;
  };

  const addVariable = (preset?: { label: string; example: string }) => {
    const n = nextVariableNumber(bodyText);
    const needsSpaceBefore = (() => {
      const pos = bodyRef.current?.selectionStart ?? bodyText.length;
      const prev = bodyText.slice(0, pos);
      return prev.length > 0 && !/\s$/.test(prev);
    })();
    const next = insertAtCaret(() => `${needsSpaceBefore ? ' ' : ''}{{${n}}}`);
    const examples = [...(draft.body?.examples || [])];
    const labels = [...(draft.paramLabels || [])];
    if (preset) {
      examples[n - 1] = examples[n - 1] || preset.example;
      labels[n - 1] = labels[n - 1] || preset.label;
    }
    setServerFieldErrors({});
    setDraft((d) => ({ ...d, body: { text: next, examples }, paramLabels: labels }));
  };

  const wrapSelection = (mark: string) => {
    const next = insertAtCaret((sel) => `${mark}${sel || 'text'}${mark}`);
    setBody(next);
  };

  const buttons = draft.buttons || [];
  const setButton = (i: number, patch: Partial<TemplateButtonDraft>) => {
    const next = buttons.map((b, idx) => (idx === i ? ({ ...b, ...patch } as TemplateButtonDraft) : b));
    update({ buttons: next });
  };
  const addButton = (type: TemplateButtonDraft['type']) => {
    const b: TemplateButtonDraft =
      type === 'URL' ? { type, text: 'Visit website', url: 'https://' } : type === 'PHONE_NUMBER' ? { type, text: 'Call us', phone: '+91' } : { type, text: '' };
    update({ buttons: [...buttons, b] });
  };
  const removeButton = (i: number) => update({ buttons: buttons.filter((_, idx) => idx !== i) });
  const urlCount = buttons.filter((b) => b.type === 'URL').length;
  const phoneCount = buttons.filter((b) => b.type === 'PHONE_NUMBER').length;
  const canAddButton = buttons.length < TEMPLATE_LIMITS.buttons;

  const payload = (): TemplateDraft => {
    if (isAuth) return { name: draft.name.trim(), language: draft.language, category: draft.category, auth: draft.auth };
    return {
      name: draft.name.trim(),
      language: draft.language,
      category: draft.category,
      header: draft.header?.text?.trim() ? { text: draft.header.text.trim() } : null,
      body: { text: bodyText.trim(), examples: Array.from({ length: varCount }, (_, i) => (draft.body?.examples?.[i] || '').trim()) },
      footer: draft.footer?.text?.trim() ? { text: draft.footer.text.trim() } : null,
      buttons,
      paramLabels: Array.from({ length: varCount }, (_, i) => (draft.paramLabels?.[i] || '').trim()),
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const local = validateTemplateDraft(draft);
    if (Object.keys(local).length) {
      setServerError('Fix the highlighted fields first.');
      const firstKey = Object.keys(local)[0];
      document.getElementById(`tpl-${firstKey.replace(/\./g, '-')}`)?.focus();
      return;
    }
    setSaving(true);
    setServerError(null);
    try {
      const resp = await whatsappAdminApi.createTemplate(payload());
      toast.success(`"${resp.template.name}" sent to Meta for review`, {
        description: 'Status shows "In review" until Meta approves it. Use Sync from Meta to refresh.',
      });
      setDraft(emptyDraft());
      setTouched({});
      setSubmitted(false);
      onCreated?.();
    } catch (err) {
      const apiErr = err instanceof WhatsAppApiError ? err : null;
      setServerError(apiErr?.message || 'Could not create the template.');
      if (apiErr?.fieldErrors) setServerFieldErrors(apiErr.fieldErrors);
    } finally {
      setSaving(false);
    }
  };

  // ---- preview content
  const examples = draft.body?.examples || [];
  const previewBody = isAuth
    ? `*123456* is your verification code.${draft.auth?.addSecurityRecommendation !== false ? ' For your security, do not share this code.' : ''}`
    : renderWithExamples(bodyText, examples);
  const previewFooter = isAuth
    ? draft.auth?.codeExpirationMinutes
      ? `This code expires in ${draft.auth.codeExpirationMinutes} minutes.`
      : null
    : draft.footer?.text || null;
  const previewButtons = isAuth
    ? [{ type: 'OTP', text: 'Copy code' }]
    : [...buttons.filter((b) => b.type === 'QUICK_REPLY'), ...buttons.filter((b) => b.type !== 'QUICK_REPLY')];

  return (
    <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      {/* ------------------------------------------------------------ form */}
      <div className="space-y-5 lg:col-start-1 lg:row-start-1">
        <Card title="Basics">
          <FieldRow id="tpl-name" label="Template name" hint="Lowercase letters, numbers and underscores. A deleted name can't be reused for 30 days." error={errorFor('name')}>
            <input
              id="tpl-name"
              value={draft.name}
              onChange={(e) => update({ name: e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') })}
              onBlur={() => touch('name')}
              placeholder="order_shipped_v1"
              maxLength={TEMPLATE_LIMITS.name}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!!errorFor('name')}
              className={`${inputCls} font-mono`}
            />
          </FieldRow>
          <FieldRow id="tpl-language" label="Language" error={errorFor('language')}>
            <select id="tpl-language" value={draft.language} onChange={(e) => update({ language: e.target.value })} className={inputCls}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label} ({l.code})
                </option>
              ))}
            </select>
          </FieldRow>
          <fieldset>
            <legend className="mb-2 text-xs font-medium text-gray-700 dark:text-gray-300">Category</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup">
              {(Object.keys(CATEGORY_HELP) as TemplateCategory[]).map((c) => {
                const active = draft.category === c;
                return (
                  <label
                    key={c}
                    className={`relative flex cursor-pointer flex-col gap-0.5 rounded-xl border p-3 transition-[border-color,background-color] duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-amber-500 ${
                      active
                        ? 'border-amber-400 bg-amber-50/70 dark:border-amber-500/60 dark:bg-amber-500/10'
                        : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-950 dark:hover:border-gray-600'
                    }`}
                  >
                    <input type="radio" name="tpl-category" value={c} checked={active} onChange={() => update({ category: c })} className="sr-only" />
                    <span className={`text-sm font-medium ${active ? 'text-amber-900 dark:text-amber-200' : 'text-gray-900 dark:text-gray-100'}`}>{CATEGORY_HELP[c].label}</span>
                  </label>
                );
              })}
            </div>
            <p className="mt-2 flex gap-1.5 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
              <Info className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden />
              <span>{CATEGORY_HELP[draft.category].help}</span>
            </p>
          </fieldset>
        </Card>

        {isAuth ? (
          <Card title="Code message">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Meta writes authentication messages itself. You only choose these options.
            </p>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-gray-800 dark:text-gray-200">
              <input
                type="checkbox"
                checked={draft.auth?.addSecurityRecommendation !== false}
                onChange={(e) => update({ auth: { ...draft.auth, addSecurityRecommendation: e.target.checked } })}
                className="h-4 w-4 accent-amber-600"
              />
              Add "For your security, do not share this code."
            </label>
            <FieldRow id="tpl-auth-codeExpirationMinutes" label="Code expires after (minutes, optional)" error={errorFor('auth.codeExpirationMinutes')}>
              <input
                id="tpl-auth-codeExpirationMinutes"
                type="number"
                inputMode="numeric"
                min={1}
                max={90}
                value={draft.auth?.codeExpirationMinutes ?? ''}
                onChange={(e) => update({ auth: { ...draft.auth, codeExpirationMinutes: e.target.value === '' ? null : Number(e.target.value) } })}
                onBlur={() => touch('auth.codeExpirationMinutes')}
                aria-invalid={!!errorFor('auth.codeExpirationMinutes')}
                className={`${inputCls} max-w-[10rem]`}
              />
            </FieldRow>
          </Card>
        ) : (
          <>
            <Card title="Message">
              <FieldRow id="tpl-header-text" label="Header (optional)" counter={`${(draft.header?.text || '').length}/${TEMPLATE_LIMITS.header}`} error={errorFor('header.text')}>
                <input
                  id="tpl-header-text"
                  value={draft.header?.text || ''}
                  onChange={(e) => update({ header: { text: e.target.value } })}
                  onBlur={() => touch('header.text')}
                  maxLength={TEMPLATE_LIMITS.header}
                  placeholder="Your order is on its way"
                  aria-invalid={!!errorFor('header.text')}
                  className={inputCls}
                />
              </FieldRow>

              <div>
                <div className="mb-1.5 flex items-end justify-between gap-2">
                  <label htmlFor="tpl-body-text" className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Message text <span className="text-red-600 dark:text-red-400">*</span>
                  </label>
                  <span className="text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
                    {bodyText.length}/{TEMPLATE_LIMITS.body}
                  </span>
                </div>
                <div className="mb-2 flex flex-wrap items-center gap-1.5" aria-label="Insert into message">
                  <button type="button" onClick={() => addVariable()} className={`${chipBtn} border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/20`}>
                    <Plus className="h-3.5 w-3.5" aria-hidden /> Add variable {`{{${nextVariableNumber(bodyText)}}}`}
                  </button>
                  {VARIABLE_PRESETS.map((p) => (
                    <button key={p.label} type="button" onClick={() => addVariable(p)} className={chipBtn}>
                      {p.label}
                    </button>
                  ))}
                  <span className="mx-1 hidden h-5 w-px bg-gray-200 dark:bg-gray-700 sm:block" aria-hidden />
                  <button type="button" onClick={() => wrapSelection('*')} className={chipBtn} aria-label="Bold selected text">
                    <Bold className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button type="button" onClick={() => wrapSelection('_')} className={chipBtn} aria-label="Italic selected text">
                    <Italic className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
                <textarea
                  id="tpl-body-text"
                  ref={bodyRef}
                  value={bodyText}
                  onChange={(e) => setBody(e.target.value)}
                  onBlur={() => touch('body.text')}
                  rows={6}
                  maxLength={TEMPLATE_LIMITS.body}
                  placeholder={'Hi {{1}}, your Sreerasthu Silvers order {{2}} has been shipped. We will message you again when it is out for delivery.'}
                  aria-invalid={!!errorFor('body.text')}
                  aria-describedby="tpl-body-help"
                  className={`${inputCls} resize-y leading-relaxed`}
                />
                {errorFor('body.text') ? (
                  <FieldError>{errorFor('body.text')}</FieldError>
                ) : (
                  <p id="tpl-body-help" className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                    Variables are filled in when you send, for example the customer's name. Use *bold* and _italic_ like in WhatsApp.
                  </p>
                )}
              </div>

              {varCount > 0 && (
                <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-950/60">
                  <p className="mb-2 text-xs font-medium text-gray-800 dark:text-gray-200">Variables</p>
                  <p className="mb-3 text-[11px] text-gray-600 dark:text-gray-400">
                    Meta needs a realistic example for each variable to approve the template. The name helps your team when sending.
                  </p>
                  <div className="space-y-3">
                    {Array.from({ length: varCount }, (_, i) => (
                      <div key={i} className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-start gap-2 sm:grid-cols-[2.75rem_minmax(0,1fr)_minmax(0,1fr)]">
                        <span className="mt-2 inline-flex h-7 items-center justify-center rounded-md bg-white font-mono text-xs text-gray-700 ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-200 dark:ring-gray-700">
                          {`{{${i + 1}}}`}
                        </span>
                        <div>
                          <label htmlFor={`tpl-label-${i}`} className="sr-only">{`Name for variable ${i + 1}`}</label>
                          <input
                            id={`tpl-label-${i}`}
                            value={draft.paramLabels?.[i] || ''}
                            onChange={(e) => setLabel(i, e.target.value)}
                            maxLength={TEMPLATE_LIMITS.label}
                            placeholder="What is it? e.g. Customer name"
                            className={inputCls}
                          />
                        </div>
                        <div className="col-start-2 sm:col-start-3">
                          <label htmlFor={`tpl-body-examples-${i}`} className="sr-only">{`Example for variable ${i + 1}`}</label>
                          <input
                            id={`tpl-body-examples-${i}`}
                            value={examples[i] || ''}
                            onChange={(e) => setExample(i, e.target.value)}
                            onBlur={() => touch(`body.examples.${i}`)}
                            maxLength={TEMPLATE_LIMITS.example}
                            placeholder="Example, e.g. Priya"
                            aria-invalid={!!errorFor(`body.examples.${i}`)}
                            className={inputCls}
                          />
                          {errorFor(`body.examples.${i}`) && <FieldError>{errorFor(`body.examples.${i}`)}</FieldError>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <FieldRow id="tpl-footer-text" label="Footer (optional)" counter={`${(draft.footer?.text || '').length}/${TEMPLATE_LIMITS.footer}`} error={errorFor('footer.text')}>
                <input
                  id="tpl-footer-text"
                  value={draft.footer?.text || ''}
                  onChange={(e) => update({ footer: { text: e.target.value } })}
                  onBlur={() => touch('footer.text')}
                  maxLength={TEMPLATE_LIMITS.footer}
                  placeholder="Reply STOP to opt out"
                  aria-invalid={!!errorFor('footer.text')}
                  className={inputCls}
                />
              </FieldRow>
            </Card>

            <Card title="Buttons (optional)" aside={<span className="text-[11px] tabular-nums text-gray-500 dark:text-gray-400">{buttons.length}/{TEMPLATE_LIMITS.buttons}</span>}>
              {buttons.length === 0 && (
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Quick replies let customers answer with one tap. Website and call buttons open a link or dial your number.
                </p>
              )}
              <ul className="space-y-3">
                {buttons.map((b, i) => (
                  <li key={i} className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                        {b.type === 'URL' ? <ExternalLink className="h-3.5 w-3.5" aria-hidden /> : b.type === 'PHONE_NUMBER' ? <Phone className="h-3.5 w-3.5" aria-hidden /> : <CornerUpLeft className="h-3.5 w-3.5" aria-hidden />}
                        {b.type === 'URL' ? 'Website link' : b.type === 'PHONE_NUMBER' ? 'Call phone number' : 'Quick reply'}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeButton(i)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-[background-color,transform] duration-150 hover:bg-red-50 hover:text-red-700 active:scale-[0.97] dark:text-gray-400 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                        aria-label={`Remove button ${i + 1}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                    <div className={`grid gap-2 ${b.type === 'QUICK_REPLY' ? '' : 'sm:grid-cols-2'}`}>
                      <div>
                        <label htmlFor={`tpl-buttons-${i}-text`} className="sr-only">Button label</label>
                        <input
                          id={`tpl-buttons-${i}-text`}
                          value={b.text}
                          onChange={(e) => setButton(i, { text: e.target.value })}
                          onBlur={() => touch(`buttons.${i}.text`)}
                          maxLength={TEMPLATE_LIMITS.buttonText}
                          placeholder={b.type === 'QUICK_REPLY' ? 'e.g. Track my order' : 'Button label'}
                          aria-invalid={!!errorFor(`buttons.${i}.text`)}
                          className={inputCls}
                        />
                        {errorFor(`buttons.${i}.text`) && <FieldError>{errorFor(`buttons.${i}.text`)}</FieldError>}
                      </div>
                      {b.type === 'URL' && (
                        <div>
                          <label htmlFor={`tpl-buttons-${i}-url`} className="sr-only">Link</label>
                          <input
                            id={`tpl-buttons-${i}-url`}
                            type="url"
                            inputMode="url"
                            value={b.url}
                            onChange={(e) => setButton(i, { url: e.target.value } as Partial<TemplateButtonDraft>)}
                            onBlur={() => touch(`buttons.${i}.url`)}
                            placeholder="https://sreerasthusilvers.com"
                            aria-invalid={!!errorFor(`buttons.${i}.url`)}
                            className={inputCls}
                          />
                          {errorFor(`buttons.${i}.url`) && <FieldError>{errorFor(`buttons.${i}.url`)}</FieldError>}
                        </div>
                      )}
                      {b.type === 'PHONE_NUMBER' && (
                        <div>
                          <label htmlFor={`tpl-buttons-${i}-phone`} className="sr-only">Phone number</label>
                          <input
                            id={`tpl-buttons-${i}-phone`}
                            type="tel"
                            inputMode="tel"
                            value={b.phone}
                            onChange={(e) => setButton(i, { phone: e.target.value } as Partial<TemplateButtonDraft>)}
                            onBlur={() => touch(`buttons.${i}.phone`)}
                            placeholder="+919876543210"
                            aria-invalid={!!errorFor(`buttons.${i}.phone`)}
                            className={inputCls}
                          />
                          {errorFor(`buttons.${i}.phone`) && <FieldError>{errorFor(`buttons.${i}.phone`)}</FieldError>}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {errors.buttons && <FieldError>{errors.buttons}</FieldError>}
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={!canAddButton} onClick={() => addButton('QUICK_REPLY')} className={`${chipBtn} disabled:opacity-50`}>
                  <CornerUpLeft className="h-3.5 w-3.5" aria-hidden /> Quick reply
                </button>
                <button type="button" disabled={!canAddButton || urlCount >= TEMPLATE_LIMITS.urlButtons} onClick={() => addButton('URL')} className={`${chipBtn} disabled:opacity-50`}>
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Website link
                </button>
                <button type="button" disabled={!canAddButton || phoneCount >= TEMPLATE_LIMITS.phoneButtons} onClick={() => addButton('PHONE_NUMBER')} className={`${chipBtn} disabled:opacity-50`}>
                  <Phone className="h-3.5 w-3.5" aria-hidden /> Call number
                </button>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* --------------------------------------------------------- preview */}
      <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <div className="space-y-2 lg:sticky lg:top-4">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Preview</p>
          <WhatsAppPreviewBubble header={isAuth ? null : draft.header?.text} body={previewBody} footer={previewFooter} buttons={previewButtons} />
          <p className="text-[11px] text-gray-500 dark:text-gray-400">Shown with your example values. Customers see their own details.</p>
        </div>
      </div>

      {/* --------------------------------------------------------- actions */}
      <div className="space-y-3 lg:col-start-1 lg:row-start-2">
        <div aria-live="polite">
          {serverError && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
              <span>{serverError}</span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-amber-600 px-5 text-sm font-medium text-white transition-[background-color,transform] duration-150 hover:bg-amber-700 active:scale-[0.97] disabled:bg-gray-300 disabled:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
            {saving ? 'Submitting…' : 'Submit to Meta for review'}
          </button>
          <p className="text-xs text-gray-500 dark:text-gray-400">Review usually takes a few minutes, sometimes up to 24 hours.</p>
        </div>
      </div>
    </form>
  );
};

// ---------------------------------------------------------------------------
const Card = ({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) => (
  <section className="space-y-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-5">
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      {aside}
    </div>
    {children}
  </section>
);

const FieldError = ({ children }: { children: ReactNode }) => (
  <p className="mt-1.5 flex items-start gap-1 text-[12px] text-red-700 dark:text-red-300">
    <AlertCircle className="mt-[2px] h-3 w-3 flex-none" aria-hidden />
    <span>{children}</span>
  </p>
);

const FieldRow = ({
  id,
  label,
  hint,
  counter,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  counter?: string;
  error?: string;
  children: ReactNode;
}) => (
  <div>
    <div className="mb-1.5 flex items-end justify-between gap-2">
      <label htmlFor={id} className="text-xs font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      {counter && <span className="text-[11px] tabular-nums text-gray-500 dark:text-gray-400">{counter}</span>}
    </div>
    {children}
    {error ? <FieldError>{error}</FieldError> : hint ? <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">{hint}</p> : null}
  </div>
);

export default TemplateCreator;
