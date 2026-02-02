import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import MapPage from './pages/MapPage';
import LhtPage from './pages/LhtPage';
import Ws100Page from './pages/Ws100Page';
import AnalyzePage from './pages/AnalyzePage';
import RoadForecastPage from './pages/RoadForecastPage.jsx';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<MapPage />} />
          <Route path="/lht" element={<LhtPage />} />
          <Route path="/ws100" element={<Ws100Page />} />
          <Route path="/analyze" element={<AnalyzePage />} />
          <Route path="/road-forecast" element={<RoadForecastPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
