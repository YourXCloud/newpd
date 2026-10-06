import { useEffect, useState } from "react";
import { LockKeyhole, LockKeyholeOpen, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { ToolLayout, Step, AnimatePresence } from "@/components/ToolLayout";
import { Dropzone } from "@/components/ui/Dropzone";
import { FileCard, Panel, ProcessingPanel, ErrorPanel, ResultPanel, InfoNote } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { Input, Label, Toggle, Segmented } from "@/components/ui/Field";
import { useProcessor } from "@/lib/useProcessor";
import { useToast } from "@/lib/toast";
import { readFile, loadPdfLib } from "@/lib/pdf";
import { ACCEPT_PDF, downloadBlob, formatBytes, stripExt } from "@/lib/utils";
import { findTool } from "@/data/tools";
import { cn } from "@/utils/cn";

function PasswordInput({ id, value, onChange, placeholder, error, autoComplete = "new-password", onEnter }: { id: string; value: string; onChange: (v: string) => void; placeholder?: string; error?: string; autoComplete?: string; onEnter?: () => void }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} error={error} autoComplete={autoComplete} className="pr-12" onKeyDown={(e) => e.key === "Enter" && onEnter?.()} />
      <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-2 top-[6px] flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function strength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}

/* ============================ SET PASSWORD ============================ */
export function SetPassword() {
  const tool = findTool("set-password")!;
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [ownerPw, setOwnerPw] = useState("");
  const [useOwner, setUseOwner] = useState(false);
  const [algo, setAlgo] = useState<"AES-256" | "AES-128">("AES-256");
  const [perms, setPerms] = useState({ printing: true, copying: true, modifying: false, annotating: true });
  const [touched, setTouched] = useState(false);
  const proc = useProcessor<Blob>();

  const sc = strength(pw);
  const errs = {
    pw: touched && pw.length < 4 ? "Use at least 4 characters." : undefined,
    pw2: touched && pw2 !== pw ? "Passwords do not match." : undefined,
  };
  const valid = pw.length >= 4 && pw === pw2;

  const protect = () => {
    setTouched(true);
    if (!file || !valid) return;
    proc.run(async (report) => {
      report(10, "Loading PDF");
      const { PDFDocument } = await loadPdfLib();
      const data = await readFile(file);
      let pdf;
      try {
        pdf = await PDFDocument.load(data, { ignoreEncryption: true });
      } catch {
        throw new Error("This file couldn't be parsed as a PDF. It may be corrupted.");
      }
      if (pdf.isEncrypted) throw new Error("This PDF is already encrypted. Remove the existing password first, then set a new one.");
      report(45, "Encrypting document", `${algo} encryption`);
      pdf.encrypt({
        userPassword: pw,
        ownerPassword: useOwner && ownerPw ? ownerPw : pw,
        algorithm: algo,
        permissions: {
          printing: perms.printing ? "highResolution" : false,
          copying: perms.copying,
          modifying: perms.modifying,
          annotating: perms.annotating,
          fillingForms: perms.annotating,
          contentAccessibility: true,
          documentAssembly: perms.modifying,
        },
      });
      report(80, "Saving protected PDF");
      const bytes = await pdf.save();
      report(100, "Done");
      return new Blob([bytes as BlobPart], { type: "application/pdf" });
    }).then(() => undefined);
  };

  useEffect(() => {
    if (proc.status === "done") toast.success("Password protection enabled", "Your PDF is now encrypted.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proc.status]);

  const reset = () => {
    proc.reset();
    setFile(null);
    setPw("");
    setPw2("");
    setOwnerPw("");
    setTouched(false);
  };

  return (
    <ToolLayout tool={tool}>
      <AnimatePresence mode="wait">
        {!file && (
          <Step k="upload">
            <Dropzone accept={ACCEPT_PDF} maxSize={200 * 1024 * 1024} onFiles={(f) => (setFile(f[0]), toast.success("PDF uploaded successfully", f[0].name))} />
            <InfoNote>Encryption happens in your browser using the Web Crypto API. Your password is never sent anywhere and is cleared from memory when you leave this page.</InfoNote>
          </Step>
        )}
        {file && proc.status === "idle" && (
          <Step k="configure">
            <FileCard name={file.name} size={file.size} onRemove={reset} />
            <Panel title="Password" description="Required to open the document.">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="pw">Password</Label>
                  <PasswordInput id="pw" value={pw} onChange={setPw} error={errs.pw} placeholder="Enter a strong password" />
                  <div className="mt-2 flex gap-1" aria-hidden>
                    {[0, 1, 2, 3].map((i) => (
                      <span key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors", pw && i < sc ? (sc <= 1 ? "bg-rose-500" : sc <= 2 ? "bg-amber-500" : "bg-emerald-500") : "bg-slate-200 dark:bg-white/10")} />
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{!pw ? "Strength" : sc <= 1 ? "Weak" : sc <= 2 ? "Fair" : sc === 3 ? "Good" : "Strong"}</p>
                </div>
                <div>
                  <Label htmlFor="pw2">Confirm password</Label>
                  <PasswordInput id="pw2" value={pw2} onChange={setPw2} error={errs.pw2} placeholder="Repeat the password" onEnter={protect} />
                </div>
              </div>
            </Panel>
            <Panel title="Security options">
              <div className="space-y-4">
                <Segmented label="Encryption" value={algo} onChange={setAlgo} options={[{ value: "AES-256", label: "AES-256 (recommended)" }, { value: "AES-128", label: "AES-128 (older viewers)" }]} />
                <div>
                  <Label>Permissions</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Toggle checked={perms.printing} onChange={(v) => setPerms({ ...perms, printing: v })} label="Allow printing" />
                    <Toggle checked={perms.copying} onChange={(v) => setPerms({ ...perms, copying: v })} label="Allow copying text" />
                    <Toggle checked={perms.modifying} onChange={(v) => setPerms({ ...perms, modifying: v })} label="Allow editing" />
                    <Toggle checked={perms.annotating} onChange={(v) => setPerms({ ...perms, annotating: v })} label="Allow comments & forms" />
                  </div>
                </div>
                <Toggle checked={useOwner} onChange={setUseOwner} label="Separate owner password" description="Lets you change permissions later without the open password." />
                {useOwner && (
                  <div>
                    <Label htmlFor="opw">Owner password</Label>
                    <PasswordInput id="opw" value={ownerPw} onChange={setOwnerPw} placeholder="Owner password" />
                  </div>
                )}
                <p className="text-xs text-slate-500">Permission restrictions are honoured by compliant viewers but are not a substitute for the open password.</p>
              </div>
            </Panel>
            <Button size="lg" className="w-full sm:w-auto" onClick={protect} disabled={touched && !valid} icon={<LockKeyhole className="h-5 w-5" />}>
              Protect PDF
            </Button>
          </Step>
        )}
        {proc.status === "processing" && (
          <Step k="processing">
            <ProcessingPanel progress={proc.progress} title="Encrypting PDF" />
          </Step>
        )}
        {proc.status === "error" && (
          <Step k="error">
            <ErrorPanel title="Protection failed" message={proc.error ?? ""} onRetry={proc.retry} onReset={reset} />
          </Step>
        )}
        {proc.status === "done" && proc.result && file && (
          <Step k="done">
            <ResultPanel
              title="Your PDF is protected!"
              subtitle={
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" /> {algo} encryption · {formatBytes(proc.result.size)}
                </span>
              }
              onDownload={() => (downloadBlob(proc.result!, `${stripExt(file.name)}-protected.pdf`), toast.success("File downloaded successfully"))}
              downloadLabel="Download protected PDF"
              onReset={reset}
            >
              <InfoNote tone="warning">Keep your password safe — there is no way to recover a protected PDF without it.</InfoNote>
            </ResultPanel>
          </Step>
        )}
      </AnimatePresence>
    </ToolLayout>
  );
}

/* ============================ REMOVE PASSWORD ============================ */
export function RemovePassword() {
  const tool = findTool("remove-password")!;
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [pw, setPw] = useState("");
  const [encrypted, setEncrypted] = useState<boolean | null>(null);
  const [wrong, setWrong] = useState<string | undefined>();
  const proc = useProcessor<Blob>();

  useEffect(() => {
    if (!file) return;
    let alive = true;
    (async () => {
      try {
        const { PDFDocument } = await loadPdfLib();
        const pdf = await PDFDocument.load(await readFile(file), { ignoreEncryption: true });
        if (alive) setEncrypted(pdf.isEncrypted);
        if (!pdf.isEncrypted) toast.info("This PDF is not password protected", "There's nothing to unlock — but you can still re-save it.");
      } catch {
        if (alive) setEncrypted(true); // heavily encrypted files may not even parse without the password
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const unlock = () => {
    if (!file) return;
    setWrong(undefined);
    proc.run(async (report) => {
      report(10, "Loading PDF");
      const { PDFDocument } = await loadPdfLib();
      const data = await readFile(file);
      report(40, "Decrypting", "Verifying password");
      let pdf;
      try {
        pdf = await PDFDocument.load(data, { password: pw });
      } catch (e) {
        const msg = e instanceof Error ? e.message.toLowerCase() : "";
        if (msg.includes("password") || msg.includes("encrypt") || msg.includes("decrypt")) {
          throw new Error("Incorrect password. Double-check for typos, caps lock, and whether this is the open password (not the owner/permissions password).");
        }
        throw new Error("The PDF could not be decrypted. It may use an encryption method this browser tool doesn't support, or the file may be damaged.");
      }
      report(75, "Rebuilding unlocked copy");
      const bytes = await pdf.save();
      report(100, "Done");
      return new Blob([bytes as BlobPart], { type: "application/pdf" });
    }).then(() => undefined);
  };

  useEffect(() => {
    if (proc.status === "done") toast.success("PDF unlocked successfully");
    if (proc.status === "error" && proc.error?.startsWith("Incorrect password")) setWrong(proc.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proc.status]);

  const reset = () => {
    proc.reset();
    setFile(null);
    setPw("");
    setEncrypted(null);
    setWrong(undefined);
  };

  const showForm = file && (proc.status === "idle" || (proc.status === "error" && wrong));

  return (
    <ToolLayout tool={tool}>
      <AnimatePresence mode="wait">
        {!file && (
          <Step k="upload">
            <Dropzone accept={ACCEPT_PDF} maxSize={200 * 1024 * 1024} onFiles={(f) => (setFile(f[0]), toast.success("PDF uploaded successfully", f[0].name))} />
            <InfoNote>Only use this on documents you are authorised to unlock. Decryption happens locally; your password never leaves this device.</InfoNote>
          </Step>
        )}
        {showForm && (
          <Step k="form">
            <FileCard name={file.name} size={file.size} meta={encrypted === null ? "Checking…" : encrypted ? "Password protected" : "Not encrypted"} onRemove={reset} />
            <Panel title="Enter the current password">
              <Label htmlFor="cur">Password</Label>
              <PasswordInput id="cur" value={pw} onChange={(v) => (setPw(v), setWrong(undefined))} autoComplete="current-password" error={wrong} placeholder="Document open password" onEnter={unlock} />
              {encrypted === false && <p className="mt-2 text-xs text-slate-500">This file isn't encrypted — you can leave the password empty.</p>}
            </Panel>
            <Button size="lg" className="w-full sm:w-auto" onClick={unlock} disabled={encrypted !== false && !pw} loading={proc.status === "processing"} icon={<LockKeyholeOpen className="h-5 w-5" />}>
              Unlock PDF
            </Button>
          </Step>
        )}
        {proc.status === "processing" && (
          <Step k="processing">
            <ProcessingPanel progress={proc.progress} title="Unlocking PDF" />
          </Step>
        )}
        {proc.status === "error" && !wrong && (
          <Step k="error">
            <ErrorPanel title="Unlock failed" message={proc.error ?? ""} onRetry={proc.retry} onReset={reset} />
          </Step>
        )}
        {proc.status === "done" && proc.result && file && (
          <Step k="done">
            <ResultPanel
              title="PDF unlocked!"
              subtitle={`Opens without a password · ${formatBytes(proc.result.size)}`}
              onDownload={() => (downloadBlob(proc.result!, `${stripExt(file.name)}-unlocked.pdf`), toast.success("File downloaded successfully"))}
              downloadLabel="Download unlocked PDF"
              onReset={reset}
            />
          </Step>
        )}
      </AnimatePresence>
    </ToolLayout>
  );
}
