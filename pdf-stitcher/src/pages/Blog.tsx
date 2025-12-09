import React from "react";
import { Link } from "react-router-dom";
import { blogPosts } from "../data/blogPosts";

export default function Blog() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <main className="mx-auto max-w-5xl px-4 py-12">
        <div className="text-center mb-12">
          <Link to="/" className="inline-block text-blue-600 hover:text-blue-700 mb-4">
            ← Back to PDF Stitcher
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">📚 PDF Tips & Guides</h1>
          <p className="text-lg text-gray-600">Learn everything about PDF processing, privacy, and optimization</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {blogPosts.map((post) => (
            <Link
              key={post.id}
              to={`/blog/${post.id}`}
              className="block bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all p-6 group"
            >
              <div className="text-3xl mb-3">{post.icon}</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                {post.title}
              </h2>
              <p className="text-sm text-gray-600 mb-4">{post.excerpt}</p>
              <div className="text-xs text-gray-500">{post.date} · {post.readTime}</div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
