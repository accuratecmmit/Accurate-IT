import * as XLSX from 'xlsx';

export interface ParsedWorkbookData {
  fileName: string;
  sheetName: string;
  rowCount: number;
  columns: string[];
  rows: Record<string, any>[];
}

/**
 * Parses an uploaded Excel File object into structured JSON records.
 */
export async function parseExcelFile(file: File): Promise<ParsedWorkbookData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        if (!buffer) {
          throw new Error('Could not read file buffer.');
        }

        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          throw new Error('The workbook contains no sheets.');
        }

        const worksheet = workbook.Sheets[firstSheetName];
        const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, {
          defval: '',
          raw: false,
        });

        const columns: string[] = [];
        if (rawRows.length > 0) {
          Object.keys(rawRows[0]).forEach((key) => {
            if (!key.startsWith('__EMPTY')) {
              columns.push(key.trim());
            }
          });
        }

        resolve({
          fileName: file.name,
          sheetName: firstSheetName,
          rowCount: rawRows.length,
          columns,
          rows: rawRows,
        });
      } catch (err: any) {
        reject(new Error(`Failed to parse Excel workbook: ${err.message}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file from disk.'));
    };

    reader.readAsArrayBuffer(file);
  });
}
