import { useEffect, useState, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { themeQuartz, colorSchemeDark } from 'ag-grid-community';
import * as XLSX from 'xlsx';

interface ExcelViewerProps {
    url: string;
    highlightCell?: string; // Format: "SheetName!A1"
}

export function ExcelViewer({ url, highlightCell }: ExcelViewerProps) {
    const [rowData, setRowData] = useState<any[]>([]);
    const [columnDefs, setColumnDefs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sheets, setSheets] = useState<string[]>([]);
    const [activeSheet, setActiveSheet] = useState<string>('');
    const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
    const [gridApi, setGridApi] = useState<any>(null);

    // Helpers to parse Excel cell addresses
    const parseCell = (cell: string) => {
        if (!cell) return null;
        const match = cell.match(/([A-Z]+)(\d+)/);
        if (!match) return null;
        const colStr = match[1];
        const rowNum = parseInt(match[2], 10);

        // Convert column letter to index (A=0, B=1, etc.)
        let colIdx = 0;
        for (let i = 0; i < colStr.length; i++) {
            colIdx = colIdx * 26 + (colStr.charCodeAt(i) - 64);
        }
        return { colIdx: colIdx - 1, rowNum };
    };

    const targetInfo = useMemo(() => {
        if (!highlightCell || !highlightCell.includes('!')) return null;
        const [sheet, cell] = highlightCell.split('!');
        const cellInfo = parseCell(cell);
        if (!cellInfo) return null;
        return { sheet, cell, ...cellInfo };
    }, [highlightCell]);

    useEffect(() => {
        const fetchAndParseExcel = async () => {
            try {
                setLoading(true);
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

                const arrayBuffer = await response.arrayBuffer();
                const wb = XLSX.read(arrayBuffer, { type: 'array' });

                setWorkbook(wb);
                setSheets(wb.SheetNames);

                // Switch to target sheet if specified
                if (targetInfo && wb.SheetNames.includes(targetInfo.sheet)) {
                    setActiveSheet(targetInfo.sheet);
                } else if (wb.SheetNames.length > 0) {
                    setActiveSheet(wb.SheetNames[0]);
                }
                setLoading(false);
            } catch (err: any) {
                console.error("Error loading Excel file:", err);
                setError(err.message || 'Failed to parse Excel document.');
                setLoading(false);
            }
        };

        fetchAndParseExcel();
    }, [url, targetInfo?.sheet]);

    useEffect(() => {
        if (!workbook || !activeSheet) return;

        try {
            const worksheet = workbook.Sheets[activeSheet];
            const data = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

            if (data && data.length > 0) {
                const maxCols = Math.max(...data.map(row => row.length));
                if (maxCols === 0) {
                    setColumnDefs([]);
                    setRowData([]);
                    return;
                }

                const firstRow = data[0] || [];
                const cols: any[] = [];

                for (let i = 0; i < maxCols; i++) {
                    const val = firstRow[i];
                    const fieldId = `col_${i}`;
                    const headerName = (val !== undefined && val !== null && String(val).trim() !== '')
                        ? String(val)
                        : `Column ${i + 1}`;

                    cols.push({
                        field: fieldId,
                        headerName: headerName,
                        sortable: true,
                        filter: true,
                        resizable: true,
                        flex: 1,
                        minWidth: 120,
                        cellClassRules: {
                            'bg-blue-500/20 border-2 border-blue-500/50 font-black text-blue-100': (params: any) => {
                                if (!targetInfo || activeSheet !== targetInfo.sheet) return false;
                                const colTarget = `col_${targetInfo.colIdx}`;
                                const rowTargetIdx = targetInfo.rowNum - 2; // Subtract header row
                                return params.colDef.field === colTarget && params.node.rowIndex === rowTargetIdx;
                            }
                        }
                    });
                }

                setColumnDefs(cols);

                const rows = data.slice(1).map((rowArray: any[]) => {
                    const rowObj: Record<string, any> = {};
                    cols.forEach((col, i) => {
                        rowObj[col.field] = rowArray[i] !== undefined ? rowArray[i] : null;
                    });
                    return rowObj;
                });

                setRowData(rows);
            } else {
                setColumnDefs([]);
                setRowData([]);
            }
        } catch (err: any) {
            console.error("Error parsing sheet data:", err);
            setError("Error displaying sheet data.");
        }
    }, [workbook, activeSheet, targetInfo]);

    // Auto-scroll to highlighted cell
    useEffect(() => {
        if (gridApi && targetInfo && activeSheet === targetInfo.sheet && rowData.length > 0) {
            const rowIdx = targetInfo.rowNum - 2;
            if (rowIdx >= 0 && rowIdx < rowData.length) {
                setTimeout(() => {
                    gridApi.ensureIndexVisible(rowIdx, 'middle');
                    gridApi.ensureColumnVisible(`col_${targetInfo.colIdx}`);
                }, 200);
            }
        }
    }, [gridApi, targetInfo, activeSheet, rowData]);

    const defaultColDef = useMemo(() => {
        return {
            sortable: true,
            filter: true,
            resizable: true,
        };
    }, []);

    const myTheme = useMemo(() => {
        return themeQuartz.withPart(colorSchemeDark);
    }, []);

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center p-8 bg-slate-900 text-slate-400">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm font-bold tracking-widest uppercase">Loading Spreadsheet Data...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-900 text-red-400 space-y-4">
                <p className="font-bold">Error reading file: {error}</p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-slate-800">
            {sheets.length > 1 && (
                <div className="flex overflow-x-auto bg-slate-900 border-b border-slate-700 custom-scrollbar">
                    {sheets.map(sheet => (
                        <button
                            key={sheet}
                            onClick={() => setActiveSheet(sheet)}
                            className={`px-6 py-3 text-sm font-bold transition-colors whitespace-nowrap ${activeSheet === sheet
                                ? 'bg-slate-800 text-blue-400 border-t-2 border-blue-500'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                                }`}
                        >
                            {sheet}
                        </button>
                    ))}
                </div>
            )}

            <div className="flex-1 w-full h-full" style={{ width: '100%', height: '100%' }}>
                {rowData.length > 0 ? (
                    <AgGridReact
                        rowData={rowData}
                        columnDefs={columnDefs}
                        defaultColDef={defaultColDef}
                        theme={myTheme}
                        animateRows={true}
                        headerHeight={48}
                        rowHeight={40}
                        suppressCellFocus={false}
                        onGridReady={(params) => setGridApi(params.api)}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-500 font-bold">
                        Empty Sheet
                    </div>
                )}
            </div>
        </div>
    );
}

