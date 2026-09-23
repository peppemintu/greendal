'use client';

import { useState } from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import type { Ingredient, Step } from '@/lib/schema';
import { duration, prettyNumber } from '@/lib/format';
import styles from './RecipeDetail.module.css';

export type RecipeView = {
  title: string;
  intro: string | null;
  heroImage: string | null;
  handsOnMinutes: number | null;
  handsOnApprox: boolean;
  totalMinutes: number | null;
  totalApprox: boolean;
  baseServings: number;
  yieldLabel: string;
  ingredients: Ingredient[];
  steps: Step[];
  pullNote: string | null;
  headnote: string | null;
};

export function RecipeDetail({ recipe }: { recipe: RecipeView }) {
  const [servings, setServings] = useState(recipe.baseServings);
  const factor = servings / recipe.baseServings;

  // Half, the base amount, and two multiples of it, so a loaf recipe
  // written for 1 gets 1/2/1/2/3 rather than a nonsensical 2/4/6.
  const options = [0.5, 1, 2, 3].map((m) => recipe.baseServings * m);

  // Filtered, not just non-empty arrays — the admin form always seeds one
  // blank row, so an untouched ingredient/step list is length 1, not 0.
  const ingredients = recipe.ingredients.filter((ing) => ing.name.trim());
  const steps = recipe.steps.filter((step) => step.lead.trim() || step.text.trim());
  const pullNote = recipe.pullNote?.trim() || null;
  const headnote = recipe.headnote?.trim() || null;

  return (
    <>
      <div
        className={styles.top}
        style={recipe.heroImage ? undefined : { gridTemplateColumns: '1fr' }}
      >
        <div>
          <span className="hand" style={{ fontSize: 26 }}>
            recipes
          </span>
          <h1 className={styles.title}>{recipe.title}</h1>
          {recipe.intro && <p className={styles.intro}>{recipe.intro}</p>}

          <div className={styles.stats}>
            {recipe.handsOnMinutes ? (
              <div>
                <div className={styles.statLabel}>hands on</div>
                <div className={styles.statValue}>
                  {recipe.handsOnApprox && '~'}
                  {duration(recipe.handsOnMinutes)}
                </div>
              </div>
            ) : null}
            <div>
              <div className={styles.statLabel}>total</div>
              <div className={styles.statValue}>
                {recipe.totalApprox && '~'}
                {duration(recipe.totalMinutes)}
              </div>
            </div>
            <div>
              <div className={styles.statLabel}>makes</div>
              <div className={styles.statValue}>
                {recipe.yieldLabel.replace('{n}', prettyNumber(servings))}
              </div>
            </div>
          </div>
        </div>

        {recipe.heroImage && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img className={styles.hero} src={recipe.heroImage} alt="" />
        )}
      </div>

      <div className={styles.columns}>
        {ingredients.length > 0 && (
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>ingredients</span>
              <ToggleGroup.Root
                type="single"
                value={String(servings)}
                onValueChange={(v) => v && setServings(Number(v))}
                className={styles.toggle}
                aria-label="Scale the ingredients"
              >
                {options.map((n) => (
                  <ToggleGroup.Item
                    key={n}
                    value={String(n)}
                    className={styles.toggleItem}
                    aria-label={`Scale for ${n}`}
                  >
                    {prettyNumber(n)}
                  </ToggleGroup.Item>
                ))}
              </ToggleGroup.Root>
            </div>

            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {ingredients.map((ing, i) => (
                <li key={i} className={styles.ingredient}>
                  <span className={styles.amount}>
                    {ing.qty === null
                      ? ''
                      : `${ing.approx ? '~' : ''}${prettyNumber(ing.fixed ? ing.qty : ing.qty * factor)}${ing.unit}`}
                  </span>
                  <span className={styles.ingredientName}>{ing.name}</span>
                </li>
              ))}
            </ul>

            {pullNote && <div className={`hand ${styles.pullNote}`}>{pullNote}</div>}
          </div>
        )}

        {(steps.length > 0 || headnote) && (
          <div>
            {steps.length > 0 && (
              <>
                <div className={`hand ${styles.methodMark}`}>method</div>
                <ol className={styles.steps} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  <div className={styles.rail} aria-hidden="true" />
                  {steps.map((step, i) => (
                    <li key={i} className={styles.step}>
                      <span className={styles.dot} aria-hidden="true" />
                      <div>
                        <div className={styles.stepLead}>{step.lead}</div>
                        <p className={styles.stepText}>{step.text}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </>
            )}

            {headnote && (
              <div className={styles.headnote} style={steps.length > 0 ? undefined : { marginTop: 0, paddingTop: 0, borderTop: 0 }}>
                <div className={`hand ${styles.headnoteMark}`}>author&rsquo;s notes</div>
                <p className={styles.headnoteText}>{headnote}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
