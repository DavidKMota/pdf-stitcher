import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-12">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="font-bold text-gray-900 mb-3">PDF Stitcher</h3>
            <p className="text-sm text-gray-600">
              Free, privacy-focused tool to merge PDF pages into one long scrollable page.
            </p>
          </div>
          
          <div>
            <h3 className="font-bold text-gray-900 mb-3">Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/" className="text-gray-600 hover:text-gray-900">Tool</Link>
              </li>
              <li>
                <Link to="/blog" className="text-gray-600 hover:text-gray-900">Blog</Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-bold text-gray-900 mb-3">Support</h3>
            <p className="text-sm text-gray-600 mb-2">Like this tool? Support development:</p>
            <a
              href="https://ko-fi.com/pdfstitcher"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-blue-500 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
            >
              ☕ Buy me a coffee
            </a>
          </div>
        </div>
        
        <div className="mt-8 pt-8 border-t border-gray-200 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} PDF Stitcher. All rights reserved. Made with ❤️ for privacy.
        </div>
      </div>
    </footer>
  );
}
