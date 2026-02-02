from typing import Literal


SensorType = Literal["LHT", "WS100"]


SENSORS: list[dict] = [
    # WS100 Sensors
    {
        "id": "Saaritie",
        "name": "Saaritie",
        "type": "WS100",
        "lat": 62.136788,
        "lon": 25.762473,
    },
    {
        "id": "Tuulimyllyntie",
        "name": "Tuulimyllyntie",
        "type": "WS100",
        "lat": 62.221789,
        "lon": 25.695931,
    },
    {
        "id": "Tahtiniementie",
        "name": "Tähtiniementie",
        "type": "WS100",
        "lat": 62.011127,
        "lon": 25.552755,
    },
    {
        "id": "Kaakkovuorentie",
        "name": "Kaakkovuorentie",
        "type": "WS100",
        "lat": 62.294362,
        "lon": 25.800196,
    },
    {
        "id": "Kotaniementie",
        "name": "Kotaniementie",
        "type": "WS100",
        "lat": 62.265705,
        "lon": 25.909542,
    },
    # LHT Sensors (Placeholders for now, can be updated if coordinates are known)
    {
        "id": "Kaunisharjuntie",
        "name": "Kaunisharjuntie",
        "type": "LHT",
        "lat": 62.2400, # Demo coord
        "lon": 25.7500, # Demo coord
    },
]


def list_sensors() -> list[dict]:
    """
    Return a list of all known sensors.
    For now this is a static in-memory list.
    Later we can replace this with real sensor metadata
    loaded from config or CSV.
    """
    return SENSORS