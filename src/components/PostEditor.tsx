'use client';

import { useActionState, useEffect, useId, useRef, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';
import { savePost, autosavePost, archivePost } from '@/app/admin/actions';
import { slugify, shortDate } from '@/lib/format';
import type { Block } from '@/lib/schema';
import { AutoGrowTextarea } from './AutoGrowTextarea';
import { Squiggle } from './Squiggle';
import { BlockRenderer } from './BlockRenderer';
import adminStyles from '@/app/admin/admin.module.css';
import styles from './PostEditor.module.css';

export type PostDraft = {
  id?: number;
  slug: string;
  title: string;
  dek: string;
  blocks: Block[];
  status: 'draft' | 'published';
  publishedAtLocal: string;
};

const randomId = () => Math.random().toString(36).slice(2, 10);

const AUTOSAVE_INTERVAL_MS = 20_000;

type LocalDraftSnapshot = {
  title: string;
  dek: string;
  blocks: Block[];
  status: 'draft' | 'published';
  publishedAtLocal: string;
  savedAt: number;
};

function localDraftKey(id: number | undefined) {
  return `greendal:post-draft:${id ?? 'new'}`;
}

function readLocalDraft(id: number | undefined): LocalDraftSnapshot | null {
  try {
    const raw = localStorage.getItem(localDraftKey(id));
    return raw ? (JSON.parse(raw) as LocalDraftSnapshot) : null;
  } catch {
    return null;
  }
}

function writeLocalDraft(id: number | undefined, snap: Omit<LocalDraftSnapshot, 'savedAt'>) {
  try {
    localStorage.setItem(localDraftKey(id), JSON.stringify({ ...snap, savedAt: Date.now() }));
  } catch {
    // Private browsing, full quota, etc. — the backup is best-effort only.
  }
}

function clearLocalDraft(id: number | undefined) {
  try {
    localStorage.removeItem(localDraftKey(id));
  } catch {
    // ignore
  }
}

function emptyBlock(type: Block['type']): Block {
  switch (type) {
    case 'text':
      return { id: randomId(), type: 'text', markdown: '' };
    case 'heading':
      return { id: randomId(), type: 'heading', text: '', level: 2 };
    case 'divider':
      return { id: randomId(), type: 'divider', style: 'rule' };
    case 'ps':
      return { id: randomId(), type: 'ps', text: '', recipeId: null };
    case 'image':
      return { id: randomId(), type: 'image', url: '', alt: '' };
  }
}

const DIVIDER_STYLES = ['rule', 'squiggle', 'dots'] as const;

/** Block types with a single primary text field — the ones Cmd+Enter/Backspace shortcuts apply to. */
const TEXT_LIKE_TYPES = new Set<Block['type']>(['text', 'heading', 'ps']);

const INSERTABLE: { type: Block['type']; label: string }[] = [
  { type: 'text', label: 'text' },
  { type: 'heading', label: 'heading' },
  { type: 'image', label: 'image' },
  { type: 'divider', label: 'divider' },
  { type: 'ps', label: 'ps' },
];

export function PostEditor({
  draft,
  recipeOptions,
}: {
  draft: PostDraft;
  recipeOptions: { id: number; title: string; slug: string }[];
}) {
  const [state, action, pending] = useActionState(savePost, undefined);
  const [title, setTitle] = useState(draft.title);
  const [dek, setDek] = useState(draft.dek);
  const [slug, setSlug] = useState(draft.slug);
  const [slugTouched, setSlugTouched] = useState(Boolean(draft.slug));
  const [status, setStatus] = useState(draft.status);
  const [publishedAtLocal, setPublishedAtLocal] = useState(draft.publishedAtLocal);
  // The very first block of a brand-new post is part of the initial (server-rendered)
  // state, so its id can't come from Math.random() — that runs separately on the
  // server and during client hydration and would produce two different ids for the
  // same DOM node. useId() is stable across both.
  const initialBlockId = useId();
  const [blocks, setBlocks] = useState<Block[]>(() =>
    draft.blocks.length ? draft.blocks : [{ id: `b${initialBlockId}`, type: 'text', markdown: '' }],
  );
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  /** Which gap's insert menu is open, indexed 0..blocks.length (a gap sits before block i). */
  const [insertMenuAt, setInsertMenuAt] = useState<number | null>(null);
  /** A block whose editable field should be focused once it's in the DOM — set right after inserting or merging a block. */
  const [focusRequest, setFocusRequest] = useState<{ id: string; atEnd?: boolean } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // A brand-new post has no id until the first autosave creates its row —
  // postId tracks that, separately from the immutable draft.id prop.
  const [postId, setPostId] = useState(draft.id);
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(draft.id ? Date.now() : null);
  const [previewMode, setPreviewMode] = useState(false);
  const [restoreBanner, setRestoreBanner] = useState<LocalDraftSnapshot | null>(null);

  const recipeLinks = new Map(recipeOptions.map((r) => [r.id, { slug: r.slug, title: r.title }]));

  /** Serialized against savedSnapshotRef to decide whether there's anything unsaved. */
  function snapshot() {
    return JSON.stringify({ title, dek, blocks, status, publishedAtLocal });
  }
  const savedSnapshotRef = useRef(snapshot());
  const latestRef = useRef({ title, dek, slug, slugTouched, status, publishedAtLocal, blocks, postId });
  useEffect(() => {
    latestRef.current = { title, dek, slug, slugTouched, status, publishedAtLocal, blocks, postId };
  });

  // Offer to restore a local backup left behind by a tab that died before its
  // next autosave or explicit save — existence of the entry is the signal.
  useEffect(() => {
    const saved = readLocalDraft(draft.id);
    if (saved) setRestoreBanner(saved);
    // Only on mount: draft.id is a stable prop for this editor instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced local backup on every content change.
  useEffect(() => {
    const t = setTimeout(() => {
      writeLocalDraft(postId, { title, dek, blocks, status, publishedAtLocal });
    }, 800);
    return () => clearTimeout(t);
  }, [title, dek, blocks, status, publishedAtLocal, postId]);

  // Warn before closing/navigating away with unsaved changes.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (snapshot() === savedSnapshotRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, dek, blocks, status, publishedAtLocal]);

  // Autosave to the server every ~20s, only when something actually changed.
  useEffect(() => {
    const timer = setInterval(async () => {
      const cur = latestRef.current;
      const serialized = JSON.stringify({
        title: cur.title,
        dek: cur.dek,
        blocks: cur.blocks,
        status: cur.status,
        publishedAtLocal: cur.publishedAtLocal,
      });
      if (serialized === savedSnapshotRef.current) return;
      if (!cur.title.trim()) return;

      setAutosaveStatus('saving');
      const form = new FormData();
      if (cur.postId) form.set('id', String(cur.postId));
      form.set('title', cur.title);
      form.set('slug', cur.slugTouched ? cur.slug : slugify(cur.title));
      form.set('dek', cur.dek);
      form.set('status', cur.status);
      form.set('publishedAt', cur.publishedAtLocal);
      form.set('blocks', JSON.stringify(cur.blocks));

      const result = await autosavePost(form);
      if ('error' in result) {
        setAutosaveStatus('error');
        return;
      }
      if (!cur.postId) {
        clearLocalDraft(draft.id);
        setPostId(result.id);
      }
      clearLocalDraft(result.id);
      savedSnapshotRef.current = serialized;
      setLastSavedAt(Date.now());
      setAutosaveStatus('saved');
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function restoreLocalDraft() {
    if (!restoreBanner) return;
    setTitle(restoreBanner.title);
    setDek(restoreBanner.dek);
    setBlocks(restoreBanner.blocks);
    setStatus(restoreBanner.status);
    setPublishedAtLocal(restoreBanner.publishedAtLocal);
    setRestoreBanner(null);
  }
  function discardLocalDraft() {
    clearLocalDraft(draft.id);
    setRestoreBanner(null);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (!focusRequest) return;
    const el = document.querySelector<HTMLTextAreaElement | HTMLInputElement>(
      `[data-block-id="${focusRequest.id}"]`,
    );
    if (el) {
      el.focus();
      if (focusRequest.atEnd) el.setSelectionRange(el.value.length, el.value.length);
    }
    setFocusRequest(null);
  }, [focusRequest]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setBlocks((bs) => {
      const from = bs.findIndex((b) => b.id === active.id);
      const to = bs.findIndex((b) => b.id === over.id);
      if (from < 0 || to < 0) return bs;
      return arrayMove(bs, from, to);
    });
  }

  const effectiveSlug = slugTouched ? slug : slugify(title);

  function updateBlock(id: string, patch: Partial<Block>) {
    setBlocks((bs) => bs.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)));
  }
  function removeBlock(id: string) {
    setBlocks((bs) => (bs.length > 1 ? bs.filter((b) => b.id !== id) : bs));
    setMenuOpenId(null);
  }
  function moveBlock(id: string, dir: -1 | 1) {
    setBlocks((bs) => {
      const i = bs.findIndex((b) => b.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= bs.length) return bs;
      const next = [...bs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function duplicateBlock(id: string) {
    setBlocks((bs) => {
      const i = bs.findIndex((b) => b.id === id);
      if (i < 0) return bs;
      const copy = { ...bs[i], id: randomId() } as Block;
      const next = [...bs];
      next.splice(i + 1, 0, copy);
      return next;
    });
    setMenuOpenId(null);
  }
  function insertBlock(type: Block['type'], atIndex: number) {
    setBlocks((bs) => {
      const next = [...bs];
      next.splice(atIndex, 0, emptyBlock(type));
      return next;
    });
    setInsertMenuAt(null);
  }
  /** Cmd/Ctrl+Enter inside a block: a fresh text block right after it, focused. */
  function insertTextBlockAfter(id: string) {
    const newBlock = emptyBlock('text');
    setBlocks((bs) => {
      const i = bs.findIndex((b) => b.id === id);
      if (i < 0) return bs;
      const next = [...bs];
      next.splice(i + 1, 0, newBlock);
      return next;
    });
    setFocusRequest({ id: newBlock.id });
  }
  /** Backspace at the start of an empty block: remove it, land at the end of the previous one. */
  function mergeBackspace(id: string) {
    const i = blocks.findIndex((b) => b.id === id);
    if (i <= 0) return;
    const prev = blocks[i - 1];
    if (TEXT_LIKE_TYPES.has(prev.type)) setFocusRequest({ id: prev.id, atEnd: true });
    setBlocks((bs) => bs.filter((b) => b.id !== id));
  }

  return (
    <form action={action} ref={formRef}>
      <div className="sectionMark">
        <span className="hand">{postId ? 'edit' : 'new thought'}</span>
      </div>

      {state?.error && <div className={adminStyles.error}>{state.error}</div>}
      {restoreBanner && (
        <div className={adminStyles.error} style={{ background: 'var(--paper-deep)', borderColor: 'var(--rule)', color: 'var(--ink)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span>
            There&rsquo;s an unsaved version from {new Date(restoreBanner.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Restore it?
          </span>
          <span style={{ display: 'flex', gap: 8 }}>
            <button type="button" className={adminStyles.buttonSmall} onClick={restoreLocalDraft}>
              Restore
            </button>
            <button type="button" className={adminStyles.buttonSmall} onClick={discardLocalDraft}>
              Discard
            </button>
          </span>
        </div>
      )}
      {postId && <input type="hidden" name="id" value={postId} />}
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="slug" value={effectiveSlug} />
      <input type="hidden" name="dek" value={dek} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="publishedAt" value={publishedAtLocal} />
      <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />

      {previewMode ? (
        <div className="shell shell--narrow" style={{ padding: 0 }}>
          <h1
            style={{
              margin: 0,
              fontWeight: 300,
              letterSpacing: '-0.015em',
              fontSize: 'clamp(32px, 6vw, 46px)',
              lineHeight: 1.15,
              color: 'var(--ink)',
            }}
          >
            {title || 'Untitled'}
          </h1>
          {dek && <p style={{ margin: '10px 0 0', fontSize: 16.5, lineHeight: 1.5, color: 'var(--ink-quiet)' }}>{dek}</p>}
          <Squiggle width={180} color="var(--rust)" />
          <div style={{ marginTop: 26 }}>
            <BlockRenderer blocks={blocks} recipeLinks={recipeLinks} />
          </div>
        </div>
      ) : (
      <>
      <div className={styles.metaRow}>
        <label className={styles.metaField} style={{ flex: '1 1 200px' }}>
          <span className={styles.metaLabel}>web address</span>
          <input
            className={styles.metaInput}
            value={effectiveSlug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
          />
        </label>
        <label className={styles.metaField}>
          <span className={styles.metaLabel}>status</span>
          <select className={styles.metaInput} value={status} onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}>
            <option value="draft">draft</option>
            <option value="published">published</option>
          </select>
        </label>
        <label className={styles.metaField}>
          <span className={styles.metaLabel}>published</span>
          <input
            className={styles.metaInput}
            type="datetime-local"
            value={publishedAtLocal}
            onChange={(e) => setPublishedAtLocal(e.target.value)}
          />
        </label>
      </div>

      <div className="shell shell--narrow" style={{ padding: 0 }}>
        <AutoGrowTextarea
          className={styles.titleInput}
          value={title}
          onChange={setTitle}
          placeholder="title"
        />
        <AutoGrowTextarea
          className={styles.dekInput}
          value={dek}
          onChange={setDek}
          placeholder="one-line teaser for the home page"
        />
        <Squiggle width={180} color="var(--rust)" />

        <div className={styles.blockList} style={{ marginTop: 26 }}>
          <InsertGap
            open={insertMenuAt === 0}
            onToggle={() => setInsertMenuAt((cur) => (cur === 0 ? null : 0))}
            onInsert={(type) => insertBlock(type, 0)}
          />
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          {blocks.map((block, i) => (
            <div key={block.id}>
              <EditableBlock
                block={block}
                menuOpen={menuOpenId === block.id}
                onToggleMenu={() => setMenuOpenId((cur) => (cur === block.id ? null : block.id))}
                onCloseMenu={() => setMenuOpenId(null)}
                onChange={(patch) => updateBlock(block.id, patch)}
                onMoveUp={() => moveBlock(block.id, -1)}
                onMoveDown={() => moveBlock(block.id, 1)}
                onDuplicate={() => duplicateBlock(block.id)}
                onDelete={() => removeBlock(block.id)}
                onNewBlockBelow={() => insertTextBlockAfter(block.id)}
                onBackspaceMerge={() => mergeBackspace(block.id)}
                canMoveUp={i > 0}
                canMoveDown={i < blocks.length - 1}
                canDelete={blocks.length > 1}
                recipeOptions={recipeOptions}
              />
              {i < blocks.length - 1 && (
                <InsertGap
                  open={insertMenuAt === i + 1}
                  onToggle={() => setInsertMenuAt((cur) => (cur === i + 1 ? null : i + 1))}
                  onInsert={(type) => insertBlock(type, i + 1)}
                />
              )}
            </div>
          ))}
          </SortableContext>
          </DndContext>
        </div>

        <div className={styles.insertGapEnd}>
          <button
            type="button"
            className={styles.insertButton}
            onClick={() => setInsertMenuAt((cur) => (cur === blocks.length ? null : blocks.length))}
          >
            + add block
          </button>
          {insertMenuAt === blocks.length && (
            <InsertMenu onInsert={(type) => insertBlock(type, blocks.length)} onClose={() => setInsertMenuAt(null)} />
          )}
        </div>
      </div>
      </>
      )}

      <div className={adminStyles.sticky} style={{ flexWrap: 'wrap' }}>
        <button
          className={adminStyles.button}
          type="submit"
          disabled={pending}
          onClick={() => clearLocalDraft(postId)}
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className={adminStyles.buttonGhost} onClick={() => setPreviewMode((v) => !v)}>
          {previewMode ? 'back to editing' : 'preview'}
        </button>
        {postId && (
          <button
            className={adminStyles.buttonSmall}
            type="submit"
            formAction={archivePost}
            formNoValidate
            onClick={(e) => {
              if (!confirm(`Archive "${title || 'this thought'}"? It disappears from the site but stays in the archive.`)) {
                e.preventDefault();
              }
            }}
          >
            Archive
          </button>
        )}
        <span style={{ fontSize: 12.5, color: 'var(--ink-quiet)' }}>
          {status === 'draft' ? 'draft' : `published${publishedAtLocal ? ' · ' + shortDate(Math.floor(new Date(publishedAtLocal).getTime() / 1000)) : ''}`}
        </span>
        {status === 'published' && postId && (
          <Link href={`/thoughts/${effectiveSlug}`} target="_blank" style={{ fontSize: 12.5 }}>
            open on site
          </Link>
        )}
        <span style={{ fontSize: 12, color: 'var(--ink-quiet)', marginLeft: 'auto' }}>
          {autosaveStatus === 'saving' && 'saving…'}
          {autosaveStatus === 'saved' && lastSavedAt && `saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
          {autosaveStatus === 'error' && 'autosave failed — use Save'}
        </span>
      </div>
    </form>
  );
}

function InsertGap({
  open,
  onToggle,
  onInsert,
}: {
  open: boolean;
  onToggle: () => void;
  onInsert: (type: Block['type']) => void;
}) {
  return (
    <div className={`${styles.insertGap} ${open ? styles.menuOpen : ''}`}>
      <button type="button" className={styles.insertButton} onClick={onToggle} aria-label="Insert block">
        +
      </button>
      {open && <InsertMenu onInsert={onInsert} onClose={onToggle} inline />}
    </div>
  );
}

function InsertMenu({
  onInsert,
  onClose,
  inline,
}: {
  onInsert: (type: Block['type']) => void;
  onClose: () => void;
  inline?: boolean;
}) {
  return (
    <>
      <div className={styles.menuOverlay} onClick={onClose} />
      <div className={inline ? styles.insertMenu : styles.menuPopover}>
        {INSERTABLE.map((item) => (
          <button key={item.type} type="button" className={styles.menuItem} onClick={() => onInsert(item.type)}>
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}

function EditableBlock({
  block,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
  onChange,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  onNewBlockBelow,
  onBackspaceMerge,
  canMoveUp,
  canMoveDown,
  canDelete,
  recipeOptions,
}: {
  block: Block;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onChange: (patch: Partial<Block>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onNewBlockBelow: () => void;
  onBackspaceMerge: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canDelete: boolean;
  recipeOptions: { id: number; title: string }[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      onNewBlockBelow();
      return;
    }
    if (e.key === 'Backspace') {
      const el = e.currentTarget;
      if (el.value === '' && el.selectionStart === 0 && el.selectionEnd === 0) {
        e.preventDefault();
        onBackspaceMerge();
      }
    }
  }

  return (
    <div ref={setNodeRef} style={dragStyle} className={`${styles.blockWrap} ${menuOpen ? styles.menuOpen : ''}`}>
      <button
        type="button"
        className={styles.dragHandle}
        aria-label="Drag to reorder"
        title="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>

      <BlockBody block={block} onChange={onChange} onKeyDown={handleKeyDown} recipeOptions={recipeOptions} />

      <div className={styles.blockControls}>
        <button type="button" className={styles.controlButton} onClick={onMoveUp} disabled={!canMoveUp} aria-label="Move up" title="Move up">
          ↑
        </button>
        <button type="button" className={styles.controlButton} onClick={onMoveDown} disabled={!canMoveDown} aria-label="Move down" title="Move down">
          ↓
        </button>
        <button type="button" className={styles.controlButton} onClick={onToggleMenu} aria-label="More" title="More">
          ⋯
        </button>
      </div>

      {menuOpen && (
        <>
          <div className={styles.menuOverlay} onClick={onCloseMenu} />
          <div className={styles.menuPopover}>
            <button type="button" className={styles.menuItem} onClick={() => { onDuplicate(); }}>
              Duplicate
            </button>
            {block.type === 'heading' && (
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => onChange({ level: block.level === 2 ? 3 : 2 } as Partial<Block>)}
              >
                Switch to {block.level === 2 ? 'h3' : 'h2'}
              </button>
            )}
            <button
              type="button"
              className={`${styles.menuItem} ${styles.menuItemDanger}`}
              onClick={onDelete}
              disabled={!canDelete}
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function BlockBody({
  block,
  onChange,
  onKeyDown,
  recipeOptions,
}: {
  block: Block;
  onChange: (patch: Partial<Block>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => void;
  recipeOptions: { id: number; title: string }[];
}) {
  switch (block.type) {
    case 'text':
      return (
        <div className={styles.textBlock}>
          <AutoGrowTextarea
            className={styles.textArea}
            value={block.markdown}
            onChange={(markdown) => onChange({ markdown })}
            onKeyDown={onKeyDown}
            data-block-id={block.id}
            placeholder="Write… markdown is fine: **bold**, _italic_, > quote."
          />
        </div>
      );

    case 'heading':
      return (
        <div className={styles.headingRow}>
          <input
            className={block.level === 2 ? styles.headingInputH2 : styles.headingInputH3}
            value={block.text}
            onChange={(e) => onChange({ text: e.target.value })}
            onKeyDown={onKeyDown}
            data-block-id={block.id}
            placeholder="heading"
          />
        </div>
      );

    case 'divider': {
      const style = block.style ?? 'rule';
      const next = DIVIDER_STYLES[(DIVIDER_STYLES.indexOf(style) + 1) % DIVIDER_STYLES.length];
      return (
        <div className={styles.dividerBlock}>
          <button type="button" className={styles.dividerButton} onClick={() => onChange({ style: next })}>
            {style === 'squiggle' ? (
              <Squiggle width={140} />
            ) : style === 'dots' ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--sage-dim)' }} />
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--sage-dim)' }} />
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--sage-dim)' }} />
              </div>
            ) : (
              <hr className={styles.dividerRuleMark} />
            )}
            <span className={styles.dividerHint}>{style} — click to change</span>
          </button>
        </div>
      );
    }

    case 'ps':
      return (
        <div className={styles.psBox}>
          <span className={`hand ${styles.psLabel}`}>ps</span>
          <div className={styles.psFields}>
            <AutoGrowTextarea
              className={styles.psTextArea}
              value={block.text}
              onChange={(text) => onChange({ text })}
              onKeyDown={onKeyDown}
              data-block-id={block.id}
              placeholder="I braised leeks twice this week."
            />
            <select
              className={styles.psSelect}
              value={block.recipeId ?? ''}
              onChange={(e) => onChange({ recipeId: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">no recipe link</option>
              {recipeOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      );

    case 'image':
      return <ImageBlockEditor block={block} onChange={onChange} />;

    default:
      return null;
  }
}

function ImageBlockEditor({
  block,
  onChange,
}: {
  block: Extract<Block, { type: 'image' }>;
  onChange: (patch: Partial<Block>) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploadOriginal, setUploadOriginal] = useState(false);

  async function upload(file: File) {
    if (!file.type.startsWith('image/')) return;
    setUploading(true);
    setError('');
    const body = new FormData();
    body.append('file', file);
    if (uploadOriginal) body.append('original', 'true');
    const res = await fetch('/api/upload', { method: 'POST', body });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) {
      setError(data.error ?? 'The upload failed.');
      return;
    }
    onChange({ url: data.url, alt: block.alt || file.name.replace(/\.[a-z0-9]+$/i, '') });
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) upload(file);
  }

  function onPaste(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find((it) => it.type.startsWith('image/'));
    const file = item?.getAsFile();
    if (file) {
      e.preventDefault();
      upload(file);
    }
  }

  const widthClass = block.width === 'wide' ? styles.wide : block.width === 'full' ? styles.full : '';

  const uploadOriginalToggle = (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--ink-quiet)' }}>
      <input type="checkbox" checked={uploadOriginal} onChange={(e) => setUploadOriginal(e.target.checked)} />
      upload original (less compression)
    </label>
  );

  if (!block.url) {
    return (
      <div className={styles.imageBlock}>
        <label
          className={styles.imageDropzone}
          tabIndex={0}
          onPaste={onPaste}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          style={dragOver ? { borderColor: 'var(--rust)', color: 'var(--rust)' } : undefined}
        >
          {uploading ? 'Uploading…' : 'Drag an image here, paste, or click to choose'}
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
        </label>
        <div style={{ marginTop: 8 }}>{uploadOriginalToggle}</div>
        {error && <p style={{ color: 'var(--rust)', fontSize: 13, marginTop: 6 }}>{error}</p>}
      </div>
    );
  }

  return (
    <figure
      className={`${styles.imageBlock} ${widthClass}`}
      tabIndex={0}
      onPaste={onPaste}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      style={dragOver ? { outline: '2px dashed var(--rust)', outlineOffset: 4 } : undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={block.url} alt={block.alt} />
      <div className={styles.imageMeta}>
        <input
          className={styles.imageAltInput}
          value={block.alt}
          onChange={(e) => onChange({ alt: e.target.value })}
          placeholder="alt text (for screen readers)"
        />
        <input
          className={styles.imageCaptionInput}
          value={block.caption ?? ''}
          onChange={(e) => onChange({ caption: e.target.value || undefined })}
          placeholder="caption (optional)"
        />
        <div className={styles.imageToolRow}>
          <select
            className={styles.imageCaptionInput}
            value={block.width ?? 'column'}
            onChange={(e) => onChange({ width: e.target.value as 'column' | 'wide' | 'full' })}
            style={{ flex: 'none' }}
          >
            <option value="column">column width</option>
            <option value="wide">wide</option>
            <option value="full">full bleed</option>
          </select>
          <label className={adminStyles.buttonSmall} style={{ cursor: 'pointer' }}>
            replace
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
          </label>
          <button type="button" className={adminStyles.buttonSmall} onClick={() => onChange({ url: '', alt: '' })}>
            remove
          </button>
          {uploadOriginalToggle}
        </div>
        {uploading && <p style={{ fontSize: 13, color: 'var(--ink-quiet)' }}>Uploading replacement…</p>}
        {error && <p style={{ color: 'var(--rust)', fontSize: 13 }}>{error}</p>}
      </div>
    </figure>
  );
}
