import React from "react";
import { Link } from "react-router-dom";

export default function Header() {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <nav className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold text-gray-900 hover:text-gray-700 transition-colors">
          PDF Stitcher
        </Link>
        
        <div className="flex items-center gap-6">
          <Link to="/" className="text-gray-700 hover:text-gray-900 transition-colors">
            Tool
          </Link>
          <Link to="/blog" className="text-gray-700 hover:text-gray-900 transition-colors">
            Blog
          </Link>
        </div>
      </nav>
    </header>
  );
}
