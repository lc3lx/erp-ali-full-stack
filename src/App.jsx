import { useState } from 'react'
import './App.css'
import { useAuth } from './context/AuthContext.jsx'
import { AppShell } from './app/layout/AppShell.jsx'
import LoginView from './components/LoginView.jsx'
import ContainerListPage from './pages/ContainerListPage.jsx'
import ReportsPage from './pages/ReportsPage.jsx'
import OfficialDocumentsPage from './pages/OfficialDocumentsPage.jsx'
import AccountingMovesPage from './pages/AccountingMovesPage.jsx'
import FinanceManagementPage from './pages/FinanceManagementPage.jsx'
import AccountingHubPage from './pages/AccountingHubPage.jsx'
import IncomeOutcomePage from './pages/IncomeOutcomePage.jsx'
import InvoiceVouchersPage from './pages/InvoiceVouchersPage.jsx'
import InvoiceSalePage from './pages/InvoiceSalePage.jsx'
import CustomersManagementPage from './pages/CustomersManagementPage.jsx'
import StoresManagementPage from './pages/StoresManagementPage.jsx'
import ItemsManagementPage from './pages/ItemsManagementPage.jsx'
import WarehousesManagementPage from './pages/WarehousesManagementPage.jsx'
import StockInventoryPage from './pages/StockInventoryPage.jsx'
import SuppliersManagementPage from './pages/SuppliersManagementPage.jsx'
import TreasuryPage from './pages/TreasuryPage.jsx'
import FinancialReportsPage from './pages/FinancialReportsPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import HrPage from './pages/HrPage.jsx'
import CrmPage from './pages/CrmPage.jsx'
import SystemSettingsPage from './pages/SystemSettingsPage.jsx'

export default function App() {
  const { isAuthenticated, logout, user } = useAuth()
  const [page, setPage] = useState('hub')

  if (!isAuthenticated) {
    return <LoginView />
  }

  return (
    <AppShell user={user} logout={logout} page={page} setPage={setPage}>
      {page === 'hub' && <AccountingHubPage />}
      {page === 'dashboard' && <DashboardPage />}
      {page === 'list' && <ContainerListPage />}
      {page === 'reports' && <ReportsPage />}
      {page === 'customers' && <CustomersManagementPage />}
      {page === 'stores' && <StoresManagementPage />}
      {page === 'items' && <ItemsManagementPage />}
      {page === 'warehouses' && <WarehousesManagementPage />}
      {page === 'stock' && <StockInventoryPage />}
      {page === 'suppliers' && <SuppliersManagementPage />}
      {page === 'official' && <OfficialDocumentsPage />}
      {page === 'finance' && <FinanceManagementPage />}
      {page === 'treasury' && <TreasuryPage />}
      {page === 'freports' && <FinancialReportsPage />}
      {page === 'accounting' && <AccountingMovesPage />}
      {page === 'io' && <IncomeOutcomePage />}
      {page === 'iv' && <InvoiceVouchersPage />}
      {page === 'is' && <InvoiceSalePage />}
      {page === 'hr' && <HrPage />}
      {page === 'crm' && <CrmPage />}
      {page === 'settings' && <SystemSettingsPage />}
    </AppShell>
  )
}
