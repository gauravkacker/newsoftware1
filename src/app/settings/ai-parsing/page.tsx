"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

interface AISettings {
  enabled: boolean;
  apiKey: string;
  model: string;
}

export default function AIParsingSettingsPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settings, setSettings] = useState<AISettings>({
    enabled: false,
    apiKey: "",
    model: "llama-3.3-70b-versatile",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [testInput, setTestInput] = useState("Ars alb 1M 1/2oz liquid 6-6-6 4 weeks");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    // Load settings from localStorage
    const savedSettings = localStorage.getItem("aiParsingSettings");
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (e) {
        console.error("Failed to load AI settings:", e);
      }
    }
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      localStorage.setItem("aiParsingSettings", JSON.stringify(settings));
      // Also save to database for persistence
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "aiParsingSettings",
          value: JSON.stringify(settings),
          category: "ai",
        }),
      });
      alert("Settings saved successfully!");
    } catch (error) {
      console.error("Failed to save settings:", error);
      alert("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!settings.apiKey) {
      alert("Please enter an API key first");
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch("/api/parse-prescription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: testInput,
          apiKey: settings.apiKey,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setTestResult(JSON.stringify(data.data, null, 2));
      } else {
        setTestResult(`Error: ${data.error || "Failed to parse"}`);
      }
    } catch (error) {
      setTestResult(`Error: ${error}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className={`transition-all duration-300 ${sidebarCollapsed ? "ml-16" : "ml-64"}`}>
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-4">
            <a href="/settings" className="text-gray-500 hover:text-gray-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </a>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AI Prescription Parsing</h1>
              <p className="text-sm text-gray-500">
                Configure AI-powered prescription text parsing for better accuracy
              </p>
            </div>
            <span className="ml-auto px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
              100% FREE
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-w-4xl">
          {/* How it works */}
          <Card className="p-6 mb-6 bg-green-50 border-green-200">
            <h3 className="text-lg font-semibold text-green-900 mb-2">FREE AI Parsing with Groq</h3>
            <ul className="text-sm text-green-800 space-y-2">
              <li>• <strong>100% Free:</strong> No credit card required - uses Groq&apos;s free API with Llama 3 model</li>
              <li>• <strong>More Accurate:</strong> AI understands medical abbreviations and context better than regex patterns</li>
              <li>• <strong>Flexible Input:</strong> Works with various prescription formats like &quot;Ars alb 1M 1/2oz liquid 6-6-6 4 weeks&quot;</li>
              <li>• <strong>Privacy:</strong> Your API key is stored locally and only sent to Groq for parsing</li>
              <li>• <strong>Fallback:</strong> If AI fails, the system automatically falls back to regex parsing</li>
            </ul>
          </Card>

          {/* Step by Step Guide */}
          <Card className="p-6 mb-6 bg-blue-50 border-blue-200">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">Step-by-Step Setup Guide</h3>
            <ol className="text-sm text-blue-800 space-y-3 list-decimal list-inside">
              <li>
                <strong>Create a free Groq account:</strong>{" "}
                <a
                  href="https://console.groq.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  console.groq.com
                </a>
              </li>
              <li>
                <strong>Generate your API key:</strong>{" "}
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  console.groq.com/keys
                </a>
              </li>
              <li><strong>Copy the API key</strong> and paste it below</li>
              <li><strong>Enable AI Parsing</strong> using the toggle below</li>
              <li><strong>Click Save Settings</strong> to save your configuration</li>
              <li><strong>Test it</strong> using the test section below</li>
            </ol>
          </Card>

          {/* Settings Form */}
          <Card className="p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Configuration</h3>
            
            <div className="space-y-4">
              {/* Enable AI */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium text-gray-700">Enable AI Parsing</label>
                  <p className="text-sm text-gray-500">Use AI for prescription text parsing</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.enabled ? "bg-green-600" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* API Key */}
              <div>
                <label className="block font-medium text-gray-700 mb-1">
                  Groq API Key (FREE)
                </label>
                <p className="text-sm text-gray-500 mb-2">
                  Get your FREE API key from{" "}
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    console.groq.com/keys
                  </a>
                </p>
                <Input
                  type="password"
                  placeholder="gsk_..."
                  value={settings.apiKey}
                  onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                  className="w-full"
                />
              </div>

              {/* Model Selection */}
              <div>
                <label className="block font-medium text-gray-700 mb-1">
                  AI Model
                </label>
                <select
                  value={settings.model}
                  onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="llama-3.3-70b-versatile">Llama 3.3 70B (Recommended - FREE)</option>
                  <option value="llama-3.1-8b-instant">Llama 3.1 8B (Faster - FREE)</option>
                  <option value="mixtral-8x7b-32768">Mixtral 8x7B (FREE)</option>
                </select>
              </div>

              {/* Save Button */}
              <div className="pt-4">
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </div>
          </Card>

          {/* Test Section */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Test AI Parsing</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block font-medium text-gray-700 mb-1">
                  Test Input
                </label>
                <Input
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  placeholder="Enter prescription text to parse"
                  className="w-full"
                />
              </div>

              <Button onClick={handleTest} disabled={isTesting || !settings.apiKey}>
                {isTesting ? "Testing..." : "Test Parsing"}
              </Button>

              {testResult && (
                <div className="mt-4">
                  <label className="block font-medium text-gray-700 mb-1">
                    Result
                  </label>
                  <pre className="bg-gray-100 p-4 rounded-md text-sm overflow-auto max-h-96">
                    {testResult}
                  </pre>
                </div>
              )}
            </div>
          </Card>

          {/* Example Inputs */}
          <Card className="p-6 mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Example Inputs to Try</h3>
            <div className="space-y-2 text-sm">
              <button
                onClick={() => setTestInput("Ars alb 1M 1/2oz liquid 6-6-6 4 weeks")}
                className="block w-full text-left p-2 bg-gray-50 hover:bg-gray-100 rounded"
              >
                <code>Ars alb 1M 1/2oz liquid 6-6-6 4 weeks</code>
              </button>
              <button
                onClick={() => setTestInput("Nux Vomica 200C 4 pills TDS 7 days")}
                className="block w-full text-left p-2 bg-gray-50 hover:bg-gray-100 rounded"
              >
                <code>Nux Vomica 200C 4 pills TDS 7 days</code>
              </button>
              <button
                onClick={() => setTestInput("Bryonia 30CH 2dr drops 1-0-1 for 2 weeks")}
                className="block w-full text-left p-2 bg-gray-50 hover:bg-gray-100 rounded"
              >
                <code>Bryonia 30CH 2dr drops 1-0-1 for 2 weeks</code>
              </button>
              <button
                onClick={() => setTestInput("Sulphur 1M weekly 1 dose 1 month")}
                className="block w-full text-left p-2 bg-gray-50 hover:bg-gray-100 rounded"
              >
                <code>Sulphur 1M weekly 1 dose 1 month</code>
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
