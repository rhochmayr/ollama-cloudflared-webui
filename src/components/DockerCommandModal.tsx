import React, { useState } from 'react';
import { Copy, Check, Terminal } from 'lucide-react';

interface DockerCommandModalProps {
  show: boolean;
  onClose: () => void;
  instanceId: string;
}

type CommandType = 'docker' | 'lilypad';

export function DockerCommandModal({ show, onClose, instanceId }: DockerCommandModalProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<CommandType>('docker');

  if (!show) return null;

  const dockerCommand = `docker run -d --gpus=all \\
  -e SUPABASE_INSTANCE_ID="${instanceId}" \\
  -e SUPABASE_URL="${import.meta.env.VITE_SUPABASE_URL}" \\
  -e SUPABASE_ANON_KEY="${import.meta.env.VITE_SUPABASE_ANON_KEY}" \\
  ghcr.io/rhochmayr/ollama-cloudflared:latest`;

  const lilypadCommand = `lilypad run --target 0xdf8666e9ed7fe6f52ead2b201a5da7205a663725 \\
  github.com/rhochmayr/ollama-cloudflared:0.1.0 \\
  -i SUPABASE_INSTANCE_ID="${instanceId}" \\
  -i SUPABASE_URL="${import.meta.env.VITE_SUPABASE_URL}" \\
  -i SUPABASE_ANON_KEY="${import.meta.env.VITE_SUPABASE_ANON_KEY}"`;

  const activeCommand = activeTab === 'docker' ? dockerCommand : lilypadCommand;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(activeCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy command:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Terminal className="h-5 w-5 text-indigo-600" />
              <h2 className="text-lg font-semibold text-gray-900">Run Command</h2>
            </div>
            <button
              onClick={copyToClipboard}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 rounded-md"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-1.5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1.5" />
                  Copy
                </>
              )}
            </button>
          </div>

          <div className="border-b border-gray-200 mb-4">
            <nav className="-mb-px flex space-x-4">
              <button
                onClick={() => setActiveTab('docker')}
                className={`py-2 px-4 text-sm font-medium border-b-2 ${
                  activeTab === 'docker'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Docker
              </button>
              <button
                onClick={() => setActiveTab('lilypad')}
                className={`py-2 px-4 text-sm font-medium border-b-2 ${
                  activeTab === 'lilypad'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Lilypad
              </button>
            </nav>
          </div>
          
          <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm">
            <pre className="text-gray-100 whitespace-pre-wrap break-all">
              {activeCommand}
            </pre>
          </div>

          <div className="mt-4 text-sm text-gray-500">
            {activeTab === 'docker' ? (
              <p>This command will start an Ollama instance with CloudFlared tunnel access.</p>
            ) : (
              <p>This command will start an Ollama instance on the Lilypad network.</p>
            )}
          </div>
        </div>
        
        <div className="bg-gray-50 px-6 py-4 rounded-b-lg flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 rounded-md"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}