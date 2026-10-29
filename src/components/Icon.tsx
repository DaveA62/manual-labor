export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    workshop: <><path d="M4 3h16v5H4zM6 8v12m12-12v12M3 20h18M11 8v6m-3 1h8v3H8z" /></>,
    storage: <><path d="M3 3h18v18H3zM3 12h18M12 3v18M7 7h1m8 0h1m-10 9h1m8 0h1" /></>,
    catalog: <><path d="M4 3h16v18H4zM8 7h8M8 17h8M8 11h8v3H8z" /></>,
    wrench: <><path d="M14 4a5 5 0 0 0-6 6L3 17l4 4 7-7a5 5 0 0 0 6-6l-4 4-4-4 4-4z" /></>,
    settings: <><path d="M4 6h16M4 12h16M4 18h16" /><path d="M8 3v6m8 0v6m-6 0v6" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    left: <path d="m14 5-7 7 7 7" />,
    right: <path d="m10 5 7 7-7 7" />,
    plus: <path d="M12 5v14M5 12h14" />,
    grip: <><path d="M8 5h1m6 0h1M8 12h1m6 0h1M8 19h1m6 0h1" strokeWidth="3" /></>,
    feed: <><path d="M4 6h12v4H4zm2 4v8h14v-7M9 14h7m0 0-2-2m2 2-2 2" /></>,
    motor: <><path d="M5 8h12v10H5zm12 3h3v4h-3M8 5v3m6-3v3M2 11h3m-3 4h3M8 21v-3m6 3v-3" /><path d="m12 10-3 4h4l-2 3" /></>,
    collect: <><path d="M3 12v8h18v-8M7 8l5 5 5-5M12 3v10M3 16h18" /></>,
    print: <><path d="M4 6h16v13H4zM7 9h10v7H7zM10 12h4M12 10v4" /></>,
    stamp: <><path d="M6 4h12v6H6zM9 10v5m6-5v5M5 16h14v4H5z" /></>,
    sound: <><path d="m4 10 4 0 5-4v12l-5-4H4zM17 8c3 2 3 6 0 8m2-11c5 4 5 10 0 14" /></>,
    muted: <><path d="m4 10 4 0 5-4v12l-5-4H4zM17 9l5 6m0-6-5 6" /></>,
    reset: <><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6" /></>,
    check: <path d="m5 12 4 4L19 6" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.print}</svg>;
}
