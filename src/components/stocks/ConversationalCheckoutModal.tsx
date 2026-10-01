"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Mic, MicOff, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/gst";
import {
  executeVoiceCommand,
  parseVoiceCommand,
  SmartStocksApiError,
} from "@/lib/smart-stocks/client";
import {
  VoiceCommandDraft,
  VoiceCommandExecuteResponse,
  VoiceIntent,
} from "@/lib/smart-stocks/shared";
import { useWorkspaceStore } from "@/store/workspace-store";
import { StockItemRow } from "@/types";

type StockOption = Pick<
  StockItemRow,
  "id" | "name" | "unit" | "qty_on_hand" | "selling_price" | "last_cost"
>;

interface ConversationalCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  stockItems: StockOption[];
  onExecuted: (result: VoiceCommandExecuteResponse) => void;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }

  const speechWindow = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

const LANGUAGES = [
  { value: "hi-IN", label: "Hindi / Hinglish" },
  { value: "en-IN", label: "Indian English" },
];

const INTENT_LABEL: Record<VoiceIntent, string> = {
  sale: "Sale",
  adjustment_loss: "Stock loss",
  purchase: "Purchase in",
};

const SELECT_CLASS =
  "focus-ring w-full rounded-md border border-recoverpe-line bg-recoverpe-white px-2 py-2 text-sm text-recoverpe-black focus:border-recoverpe-black";
const LABEL_CLASS = "mb-1 block text-xs font-medium text-recoverpe-black";

interface ReviewLine {
  key: number;
  spokenName: string;
  itemId: string;
  qty: string;
  rate: string;
}

type Stage = "capture" | "review" | "done";

export function ConversationalCheckoutModal({
  isOpen,
  onClose,
  businessId,
  stockItems,
  onExecuted,
}: ConversationalCheckoutModalProps) {
  const openCollectionGate = useWorkspaceStore((state) => state.openCollectionGate);
  const [stage, setStage] = useState<Stage>("capture");
  const [language, setLanguage] = useState("hi-IN");
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [draft, setDraft] = useState<VoiceCommandDraft | null>(null);
  const [lines, setLines] = useState<ReviewLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [result, setResult] = useState<VoiceCommandExecuteResponse | null>(null);
  const [error, setError] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSpeechSupported(Boolean(getSpeechRecognition()));
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    setInterim("");
  }, []);

  const reset = useCallback(() => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setStage("capture");
    setTranscript("");
    setInterim("");
    setIsListening(false);
    setDraft(null);
    setLines([]);
    setCustomerName("");
    setCustomerPhone("");
    setResult(null);
    setError("");
    setIsWorking(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      reset();
    }
  }, [isOpen, reset]);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  function startListening() {
    const Recognition = getSpeechRecognition();

    if (!Recognition) {
      setSpeechSupported(false);
      return;
    }

    setError("");
    const recognition = new Recognition();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const segment = event.results[index];
        const text = segment[0]?.transcript ?? "";

        if (segment.isFinal) {
          finalText += text;
        } else {
          interimText += text;
        }
      }

      if (finalText) {
        setTranscript((current) => `${current} ${finalText}`.trim());
      }

      setInterim(interimText);
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Microphone access was blocked. Allow it in the browser, or type instead.");
      } else if (event.error !== "aborted" && event.error !== "no-speech") {
        setError("Voice capture stopped. You can type the command instead.");
      }
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
      setInterim("");
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  const stockById = useMemo(
    () => new Map(stockItems.map((item) => [item.id, item])),
    [stockItems]
  );

  async function handleUnderstand() {
    stopListening();
    const text = transcript.trim();

    if (!text) {
      setError("Say or type what was sold first.");
      return;
    }

    setError("");
    setIsWorking(true);

    try {
      const { draft: parsedDraft } = await parseVoiceCommand(businessId, text);
      setDraft(parsedDraft);
      setLines(
        parsedDraft.items.map((item, index) => ({
          key: index,
          spokenName: item.name,
          itemId: item.match?.item_id ?? "",
          qty: String(item.qty),
          rate: item.suggested_rate > 0 ? String(item.suggested_rate) : "",
        }))
      );
      setCustomerName(parsedDraft.parsed.customer_name ?? "");
      setCustomerPhone(parsedDraft.parsed.customer_phone ?? "");
      setStage("review");
    } catch (parseError) {
      setError(
        parseError instanceof Error ? parseError.message : "Could not understand that."
      );
    } finally {
      setIsWorking(false);
    }
  }

  function updateLine(key: number, patch: Partial<ReviewLine>) {
    setLines((current) =>
      current.map((line) => {
        if (line.key !== key) {
          return line;
        }

        const next = { ...line, ...patch };

        if (patch.itemId && !line.rate) {
          const stock = stockById.get(patch.itemId);
          const price =
            draft?.parsed.intent === "purchase" ? stock?.last_cost : stock?.selling_price;

          if (price && Number(price) > 0) {
            next.rate = String(price);
          }
        }

        return next;
      })
    );
  }

  const total = lines.reduce(
    (sum, line) => sum + (Number(line.qty) || 0) * (Number(line.rate) || 0),
    0
  );
  const intent = draft?.parsed.intent ?? "sale";
  const wantsKhata = intent === "sale" && Boolean(customerName.trim() || customerPhone.trim());
  const unlinked = lines.filter((line) => !line.itemId);

  async function handleExecute() {
    if (!draft) {
      return;
    }

    if (lines.length === 0) {
      setError("Add at least one item.");
      return;
    }

    if (unlinked.length > 0) {
      setError(
        `Pick a stock item for: ${unlinked.map((line) => line.spokenName).join(", ")}. Add new items from the stock table first.`
      );
      return;
    }

    setError("");
    setIsWorking(true);

    try {
      const executed = await executeVoiceCommand({
        command_id: draft.command_id,
        items: lines.map((line) => ({
          item_id: line.itemId,
          qty: Number(line.qty),
          rate: Number(line.rate) || 0,
        })),
        customer_name: wantsKhata ? customerName.trim() || null : null,
        customer_phone: wantsKhata ? customerPhone.trim() || null : null,
      });
      setResult(executed);
      setStage("done");
      onExecuted(executed);
    } catch (executeError) {
      if (
        executeError instanceof SmartStocksApiError &&
        executeError.code === "collection_details_required"
      ) {
        onClose();
        openCollectionGate();
        return;
      }

      setError(
        executeError instanceof Error ? executeError.message : "Failed to post the sale."
      );
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Bolo aur becho — Voice checkout"
      disableClose={isWorking}
    >
      <div className="space-y-4">
        {error ? <Alert tone="danger">{error}</Alert> : null}

        {stage === "capture" ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {LANGUAGES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setLanguage(option.value)}
                  disabled={isListening}
                  className={`focus-ring rounded-full border px-3 py-1 text-xs font-medium ${
                    language === option.value
                      ? "border-recoverpe-black bg-recoverpe-black text-recoverpe-white"
                      : "border-recoverpe-line text-recoverpe-grey-medium hover:text-recoverpe-black"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col items-center gap-3 rounded-xl border border-recoverpe-line p-5">
              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                disabled={!speechSupported || isWorking}
                aria-pressed={isListening}
                aria-label={isListening ? "Stop listening" : "Start listening"}
                className={`focus-ring flex h-16 w-16 items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  isListening
                    ? "border-recoverpe-danger-line bg-recoverpe-danger-fill text-recoverpe-danger-ink"
                    : "border-recoverpe-black bg-recoverpe-black text-recoverpe-white"
                }`}
              >
                {isListening ? (
                  <MicOff className="h-6 w-6" aria-hidden />
                ) : (
                  <Mic className="h-6 w-6" aria-hidden />
                )}
              </button>
              <p className="text-center text-xs text-recoverpe-muted">
                {!speechSupported
                  ? "Voice is not available in this browser. Type the command below."
                  : isListening
                    ? "Listening… speak naturally, then tap again to stop."
                    : 'Tap and say e.g. "Ramesh ko do kilo cheeni aur ek Parle-G, udhaar mein, 98765 43210"'}
              </p>
            </div>

            <div>
              <label htmlFor="voice-transcript" className={LABEL_CLASS}>
                Command
              </label>
              <textarea
                id="voice-transcript"
                rows={3}
                value={isListening && interim ? `${transcript} ${interim}`.trim() : transcript}
                onChange={(event) => setTranscript(event.target.value)}
                readOnly={isListening}
                placeholder="Type or speak what was sold"
                className="focus-ring w-full rounded-md border border-recoverpe-line bg-recoverpe-white px-3 py-2.5 text-sm text-recoverpe-black placeholder:text-recoverpe-subtle focus:border-recoverpe-black"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={onClose} disabled={isWorking}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleUnderstand()}
                disabled={isWorking || !transcript.trim()}
              >
                {isWorking ? "Understanding..." : "Understand"}
              </Button>
            </div>
          </>
        ) : null}

        {stage === "review" && draft ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 text-sm italic text-recoverpe-muted">“{draft.transcript}”</p>
              <Badge tone={intent === "adjustment_loss" ? "warning" : "info"}>
                {INTENT_LABEL[intent]}
              </Badge>
            </div>

            {lines.length === 0 ? (
              <Alert tone="warning">
                No items were recognised. Go back and say the item names and quantities.
              </Alert>
            ) : (
              <div className="space-y-2">
                {lines.map((line) => {
                  const stock = line.itemId ? stockById.get(line.itemId) : undefined;

                  return (
                    <div key={line.key} className="rounded-lg border border-recoverpe-line p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs text-recoverpe-muted">
                          Heard: <span className="text-recoverpe-black">{line.spokenName}</span>
                        </p>
                        <button
                          type="button"
                          aria-label={`Remove ${line.spokenName}`}
                          className="focus-ring rounded p-1 text-recoverpe-muted hover:text-recoverpe-black"
                          onClick={() =>
                            setLines((current) => current.filter((entry) => entry.key !== line.key))
                          }
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                      <div className="mt-2 grid grid-cols-4 gap-2">
                        <div className="col-span-4 sm:col-span-2">
                          <label className={LABEL_CLASS} htmlFor={`voice-item-${line.key}`}>
                            Stock item
                          </label>
                          <select
                            id={`voice-item-${line.key}`}
                            className={`${SELECT_CLASS} ${line.itemId ? "" : "border-recoverpe-danger-line"}`}
                            value={line.itemId}
                            onChange={(event) => updateLine(line.key, { itemId: event.target.value })}
                          >
                            <option value="">Select item…</option>
                            {stockItems.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name} — {Number(item.qty_on_hand)} {item.unit}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <label className={LABEL_CLASS} htmlFor={`voice-qty-${line.key}`}>
                            Qty{stock ? ` (${stock.unit})` : ""}
                          </label>
                          <Input
                            id={`voice-qty-${line.key}`}
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="any"
                            value={line.qty}
                            onChange={(event) => updateLine(line.key, { qty: event.target.value })}
                          />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <label className={LABEL_CLASS} htmlFor={`voice-rate-${line.key}`}>
                            Rate
                          </label>
                          <Input
                            id={`voice-rate-${line.key}`}
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            value={line.rate}
                            onChange={(event) => updateLine(line.key, { rate: event.target.value })}
                          />
                        </div>
                      </div>
                      {stock && intent !== "purchase" && Number(line.qty) > Number(stock.qty_on_hand) ? (
                        <p className="mt-1 text-xs text-recoverpe-danger-ink">
                          Only {Number(stock.qty_on_hand)} {stock.unit} in stock.
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}

            {intent === "sale" ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label htmlFor="voice-customer" className={LABEL_CLASS}>
                    Customer (for udhaar)
                  </label>
                  <Input
                    id="voice-customer"
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    placeholder="Leave blank for cash sale"
                  />
                </div>
                <div>
                  <label htmlFor="voice-phone" className={LABEL_CLASS}>
                    Mobile
                  </label>
                  <Input
                    id="voice-phone"
                    type="tel"
                    inputMode="numeric"
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                    placeholder="10-digit mobile"
                  />
                </div>
                <p className="text-xs text-recoverpe-muted sm:col-span-2">
                  {wantsKhata
                    ? "This sale goes on the customer's khata and they get a WhatsApp receipt."
                    : "No customer: recorded as a cash sale, stock only."}
                </p>
              </div>
            ) : null}

            <div className="flex items-center justify-between border-t border-recoverpe-line pt-3 text-sm">
              <span className="text-recoverpe-muted">Total</span>
              <span className="font-mono tabular-nums font-semibold text-recoverpe-black">
                {formatCurrency(Math.round(total * 100) / 100)}
              </span>
            </div>

            <div className="flex justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStage("capture")}
                disabled={isWorking}
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={() => void handleExecute()}
                disabled={isWorking || lines.length === 0}
              >
                {isWorking ? "Posting..." : "Confirm"}
              </Button>
            </div>
          </>
        ) : null}

        {stage === "done" && result ? (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-recoverpe-success-ink" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-recoverpe-black">
                {INTENT_LABEL[result.intent]} posted — {formatCurrency(result.total_amount)}
              </p>
              <p className="mt-1 text-xs text-recoverpe-muted">
                {result.items.map((item) => `${item.qty} × ${item.name}`).join(", ")}
              </p>
            </div>
            {result.ledger_id ? (
              <div className="flex flex-wrap justify-center gap-2">
                <Badge tone="success">Added to khata</Badge>
                <Badge tone={result.whatsapp_sent ? "success" : "warning"}>
                  {result.whatsapp_sent ? "WhatsApp receipt sent" : "WhatsApp receipt not sent"}
                </Badge>
              </div>
            ) : null}
            <div className="flex justify-center gap-2">
              <Button type="button" variant="secondary" onClick={reset}>
                New sale
              </Button>
              <Button type="button" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
