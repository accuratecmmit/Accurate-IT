import React, { useState, useRef } from 'react';
import { parseExcelFile, ParsedWorkbookData } from '../../services/excelReader';
import {
  validateExcelRows,
  importExcelRows,
  importInitialWorkbook,
  ValidationSummary,
  ImportSummaryResult,
} from '../../services/assetService';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Database,
  ArrowRight,
  RefreshCw,
  Info,
  Layers,
  Sparkles,
} from 'lucide-react';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedWorkbookData | null>(null);
  const [validationSummary, setValidationSummary] = useState<ValidationSummary | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [importResult, setImportResult] = useState<ImportSummaryResult | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(false);

  if (!isOpen) return null;

  const resetState = () => {
    setParsedData(null);
    setValidationSummary(null);
    setImportResult(null);
    setGeneralError(null);
    setOverwriteExisting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFile = async (file: File) => {
    setGeneralError(null);
    setImportResult(null);
    try {
      setIsValidating(true);
      const parsed = await parseExcelFile(file);
      setParsedData(parsed);

      if (parsed.rows.length === 0) {
        setGeneralError('The selected workbook sheet contains no data rows.');
        setIsValidating(false);
        return;
      }

      // Validate against server DB and schema rules
      const valRes = await validateExcelRows(parsed.rows);
      if (valRes.success && valRes.summary) {
        setValidationSummary(valRes.summary);
      } else {
        setGeneralError(valRes.error || 'Failed to validate Excel rows.');
      }
    } catch (err: any) {
      setGeneralError(err.message || 'Error processing Excel file.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleExecuteImport = async () => {
    if (!parsedData || parsedData.rows.length === 0) return;

    setIsImporting(true);
    setGeneralError(null);
    try {
      const res = await importExcelRows(parsedData.rows, overwriteExisting);
      if (res.success && res.summary) {
        setImportResult(res.summary);
        onImportSuccess();
      } else {
        setGeneralError(res.error || 'Import failed.');
      }
    } catch (err: any) {
      setGeneralError(err.message || 'Network error executing import.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleLoadStarterWorkbook = async () => {
    setIsInitialLoading(true);
    setGeneralError(null);
    try {
      const res = await importInitialWorkbook();
      if (res.success) {
        setImportResult({
          totalRows: res.totalAssets || 0,
          importedCount: res.importedCount || 0,
          updatedCount: res.updatedCount || 0,
          skippedCount: 0,
          errorCount: 0,
          errors: [],
        });
        onImportSuccess();
      } else {
        setGeneralError(res.error || 'Failed to load organization starter workbook.');
      }
    } catch (err: any) {
      setGeneralError(err.message || 'Error loading starter workbook.');
    } finally {
      setIsInitialLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-3xl w-full p-6 space-y-5 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Import IT Computer Asset Inventory
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upload initial or periodic Excel inventory workbooks with automated validation & duplicate checks.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              resetState();
              onClose();
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Global Error Banner */}
        {generalError && (
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-center gap-2 text-xs text-rose-800 dark:text-rose-200">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{generalError}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {/* If import completed */}
          {importResult ? (
            <div className="p-6 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-3xl text-center space-y-4 animate-fade-in">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  Inventory Import Completed Successfully
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Computer records have been processed and stored in the enterprise database.
                </p>
              </div>

              {/* Summary Stats Pill Grid */}
              <div className="grid grid-cols-4 gap-2 pt-2 max-w-lg mx-auto text-center">
                <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Processed</span>
                  <span className="text-base font-extrabold text-slate-800 dark:text-slate-200">{importResult.totalRows}</span>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase block">New Added</span>
                  <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-300">{importResult.importedCount}</span>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-800">
                  <span className="text-[10px] font-bold text-blue-600 uppercase block">Updated</span>
                  <span className="text-base font-extrabold text-blue-700 dark:text-blue-300">{importResult.updatedCount}</span>
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-800">
                  <span className="text-[10px] font-bold text-amber-600 uppercase block">Skipped</span>
                  <span className="text-base font-extrabold text-amber-700 dark:text-amber-300">{importResult.skippedCount}</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetState}
                  className="rounded-xl text-xs font-semibold"
                >
                  Import Another File
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    resetState();
                    onClose();
                  }}
                  className="rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700"
                >
                  View Inventory
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* One-Click Starter Dataset Import Callout */}
              <div className="p-4 bg-gradient-to-r from-indigo-50/70 via-blue-50/50 to-purple-50/60 dark:from-indigo-950/30 dark:via-blue-950/20 dark:to-purple-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl flex items-center justify-between gap-4 shadow-2xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                      Organization Canonical Inventory Workbook
                    </span>
                    <Badge variant="purple">Starting Dataset</Badge>
                  </div>
                  <p className="text-[11px] text-indigo-800/80 dark:text-indigo-300/70">
                    Pre-loaded corporate inventory workbook containing laptops, workstations, serial numbers, locations, and employee assignments.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleLoadStarterWorkbook}
                  disabled={isInitialLoading || isValidating}
                  icon={isInitialLoading ? RefreshCw : Sparkles}
                  className="shrink-0 rounded-xl text-xs bg-indigo-600 hover:bg-indigo-700 font-semibold shadow-xs"
                >
                  {isInitialLoading ? 'Loading Workbook...' : 'Load Starter Dataset'}
                </Button>
              </div>

              {/* Upload Dropzone */}
              {!validationSummary && (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-8 border-2 border-dashed rounded-3xl text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 scale-[0.99]'
                      : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-slate-800/20'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleFile(e.target.files[0]);
                      }
                    }}
                  />
                  <UploadCloud className="w-10 h-10 text-indigo-500 dark:text-indigo-400 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Drag and drop your Excel inventory workbook here
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Supports <span className="font-semibold text-slate-700 dark:text-slate-300">.xlsx</span>, <span className="font-semibold text-slate-700 dark:text-slate-300">.xls</span>, and <span className="font-semibold text-slate-700 dark:text-slate-300">.csv</span> files with automatic column detection
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-4 rounded-xl text-xs font-semibold"
                  >
                    Select File From Device
                  </Button>
                </div>
              )}

              {/* Loading Indicator during parsing / validation */}
              {isValidating && (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 space-y-2">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-500" />
                  <p className="text-xs font-medium">Validating rows, serial numbers, locations, and duplicate tags...</p>
                </div>
              )}

              {/* Validation Summary Stage */}
              {validationSummary && (
                <div className="space-y-4 animate-fade-in">
                  {/* File & Sheet Overview */}
                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {parsedData?.fileName}
                      </span>
                      <span className="text-slate-400">&bull; Sheet: {parsedData?.sheetName}</span>
                    </div>
                    <button
                      onClick={resetState}
                      className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold"
                    >
                      Choose Different File
                    </button>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-4 gap-2.5 text-center">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Rows</span>
                      <span className="text-base font-extrabold text-slate-800 dark:text-slate-200">
                        {validationSummary.totalRows}
                      </span>
                    </div>

                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl">
                      <span className="text-[10px] font-bold text-emerald-600 uppercase block">Valid Rows</span>
                      <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-300">
                        {validationSummary.validRows}
                      </span>
                    </div>

                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl">
                      <span className="text-[10px] font-bold text-amber-600 uppercase block">Duplicates</span>
                      <span className="text-base font-extrabold text-amber-700 dark:text-amber-300">
                        {validationSummary.duplicateCount}
                      </span>
                    </div>

                    <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-2xl">
                      <span className="text-[10px] font-bold text-rose-600 uppercase block">Errors</span>
                      <span className="text-base font-extrabold text-rose-700 dark:text-rose-300">
                        {validationSummary.errorCount}
                      </span>
                    </div>
                  </div>

                  {/* Duplicate Handling Policy */}
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      Duplicate Conflict Resolution (Protection Against Silent Overwrite)
                    </span>
                    <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-600 dark:text-slate-400">
                      <input
                        type="checkbox"
                        checked={overwriteExisting}
                        onChange={(e) => setOverwriteExisting(e.target.checked)}
                        className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>
                        <strong className="text-slate-800 dark:text-slate-200">Update existing assets</strong> matching identical Asset Tag or Serial Number, while recording transfer and modification ledger history. (Unchecked: Safe Mode skips duplicates).
                      </span>
                    </label>
                  </div>

                  {/* Errors / Warnings breakdown */}
                  {validationSummary.errorCount > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                          <XCircle className="w-4 h-4" />
                          Rows with Validation Issues ({validationSummary.errorCount})
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          These rows will be skipped during import to protect data integrity.
                        </span>
                      </div>

                      <div className="max-h-48 overflow-y-auto border border-rose-100 dark:border-rose-900/40 rounded-2xl bg-rose-50/40 dark:bg-rose-950/20 divide-y divide-rose-100 dark:divide-rose-900/30">
                        {validationSummary.results
                          .filter((r) => r.errors.length > 0)
                          .map((r, i) => (
                            <div key={i} className="p-2.5 text-xs flex items-start gap-2.5">
                              <span className="px-2 py-0.5 bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200 rounded font-mono font-bold text-[10px]">
                                Row {r.rowNumber}
                              </span>
                              <div className="flex-1 space-y-0.5">
                                {r.errors.map((err, j) => (
                                  <p key={j} className="text-rose-700 dark:text-rose-300">
                                    <strong className="font-semibold">{err.column}:</strong> {err.message}
                                  </p>
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>All rows passed strict validation with no schema errors detected. Ready to commit.</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!importResult && (
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetState();
                onClose();
              }}
              className="rounded-xl text-xs font-semibold"
            >
              Cancel
            </Button>

            {validationSummary && (
              <Button
                variant="primary"
                size="sm"
                disabled={isImporting || validationSummary.validRows === 0}
                onClick={handleExecuteImport}
                icon={isImporting ? RefreshCw : ArrowRight}
                className="rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 shadow-xs"
              >
                {isImporting
                  ? 'Importing...'
                  : `Execute Import (${validationSummary.validRows} Records)`}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
