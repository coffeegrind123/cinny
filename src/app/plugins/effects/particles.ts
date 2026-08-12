export type EffectName = 'confetti' | 'fireworks' | 'snowfall' | 'rainfall' | 'hearts';

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  spin: number;
  colour: string;
  glyph?: string;
  life: number;
};

type EffectConfig = {
  /** Particles alive at once. */
  count: number;
  /** How long the whole effect runs, ms. */
  duration: number;
  colours: string[];
  glyphs?: string[];
  gravity: number;
  /** Emit from the top edge rather than a burst from the bottom. */
  fromTop: boolean;
  drift: number;
  minSize: number;
  maxSize: number;
};

const CONFIGS: Record<EffectName, EffectConfig> = {
  confetti: {
    count: 140,
    duration: 4000,
    colours: ['#e63946', '#f1c453', '#2a9d8f', '#457b9d', '#e76f51', '#a663cc'],
    gravity: 0.12,
    fromTop: true,
    drift: 1.4,
    minSize: 6,
    maxSize: 12,
  },
  fireworks: {
    count: 180,
    duration: 4000,
    colours: ['#ffd166', '#ef476f', '#06d6a0', '#118ab2', '#fca311'],
    gravity: 0.04,
    fromTop: false,
    drift: 0,
    minSize: 2,
    maxSize: 4,
  },
  snowfall: {
    count: 120,
    duration: 6000,
    colours: ['#ffffff', '#e8f1f8', '#cfe3f5'],
    gravity: 0.02,
    fromTop: true,
    drift: 0.6,
    minSize: 3,
    maxSize: 7,
  },
  rainfall: {
    count: 200,
    duration: 5000,
    colours: ['#7fb3d5', '#5d8aa8', '#a9cce3'],
    gravity: 0.5,
    fromTop: true,
    drift: 0.2,
    minSize: 1,
    maxSize: 2,
  },
  hearts: {
    count: 80,
    duration: 5000,
    colours: ['#ff5d8f', '#ff85a1', '#ffa5ab', '#f9bec7'],
    glyphs: ['❤', '💖', '💕'],
    gravity: -0.03,
    fromTop: false,
    drift: 0.8,
    minSize: 14,
    maxSize: 26,
  },
};

export const isEffectName = (value: string): value is EffectName => value in CONFIGS;

const random = (min: number, max: number) => min + Math.random() * (max - min);

const pick = <T>(values: T[]): T => values[Math.floor(Math.random() * values.length)];

const makeParticle = (config: EffectConfig, width: number, height: number): Particle => {
  const size = random(config.minSize, config.maxSize);

  if (config.fromTop) {
    return {
      x: random(0, width),
      y: random(-height, 0),
      vx: random(-config.drift, config.drift),
      vy: random(1, 3),
      size,
      rotation: random(0, Math.PI * 2),
      spin: random(-0.1, 0.1),
      colour: pick(config.colours),
      glyph: config.glyphs ? pick(config.glyphs) : undefined,
      life: 1,
    };
  }

  // Burst upward and outward from near the bottom — fireworks and hearts both
  // read as coming from the message you just sent.
  const angle = random(-Math.PI * 0.75, -Math.PI * 0.25);
  const speed = random(4, 11);
  return {
    x: random(width * 0.2, width * 0.8),
    y: height + size,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size,
    rotation: random(0, Math.PI * 2),
    spin: random(-0.15, 0.15),
    colour: pick(config.colours),
    glyph: config.glyphs ? pick(config.glyphs) : undefined,
    life: 1,
  };
};

/**
 * Plays an effect on a canvas and resolves when it has finished.
 *
 * Returns a cancel function — the caller must call it on unmount, or the
 * animation frame loop keeps running against a detached canvas.
 */
export const playEffect = (canvas: HTMLCanvasElement, name: EffectName): (() => void) => {
  const config = CONFIGS[name];
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => undefined;

  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  let particles: Particle[] = Array.from({ length: config.count }, () =>
    makeParticle(config, width, height),
  );

  const startedAt = performance.now();
  let frame = 0;
  let cancelled = false;

  const tick = (now: number) => {
    if (cancelled) return;
    const elapsed = now - startedAt;
    const fadeFrom = config.duration * 0.7;
    const fade = elapsed > fadeFrom ? 1 - (elapsed - fadeFrom) / (config.duration - fadeFrom) : 1;

    ctx.clearRect(0, 0, width, height);

    particles.forEach((p) => {
      p.x += p.vx;

      p.y += p.vy;

      p.vy += config.gravity;

      p.rotation += p.spin;

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, fade * p.life));
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.colour;

      if (p.glyph) {
        ctx.font = `${p.size}px serif`;
        ctx.textAlign = 'center';
        ctx.fillText(p.glyph, 0, 0);
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * (name === 'rainfall' ? 6 : 1));
      }
      ctx.restore();
    });

    // Top-emitting effects recycle so the fall looks continuous; burst effects
    // let their particles leave and do not come back.
    if (config.fromTop && elapsed < fadeFrom) {
      particles = particles.map((p) =>
        p.y > height + p.size ? makeParticle(config, width, height) : p,
      );
    }

    if (elapsed < config.duration) {
      frame = requestAnimationFrame(tick);
    } else {
      ctx.clearRect(0, 0, width, height);
    }
  };

  frame = requestAnimationFrame(tick);

  return () => {
    cancelled = true;
    cancelAnimationFrame(frame);
    ctx.clearRect(0, 0, width, height);
  };
};
