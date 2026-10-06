import { createContext, useCallback, useContext, useEffect, useState, type ReactNode, type MouseEvent } from "react";

interface RouterCtx {
  path: string;
  navigate: (to: string) => void;
}
const Ctx = createContext<RouterCtx>({ path: "/", navigate: () => {} });

function readHash() {
  const h = window.location.hash.replace(/^#/, "");
  return h.startsWith("/") ? h : "/" + h;
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(readHash);

  useEffect(() => {
    const onHash = () => {
      setPath(readHash());
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navigate = useCallback((to: string) => {
    if (to.startsWith("#")) {
      const el = document.querySelector(to);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (readHash() === to) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    window.location.hash = to;
  }, []);

  return <Ctx.Provider value={{ path, navigate }}>{children}</Ctx.Provider>;
}

export const useRouter = () => useContext(Ctx);

export function Link({
  to,
  children,
  className,
  onClick,
  ...rest
}: { to: string; children: ReactNode; className?: string; onClick?: () => void } & Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "href" | "onClick"
>) {
  const { navigate } = useRouter();
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    onClick?.();
    navigate(to);
  };
  return (
    <a href={to.startsWith("#") ? to : `#${to}`} onClick={handle} className={className} {...rest}>
      {children}
    </a>
  );
}
