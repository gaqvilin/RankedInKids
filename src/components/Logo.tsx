// PadelAdmin logo: a padel racket seen from the front, holes in a 3×3 grid.
// One shape in currentColor, so it follows the text colour in light and dark mode.

const HOLES = [20, 28, 36].flatMap((y) => [24, 32, 40].map((x) => [x, y]));

export function LogoMark({ size = 24, title }: { size?: number; title?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <path
        fillRule="evenodd"
        fill="currentColor"
        d={[
          // head
          'M32 4C20.4 4 13 12.6 13 24.5C13 35.6 19.6 43.4 27 45.8L27.6 50H36.4L37 45.8C44.4 43.4 51 35.6 51 24.5C51 12.6 43.6 4 32 4Z',
          // handle
          'M28 50H36V58.5A2.5 2.5 0 0 1 33.5 61H30.5A2.5 2.5 0 0 1 28 58.5Z',
          // holes
          ...HOLES.map(([x, y]) => `M${x + 2.6} ${y}A2.6 2.6 0 1 0 ${x - 2.6} ${y}A2.6 2.6 0 1 0 ${x + 2.6} ${y}Z`),
        ].join('')}
      />
    </svg>
  );
}

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <span className="logo">
      <LogoMark size={size} />
      <span className="logo__word">
        Padel<span className="logo__word-admin">Admin</span>
      </span>
    </span>
  );
}
