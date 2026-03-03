from backend.app.services.pdf_service import PdfService
import json

def test_inject_citations():
    service = PdfService()
    source_map = {
        "1": {"source_file": "doc1.pdf", "page_number": 1, "coordinates": [10, 20, 30, 40]},
        "2": {"source_file": "data.xlsx", "context": "Sheet1!A1"},
    }
    bu_id = "bu123"
    deal_id = None # Testing without deal_id
    base_url = "http://localhost:5173"

    # Case 1: Simple citation
    content1 = "According to [1], the revenue is up."
    result1 = service._inject_citations(content1, source_map, bu_id, deal_id, base_url)
    print(f"Result 1: {result1}")

    # Case 2: Multinumber citation
    content2 = "Data found in [1, 2]."
    result2 = service._inject_citations(content2, source_map, bu_id, deal_id, base_url)
    print(f"Result 2: {result2}")

    # Case 3: Descriptive citation
    content3 = "See [1 | Financial Report]."
    result3 = service._inject_citations(content3, source_map, bu_id, deal_id, base_url)
    print(f"Result 3: {result3}")

if __name__ == "__main__":
    test_inject_citations()
