import pandas as pd
import numpy as np
from backend.core.io_lht import clean_lht_sensor, prepare_and_features, summarize, prepare_all_sensors

# Synthetic raw data for two sensors
rng = pd.date_range('2024-07-01', periods=200, freq='15min')
raw1 = pd.DataFrame({
    'Timestamp': rng,
    'TempC_SHT': 15 + 5*np.sin(np.linspace(0, 6*np.pi, len(rng))) + np.random.normal(0,0.5,len(rng)),
    'Hum_SHT': 70 + 10*np.sin(np.linspace(0, 4*np.pi, len(rng))) + np.random.normal(0,2,len(rng)),
})
raw2 = pd.DataFrame({
    'Timestamp': rng,
    'TempC_SHT': 17 + 4*np.sin(np.linspace(0, 5*np.pi, len(rng))) + np.random.normal(0,0.6,len(rng)),
    'Hum_SHT': 65 + 12*np.sin(np.linspace(0, 3*np.pi, len(rng))) + np.random.normal(0,3,len(rng)),
})

# Corrupt values
raw1.loc[10,'TempC_SHT'] = 400
raw1.loc[20,'Hum_SHT'] = -5
raw2.loc[30,'Hum_SHT'] = 500

proc1 = prepare_and_features(raw1)
proc2 = prepare_and_features(raw2)
summary1 = summarize(proc1['features'])
summary2 = summarize(proc2['features'])
print('Sensor A summary:')
for k,v in summary1.items():
    print(f'  {k}: {v}')
print('\nSensor B summary:')
for k,v in summary2.items():
    print(f'  {k}: {v}')

processed, table = prepare_all_sensors({'A': raw1, 'B': raw2})
print('\nCombined summary table:')
print(table.to_string())
