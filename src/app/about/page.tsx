import type { Metadata } from 'next';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { NewsletterSubscribeBox } from '@/components/NewsletterSubscribeBox';
import { Squiggle } from '@/components/Squiggle';
import { getSettings } from '@/lib/queries';
import { renderMarkdown } from '@/lib/markdown';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'about' };

export default async function AboutPage() {
  const settings = await getSettings();

  return (
    <>
      <SiteHeader />
      <main className="shell shell--narrow" style={{ paddingTop: 50 }}>
        <span className="hand" style={{ fontSize: 26 }}>about</span>
        <h1 style={{ margin: '12px 0 0', fontSize: 'clamp(32px, 6vw, 46px)', lineHeight: 1.15 }}>
          {settings.aboutTitle || 'who is doing all this'}
        </h1>
        <Squiggle width={180} color="var(--rust)" seed="about" />
        <div
          className="prose"
          style={{ marginTop: 26 }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(settings.aboutBody ?? '') }}
        />
      </main>
      <SiteFooter note={settings.footerNote} subscribeSlot={<NewsletterSubscribeBox />} />
    </>
  );
}
