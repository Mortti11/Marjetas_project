"""
Historical Data Analysis: Flag Frequencies and Drying Times
Analyzes pair_hourly data to understand flag behavior and thresholds.
"""

import pandas as pd
import numpy as np
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from core.pair_core import build_pair_hourly, add_environment_flags
from core.road_risk import add_slippery_risk
from core.event_core import detect_events, build_event_windows, compute_event_drying_times
from core.thresholds import DEFAULT_THRESHOLDS

def load_historical_data():
    """Load LHT, WS100, and wind data for 2021-2024."""
    print("Loading historical sensor data...")
    
    # Load LHT data (using Kaunisharjuntie as primary)
    lht_df = pd.read_csv('cleaned_datasets/LHT/Kaunisharjuntie.csv')
    lht_df['Timestamp'] = pd.to_datetime(lht_df['Timestamp'])
    
    # Load WS100 data (using Kotaniementie as primary)
    ws100_df = pd.read_csv('cleaned_datasets/wes100/df_Kotaniementie.csv')
    ws100_df['Timestamp'] = pd.to_datetime(ws100_df['Timestamp'])
    
    # Load wind data
    wind_df = pd.read_csv('cleaned_datasets/cleaned_wind_data.csv')
    wind_df['Timestamp'] = pd.to_datetime(wind_df['Timestamp'])
    
    print(f"LHT data: {len(lht_df)} rows, {lht_df['Timestamp'].min()} to {lht_df['Timestamp'].max()}")
    print(f"WS100 data: {len(ws100_df)} rows, {ws100_df['Timestamp'].min()} to {ws100_df['Timestamp'].max()}")
    print(f"Wind data: {len(wind_df)} rows, {wind_df['Timestamp'].min()} to {wind_df['Timestamp'].max()}")
    
    return lht_df, ws100_df, wind_df

def resample_to_hourly(lht_df, ws100_df, wind_df):
    """Resample all data to hourly and align timestamps."""
    print("\nResampling to hourly data...")
    
    # Resample LHT to hourly
    lht_hourly = lht_df.set_index('Timestamp').resample('h').mean().reset_index()
    
    # Rename WS100 columns to match expected format
    ws100_df = ws100_df.rename(columns={
        'precipitationIntensity_mm_h': 'Rain_mm_hour',
        'precipitationType': 'ptype_hour'
    })
    
    # Resample WS100 to hourly (sum rain, mean for others)
    agg_dict = {'Rain_mm_hour': 'sum'}
    if 'ptype_hour' in ws100_df.columns:
        # For ptype, take the most common value
        agg_dict['ptype_hour'] = lambda x: x.mode()[0] if len(x.mode()) > 0 else 0
    
    for col in ws100_df.columns:
        if col not in ['Timestamp', 'Rain_mm_hour', 'ptype_hour']:
            agg_dict[col] = 'mean'
    
    ws100_resampled = ws100_df.set_index('Timestamp').resample('h').agg(agg_dict).reset_index()
    
    # Resample wind to hourly
    wind_hourly = wind_df.set_index('Timestamp').resample('h').mean().reset_index()
    
    print(f"LHT hourly: {len(lht_hourly)} hours")
    print(f"WS100 hourly: {len(ws100_resampled)} hours")
    print(f"Wind hourly: {len(wind_hourly)} hours")
    
    return lht_hourly, ws100_resampled, wind_hourly

def analyze_flag_frequencies(pair_df):
    """Analyze how often each flag is True, broken down by month."""
    print("\n=== FLAG FREQUENCY ANALYSIS ===")
    
    df = pair_df.copy()
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df['year_month'] = df['timestamp'].dt.to_period('M')
    
    # Define flags to analyze
    wetness_flags = ['is_raining', 'leaf_wetness', 'wet_or_rain']
    drying_flags = ['dry_enough_city', 'dry_enough_strict']
    
    all_flags = wetness_flags + drying_flags
    
    # Overall statistics
    print("\n--- Overall Flag Frequencies (% of time True) ---")
    for flag in all_flags:
        if flag in df.columns:
            pct = (df[flag].sum() / len(df)) * 100
            print(f"{flag:25s}: {pct:6.2f}%")
    
    # Monthly breakdown
    print("\n--- Monthly Breakdown ---")
    monthly = df.groupby('year_month')[all_flags].apply(lambda x: (x.sum() / len(x)) * 100)
    
    # Save to CSV
    monthly.to_csv('flag_frequencies_monthly.csv')
    print("Saved: flag_frequencies_monthly.csv")
    
    # Print summary statistics
    print("\n--- Summary Statistics (% True) ---")
    print(monthly.describe().round(2))
    
    # Identify rare flags (< 5% overall)
    print("\n--- Rare Flags (< 5% occurrence) ---")
    for flag in all_flags:
        if flag in df.columns:
            pct = (df[flag].sum() / len(df)) * 100
            if pct < 5.0:
                print(f"{flag}: {pct:.2f}%")
    
    return monthly

def analyze_road_risk_flags(pair_df):
    """Analyze road risk-specific flags."""
    print("\n=== ROAD RISK FLAG ANALYSIS ===")
    
    # Add road risk scoring
    df_risk = add_slippery_risk(pair_df)
    
    df_risk['timestamp'] = pd.to_datetime(df_risk['timestamp'])
    df_risk['year_month'] = df_risk['timestamp'].dt.to_period('M')
    df_risk['hour'] = df_risk['timestamp'].dt.hour
    
    # Analyze freezing band
    is_freezing_band = (df_risk['temp_C'] >= -4.0) & (df_risk['temp_C'] <= 1.0)
    freezing_pct = (is_freezing_band.sum() / len(df_risk)) * 100
    print(f"\nFreezing band (-4°C to 1°C): {freezing_pct:.2f}% of hours")
    
    # Analyze commute hours
    is_commute = df_risk['hour'].isin([5, 6, 7, 8, 16, 17, 18, 19])
    commute_pct = (is_commute.sum() / len(df_risk)) * 100
    print(f"Commute hours (5-8, 16-19): {commute_pct:.2f}% of hours")
    
    # Analyze slippery levels
    print("\n--- Slippery Risk Levels ---")
    risk_counts = df_risk['slippery_level'].value_counts()
    for level in ['low', 'medium', 'high']:
        count = risk_counts.get(level, 0)
        pct = (count / len(df_risk)) * 100
        print(f"{level:10s}: {pct:6.2f}% ({count:,} hours)")
    
    # High risk score distribution
    high_scores = df_risk[df_risk['slippery_score'] >= 70]
    print(f"\nHours with score >= 70: {len(high_scores):,} ({len(high_scores)/len(df_risk)*100:.2f}%)")
    
    # Save risk analysis
    risk_monthly = df_risk.groupby('year_month')['slippery_level'].value_counts(normalize=True).unstack(fill_value=0) * 100
    risk_monthly.to_csv('road_risk_monthly.csv')
    print("Saved: road_risk_monthly.csv")
    
    return df_risk

def analyze_drying_times(pair_df, events_df):
    """Analyze drying times by season and precipitation type."""
    print("\n=== DRYING TIME ANALYSIS ===")
    
    if events_df.empty:
        print("No events detected in dataset.")
        return
    
    # Build event windows
    windows = build_event_windows(pair_df, events_df, pre_h=6, post_h=48)
    
    # Compute drying times
    drying_df = compute_event_drying_times(windows)
    
    if drying_df.empty:
        print("No drying times could be calculated.")
        return
    
    # Merge with event details
    analysis_df = events_df.merge(drying_df, on='event_id', how='left')
    analysis_df['start_ts'] = pd.to_datetime(analysis_df['start_ts'])
    analysis_df['season'] = analysis_df['start_ts'].dt.month.map({
        12: 'Winter', 1: 'Winter', 2: 'Winter',
        3: 'Spring', 4: 'Spring', 5: 'Spring',
        6: 'Summer', 7: 'Summer', 8: 'Summer',
        9: 'Autumn', 10: 'Autumn', 11: 'Autumn'
    })
    
    print(f"\nTotal events: {len(events_df)}")
    print(f"Events with drying time: {len(drying_df)}")
    print(f"Events without drying time: {len(events_df) - len(drying_df)}")
    
    # Overall statistics
    print("\n--- Overall Drying Time Statistics (hours from event END) ---")
    print(f"Median: {drying_df['drying_hours_from_end'].median():.1f} h")
    print(f"Mean: {drying_df['drying_hours_from_end'].mean():.1f} h")
    print(f"Std: {drying_df['drying_hours_from_end'].std():.1f} h")
    print(f"Min: {drying_df['drying_hours_from_end'].min():.1f} h")
    print(f"Max: {drying_df['drying_hours_from_end'].max():.1f} h")
    
    # By season
    print("\n--- Drying Time by Season (median hours from end) ---")
    season_drying = analysis_df.groupby('season')['drying_hours_from_end'].agg(['median', 'mean', 'count'])
    print(season_drying.round(1))
    
    # By precipitation type
    print("\n--- Drying Time by Precipitation Type (median hours from end) ---")
    ptype_drying = analysis_df.groupby('ptype_main')['drying_hours_from_end'].agg(['median', 'mean', 'count'])
    print(ptype_drying.round(1))
    
    # By intensity
    print("\n--- Drying Time by Event Intensity (median hours from end) ---")
    intensity_drying = analysis_df.groupby('event_intensity')['drying_hours_from_end'].agg(['median', 'mean', 'count'])
    print(intensity_drying.round(1))
    
    # Save detailed analysis
    analysis_df.to_csv('drying_times_detailed.csv', index=False)
    print("\nSaved: drying_times_detailed.csv")
    
    return analysis_df

def main():
    print("=" * 60)
    print("HISTORICAL DATA ANALYSIS: FLAGS & THRESHOLDS")
    print("=" * 60)
    
    # Load data
    lht_df, ws100_df, wind_df = load_historical_data()
    
    # Resample to hourly
    lht_hourly, ws100_hourly, wind_hourly = resample_to_hourly(lht_df, ws100_df, wind_df)
    
    # Build pair_hourly using the core function
    print("\nBuilding pair_hourly dataset...")
    pair_df = build_pair_hourly(lht_hourly, ws100_hourly, wind_hourly)
    print(f"Pair hourly dataset: {len(pair_df)} hours")
    print(f"Date range: {pair_df['timestamp'].min()} to {pair_df['timestamp'].max()}")
    
    # Add environment flags
    print("\nAdding environment flags...")
    pair_df = add_environment_flags(pair_df, DEFAULT_THRESHOLDS)
    
    # Analyze flag frequencies
    monthly_flags = analyze_flag_frequencies(pair_df)
    
    # Analyze road risk flags
    risk_df = analyze_road_risk_flags(pair_df)
    
    # Detect events
    print("\nDetecting precipitation events...")
    events_df = detect_events(pair_df, rain_threshold=DEFAULT_THRESHOLDS.rain_event_mm_h, max_gap_hours=4)
    print(f"Detected {len(events_df)} events")
    
    # Analyze drying times
    if not events_df.empty:
        drying_analysis = analyze_drying_times(pair_df, events_df)
    
    print("\n" + "=" * 60)
    print("ANALYSIS COMPLETE")
    print("Generated files:")
    print("  - flag_frequencies_monthly.csv")
    print("  - road_risk_monthly.csv")
    print("  - drying_times_detailed.csv")
    print("=" * 60)

if __name__ == "__main__":
    main()
