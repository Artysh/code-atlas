import React from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Routes } from './routes';

export const App: React.FC = () => {
  return (
    <div className="app">
      <Header title="My App" />
      <main>
        <Routes />
      </main>
      <Footer />
    </div>
  );
};

export default App;
