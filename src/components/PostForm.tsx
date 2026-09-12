'use client';

import { useActionState, useState } from 'react';
import { savePost, deletePost } from '@/app/admin/actions';
import { slugify } from '@/lib/format';
import styles from '@/app/admin/admin.module.css';

export type PostDraft = {
  id?: number;
  slug: string;
  title: string;
  dek: string;
  body: string;
  status: 'draft' | 'published';
  publishedAtLocal: string;
  psRecipeId: string;
  psText: string;
};

export function PostForm({
  draft,
  recipeOptions,
}: {
  draft: PostDraft;
  recipeOptions: { id: number; title: string }[];
}) {
  const [state, action, pending] = useActionState(savePost, undefined);
  const [title, setTitle] = useState(draft.title);
  const [slug, setSlug] = useState(draft.slug);
  const [slugTouched, setSlugTouched] = useState(Boolean(draft.slug));

  const effectiveSlug = slugTouched ? slug : slugify(title);

  return (
    <form action={action}>
      <div className="sectionMark">
        <span className="hand">{draft.id ? 'edit' : 'new thought'}</span>
      </div>

      {state?.error && <div className={styles.error}>{state.error}</div>}
      {draft.id && <input type="hidden" name="id" value={draft.id} />}

      <label className={styles.field}>
        <span className={styles.label}>title</span>
        <input
          className={styles.input}
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>web address</span>
        <input
          className={styles.input}
          name="slug"
          value={effectiveSlug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
        />
        <p className={styles.hint}>/thoughts/{effectiveSlug || '…'}</p>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>teaser</span>
        <input className={styles.input} name="dek" defaultValue={draft.dek} />
        <p className={styles.hint}>The one line under the title on the home page.</p>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>body</span>
        <textarea className={styles.textarea} name="body" defaultValue={draft.body} />
        <p className={styles.hint}>
          Markdown. **bold**, _italic_, &gt; for a pull quote, ## for a subheading.
        </p>
      </label>

      <div className={styles.row}>
        <label className={styles.field}>
          <span className={styles.label}>ps — points at</span>
          <select className={styles.select} name="psRecipeId" defaultValue={draft.psRecipeId}>
            <option value="">no ps box</option>
            {recipeOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.label}>ps — wording</span>
          <input
            className={styles.input}
            name="psText"
            defaultValue={draft.psText}
            placeholder="I braised leeks twice this week."
          />
        </label>
      </div>

      <div className={styles.row}>
        <label className={styles.field}>
          <span className={styles.label}>status</span>
          <select className={styles.select} name="status" defaultValue={draft.status}>
            <option value="draft">draft</option>
            <option value="published">published</option>
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.label}>published</span>
          <input
            className={styles.input}
            type="datetime-local"
            name="publishedAt"
            defaultValue={draft.publishedAtLocal}
          />
          <p className={styles.hint}>Leave empty to stamp it now.</p>
        </label>
      </div>

      <div className={styles.sticky}>
        <button className={styles.button} type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </button>
        {draft.id && (
          <button
            className={styles.buttonSmall}
            type="submit"
            formAction={deletePost}
            formNoValidate
            onClick={(e) => {
              if (!confirm('Delete this thought for good?')) e.preventDefault();
            }}
          >
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
