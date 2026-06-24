import React from 'react';

export default function Footer() {
  const handleLinkClick = (e) => {
    if (window.hasOwnProperty('Capacitor') || window.Capacitor) {
      e.preventDefault();
      window.open('https://www.facebook.com/mahbuburhamimofficial/', '_system');
    }
  };

  return (
    <footer className="w-full py-6 mt-12 border-t border-gray-800 text-center">
      <p className="text-xs text-gray-500 font-light tracking-wider hover:text-emerald-500 transition-colors duration-300">
        Made by{' '}
        <a
          href="https://www.facebook.com/mahbuburhamimofficial/"
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleLinkClick}
          className="font-medium text-gray-400 hover:underline cursor-pointer"
        >
          Mahbubur Hamim
        </a>
      </p>
    </footer>
  );
}
