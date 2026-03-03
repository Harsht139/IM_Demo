import sys
import os

# Add src to path
sys.path.append(os.path.join(os.getcwd(), 'src'))

from app.services.im_service import IMResponse
from app.services.pdf_service import pdf_service

def test_identifier_sync():
    data = {
        "sections": [{"id": "1", "title": "Test", "content": "Citation [1]"}],
        "sources": [{"number": 1, "source_file": "doc.pdf", "page_number": 1, "coordinates": [10, 10, 20, 20]}],
        "business_unit_id": "bu_auto_sync_123", # Frontend style
        "dealId": "deal_auto_sync_456" # Frontend style
    }
    
    im_response = IMResponse(**data)
    print(f"Mapped bu_id: {im_response.bu_id}")
    print(f"Mapped deal_id: {im_response.deal_id}")
    
    assert im_response.bu_id == "bu_auto_sync_123"
    assert im_response.deal_id == "deal_auto_sync_456"

    # Verify citation injection in PDF service uses this bu_id
    pdf_data = im_response.model_dump()
    result = pdf_service._inject_citations(
        pdf_data['sections'][0]['content'],
        {str(s['number']): s for s in pdf_data['sources']},
        pdf_data['bu_id'],
        pdf_data['deal_id']
    )
    print(f"Injected Citation: {result}")
    assert "bu_auto_sync_123" in result

if __name__ == "__main__":
    test_identifier_sync()
    print("Verification successful!")
