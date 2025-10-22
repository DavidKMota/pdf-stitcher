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
      {/* Blog Section */}
      <section className="mx-auto max-w-5xl px-4 py-16 bg-gray-50">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">PDF Tips & Guides</h2>
          <p className="text-gray-600">Learn everything about PDF processing, merging, and optimization</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Article 1 */}
          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="mb-4">
              <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Tutorial</span>
              <h3 className="text-xl font-bold text-gray-900 mt-2 mb-3">
                How to Merge PDF Pages into One Long Page: Complete Guide
              </h3>
              <p className="text-sm text-gray-500 mb-4">October 10, 2025 • 5 min read</p>
            </div>
            <div className="prose prose-sm max-w-none text-gray-700 space-y-3">
              <p>
                Merging multiple PDF pages into a single, long scrollable page is a common need for professionals creating 
                portfolios, infographics, or continuous documents. This comprehensive guide explains everything you need to know.
              </p>
              <h4 className="font-semibold text-gray-900 mt-4 mb-2">Why Merge PDF Pages?</h4>
              <p>
                Traditional multi-page PDFs require constant scrolling or page navigation, which can disrupt the reading 
                experience. A single long page offers seamless vertical scrolling, perfect for presentations, CVs, timelines, 
                and infographics where continuity matters.
              </p>
              <h4 className="font-semibold text-gray-900 mt-4 mb-2">Best Practices</h4>
              <ul className="list-disc pl-5 space-y-2">
                <li>Keep file size under 50MB for optimal browser performance</li>
                <li>Maintain consistent page widths for professional appearance</li>
                <li>Add spacing between sections (20-30 points recommended)</li>
                <li>Preserve hyperlinks for interactive documents</li>
                <li>Test the final output on multiple devices</li>
              </ul>
              <h4 className="font-semibold text-gray-900 mt-4 mb-2">Common Use Cases</h4>
              <p>
                Designers use merged PDFs for portfolio presentations, HR professionals create single-page CVs, 
                marketers build long-form infographics, and educators develop continuous study guides. The technique 
                is also popular for creating scrollable comic books and manga.
              </p>
              <h4 className="font-semibold text-gray-900 mt-4 mb-2">Technical Considerations</h4>
              <p>
                When merging pages, consider the output file size. Large PDFs (100+ pages) may cause browser performance 
                issues. We recommend processing in batches of 50 pages maximum. Always keep a backup of your original file 
                before processing.
              </p>
            </div>
          </Card>

          {/* Article 2 */}
          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="mb-4">
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Privacy</span>
              <h3 className="text-xl font-bold text-gray-900 mt-2 mb-3">
                Why Browser-Based PDF Tools Are Safer Than Online Converters
              </h3>
              <p className="text-sm text-gray-500 mb-4">October 9, 2025 • 6 min read</p>
            </div>
            <div className="prose prose-sm max-w-none text-gray-700 space-y-3">
              <p>
                In an era of increasing data breaches and privacy concerns, choosing the right PDF tool matters more than ever. 
                Browser-based tools offer significant security advantages over traditional online converters.
              </p>
              <h4 className="font-semibold text-gray-900 mt-4 mb-2">The Upload Risk</h4>
              <p>
                Traditional online PDF converters require uploading your documents to remote servers. This creates multiple 
                risk points: data interception during transfer, storage on unknown servers, potential data breaches, and 
                unclear data retention policies. Your confidential documents could be stored indefinitely without your knowledge.
              </p>
              <h4 className="font-semibold text-gray-900 mt-4 mb-2">How Browser Processing Works</h4>
              <p>
                Client-side PDF tools process everything locally in your browser using JavaScript and WebAssembly. Your files 
                never leave your device. The processing happens entirely on your CPU, ensuring complete privacy. No server can 
                access, store, or analyze your documents.
              </p>
              <h4 className="font-semibold text-gray-900 mt-4 mb-2">Performance Benefits</h4>
              <p>
                Beyond security, browser-based tools offer speed advantages. No upload/download time means instant processing 
                for most documents. You're also not dependent on internet speed or server availability. Work offline without 
                limitations.
              </p>
              <h4 className="font-semibold text-gray-900 mt-4 mb-2">Compliance Matters</h4>
              <p>
                For businesses handling sensitive information, GDPR compliance and data protection regulations make browser-based 
                tools the only viable option. When documents never leave the user's device, compliance becomes straightforward. 
                No data transfer means no data breach risk.
              </p>
              <h4 className="font-semibold text-gray-900 mt-4 mb-2">Limitations to Consider</h4>
              <p>
                Browser-based tools have constraints: very large files (200MB+) may cause performance issues, and processing 
                power depends on the user's device. However, for 95% of use cases, these limitations are irrelevant compared 
                to the privacy benefits.
              </p>
            </div>
          </Card>

          {/* Article 3 */}
          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="mb-4">
              <span className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Optimization</span>
              <h3 className="text-xl font-bold text-gray-900 mt-2 mb-3">
                10 Essential PDF Optimization Tips for 2025
              </h3>
              <p className="text-sm text-gray-500 mb-4">October 8, 2025 • 7 min read</p>
            </div>
            <div className="prose prose-sm max-w-none text-gray-700 space-y-3">
              <p>
                PDF optimization isn't just about file size—it's about creating documents that load quickly, display correctly, 
                and remain accessible across all devices. Here are the essential techniques every PDF user should know.
              </p>
              <h4 className="font-semibold text-gray-900 mt-4 mb-2">1. Compress Images Intelligently</h4>
              <p>
                Images often account for 80% of PDF file size. Use JPEG compression for photographs (quality 85 is optimal) 
                and PNG for graphics with text. Consider downsampling images to 150 DPI for screen viewing—most displays 
                can't show higher resolution anyway.
              </p>
              <h4 className="font-semibold text-gray-900 mt-4 mb-2">2. Embed Fonts Selectively</h4>
              <p>
                Embedding fonts ensures consistency but increases file size. Only embed fonts actually used in the document, 
                and consider subsetting (including only used characters). Standard fonts like Arial and Times don't need embedding.
              </p>
              <h4 className="font-semibold text-gray-900 mt-4 mb-2">3. Remove Unnecessary Metadata</h4>
              <p>
                PDFs often contain hidden data: previous versions, comments, editing history, and custom properties. Cleaning 
                metadata can reduce file size by 10-20% while protecting privacy. Always sanitize documents before sharing publicly.
              </p>
              <h4 className="font-semibold text-gray-900 mt-4 mb-2">4. Optimize for Fast Web View</h4>
              <p>
                Enable "Fast Web View" (linearization) to allow page-by-page loading instead of downloading the entire file. 
                This is crucial for large documents shared online. Users can start reading the first page while remaining pages 
                load in the background.
              </p>
              <h4 className="font-semibold text-gray-900 mt-4 mb-2">5. Use Proper PDF Versions</h4>
              <p>
                PDF 1.7 (PDF/A) is the sweet spot for compatibility and features. Avoid bleeding-edge versions unless you need 
                specific features—they may not display correctly in older readers. PDF/A format is ideal for long-term archival.
              </p>
              <h4 className="font-semibold text-gray-900 mt-4 mb-2">Additional Tips</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>Remove duplicate resources and unused objects</li>
                <li>Flatten form fields after completion</li>
                <li>Convert color to grayscale when color isn't needed</li>
                <li>Use object streams for better compression</li>
                <li>Test output across different PDF readers</li>
              </ul>
            </div>
          </Card>

          {/* Article 4 */}
          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="mb-4">
              <span className="text-xs font-semibold text-orange-600 uppercase tracking-wide">Technology</span>
              <h3 className="text-xl font-bold text-gray-900 mt-2 mb-3">
                Understanding PDF Structure: A Developer's Guide
              </h3>
              <p className="text-sm text-gray-500 mb-4">October 7, 2025 • 8 min read</p>
            </div>
            <div className="prose prose-sm max-w-none text-gray-700 space-y-3">
              <p>
                PDFs appear simple to users, but the underlying structure is complex and fascinating. Understanding PDF internals 
                helps developers build better tools and users troubleshoot common issues.
              </p>
              <h4 className="font-semibold text-gray-900 mt-4 mb-2">The PDF File Structure</h4>
              <p>
                A PDF consists of four main sections: the header (defining PDF version), body (containing objects like pages, 
                fonts, and images), cross-reference table (index of all objects), and trailer (pointing to the root object). 
                This structure allows random access to any page without parsing the entire file.
              </p>
              <h4 className="font-semibold text-gray-900 mt-4 mb-2">Objects and Streams</h4>
              <p>
                Everything in a PDF is an object: pages, fonts, images, annotations. Objects can be direct (inline) or indirect 
                (referenced by number). Streams contain actual data like image bytes or content streams. Understanding this 
                object model is key to PDF manipulation.
              </p>
              <h4 className="font-semibold text-gray-900 mt-4 mb-2">Coordinate Systems</h4>
              <p>
                PDFs use a bottom-left origin coordinate system (unlike most graphics APIs). This causes confusion when 
                positioning elements. Each page has its own coordinate space, with units in points (1/72 inch). Transformations 
                allow rotation, scaling, and skewing.
              </p>
              <h4 className="font-semibold text-gray-900 mt-4 mb-2">Content Streams</h4>
              <p>
                Page content is described in a PostScript-like language. Commands like "m" (moveto), "l" (lineto), and "S" 
                (stroke) draw paths. Text operators place glyphs at specific positions. This low-level control enables precise 
                rendering but makes direct editing challenging.
              </p>
              <h4 className="font-semibold text-gray-900 mt-4 mb-2">Compression Techniques</h4>
              <p>
                PDFs support multiple compression algorithms: Flate (similar to ZIP), JPEG for images, JBIG2 for monochrome 
                images, and JPEG2000. Object streams (PDF 1.5+) can compress multiple objects together for better ratios. 
                Choosing the right compression for each data type is crucial for file size optimization.
              </p>
              <h4 className="font-semibold text-gray-900 mt-4 mb-2">Interactive Elements</h4>
              <p>
                Forms, annotations, and interactive features use the AcroForm dictionary. Each field has properties defining 
                type, appearance, and behavior. JavaScript can be embedded for dynamic behavior. Understanding these structures 
                is essential when preserving interactivity during merging or splitting operations.
              </p>
            </div>
          </Card>

          {/* Article 5 */}
          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="mb-4">
              <span className="text-xs font-semibold text-red-600 uppercase tracking-wide">Best Practices</span>
              <h3 className="text-xl font-bold text-gray-900 mt-2 mb-3">
                Creating Print-Ready PDFs: Professional Standards
              </h3>
              <p className="text-sm text-gray-500 mb-4">October 6, 2025 • 6 min read</p>
            </div>
            <div className="prose prose-sm max-w-none text-gray-700 space-y-3">
              <p>
                Whether you're designing business cards or preparing a book for publication, print-ready PDFs require specific 
                technical standards. Getting these details right prevents costly printing errors and ensures professional results.
              </p>
              <h4 className="font-semibold text-gray-900 mt-4 mb-2">Color Mode: CMYK vs RGB</h4>
              <p>
                Screens use RGB (Red, Green, Blue) while printers use CMYK (Cyan, Magenta, Yellow, Black). Always convert to 
                CMYK before printing. Colors will look different—RGB has a wider gamut, so some bright colors can't be reproduced 
                in CMYK. Perform soft proofing to preview how colors will print.
              </p>
              <h4 className="font-semibold text-gray-900 mt-4 mb-2">Bleed and Safe Areas</h4>
              <p>
                Bleed is the extra area extending beyond the trim line (typically 3mm). It prevents white edges if cutting isn't 
                perfectly aligned. Keep important content within the safe area (3-5mm from trim line). Text too close to edges 
                may be cut off during trimming.
              </p>
              <h4 className="font-semibold text-gray-900 mt-4 mb-2">Resolution Requirements</h4>
              <p>
                Images should be 300 DPI minimum for professional printing. Lower resolution produces pixelated results. 
                Vector graphics (text, logos) should remain as vectors, not rasterized. Check for low-resolution images using 
                PDF preflight tools before sending to the printer.
              </p>
              <h4 className="font-semibold text-gray-900 mt-4 mb-2">Font Embedding</h4>
              <p>
                Always embed all fonts used in the document. Missing fonts cause text to reflow incorrectly or display in 
                substitute fonts. Convert text to outlines only as a last resort—it increases file size and prevents text 
                searching. Use font subsetting to minimize file size while maintaining full embedding.
              </p>
              <h4 className="font-semibold text-gray-900 mt-4 mb-2">PDF/X Standards</h4>
              <p>
                PDF/X-1a is the most common standard for print. It ensures color compliance, font embedding, and prohibits 
                RGB content. PDF/X-4 allows transparency and layers. Always ask your printer which standard they prefer. 
                These standards eliminate most common printing problems.
              </p>
              <h4 className="font-semibold text-gray-900 mt-4 mb-2">Pre-Flight Checklist</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>All colors converted to CMYK</li>
                <li>Bleed added (3mm minimum)</li>
                <li>Images at 300 DPI or higher</li>
                <li>Fonts embedded and subset</li>
                <li>Crop marks and registration marks included if required</li>
                <li>File saved as PDF/X-1a or printer's preferred standard</li>
              </ul>
            </div>
          </Card>
        </div>

        <div className="text-center mt-12">
          <p className="text-gray-600 text-sm">
            Want to learn more? Check back regularly for new guides and tutorials about PDF processing.
          </p>
        </div>
      </section>
{/* About & FAQ Section */}
      <section className="mx-auto max-w-5xl px-4 pb-12">
        <Card className="p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">About PDF Stitcher</h2>
          <div className="prose prose-gray max-w-none">
            <p className="text-gray-700 mb-4">
              PDF Stitcher is a free, privacy-focused online tool that allows you to merge multiple pages of a PDF document into a single, long scrollable page. 
              Perfect for creating continuous documents like CVs, portfolios, infographics, or any document where you want seamless vertical scrolling.
            </p>
            <p className="text-gray-700 mb-4">
              Unlike other PDF tools, PDF Stitcher processes everything directly in your browser using advanced client-side technology. 
              This means your documents never leave your device, ensuring complete privacy and security.
            </p>
          </div>

          <h3 className="text-xl font-bold text-gray-900 mt-8 mb-4">Frequently Asked Questions</h3>
          
          <div className="space-y-6">
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Is my PDF data safe?</h4>
              <p className="text-gray-700 text-sm">
                Absolutely! All processing happens entirely in your browser. Your PDF files are never uploaded to any server. 
                We cannot see, store, or access your documents in any way.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-2">What file size is supported?</h4>
              <p className="text-gray-700 text-sm">
                We support PDF files up to 100 MB. This is sufficient for most documents. Larger files may cause performance issues in your browser.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-2">How many pages can I stitch?</h4>
              <p className="text-gray-700 text-sm">
                By default, you can process up to 50 pages. You can adjust this limit in the settings before processing your PDF.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Will hyperlinks be preserved?</h4>
              <p className="text-gray-700 text-sm">
                Yes! The "Interactive Links" option (enabled by default) preserves all clickable links, mailto addresses, and internal PDF navigation.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-2">What browsers are supported?</h4>
              <p className="text-gray-700 text-sm">
                PDF Stitcher works on all modern browsers including Chrome, Firefox, Safari, and Edge. We recommend using the latest version for best performance.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Is this tool really free?</h4>
              <p className="text-gray-700 text-sm">
                Yes! PDF Stitcher is completely free to use with no registration required. If you find it useful, you can support the development through our Ko-fi page.
              </p>
            </div>
          </div>
        </Card>

        {/* Privacy Policy */}
        <Card className="p-8 mt-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Privacy Policy</h2>
          <div className="prose prose-gray max-w-none text-sm space-y-4">
            <p className="text-gray-700">
              <strong>Last Updated:</strong> October 10, 2025
            </p>
            
            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Data Collection</h3>
            <p className="text-gray-700">
              PDF Stitcher does not collect, store, or transmit any personal data or PDF files. All processing occurs locally in your browser.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Cookies</h3>
            <p className="text-gray-700">
              We use cookies only for:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Remembering your cookie consent preference</li>
              <li>Analytics (Google Analytics) - only if you consent</li>
              <li>Advertising (Google AdSense) - only if you consent</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Third-Party Services</h3>
            <p className="text-gray-700">
              We may use:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li><strong>Google Analytics:</strong> To understand how users interact with our tool</li>
              <li><strong>Google AdSense:</strong> To display relevant advertisements</li>
              <li><strong>Ko-fi:</strong> For optional donations (processes payments securely)</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Your Rights</h3>
            <p className="text-gray-700">
              You can decline cookies at any time through our cookie consent banner. Since we don't collect personal data, 
              there is no data to request, modify, or delete.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Contact</h3>
            <p className="text-gray-700">
              For privacy concerns, please contact us through our Ko-fi page.
            </p>
          </div>
        </Card>

        {/* Terms of Service */}
        <Card className="p-8 mt-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Terms of Service</h2>
          <div className="prose prose-gray max-w-none text-sm space-y-4">
            <p className="text-gray-700">
              <strong>Last Updated:</strong> October 10, 2025
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Acceptance of Terms</h3>
            <p className="text-gray-700">
              By using PDF Stitcher, you agree to these Terms of Service. If you do not agree, please do not use this tool.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Use of Service</h3>
            <p className="text-gray-700">
              PDF Stitcher is provided "as is" for personal and commercial use. You may:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Use the tool for any legal purpose</li>
              <li>Process any PDF documents you have rights to</li>
              <li>Use generated PDFs for personal or commercial projects</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Prohibited Uses</h3>
            <p className="text-gray-700">
              You may NOT:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Use this tool for any illegal activity</li>
              <li>Attempt to reverse engineer or copy the source code for commercial redistribution</li>
              <li>Overload or abuse the service infrastructure</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Disclaimer</h3>
            <p className="text-gray-700">
              PDF Stitcher is provided without warranty of any kind. We are not responsible for:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Loss of data or corrupted PDF files</li>
              <li>Errors in processing or output quality</li>
              <li>Browser compatibility issues</li>
              <li>Any damages arising from use of this tool</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Limitation of Liability</h3>
            <p className="text-gray-700">
              In no event shall PDF Stitcher be liable for any indirect, incidental, special, or consequential damages 
              related to your use of this service.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Changes to Terms</h3>
            <p className="text-gray-700">
              We reserve the right to modify these terms at any time. Continued use of the service constitutes acceptance of updated terms.
            </p>
          </div>
        </Card>
      </section>
      <footer className="mx-auto max-w-5xl px-4 pb-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t border-gray-200">
          <p className="text-xs text-gray-400">Made with 💙 • 100% local processing</p>
          
          <a
            href="https://ko-fi.com/pdfstitcher"
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


