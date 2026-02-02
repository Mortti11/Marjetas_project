import React from 'react';
import { Sprout, Sun, Leaf, Snowflake } from 'lucide-react';
import '../pages/Pages.css';

export default function SeasonDryingStrip() {
    const seasons = [
        {
            name: 'Spring',
            hours: 26,
            label: 'Moderate drying',
            icon: <Sprout size={24} strokeWidth={1.5} />,
            colorClass: 'season-card--spring'
        },
        {
            name: 'Summer',
            hours: 17,
            label: 'Fastest drying',
            icon: <Sun size={24} strokeWidth={1.5} />,
            colorClass: 'season-card--summer'
        },
        {
            name: 'Autumn',
            hours: 32.5,
            label: 'Slow drying',
            icon: <Leaf size={24} strokeWidth={1.5} />,
            colorClass: 'season-card--autumn'
        },
        {
            name: 'Winter',
            hours: 94,
            label: 'Very slow drying',
            icon: <Snowflake size={24} strokeWidth={1.5} />,
            colorClass: 'season-card--winter'
        }
    ];

    return (
        <section className="season-drying-strip">
            <div className="season-drying-header">
                <h3>Median drying by season (h)</h3>
                <p>Typical time until surfaces dry after rain events in Jyväskylä.</p>
            </div>

            <div className="season-drying-grid">
                {seasons.map((season) => (
                    <div key={season.name} className={`season-card ${season.colorClass}`}>
                        <div className="season-icon-wrapper">
                            {season.icon}
                        </div>
                        <div className="season-content">
                            <div className="season-name">{season.name}</div>
                            <div className="season-value">{season.hours} h</div>
                            <div className="season-label">{season.label}</div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
