import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { Upload, FileText, Download, Trash2, Settings, Link, Loader2, Eye, AlertCircle, Heart } from "lucide-react";

// ---- UI Components ----
function Button({
  children,
  className = "",
  disabled,
  onClick,
  type = "button",
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={
        `inline-flex items-center gap-2 rounded-2xl px-4 py-2 shadow-sm border border-gray-200 hover:border-gray-300 ` +
        `disabled:opacity-50 disabled:cursor-not-allowed transition-all ${className}`
      }
    >
      {children}
    </button>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-gray-200 shadow-sm bg-white ${className}`}>{children}</div>
  );
}

function Label({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-gray-700">
      {children}
    </label>
  );
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
      <div
        className="bg-black h-full transition-all duration-300 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
  );
}

// Cookie Consent Banner Component
function CookieConsent({ onAccept, onDecline }: { onAccept: () => void; onDecline: () => void }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 shadow-2xl z-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm text-gray-700">
            <strong>🍪 We use cookies</strong> to improve your experience and show relevant ads. 
            By clicking "Accept", you consent to our use of cookies and analytics.{" "}
            <a href="#" className="underline hover:text-gray-900">Learn more</a>
          </p>
        </div>
        <div className="flex gap-3 flex-shrink-0">
          <Button onClick={onDecline} className="text-gray-600 hover:bg-gray-50">
            Decline
          </Button>
          <Button onClick={onAccept} className="bg-black text-white hover:bg-gray-800">
            Accept All
          </Button>
        </div>
      </div>
    </div>
  );
}

// Ad Placeholder Component
function AdPlaceholder({ id, format = "horizontal" }: { id: string; format?: "horizontal" | "square" }) {
  const height = format === "horizontal" ? "90px" : "280px";
  
  return (
    <div className="w-full flex items-center justify-center bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl" style={{ minHeight: height }}>
      <p className="text-xs text-gray-400 font-mono">
        {id} - Replace with AdSense code
      </p>
    </div>
  );
}

// ---- Helpers ----
function bytesToNice(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(2)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

async function downloadBlob(blob: Blob, filename = "stitched.pdf") {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

// Validate PDF
async function validatePDF(file: File): Promise<{ valid: boolean; pages?: number; error?: string }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    const header = String.fromCharCode(...bytes.slice(0, 5));
    if (header !== '%PDF-') {
      return { valid: false, error: "File is not a valid PDF" };
    }

    const text = String.fromCharCode(...bytes.slice(0, Math.min(50000, bytes.length)));
    const matches = text.match(/\/Type[\s]*\/Page[^s]/g);
    const pages = matches ? matches.length : 0;

    return { valid: true, pages: pages || 1 };
  } catch (e) {
    return { valid: false, error: "Error validating PDF" };
  }
}

// PDF Stitching with PDF-lib
async function stitchPDF(
  file: File,
  options: { margin: number; maxPages: number; preserveLinks: boolean },
  onProgress: (progress: number) => void
): Promise<Blob> {
  onProgress(10);

  const PDFLib = await import('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm');
  const { PDFDocument } = PDFLib;

  onProgress(20);

  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  
  onProgress(30);

  const pages = pdfDoc.getPages();
  const totalPages = Math.min(pages.length, options.maxPages);

  if (totalPages === 0) {
    throw new Error("PDF has no pages");
  }

  const newPdfDoc = await PDFDocument.create();
  
  onProgress(40);

  let totalHeight = 0;
  const pageWidths: number[] = [];
  const pageHeights: number[] = [];
  
  for (let i = 0; i < totalPages; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();
    pageWidths.push(width);
    pageHeights.push(height);
    totalHeight += height;
    if (i < totalPages - 1) {
      totalHeight += options.margin;
    }
  }

  const pageWidth = pageWidths[0];

  onProgress(50);

  const newPage = newPdfDoc.addPage([pageWidth, totalHeight]);

  let currentY = totalHeight;
  
  for (let i = 0; i < totalPages; i++) {
    onProgress(50 + (i / totalPages) * 40);
    
    const [embeddedPage] = await newPdfDoc.embedPdf(pdfDoc, [i]);
    const { width, height } = pageHeights[i] ? { width: pageWidths[i], height: pageHeights[i] } : embeddedPage;
    
    currentY -= height;
    
    newPage.drawPage(embeddedPage, {
      x: 0,
      y: currentY,
      width: width,
      height: height,
    });

    if (i < totalPages - 1) {
      currentY -= options.margin;
    }
  }

  onProgress(95);

  const pdfBytes = await newPdfDoc.save();
  
  onProgress(100);

  return new Blob([pdfBytes], { type: 'application/pdf' });
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [pdfInfo, setPdfInfo] = useState<{ pages: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preserveLinks, setPreserveLinks] = useState(true);
  const [marginPoints, setMarginPoints] = useState<number>(20);
  const [maxPages, setMaxPages] = useState<number>(50);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showCookieConsent, setShowCookieConsent] = useState(true);
  const [cookiesAccepted, setCookiesAccepted] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    if (cookiesAccepted) {
      // TODO: Initialize Google Analytics here
      // Replace 'G-XXXXXXXXXX' with your actual Measurement ID
    }
  }, [cookiesAccepted]);

  const handleCookieAccept = () => {
    setCookiesAccepted(true);
    setShowCookieConsent(false);
  };

  const handleCookieDecline = () => {
    setCookiesAccepted(false);
    setShowCookieConsent(false);
  };

  const onSelect = useCallback(async (f: File | null) => {
    setError(null);
    setPdfInfo(null);
    
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }

    if (!f) {
      setFile(null);
      return;
    }

    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setError("Please select a PDF file.");
      setFile(null);
      return;
    }

    if (f.size > 100 * 1024 * 1024) {
      setError("File too large. Maximum: 100 MB");
      setFile(null);
      return;
    }

    if (f.size === 0) {
      setError("File is empty.");
      setFile(null);
      return;
    }

    setIsValidating(true);
    const validation = await validatePDF(f);
    setIsValidating(false);

    if (!validation.valid) {
      setError(validation.error || "Invalid PDF");
      setFile(null);
      return;
    }

    setFile(f);
    setPdfInfo({ pages: validation.pages || 0 });

    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
  }, [previewUrl]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    onSelect(f ?? null);
  }, [onSelect]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const canProcess = useMemo(() => !!file && !isProcessing && !isValidating, [file, isProcessing, isValidating]);

  const handleProcess = useCallback(async () => {
    if (!file) return;
    
    setError(null);
    setIsProcessing(true);
    setProgress(0);

    try {
      const blob = await stitchPDF(
        file,
        { margin: marginPoints, maxPages, preserveLinks },
        setProgress
      );

      const filename = file.name.replace(/\.pdf$/i, "") + "_stitched.pdf";
      await downloadBlob(blob, filename);
      
      setProgress(0);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "An error occurred while processing the PDF.");
      setProgress(0);
    } finally {
      setIsProcessing(false);
    }
  }, [file, preserveLinks, marginPoints, maxPages]);

  const reset = useCallback(() => {
    setFile(null);
    setPdfInfo(null);
    setError(null);
    setProgress(0);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (inputRef.current) inputRef.current.value = "";
  }, [previewUrl]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <header className="mx-auto max-w-5xl px-4 pt-12 pb-8">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-700 text-white grid place-items-center shadow-lg">
            <FileText size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">PDF Stitcher</h1>
            <p className="text-sm text-gray-600 mt-1">Transform multiple pages into a single long scrollable page</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 mb-6">
        <AdPlaceholder id="ad-top-banner" format="horizontal" />
      </div>

      <main className="mx-auto max-w-5xl px-4 pb-20">
        <Card className="p-6">
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            className={
              `rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-200 ` +
              (isDragging ? "border-black bg-gray-50 scale-[1.02]" : "border-gray-300 hover:border-gray-400 hover:bg-gray-50")
            }
          >
            {!file ? (
              <div className="flex flex-col items-center gap-5">
                <div className="rounded-full h-16 w-16 grid place-items-center bg-gradient-to-br from-gray-100 to-gray-200 shadow-inner">
                  <Upload size={28} className="text-gray-600" />
                </div>
                <div>
                  <p className="text-base font-medium text-gray-700">Drag and drop your PDF here</p>
                  <p className="text-sm text-gray-500 mt-1">or click the button below</p>
                </div>
                <div>
                  <input
                    ref={inputRef}
                    id="file"
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
                  />
                  <Button
                    className="bg-black text-white hover:bg-gray-800 font-medium"
                    onClick={() => inputRef.current?.click()}
                  >
                    <Upload size={18} /> Choose PDF File
                  </Button>
                </div>
                <p className="text-xs text-gray-400">Maximum: 100 MB • 100% browser-based processing</p>
              </div>
            ) : (
              <div className="flex w-full flex-col gap-6">
                <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-white p-3 shadow-sm">
                      <FileText size={24} className="text-gray-700" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-semibold text-gray-900 truncate max-w-[40ch]" title={file.name}>
                        {file.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 flex items-center gap-3">
                        <span>{bytesToNice(file.size)}</span>
                        {pdfInfo && <span>• {pdfInfo.pages} page{pdfInfo.pages !== 1 ? 's' : ''}</span>}
                        {isValidating && <span className="flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Validating...</span>}
                      </div>
                    </div>
                  </div>
                  <Button className="text-red-600 hover:bg-red-50 border-red-200" onClick={reset}>
                    <Trash2 size={16} /> Remove
                  </Button>
                </div>

                {previewUrl && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-600 mb-2">
                      <Eye size={14} /> Preview
                    </div>
                    <iframe
                      src={previewUrl}
                      className="w-full h-64 rounded-lg border border-gray-200"
                      title="PDF Preview"
                      sandbox="allow-same-origin"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="preserveLinks">Interactive Links</Label>
                    <button
                      id="preserveLinks"
                      type="button"
                      onClick={() => setPreserveLinks((v) => !v)}
                      className={`flex items-center justify-between rounded-xl border-2 px-4 py-3 transition-all ${
                        preserveLinks 
                          ? "border-emerald-400 bg-emerald-50 shadow-sm" 
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <span className="text-sm font-medium flex items-center gap-2">
                        <Link size={16} />
                        {preserveLinks ? "Active" : "Inactive"}
                      </span>
                    </button>
                    <p className="text-xs text-gray-500">Keep clickable links</p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="margin">Spacing Between Pages</Label>
                    <input
                      id="margin"
                      type="number"
                      min={0}
                      max={200}
                      step={5}
                      value={marginPoints}
                      onChange={(e) => setMarginPoints(Number(e.target.value || 0))}
                      className="rounded-xl border-2 border-gray-200 px-4 py-3 text-sm font-medium focus:border-black focus:outline-none transition-colors"
                      placeholder="20"
                    />
                    <p className="text-xs text-gray-500">{marginPoints} points (≈{(marginPoints * 0.35).toFixed(1)}mm)</p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="maxPages">Page Limit</Label>
                    <input
                      id="maxPages"
                      type="number"
                      min={1}
                      max={pdfInfo?.pages || 999}
                      step={1}
                      value={maxPages}
                      onChange={(e) => setMaxPages(Number(e.target.value || 1))}
                      className="rounded-xl border-2 border-gray-200 px-4 py-3 text-sm font-medium focus:border-black focus:outline-none transition-colors"
                      placeholder="50"
                    />
                    <p className="text-xs text-gray-500">Process maximum {maxPages} pages</p>
                  </div>
                </div>

                {isProcessing && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-gray-600">
                      <span className="font-medium">Processing...</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <ProgressBar progress={progress} />
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Settings size={14} /> Local & secure processing
                  </div>
                  <Button
                    onClick={handleProcess}
                    disabled={!canProcess}
                    className="bg-black text-white hover:bg-gray-800 font-semibold shadow-md hover:shadow-lg transition-all"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="animate-spin" size={18} /> Processing...
                      </>
                    ) : (
                      <>
                        <Download size={18} /> Create Long Page
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-xl border-2 border-red-200 bg-red-50 p-4 flex items-start gap-3">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800 font-medium">{error}</div>
            </div>
          )}
        </Card>

        <div className="mt-6 bg-gradient-to-r from-emerald-50 to-blue-50 rounded-2xl p-5 border border-emerald-200">
          <div className="flex items-start gap-3">
            <div className="bg-emerald-100 rounded-xl p-2 flex-shrink-0">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">
                🔒 100% Private & Secure
              </h3>
              <p className="text-xs text-gray-700 leading-relaxed">
                Your PDF is processed <strong>entirely in your browser</strong>. No files are uploaded to external servers. 
                We don't store, view, or share anything. What happens here, stays here. ✨
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <AdPlaceholder id="ad-mid-content" format="square" />
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">💪 Private</div>
            <p className="text-sm text-gray-700">All processing happens in your browser. No files uploaded.</p>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">⚡ Fast</div>
            <p className="text-sm text-gray-700">Client-side technology with PDF-lib for maximum performance.</p>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">🎯 Free</div>
            <p className="text-sm text-gray-700">No limits, no registration. Use as many times as you want.</p>
          </Card>
        </div>
      </main>

      <footer className="mx-auto max-w-5xl px-4 pb-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t border-gray-200">
          <p className="text-xs text-gray-400">Made with 💙 • 100% local processing</p>
          
          <a
            href="https://ko-fi.com/YOUR_USERNAME"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white text-sm font-medium hover:from-pink-600 hover:to-rose-600 transition-all shadow-md hover:shadow-lg"
          >
            <Heart size={16} fill="currentColor" />
            Support This Tool
          </a>
        </div>
      </footer>

      {showCookieConsent && (
        <CookieConsent onAccept={handleCookieAccept} onDecline={handleCookieDecline} />
      )}
    </div>
  );
}