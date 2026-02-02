import pytest
from backend.services.pair_service import pair_event_aggregates

def test_drying_medians_2023_07_28():
    """
    Verify that for the event on 2023-07-28:
    - median_drying_h_from_end is approx 47.0
    - median_drying_h_from_start is approx 85.0
    - median_drying_h matches from_end
    """
    result = pair_event_aggregates("2023-07-28", pre_h=6, post_h=120)
    fractions = result.get("fractions", {})
    
    assert fractions is not None, "Fractions payload should not be None"
    
    median_end = fractions.get("median_drying_h_from_end")
    median_start = fractions.get("median_drying_h_from_start")
    median_main = fractions.get("median_drying_h")
    
    print(f"DEBUG: median_end={median_end}, median_start={median_start}, median_main={median_main}")
    
    assert median_end is not None
    assert median_start is not None
    
    # Check values with tolerance
    assert abs(median_end - 47.0) <= 1.0, f"Expected ~47.0 from end, got {median_end}"
    assert abs(median_start - 85.0) <= 1.0, f"Expected ~85.0 from start, got {median_start}"
    
    # Check consistency
    assert median_main == median_end, "Main median_drying_h should match from_end"

if __name__ == "__main__":
    test_drying_medians_2023_07_28()
    print("Test passed!")
