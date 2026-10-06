import { useCallback, useRef, useState } from "react";
import type { Progress } from "@/components/ui/States";
import { errorMessage } from "./utils";

export type Status = "idle" | "processing" | "done" | "error";

/**
 * Small state machine shared by every tool: idle → processing → done | error.
 * Keeps progress reporting and error handling consistent.
 */
export function useProcessor<T>() {
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState<Progress>({ percent: -1, stage: "Preparing" });
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastTask = useRef<(() => Promise<void>) | null>(null);

  const report = useCallback((percent: number, stage: string, detail?: string) => {
    setProgress({ percent, stage, detail });
  }, []);

  const run = useCallback(
    async (task: (report: (percent: number, stage: string, detail?: string) => void) => Promise<T>) => {
      const exec = async () => {
        setStatus("processing");
        setError(null);
        setProgress({ percent: -1, stage: "Preparing" });
        try {
          const r = await task(report);
          setResult(r);
          setStatus("done");
        } catch (e) {
          console.error(e);
          setError(errorMessage(e));
          setStatus("error");
        }
      };
      lastTask.current = exec;
      await exec();
    },
    [report]
  );

  const retry = useCallback(() => lastTask.current?.(), []);
  const reset = useCallback(() => {
    setStatus("idle");
    setResult(null);
    setError(null);
  }, []);

  return { status, progress, result, error, run, retry, reset, setStatus };
}
