'use client';

import { useActionState, useState } from 'react';
import { saveRecipe, archiveRecipe } from '@/app/admin/actions';
import { slugify } from '@/lib/format';
import type { Ingredient, Step } from '@/lib/schema';
import styles from '@/app/admin/admin.module.css';

export type RecipeDraft = {
  id?: number;
  slug: string;
  title: string;
  intro: string;
  heroImage: string;
  handsOnMinutes: string;
  totalMinutes: string;
  baseServings: string;
  yieldLabel: string;
  ingredients: Ingredient[];
  steps: Step[];
  pullNote: string;
  headnote: string;
  status: 'draft' | 'published';
  publishedAtLocal: string;
};

const EMPTY_INGREDIENT: Ingredient = { qty: null, unit: '', name: '', fixed: false };
const EMPTY_STEP: Step = { lead: '', text: '' };

export function RecipeForm({ draft }: { draft: RecipeDraft }) {
  const [state, action, pending] = useActionState(saveRecipe, undefined);
  const [title, setTitle] = useState(draft.title);
  const [slug, setSlug] = useState(draft.slug);
  const [slugTouched, setSlugTouched] = useState(Boolean(draft.slug));
  const [hero, setHero] = useState(draft.heroImage);
  const [uploadError, setUploadError] = useState('');
  const [uploadOriginal, setUploadOriginal] = useState(false);
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    draft.ingredients.length ? draft.ingredients : [EMPTY_INGREDIENT],
  );
  const [steps, setSteps] = useState<Step[]>(draft.steps.length ? draft.steps : [EMPTY_STEP]);

  const effectiveSlug = slugTouched ? slug : slugify(title);

  async function upload(file: File) {
    setUploadError('');
    const body = new FormData();
    body.append('file', file);
    if (uploadOriginal) body.append('original', 'true');
    const res = await fetch('/api/upload', { method: 'POST', body });
    const data = await res.json();
    if (!res.ok) {
      setUploadError(data.error ?? 'The upload failed.');
      return;
    }
    setHero(data.url);
  }

  function patchIngredient(index: number, patch: Partial<Ingredient>) {
    setIngredients((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function patchStep(index: number, patch: Partial<Step>) {
    setSteps((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <form action={action}>
      <div className="sectionMark">
        <span className="hand">{draft.id ? 'edit' : 'new recipe'}</span>
      </div>

      {state?.error && <div className={styles.error}>{state.error}</div>}
      {draft.id && <input type="hidden" name="id" value={draft.id} />}
      <input type="hidden" name="ingredients" value={JSON.stringify(ingredients)} />
      <input type="hidden" name="steps" value={JSON.stringify(steps)} />
      <input type="hidden" name="heroImage" value={hero} />

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
        <p className={styles.hint}>/recipes/{effectiveSlug || '…'}</p>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>intro</span>
        <input className={styles.input} name="intro" defaultValue={draft.intro} />
      </label>

      <div className={styles.field}>
        <span className={styles.label}>photo</span>
        {hero && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hero}
            alt=""
            style={{ width: 240, height: 160, objectFit: 'cover', borderRadius: 3, marginBottom: 8 }}
          />
        )}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          style={{ fontSize: 14 }}
        />
        {hero && (
          <button type="button" className={styles.buttonSmall} onClick={() => setHero('')} style={{ marginLeft: 10 }}>
            Remove photo
          </button>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 13.5, color: 'var(--ink-quiet)' }}>
          <input
            type="checkbox"
            checked={uploadOriginal}
            onChange={(e) => setUploadOriginal(e.target.checked)}
          />
          upload original (full size, less compression)
        </label>
        {uploadError && <p className={styles.hint} style={{ color: 'var(--rust)' }}>{uploadError}</p>}
      </div>

      <div className={styles.row}>
        <label className={styles.field}>
          <span className={styles.label}>hands on (min)</span>
          <input className={styles.input} name="handsOnMinutes" type="number" defaultValue={draft.handsOnMinutes} />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>total (min)</span>
          <input className={styles.input} name="totalMinutes" type="number" defaultValue={draft.totalMinutes} />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>written for</span>
          <input className={styles.input} name="baseServings" type="number" min={1} defaultValue={draft.baseServings} />
          <p className={styles.hint}>Quantities below are for this many.</p>
        </label>
      </div>

      <label className={styles.field}>
        <span className={styles.label}>makes</span>
        <input className={styles.input} name="yieldLabel" defaultValue={draft.yieldLabel} />
        <p className={styles.hint}>Use &#123;n&#125; where the servings number goes: &ldquo;&#123;n&#125; as dinner&rdquo;.</p>
      </label>

      <div className={styles.field}>
        <span className={styles.label}>ingredients</span>
        {ingredients.map((ing, i) => (
          <div key={i} className={styles.repeatRow}>
            <input
              className={styles.input}
              style={{ flex: '0 0 76px' }}
              placeholder="qty"
              inputMode="decimal"
              value={ing.qty ?? ''}
              onChange={(e) =>
                patchIngredient(i, { qty: e.target.value === '' ? null : Number(e.target.value) })
              }
            />
            <input
              className={styles.input}
              style={{ flex: '0 0 66px' }}
              placeholder="unit"
              value={ing.unit}
              onChange={(e) => patchIngredient(i, { unit: e.target.value })}
            />
            <input
              className={styles.input}
              style={{ flex: '1 1 150px', minWidth: 0 }}
              placeholder="leeks, trimmed"
              value={ing.name}
              onChange={(e) => patchIngredient(i, { name: e.target.value })}
            />
            <label
              style={{ flex: '0 0 auto', fontSize: 12.5, color: 'var(--ink-quiet)', display: 'flex', gap: 4, alignItems: 'center', paddingTop: 10 }}
              title="Keep this amount the same when the recipe is scaled"
            >
              <input
                type="checkbox"
                checked={Boolean(ing.fixed)}
                onChange={(e) => patchIngredient(i, { fixed: e.target.checked })}
              />
              fixed
            </label>
            <button
              type="button"
              className={styles.buttonSmall}
              onClick={() => setIngredients((rows) => rows.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className={styles.buttonSmall}
          onClick={() => setIngredients((rows) => [...rows, { ...EMPTY_INGREDIENT }])}
        >
          Add ingredient
        </button>
        <p className={styles.hint}>Leave the quantity empty for things like &ldquo;flaky salt, to taste&rdquo;.</p>
      </div>

      <label className={styles.field}>
        <span className={styles.label}>note in the panel</span>
        <input className={styles.input} name="pullNote" defaultValue={draft.pullNote} placeholder="use the good butter" />
      </label>

      <div className={styles.field}>
        <span className={styles.label}>method</span>
        {steps.map((step, i) => (
          <div key={i} style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <input
                className={styles.input}
                placeholder="Clean them properly."
                value={step.lead}
                onChange={(e) => patchStep(i, { lead: e.target.value })}
                style={{ marginBottom: 6 }}
              />
              <textarea
                className={styles.input}
                style={{ minHeight: 72, resize: 'vertical' }}
                placeholder="What actually happens in this step."
                value={step.text}
                onChange={(e) => patchStep(i, { text: e.target.value })}
              />
            </div>
            <button
              type="button"
              className={styles.buttonSmall}
              onClick={() => setSteps((rows) => rows.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className={styles.buttonSmall}
          onClick={() => setSteps((rows) => [...rows, { ...EMPTY_STEP }])}
        >
          Add step
        </button>
      </div>

      <label className={styles.field}>
        <span className={styles.label}>why this one</span>
        <textarea
          className={styles.input}
          style={{ minHeight: 110, resize: 'vertical' }}
          name="headnote"
          defaultValue={draft.headnote}
        />
      </label>

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
            formAction={archiveRecipe}
            formNoValidate
            onClick={(e) => {
              if (!confirm(`Archive "${draft.title || 'this recipe'}"? It disappears from the site but stays in the archive.`)) e.preventDefault();
            }}
          >
            Archive
          </button>
        )}
      </div>
    </form>
  );
}
