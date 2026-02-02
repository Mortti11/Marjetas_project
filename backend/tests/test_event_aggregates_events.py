from backend.services.pair_service import pair_event_aggregates

def test_event_aggregates_includes_events_block():
    d = pair_event_aggregates("2023-07-28", pre_h=6, post_h=120)
    events = d.get("events", [])
    # We don’t assert exact counts, just that the structure is present
    assert isinstance(events, list)
    if events:
        row = events[0]
        # At least these keys should be present
        for key in [
            "event_id",
            "start_ts",
            "end_ts",
            "start_date",
            # "duration_h", # duration_h might not be in detect_events output yet, let's check
            # "mm_total",   # mm_total might not be in detect_events output yet
            # "ptype_main", # ptype_main might not be in detect_events output yet
            "drying_hours_from_start",
            "drying_hours_from_end",
            "drying_hours",
        ]:
            assert key in row, f"Key {key} missing from event row"

def test_event_aggregates_includes_event_intensity():
    from backend.services.pair_service import pair_event_aggregates

    d = pair_event_aggregates("2023-07-28", pre_h=6, post_h=120)
    events = d.get("events", [])
    assert isinstance(events, list)
    if events:
        row = events[0]
        assert "event_intensity" in row
        # Intensity must be one of the expected buckets
        assert row["event_intensity"] in ["light", "moderate", "heavy", "extreme", "unknown"]
        
        # Also verify other enriched fields are present now
        assert "duration_h" in row
        assert "mm_total" in row
        assert "ptype_main" in row
