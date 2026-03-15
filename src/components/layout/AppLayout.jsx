import { Outlet } from 'react-router-dom';
import Header from './Header';
import BottomNav from './BottomNav';
import Sidebar from './Sidebar';
import Toast from '../ui/Toast';

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      <Toast />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-6">
          <div className="max-w-4xl mx-auto px-4 py-4 lg:py-6">
            <Outlet />
          </div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
