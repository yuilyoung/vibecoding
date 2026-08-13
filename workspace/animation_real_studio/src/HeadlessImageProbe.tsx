import { useEffect, useRef, useState } from "react";

type ProbeAsset = { dataUri: string; width: number; height: number; targetAspectRatio: "9:16"; returnedAspectRatio: string; notice: string };
type ProbeJob = { mode: "developer_image_probe"; phase: "queued" | "generating" | "completed" | "failed"; progress: number };
type ProbeError = { code: string; message: string; cleanupWarning?: unknown };
type ProbeGeneration = { id: string; status: "in_progress" | "completed" | "failed"; provider: string; job: ProbeJob; asset: ProbeAsset | null; error: ProbeError | null; notice: string };
type ProbeResponse = { generation: ProbeGeneration | null; capabilityToken: string | null; remainingAttempts: number | null };

class ProbeRequestError extends Error {
  constructor(message: string, readonly state: ProbeResponse) {
    super(message);
    this.name = "ProbeRequestError";
  }
}

async function readProbe(path: string, init?: RequestInit): Promise<ProbeResponse> {
  const response = await fetch(path, init);
  const body = await response.json() as { generation?: ProbeGeneration | null; capabilityToken?: string; remainingAttempts?: number; error?: string; message?: string };
  const state = { generation: body.generation ?? null, capabilityToken: body.capabilityToken ?? null, remainingAttempts: typeof body.remainingAttempts === "number" ? body.remainingAttempts : null };
  if (!response.ok) throw new ProbeRequestError(body.message ?? body.error ?? "Headless image probe request failed.", state);
  return state;
}

function DeveloperImageProbeLoading({ job }: { job: ProbeJob }) {
  const queued = job.phase === "queued";
  return <div className="developer-probe-loading" role="status" aria-live="polite">
    <span className="developer-probe-spinner" aria-hidden="true" />
    <div className="developer-probe-loading-copy">
      <b>Developer image probe generating: {job.progress}%</b>
      <span>{queued ? "Preparing the fixed local request." : "Generating and validating the fixed original image."}</span>
      <div className="developer-probe-progress" role="progressbar" aria-label="Developer image probe progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={job.progress}><span style={{ width: `${job.progress}%` }} /></div>
      <small>{queued ? "Queued milestone: 0%" : "Generation milestone: 50%"}</small>
    </div>
  </div>;
}

export function HeadlessImageProbe() {
  const [generation, setGeneration] = useState<ProbeGeneration | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const capabilityToken = useRef<string | null>(null);
  const startInFlight = useRef(false);

  async function refreshProbe() {
    const result = await readProbe("/api/headless-image-spike");
    capabilityToken.current = result.capabilityToken ?? capabilityToken.current;
    setGeneration(result.generation);
    setRemainingAttempts(result.remainingAttempts);
    return result;
  }

  useEffect(() => { void refreshProbe().catch((reason) => setError(reason instanceof Error ? reason.message : "Headless image probe is unavailable.")); }, []);
  useEffect(() => {
    if (generation?.status !== "in_progress") return;
    const timer = window.setTimeout(() => { void refreshProbe().catch((reason) => setError(reason instanceof Error ? reason.message : "Headless image probe is unavailable.")); }, 1000);
    return () => window.clearTimeout(timer);
  }, [generation]);

  async function start() {
    if (startInFlight.current || generation?.status === "in_progress" || remainingAttempts === 0) return;
    if (!capabilityToken.current) {
      setError("Local capability token is not ready. Refresh the page and try again.");
      return;
    }
    startInFlight.current = true;
    setStarting(true);
    setError("");
    try {
      const result = await readProbe("/api/headless-image-spike", { method: "POST", headers: { "X-Studio-Local-Token": capabilityToken.current } });
      capabilityToken.current = result.capabilityToken ?? capabilityToken.current;
      setGeneration(result.generation);
      setRemainingAttempts(result.remainingAttempts);
    } catch (reason) {
      const reconciled = reason instanceof ProbeRequestError && (reason.state.generation !== null || reason.state.remainingAttempts !== null);
      if (reason instanceof ProbeRequestError) {
        capabilityToken.current = reason.state.capabilityToken ?? capabilityToken.current;
        setGeneration(reason.state.generation);
        setRemainingAttempts(reason.state.remainingAttempts);
      }
      if (!reconciled) setError(reason instanceof Error ? reason.message : "Headless image probe could not start.");
    }
    finally {
      startInFlight.current = false;
      setStarting(false);
    }
  }

  const running = starting || generation?.status === "in_progress";
  const exhausted = remainingAttempts === 0;
  const actionLabel = running ? "Generating fixed image" : exhausted ? "Probe allowance exhausted" : generation ? "Generate another test image" : "Generate test photorealistic image";
  return <section className="project-section" aria-label="Headless photorealistic image generation probe">
    <div className="section-heading"><p className="section-label">HEADLESS IMAGEGEN / LOCAL PROBE</p><span className="demo-label">FIXED PROMPT ONLY</span></div>
    <div className="delivery-card"><div className="delivery-poster"><span>01<br />PROBE</span></div><div>
      <h3>Codex headless photorealistic still</h3>
      <p>This developer-only local control sends one fixed original prompt to the signed-in Codex CLI. It never sends a project scene, reference media, or user prompt.</p>
      <p>Generates one more fixed, developer-only test image and consumes one probe allowance. It is not a user request or public delivery.</p>
      <p>Restarting the local API resets this developer-only in-memory allowance and history.</p>
      {remainingAttempts !== null && <p>{remainingAttempts} developer probe allowance{remainingAttempts === 1 ? "" : "s"} remaining for this API session.</p>}
      {running && <p>A developer probe is in progress. Wait for its terminal result before using another allowance.</p>}
      {exhausted && <p>No developer probe allowance remains for this API session.</p>}
      {generation?.status === "completed" && generation.asset && <><img src={generation.asset.dataUri} width={generation.asset.width} height={generation.asset.height} alt="Generated vertical 9 by 16 photorealistic probe" style={{ display: "block", width: "min(100%, 260px)", height: "auto", marginBottom: "16px", border: "1px solid #a6a39b" }} /><p>{generation.asset.notice}</p></>}
      {generation?.status === "in_progress" && <DeveloperImageProbeLoading job={generation.job} />}
      {generation?.status === "failed" && <p className="field-error" role="alert">{generation.error?.message}</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
      <button className="button button-primary" onClick={() => void start()} disabled={running || exhausted}>{actionLabel} <span>→</span></button>
    </div></div>
  </section>;
}
