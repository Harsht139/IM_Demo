import io
import tempfile
import pandas as pd
import os
import asyncio
import logging
from pypdf import PdfReader
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import DocumentConverter, PdfFormatOption
from app.logging import get_logger

logger = get_logger(__name__)

# Add a filter to silence RapidOCR
class SilenceOCRFilter(logging.Filter):
    def filter(self, record):
        return "RapidOCR" not in record.name and "rapidocr" not in record.name.lower()

# Apply filter to the root logger to catch all RapidOCR logs
logging.getLogger().addFilter(SilenceOCRFilter())
for name in logging.root.manager.loggerDict:
    if "rapid" in name.lower() or "ocr" in name.lower():
        logging.getLogger(name).setLevel(logging.ERROR)

_converters = {}

def get_converter(do_ocr=True):
    global _converters
    if do_ocr not in _converters:
        # Configure pipeline options for speed and selective OCR
        pipeline_options = PdfPipelineOptions()
        pipeline_options.do_ocr = do_ocr
        pipeline_options.ocr_batch_size = 8  # Parallelize OCR pages
        
        # We also slightly reduce image scale from 1.0 to 0.8 to speed up OCR if it runs
        # without losing much citation accuracy.
        pipeline_options.images_scale = 0.8
        
        _converters[do_ocr] = DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
            }
        )
    return _converters[do_ocr]


async def extract_file_content(filename: str, content: bytes):
    file_type = filename.split(".")[-1].lower()

    if file_type in ["pdf", "docx"]:
        return await extract_with_docling(filename, content)

    elif file_type in ["csv", "xlsx"]:
        # Run CPU-bound task in thread
        return await asyncio.to_thread(extract_excel, filename, content)

    elif file_type in ["txt"]:
        return extract_text(filename, content)

    else:
        return {
            "filename": filename,
            "source_id": filename, # Placeholder for unique ID
            "source_title": filename,
            "source_url": f"local://{filename}",
            "type": "unsupported",
            "message": "Unsupported file format"
        }


async def extract_with_docling(filename: str, content: bytes):
    try:
        suffix = f".{filename.split('.')[-1]}"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        # Selective OCR check: Only run OCR if no programmatic text is found
        do_ocr = True
        if filename.lower().endswith(".pdf"):
            try:
                reader = PdfReader(io.BytesIO(content))
                has_text = False
                # Check mid-sample of pages for speed and accuracy
                pages_to_check = reader.pages[:10]
                for page in pages_to_check:
                    text = page.extract_text()
                    if text and len(text.strip()) > 50:
                        has_text = True
                        break
                
                if has_text:
                    logger.info(f"Native text detected in {filename}, disabling OCR for speed boost.")
                    do_ocr = False
                else:
                    logger.info(f"No native text detected in {filename}, full OCR enabled.")
            except Exception as e:
                logger.warning(f"Selective OCR check failed for {filename}: {e}. Defaulting to OCR=True")

        # Conversion is CPU intensive, run in executor
        logger.info(f"Starting Docling extraction for {filename} (OCR={do_ocr})")
        loop = asyncio.get_event_loop()
        converter = get_converter(do_ocr=do_ocr)
        result = await loop.run_in_executor(None, converter.convert, tmp_path)
        logger.info(f"Docling conversion completed for {filename}")

        doc = result.document
        markdown_text = doc.export_to_markdown()
        docling_json = doc.export_to_dict()

        return {
            "filename": filename,
            "source_id": filename,
            "source_title": filename,
            "source_url": f"local://{filename}",
            "type": "docling",
            "structured_text": markdown_text,
            "docling_json": docling_json
        }

    except Exception as e:
        logger.error(f"Docling extraction failed for {filename}: {e}")
        return {
            "filename": filename,
            "type": "docling_error",
            "error": str(e)
        }
    finally:
        # Guaranteed cleanup of temp file
        if 'tmp_path' in locals() and os.path.exists(tmp_path):
            os.remove(tmp_path)


def extract_excel(filename: str, content: bytes):
    try:
        # Load sheets or CSV
        if filename.lower().endswith(".csv"):
            df_init = pd.read_csv(io.BytesIO(content))
            sheets_map = {"Sheet1": df_init}
            sheet_names = ["Sheet1"]
        else:
            excel_file = pd.ExcelFile(io.BytesIO(content))
            sheet_names = excel_file.sheet_names
            sheets_map = {name: pd.read_excel(excel_file, sheet_name=name) for name in sheet_names}
        
        all_sheets_data = []
        structured_lines = []
        
        # Keep track for top-level backward compatibility
        first_sheet_df = None
        
        for sheet_name in sheet_names:
            df = sheets_map[sheet_name]
            if first_sheet_df is None:
                first_sheet_df = df
            
            # Replace NaN with None
            df = df.where(pd.notnull(df), None)
            
            # Add to raw data list
            all_sheets_data.append({
                "sheet_name": sheet_name,
                "columns": df.columns.tolist(),
                "data": df.to_dict(orient="records")
            })
            
            # Generate coordinate-aware structured text for LLM/RAG
            structured_lines.append(f"--- SHEET: {sheet_name} ---")
            
            # Add header with coordinates
            headers = df.columns.tolist()
            for col_idx, header in enumerate(headers):
                cell_addr = f"{sheet_name}!{chr(65 + (col_idx % 26))}{1}" # Basic A1 notation
                structured_lines.append(f"[{cell_addr}] Column: {header}")
            
            # Add rows with coordinates
            for row_idx, row in df.iterrows():
                for col_idx, (col_name, value) in enumerate(row.items()):
                    if value is not None:
                        # Convert to A1 notation (simple version, handles A-Z)
                        col_letter = chr(65 + (col_idx % 26))
                        cell_addr = f"{sheet_name}!{col_letter}{row_idx + 2}" # +2 because row 1 is header
                        structured_lines.append(f"[{cell_addr}] {col_name}: {value}")

        # Top-level fields for backward compatibility/tests
        columns = first_sheet_df.columns.tolist() if first_sheet_df is not None else []
        preview_rows = first_sheet_df.head(10).to_dict(orient="records") if first_sheet_df is not None else []

        return {
            "filename": filename,
            "source_id": filename,
            "source_title": filename,
            "source_url": f"local://{filename}",
            "type": "excel",
            "sheets": all_sheets_data,
            "structured_text": "\n".join(structured_lines),
            "columns": columns,
            "preview_rows": preview_rows
        }

    except Exception as e:
        logger.error(f"Excel extraction failed for {filename}: {e}")
        return {
            "filename": filename,
            "type": "excel_error",
            "error": str(e)
        }


def extract_text(filename: str, content: bytes):
    text = content.decode("utf-8")

    return {
        "filename": filename,
        "source_id": filename,
        "source_title": filename,
        "source_url": f"local://{filename}",
        "type": "text",
        "raw_text": text[:8000]
    }
