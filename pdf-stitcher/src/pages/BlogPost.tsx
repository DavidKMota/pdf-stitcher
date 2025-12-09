import React from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { blogPosts } from "../data/blogPosts";

export default function BlogPost() {
  const { id } = useParams<{ id: string }>();
  const post = blogPosts.find((p) => p.id === id);

  if (!post) {
    return <Navigate to="/blog" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <article className="mx-auto max-w-3xl px-4 py-12">
        <Link to="/blog" className="inline-block text-blue-600 hover:text-blue-700 mb-6">
          ← Back to Blog
        </Link>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 md:p-12">
          <div className="text-5xl mb-6">{post.icon}</div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">{post.title}</h1>
          <div className="text-sm text-gray-500 mb-8">
            {post.date} · {post.readTime}
          </div>

          <div
            className="prose prose-lg max-w-none"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        </div>

        <div className="mt-8 text-center">
          <Link
            to="/"
            className="inline-block bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-800 transition-colors"
          >
            Try PDF Stitcher →
          </Link>
        </div>
      </article>
    </div>
  );
}
