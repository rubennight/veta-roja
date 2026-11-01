import { eq } from 'drizzle-orm';
import type { LandingInput } from '@veta-roja/shared';
import { loadConfig } from '../src/config';
import { createDb, runMigrations } from '../src/db/client';
import { landings } from '../src/db/schema';
import { createLanding, updateLanding } from '../src/landings/repo';

const slide = <T extends Record<string, unknown>>(extra: T, animation = 'fade') => ({
  id: crypto.randomUUID(),
  hidden: false,
  animation,
  ...extra,
});

/** Landing de demostración con los 9 tipos de diapositiva y el contenido de estudio sobre Lyon 1831. */
export const demoLanding = (themeId = 'indice-blanco'): LandingInput =>
  ({
    title: 'Condiciones materiales: Lyon, 1831',
    description: 'Cómo nace el proletariado y por qué el marxismo surge de la lucha obrera.',
    slug: 'demo',
    themeId,
    status: 'published',
    ctaUrl: null,
    slides: [
      slide({ type: 'cover', title: 'Vivir trabajando o morir luchando', subtitle: 'Lyon, 1831. Diez días de ciudad obrera.' }),
      slide({ type: 'emphasis_text', text: 'La **revolución industrial** convirtió al taller artesanal en fábrica y dio ==nacimiento al proletariado==.' }, 'slide-up'),
      slide({ type: 'quote', text: '¡Vivir trabajando o morir luchando!', author: 'Tejedores de Lyon', date: '1831' }, 'zoom'),
      slide({ type: 'concept', term: 'Contradicción', definition: 'Dos opuestos que **necesitan el uno del otro** para existir: producción y consumo, capital y trabajo.' }, 'underline'),
      slide({ type: 'big_figure', figure: '10 000', caption: 'insurgentes encarcelados o deportados en 1834' }),
      slide({
        type: 'timeline',
        items: [
          { date: '1831', text: 'Los tejedores de Lyon toman la ciudad durante diez días.' },
          { date: '1838', text: 'La Carta del Pueblo organiza al movimiento cartista.' },
          { date: '1844', text: 'Los tejedores de Silesia se levantan y Marx ve nacer al movimiento obrero alemán.' },
        ],
      }, 'slide-up'),
      slide({
        type: 'comparison',
        left: { title: 'Capital', points: ['Posee los medios de producción', 'Una minoría de la sociedad'] },
        right: { title: 'Trabajo', points: ['Alquila su fuerza de trabajo', 'La gran mayoría de la sociedad'] },
      }),
      slide({ type: 'cta', text: 'La historia se hace organizándose. **Súmate** a la organización de la clase obrera.', buttonLabel: 'Entrar al canal' }, 'zoom'),
    ],
  }) as LandingInput;

if (process.argv[1]?.endsWith('seed-demo.ts')) {
  const config = loadConfig();
  const { db, close } = createDb(config.databaseUrl);
  try {
    await runMigrations(db);
    const themeId = process.argv[2] ?? 'indice-blanco';
    const input = demoLanding(themeId);
    const [existing] = await db.select().from(landings).where(eq(landings.slug, 'demo'));
    if (existing) await updateLanding(db, existing.id, input);
    else await createLanding(db, input);
    console.log(`Landing demo lista: ${config.publicBaseUrl}/l/demo (theme ${themeId})`);
  } finally {
    await close();
  }
}
