import React, { useState } from "react";
import { apiGet } from "../api/http";

export default function ApiTestPage() {
  const [health, setHealth] = useState(null);
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState("");

  async function ping() {
    setError("");
    setHealth(null);
    try {
      const data = await apiGet("/api/health");
      setHealth(data);
    } catch (e) {
      setError(e.message);
    }
  }

  async function loadProjects() {
    setError("");
    setProjects(null);
    try {
      const data = await apiGet("/api/projects");
      setProjects(data);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">API Test</h1>
      <p className="mt-2 text-gray-600">
        Перевіряємо звʼязок client → server.
      </p>

      <div className="mt-4 flex gap-2">
        <button
          onClick={ping}
          className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
        >
          Ping /api/health
        </button>

        <button
          onClick={loadProjects}
          className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
        >
          Load /api/projects
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border p-4">
          <div className="text-sm font-semibold">Health</div>
          <pre className="mt-2 overflow-auto rounded-xl bg-gray-50 p-3 text-xs">
            {health ? JSON.stringify(health, null, 2) : "—"}
          </pre>
        </div>

        <div className="rounded-2xl border p-4">
          <div className="text-sm font-semibold">Projects</div>
          <pre className="mt-2 overflow-auto rounded-xl bg-gray-50 p-3 text-xs">
            {projects ? JSON.stringify(projects, null, 2) : "—"}
          </pre>
        </div>
      </div>
    </div>
  );
}
