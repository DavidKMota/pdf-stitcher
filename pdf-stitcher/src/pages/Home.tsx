import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { Upload, FileText, Download, Trash2, Settings, LinkIcon, Loader2, Eye, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";

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

async function validatePDF(file: File): Promise<{ valid: boolean; pages?: number; error?: string }> {
  try {
    const buffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(buffer);
    const header = String.fromCharCode(...uint8.slice(0, 5));
    if (!header.startsWith("%PDF-")) {
      return { valid: false, error: "Not a valid PDF file" };
    }
    return { valid: true };
  } catch (err) {
    return { valid: false, error: "Could not read file" };
  }
}

// ---- Main Component ----
export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string>("");
  const [pdfInfo, setPdfInfo] = useState<{ pages: number; size: number } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    spacing: 0,
    maxPages: 0,
    preserveLinks: true,
  });
  const [pdfLibLoaded, setPdfLibLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js";
    script.async = true;
    script.onload = () => setPdfLibLoaded(true);
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleFile = useCallback(async (selectedFile: File) => {
    setError("");
    setPdfInfo(null);
    setPreviewUrl("");

    if (selectedFile.size > 50 * 1024 * 1024) {
      setError("File too large (max 50MB)");
      return;
    }

    const validation = await validatePDF(selectedFile);
    if (!validation.valid) {
      setError(validation.error || "Invalid PDF");
      return;
    }

    setFile(selectedFile);
    setPdfInfo({ pages: 0, size: selectedFile.size });

    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile?.type === "application/pdf") {
        handleFile(droppedFile);
      } else {
        setError("Please drop a PDF file");
      }
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleStitch = useCallback(async () => {
    if (!file || !pdfLibLoaded) return;

    setLoading(true);
    setProgress(0);
    setError("");

    try {
      const PDFLib = (window as any).PDFLib;
      const arrayBuffer = await file.arrayBuffer();
      setProgress(20);

      const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPages();
      const numPages = settings.maxPages > 0 ? Math.min(settings.maxPages, pages.length) : pages.length;

      setProgress(40);

      let totalHeight = 0;
      let maxWidth = 0;

      for (let i = 0; i < numPages; i++) {
        const page = pages[i];
        const { width, height } = page.getSize();
        totalHeight += height + (i < numPages - 1 ? settings.spacing : 0);
        maxWidth = Math.max(maxWidth, width);
      }

      const newPdf = await PDFLib.PDFDocument.create();
      const longPage = newPdf.addPage([maxWidth, totalHeight]);

      let yOffset = totalHeight;

      for (let i = 0; i < numPages; i++) {
        const [embeddedPage] = await newPdf.embedPages([pages[i]]);
        const { width, height } = pages[i].getSize();

        yOffset -= height;
        longPage.drawPage(embeddedPage, {
          x: (maxWidth - width) / 2,
          y: yOffset,
          width,
          height,
        });

        yOffset -= settings.spacing;
        setProgress(40 + ((i + 1) / numPages) * 50);
      }

      setProgress(95);
      const pdfBytes = await newPdf.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });

      await downloadBlob(blob, `${file.name.replace(".pdf", "")}_stitched.pdf`);
      setProgress(100);

      setTimeout(() => {
        setLoading(false);
        setProgress(0);
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Stitching failed");
      setLoading(false);
      setProgress(0);
    }
  }, [file, settings, pdfLibLoaded]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <main className="mx-auto max-w-4xl px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">PDF Page Stitcher</h1>
          <p className="text-lg text-gray-600">Merge all pages into one long scrollable page</p>
          <Link to="/blog" className="inline-block mt-4 text-blue-600 hover:text-blue-700 underline">
            📚 Read our blog
          </Link>
        </div>

        <Card className="p-8 mb-6">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => !file && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
              isDragging
                ? "border-blue-500 bg-blue-50"
                : file
                ? "border-green-500 bg-green-50"
                : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              className="hidden"
            />

            {!file ? (
              <>
                <Upload className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-medium text-gray-700 mb-2">Drop PDF here or click to upload</p>
                <p className="text-sm text-gray-500">Maximum file size: 50MB</p>
              </>
            ) : (
              <>
                <FileText className="w-16 h-16 mx-auto mb-4 text-green-600" />
                <p className="text-lg font-semibold text-gray-900 mb-2">{file.name}</p>
                {pdfInfo && (
                  <p className="text-sm text-gray-600 mb-4">Size: {bytesToNice(pdfInfo.size)}</p>
                )}
                <Button onClick={() => setFile(null)} className="bg-red-50 text-red-600 hover:bg-red-100 border-red-200">
                  <Trash2 className="w-4 h-4" />
                  Remove
                </Button>
              </>
            )}
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {file && (
            <>
              <div className="mt-6 flex items-center justify-between">
                <Button
                  onClick={() => setShowSettings(!showSettings)}
                  className="bg-gray-50 text-gray-700 hover:bg-gray-100"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </Button>

                <Button
                  onClick={handleStitch}
                  disabled={loading || !pdfLibLoaded}
                  className="bg-black text-white hover:bg-gray-800 disabled:bg-gray-300"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Create Long PDF
                    </>
                  )}
                </Button>
              </div>

              {showSettings && (
                <div className="mt-6 p-6 bg-gray-50 rounded-xl space-y-4">
                  <div>
                    <Label htmlFor="spacing">Spacing between pages (pixels)</Label>
                    <input
                      id="spacing"
                      type="number"
                      min="0"
                      max="500"
                      value={settings.spacing}
                      onChange={(e) => setSettings({ ...settings, spacing: parseInt(e.target.value) || 0 })}
                      className="mt-2 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <Label htmlFor="maxPages">Maximum pages to stitch (0 = all)</Label>
                    <input
                      id="maxPages"
                      type="number"
                      min="0"
                      value={settings.maxPages}
                      onChange={(e) => setSettings({ ...settings, maxPages: parseInt(e.target.value) || 0 })}
                      className="mt-2 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      id="preserveLinks"
                      type="checkbox"
                      checked={settings.preserveLinks}
                      onChange={(e) => setSettings({ ...settings, preserveLinks: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <Label htmlFor="preserveLinks">Preserve internal links</Label>
                  </div>
                </div>
              )}

              {loading && progress > 0 && (
                <div className="mt-6">
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Processing...</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <ProgressBar progress={progress} />
                </div>
              )}
            </>
          )}
        </Card>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
    </div>
  );
}
