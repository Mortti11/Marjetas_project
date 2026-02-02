import numpy as np



def dewpoint_C(temperature, humidity):
    b = np.where(temperature >= 0, 17.625, 22.46)
    c = np.where(temperature >= 0, 243.04, 272.62)
    rh_frac = np.clip(humidity, 1e-6, 100) / 100.0
    gamma = np.log(rh_frac) + (b * temperature) / (c + temperature)
    return (c * gamma) / (b - gamma)


def svp_kpa_piecewise(Tc):
    Tc_arr = np.asarray(Tc, dtype=float)
    svp_liquid = 0.6108 * np.exp(17.27 * Tc_arr / (Tc_arr + 237.3))
    svp_ice = 0.6108 * np.exp(21.87 * Tc_arr / (Tc_arr + 265.5))
    svp = np.where(Tc_arr >= 0.0, svp_liquid, svp_ice)
    return svp


def vpd_kpa(Tc, RH):
    svp = svp_kpa_piecewise(Tc)
    return svp * (1 - RH / 100.0)



def abs_humidity_gm3(Tc, RH):
    """
    Calculate absolute humidity in g/m³ using ideal gas law.
    
    Formula: AH = e / (R_v * T) * 1000
    where:
        e = actual vapor pressure (Pa)
        R_v = 461.5 J/(kg·K) - specific gas constant for water vapor
        T = temperature (K)
        Constant: 1000 / 461.5 ≈ 2.16679
    
    Args:
        Tc: Temperature in Celsius
        RH: Relative humidity (0-100%)
    
    Returns:
        Absolute humidity in g/m³
    """
    svp_pa = svp_kpa_piecewise(Tc) * 1000.0  # Convert kPa to Pa
    vapor_pressure_pa = np.clip(RH, 0, 100) / 100.0 * svp_pa
    T_kelvin = Tc + 273.15
    return 2.16679 * vapor_pressure_pa / T_kelvin

