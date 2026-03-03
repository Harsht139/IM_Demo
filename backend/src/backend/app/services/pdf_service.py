from fpdf import FPDF
import io
import json
import re
import urllib.parse
import markdown
from typing import Dict, List

class IMPDF(FPDF):
    def __init__(self, project_name="Deal Synthesis"):
        super().__init__()
        self.project_name = project_name
        # Define brand colors
        self.brand_blue = (37, 99, 235)  # Blue 600
        self.brand_slate_dark = (15, 23, 42)  # Slate 900
        self.brand_slate_med = (71, 85, 105)  # Slate 600
        self.brand_slate_light = (248, 250, 252)  # Slate 50

    def header(self):
        if self.page_no() > 1:
            # Simple, clean header with hairline divider
            self.set_y(10)
            self.set_font("Helvetica", "B", 8)
            self.set_text_color(148, 163, 184) # Slate 400
            self.cell(0, 5, "CONFIDENTIAL INFORMATION MEMORANDUM", align="L")
            self.cell(0, 5, self.project_name.upper(), align="R")
            self.set_draw_color(226, 232, 240)
            self.line(10, 16, 200, 16)
            self.ln(12)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(148, 163, 184)
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", align="R")

class PdfService:
    def generate_im_pdf(self, im_data: Dict, base_url: str = "http://localhost:5173") -> io.BytesIO:
        project_name = im_data.get('project_name', 'Deal Synthesis')
        pdf = IMPDF(project_name=project_name)
        pdf.alias_nb_pages()
        
        bu_id = im_data.get('bu_id')
        deal_id = im_data.get('deal_id')
        sections = im_data.get('sections', [])
        sources = im_data.get('sources', [])
        source_map = {str(s.get('number')): s for s in sources}
        # base_url is now passed from the router for dynamic resolution

        # 1. Cover Page
        self._add_cover_page(pdf, im_data)

        # 2. Table of Contents
        self._add_toc_placeholder(pdf, sections)

        # 3. Transaction at a Glance (New High-Impact Table)
        summary_metrics = im_data.get('summary_metrics', {})
        if summary_metrics:
            self._add_chapter_divider(pdf, "00", "TRANSACTION AT A GLANCE")
            self._add_summary_table(pdf, summary_metrics)

        # 4. Content Sections
        current_chapter = None
        for i, section in enumerate(sections):
            title = section.get('title', 'Untitled Section')
            
            # Extract chapter number (e.g., "1" from "1.1")
            chapter_match = re.match(r'^(\d+)', title)
            chapter_num = chapter_match.group(1) if chapter_match else str(i+1)
            
            # Only add a page if it is a new major chapter (or first page)
            if chapter_num != current_chapter:
                pdf.add_page()
                current_chapter = chapter_num
                is_new_chapter = True
            else:
                pdf.ln(5) # Small gap between sections on the same page
                is_new_chapter = False
            
            # Section Header
            # Use larger font for major chapter starts, slightly smaller for sub-sections
            header_size = 18 if is_new_chapter else 14
            pdf.set_font("Helvetica", "B", header_size)
            pdf.set_text_color(15, 23, 42)
            
            # Clean title
            display_title = re.sub(r'^Section \d+:\s*', '', title).upper()
            
            if is_new_chapter:
                pdf.cell(15, 12, f"0{chapter_num}", align="L")
                pdf.set_text_color(37, 99, 235)
                pdf.cell(0, 12, display_title, ln=True)
                
                pdf.set_draw_color(37, 99, 235)
                pdf.set_line_width(0.5)
                pdf.line(10, pdf.get_y(), 60, pdf.get_y())
                pdf.ln(10)
            else:
                pdf.set_text_color(37, 99, 235)
                pdf.cell(0, 10, display_title, ln=True)
                pdf.ln(2)
            
            # Content Rendering
            pdf.set_text_color(51, 65, 85) # Slate 700
            pdf.set_font("Helvetica", "", 11)
            
            raw_content = section.get('content', '')
            safe_content = self._sanitize_text(raw_content)
            
            # Process Citations
            safe_content = self._inject_citations(safe_content, source_map, bu_id, deal_id, base_url)
            
            try:
                html_content = markdown.markdown(safe_content)
                pdf.write_html(html_content)
            except Exception:
                safe_content = safe_content.encode('ascii', 'ignore').decode('ascii')
                html_content = markdown.markdown(safe_content)
                pdf.write_html(html_content)
            
            pdf.ln(10)

        pdf_bytes = pdf.output()
        return io.BytesIO(pdf_bytes)

    def _add_cover_page(self, pdf, im_data):
        pdf.add_page()
        
        # Split Background Aesthetic
        # Left Panel (Dark)
        pdf.set_fill_color(15, 23, 42)
        pdf.rect(0, 0, 85, 297, 'F')
        
        # Adani Logo on Left Path
        logo_path = "/home/tappu/workspace/demo/frontend/public/adani-logo.png"
        try:
            pdf.image(logo_path, x=15, y=20, w=55)
        except Exception:
            pass # Fallback if logo not found
            
        # Right Panel (White)
        pdf.set_y(100)
        pdf.set_x(95)
        pdf.set_text_color(15, 23, 42)
        pdf.set_font("Helvetica", "B", 36)
        pdf.multi_cell(0, 18, "INFORMATION\nMEMORANDUM", align="L")
        
        pdf.ln(10)
        pdf.set_x(95)
        pdf.set_font("Helvetica", "B", 18)
        pdf.set_text_color(37, 99, 235)
        pdf.multi_cell(0, 10, im_data.get('project_name', 'PROJECT FINANCE DEAL').upper(), align="L")
        
        # Space at bottom
        pdf.set_y(240)

    def _add_toc_placeholder(self, pdf, sections):
        pdf.add_page()
        
        pdf.set_y(30)
        pdf.set_font("Helvetica", "B", 24)
        pdf.set_text_color(15, 23, 42)
        pdf.cell(0, 20, "Table of Contents", ln=True)
        pdf.ln(10)
        
        # TOC List with Dot Leaders
        for i, section in enumerate(sections):
            pdf.set_font("Helvetica", "B", 11)
            pdf.set_text_color(71, 85, 105) # Slate 600
            num_str = f"0{i+1}"
            pdf.cell(10, 10, num_str)
            
            pdf.set_font("Helvetica", "", 11)
            pdf.set_text_color(15, 23, 42)
            title = section.get('title', 'Untitled Section')
            display_title = re.sub(r'^Section \d+:\s*', '', title).upper()
            
            pdf.cell(160, 10, display_title)
            
            # Simple page numbering
            pdf.set_text_color(148, 163, 184)
            pdf.cell(0, 10, f"{i+4}", ln=True, align="R")
            
            pdf.set_draw_color(241, 245, 249) # Slate 100
            pdf.line(20, pdf.get_y(), 200, pdf.get_y())
            pdf.ln(2)
            
        return pdf.page_no()

    def _add_chapter_divider(self, pdf, num, title):
        pdf.add_page()
        # Full Dark Background
        pdf.set_fill_color(15, 23, 42)
        pdf.rect(0, 0, 210, 297, 'F')
        
        # Vertical Blue Line
        pdf.set_fill_color(37, 99, 235)
        pdf.rect(100, 60, 1, 177, 'F')
        
        pdf.set_y(120)
        pdf.set_text_color(255, 255, 255)
        pdf.set_font("Helvetica", "B", 48)
        pdf.cell(0, 20, num, align="C", ln=True)
        
        pdf.ln(10)
        pdf.set_font("Helvetica", "B", 18)
        pdf.set_text_color(37, 99, 235)
        pdf.multi_cell(0, 10, title.upper(), align="C")

    def _sanitize_text(self, text: str) -> str:
        return text.replace('₹', 'INR ').replace('’', "'").replace('“', '"').replace('”', '"').replace('–', '-').replace('—', '--')

    def _inject_citations(self, content, source_map, bu_id, deal_id, base_url):
        def _convert(match):
            inner = match.group(1).strip()
            # Restore split logic for descriptive citations: [1 | Source.pdf]
            parts = re.split(r'[|:]', inner, 1)
            nums_str = parts[0].strip()
            extra_info = f" | {parts[1].strip()}" if len(parts) > 1 else ""
            
            nums = [n.strip() for n in nums_str.split(',')]
            links = []
            for num in nums:
                if num in source_map and bu_id: # Removed deal_id check
                    src = source_map[num]
                    filename = src.get('source_file')
                    page = src.get('page_number', 1)
                    coords = src.get('coordinates')
                    if filename:
                        # Restore Excel cell highlighting (&context=) logic
                        if filename.lower().endswith(('.xlsx', '.xls', '.csv')):
                            context = src.get('context')
                            if context:
                                # Context format: "SheetName!A1"
                                context_param = f"&context={urllib.parse.quote(context)}"
                                url = f"{base_url}/{bu_id}/view/{filename}#page={page}{context_param}"
                            else:
                                url = f"{base_url}/{bu_id}/view/{filename}#page={page}"
                        else:
                            # PDF files use coordinates (&coords=)
                            coords_json = ""
                            if isinstance(coords, list) and len(coords) == 4:
                                x1, y1, x2, y2 = coords
                                coords_json = f"&coords={urllib.parse.quote(json.dumps({'x': x1, 'y': y1, 'w': x2 - x1, 'h': y2 - y1}))}"
                            url = f"{base_url}/{bu_id}/view/{filename}#page={page}{coords_json}"
                        
                        # Use raw HTML with explicit styling for better FPDF recognition
                        links.append(f'<a href="{url}"><font color="#1d4ed8"><u>{num}</u></font></a>')
                    else: links.append(num)
                else: links.append(num)
            
            # Return wrapped in brackets: [1, 2 | Source Info]
            # Making the descriptive part clickable as well
            if extra_info:
                # Use the first citation for the descriptive part's link
                first_url = ""
                if links and "href=" in str(links[0]): # Check if it's already an HTML link
                    match = re.search(r'href="(.*?)"', str(links[0]))
                    if match: first_url = match.group(1)
                
                if first_url:
                    extra_info = f' | <a href="{first_url}"><font color="#1d4ed8"><u>{parts[1].strip()}</u></font></a>'
                else:
                    extra_info = f" | {parts[1].strip()}"

            # Style the links to be clearly blue and underlined in Markdown/FPDF
            # markdown.markdown handles [text](url) -> <a href="url">text</a>
            # Use single set of brackets for the list: [1, 2 | Source]
            return f"[{', '.join(links)}{extra_info}]"
        
        # Robust regex for bracketed citations starting with a number
        # Matches [1] or [1, 2 | descriptive info] inclusive of all characters inside
        # Ensure we only match if it's not already a markdown link (already handled by _convert if needed, 
        # but the top level sub should be careful)
        return re.sub(r'\[(\d[^\]]*?)\]', _convert, content)

    def _add_summary_table(self, pdf, metrics):
        pdf.ln(10)
        
        # Table Styling
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_fill_color(37, 99, 235) # Brand Blue
        pdf.set_text_color(255, 255, 255)
        
        # Header Row
        pdf.cell(80, 12, " KEY METRIC", border=0, fill=True)
        pdf.cell(110, 12, " DETAILS", border=0, fill=True, ln=True)
        
        # Data Rows with Zebra Striping
        pdf.set_text_color(15, 23, 42)
        pdf.set_draw_color(241, 245, 249) # Slate 100 lines
        
        for i, (metric, value) in enumerate(metrics.items()):
            fill = (i % 2 == 0)
            if fill:
                pdf.set_fill_color(248, 250, 252) # Slate 50
            else:
                pdf.set_fill_color(255, 255, 255)
                
            pdf.set_font("Helvetica", "B", 9)
            pdf.cell(80, 10, f" {metric}", border="B", fill=True)
            
            pdf.set_font("Helvetica", "", 10)
            # Using multi_cell for wrapping but fpdf multi_cell doesn't support fill easily with border
            # We'll use a hack of getting Y, drawing rect, then multi_cell
            x, y = pdf.get_x(), pdf.get_y()
            pdf.multi_cell(110, 10, f" {str(value)}", border="B", fill=True)
            
        pdf.ln(15)

pdf_service = PdfService()
