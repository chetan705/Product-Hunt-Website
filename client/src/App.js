import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import AdminPanel from './components/AdminPanel';
import MainDashboard from './components/MainDashboard';

// Navigation component
const Navigation = () => {
  const location = useLocation();
  
  return (
    <nav className="bg-gradient-to-r from-primary-500 to-secondary-500 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold">🚀 Product Hunt Finder</h1>
          </div>
          <div className="flex space-x-4">
            <Link 
              to="/" 
              className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 ${
                location.pathname === '/' 
                  ? 'bg-white bg-opacity-20 text-white' 
                  : 'text-white text-opacity-90 hover:text-white hover:bg-white hover:bg-opacity-10'
              }`}
            >
              📊 Dashboard
            </Link>
            <Link 
              to="/admin" 
              className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 ${
                location.pathname === '/admin' 
                  ? 'bg-white bg-opacity-20 text-white' 
                  : 'text-white text-opacity-90 hover:text-white hover:bg-white hover:bg-opacity-10'
              }`}
            >
              🛠️ Admin Panel
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Navigation />
        
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<MainDashboard />} />
            <Route path="/admin" element={<AdminPanel />} />
          </Routes>
        </main>
        
        {/* Footer */}
        <footer className="bg-gray-800 text-white text-center py-8 mt-auto">
          <div className="max-w-7xl mx-auto px-4">
            <p className="text-gray-300">© 2025 Product Hunt Finder - Built for discovering amazing products</p>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;
