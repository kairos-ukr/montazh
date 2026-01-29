import React from "react";
import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">404</h1>
      <p className="mt-2 text-gray-600">Сторінку не знайдено.</p>
      <Link className="mt-4 inline-block text-sm underline" to="/dashboard">
        На дашборд
      </Link>
    </div>
  );
}
