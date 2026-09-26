import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AppShell from './components/layout/AppShell';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';

// Operations Pages
import DashboardPage from './pages/DashboardPage';
import InventoryPage from './pages/InventoryPage';
import StockMovesPage from './pages/StockMovesPage';
import LotsPage from './pages/LotsPage';
import ReceiptsPage from './pages/ReceiptsPage';
import DeliveriesPage from './pages/DeliveriesPage';
import TransfersPage from './pages/TransfersPage';
import AdjustmentsPage from './pages/AdjustmentsPage';
import ReordersPage from './pages/ReordersPage';
import SettingsPage from './pages/SettingsPage';
import NotFoundPage from './pages/NotFoundPage';
import ScannerPage from './pages/warehouse/ScannerPage';

// Master Data Pages
import ProductsPage from './pages/master/ProductsPage';
import CategoriesPage from './pages/master/CategoriesPage';
import UomPage from './pages/master/UomPage';
import WarehousesPage from './pages/master/WarehousesPage';
import LocationsPage from './pages/master/LocationsPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Protected Application Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            
            {/* Master Data */}
            <Route path="products" element={<ProductsPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="uom" element={<UomPage />} />
            <Route path="warehouses" element={<WarehousesPage />} />
            <Route path="locations" element={<LocationsPage />} />

            {/* Warehouse Operations */}
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="moves" element={<StockMovesPage />} />
            <Route path="lots" element={<LotsPage />} />
            <Route path="receipts" element={<ReceiptsPage />} />
            <Route path="deliveries" element={<DeliveriesPage />} />
            <Route path="transfers" element={<TransfersPage />} />
            <Route path="adjustments" element={<AdjustmentsPage />} />
            <Route path="reorders" element={<ReordersPage />} />
            <Route path="scanner" element={<ScannerPage />} />
            <Route path="warehouse/scanner" element={<ScannerPage />} />
            <Route path="settings" element={<SettingsPage />} />

            {/* Catch-all 404 */}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
