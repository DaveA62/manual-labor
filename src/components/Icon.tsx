export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    feed: <><path d="M4 6h12v4H4zm2 4v8h14v-7M9 14h7m0 0-2-2m2 2-2 2" /></>,
    motor: <><path d="M5 8h12v10H5zm12 3h3v4h-3M8 5v3m6-3v3M2 11h3m-3 4h3M8 21v-3m6 3v-3" /><path d="m12 10-3 4h4l-2 3" /></>,
    collect: <><path d="M3 12v8h18v-8M7 8l5 5 5-5M12 3v10M3 16h18" /></>,
    print: <><path d="M4 6h16v13H4zM7 9h10v7H7zM10 12h4M12 10v4" /></>,
    sound: <><path d="m4 10 4 0 5-4v12l-5-4H4zM17 8c3 2 3 6 0 8m2-11c5 4 5 10 0 14" /></>,
    muted: <><path d="m4 10 4 0 5-4v12l-5-4H4zM17 9l5 6m0-6-5 6" /></>,
    reset: <><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6" /></>,
    check: <path d="m5 12 4 4L19 6" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.print}</svg>;
}
