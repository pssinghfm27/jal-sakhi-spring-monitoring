// SPDX-License-Identifier: MIT
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { MapView } from './pages/MapView';
import { SpringDetail } from './pages/SpringDetail';
import { Comparative } from './pages/Comparative';
import { Alerts } from './pages/Alerts';
// import { KrpPerformance } from './pages/KrpPerformance'; // /krps now redirects to /krp-management
import { PendingApprovals } from './pages/PendingApprovals';
import { SpringManagement } from './pages/SpringManagement';
import { ReadingsExplorer } from './pages/ReadingsExplorer';
import { KrpManagement } from './pages/KrpManagement';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/map" replace />} />
        <Route path="/map" element={<MapView />} />
        <Route path="/spring/:id" element={<SpringDetail />} />
        <Route path="/compare" element={<Comparative />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/krps" element={<Navigate to="/krp-management" replace />} />
        <Route path="/approvals" element={<PendingApprovals />} />
        <Route path="/springs" element={<SpringManagement />} />
        <Route path="/readings" element={<ReadingsExplorer />} />
        <Route path="/krp-management" element={<KrpManagement />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
