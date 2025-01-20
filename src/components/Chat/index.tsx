import React, { useState, useEffect } from 'react';
import { useChatStore } from '../../lib/store';
import { ChatHeader } from './ChatHeader';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';
import { SettingsModal } from './SettingsModal';
import { ConfirmationModal } from '../ConfirmationModal';
import { supabase } from '../../lib/supabase';
import { Message, Model } from '../../types';
import { endpointManager } from '../../lib/endpoint';

export function Chat() {
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [tempEndpoint, setTempEndpoint] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  
  const {
    messages,
    addMessage,
    updateLastMessage,
    clearMessages,
    ollamaEndpoint,
    setOllamaEndpoint,
    selectedModel,
    setSelectedModel,
    logError
  } = useChatStore();

  // Single source of truth for endpoint monitoring
  useEffect(() => {
    if (!ollamaEndpoint) return;

    // Start monitoring endpoint health
    endpointManager.startMonitoring(ollamaEndpoint);

    // Subscribe to health updates
    const unsubscribe = endpointManager.subscribe(() => {
      const health = endpointManager.getHealth(ollamaEndpoint);
      if (health?.isConnected) {
        // Only fetch models when we're connected
        fetchModels(ollamaEndpoint);
      } else {
        // Clear models when disconnected
        setModels([]);
        setSelectedModel('');
        setError(null); // Clear error message when disconnected
      }
    });

    return () => {
      unsubscribe();
      endpointManager.stopMonitoring(ollamaEndpoint);
    };
  }, [ollamaEndpoint]);

  const handleSubmit = async (message: string) => {
    if (!ollamaEndpoint || !selectedModel || loading) return;

    setLoading(true);
    setError(null);

    try {
      await addMessage(message, 'user');
      await addMessage('', 'assistant');

      const response = await fetch('/api/proxy/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Ollama-Endpoint': ollamaEndpoint
        },
        body: JSON.stringify({
          model: selectedModel,
          prompt: message,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
            top_k: 40
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const data = await response.json();
      if (!data.response) {
        throw new Error('Invalid response from Ollama API');
      }

      updateLastMessage(data.response);
    } catch (error) {
      let errorMessage: string;
      if (error instanceof Error) {
        errorMessage = error.message;
        console.error('Chat error:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
      } else {
        errorMessage = 'An unexpected error occurred';
        console.error('Chat error:', error);
      }

      setError(errorMessage);
      logError(errorMessage, {
        endpoint: ollamaEndpoint,
        model: selectedModel,
        input: message,
        error: error instanceof Error ? {
          message: error.message,
          name: error.name,
          stack: error.stack
        } : String(error)
      });

      updateLastMessage('Sorry, I encountered an error. Please check your settings and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      const errorMessage = 'Failed to sign out. Please try again.';
      setError(errorMessage);
      logError(errorMessage, { 
        error: error instanceof Error ? {
          message: error.message,
          name: error.name,
          stack: error.stack
        } : String(error) 
      });
      console.error('Sign out error:', error);
    }
  };

  const handleClearChat = async () => {
    setShowClearConfirmation(true);
  };

  const confirmClearChat = async () => {
    try {
      await clearMessages();
      setShowClearConfirmation(false);
    } catch (error) {
      const errorMessage = 'Failed to clear chat history. Please try again.';
      setError(errorMessage);
      logError(errorMessage, { 
        error: error instanceof Error ? {
          message: error.message,
          name: error.name,
          stack: error.stack
        } : String(error) 
      });
      console.error('Clear chat error:', error);
    }
  };

  const handleOpenSettings = () => {
    setTempEndpoint(ollamaEndpoint);
    setShowSettings(true);
    setError(null);
    if (ollamaEndpoint) {
      fetchModels(ollamaEndpoint);
    }
  };

  const fetchModels = async (endpoint: string) => {
    setLoadingModels(true);
    setError(null);
    try {
      const response = await fetch('/api/proxy/models', {
        headers: {
          'X-Ollama-Endpoint': endpoint
        }
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorData}`);
      }

      const data = await response.json();
      setModels(data.models || []);
    } catch (error) {
      const health = endpointManager.getHealth(endpoint);
      if (health?.isConnected) {
        const errorMessage = 'Failed to fetch available models. Please check your endpoint configuration.';
        setError(errorMessage);
        logError(errorMessage, {
          endpoint,
          error: error instanceof Error ? {
            message: error.message,
            name: error.name,
            stack: error.stack
          } : String(error)
        });
        console.error('Error fetching models:', error);
      } else {
        setError(null); // Clear error message if disconnected
      }
    } finally {
      setLoadingModels(false);
    }
  };

  const handleSaveSettings = () => {
    try {
      const url = new URL(tempEndpoint);
      if (!url.protocol.startsWith('http')) {
        throw new Error('Invalid URL: Protocol must be HTTP or HTTPS');
      }
      setOllamaEndpoint(tempEndpoint);
      setShowSettings(false);
      setError(null);
    } catch (error) {
      const errorMessage = 'Please enter a valid URL (e.g., http://localhost:11434)';
      setError(errorMessage);
      logError(errorMessage, {
        attemptedEndpoint: tempEndpoint,
        error: error instanceof Error ? {
          message: error.message,
          name: error.name,
          stack: error.stack
        } : String(error)
      });
    }
  };

  const inputPlaceholder = !ollamaEndpoint
    ? "Configure Ollama API endpoint in settings first"
    : !selectedModel
    ? "Select a model from settings first"
    : "Type your message...";

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <ChatHeader
        selectedModel={selectedModel}
        onOpenSettings={handleOpenSettings}
        onSignOut={handleSignOut}
        onClearChat={handleClearChat}
      />
      
      <ChatMessages
        messages={messages}
        error={error}
      />
      
      <ChatInput
        onSubmit={handleSubmit}
        loading={loading}
        disabled={!ollamaEndpoint || !selectedModel}
        placeholder={inputPlaceholder}
        endpoint={ollamaEndpoint}
      />
      
      <SettingsModal
        show={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={handleSaveSettings}
        endpoint={tempEndpoint}
        onEndpointChange={setTempEndpoint}
        onRefreshModels={() => fetchModels(tempEndpoint)}
        models={models}
        selectedModel={selectedModel}
        onModelSelect={setSelectedModel}
        error={error}
        loading={loadingModels}
      />

      <ConfirmationModal
        show={showClearConfirmation}
        title="Clear Chat History"
        message="Are you sure you want to clear all chat messages? This action cannot be undone."
        confirmLabel="Clear History"
        cancelLabel="Cancel"
        onConfirm={confirmClearChat}
        onCancel={() => setShowClearConfirmation(false)}
        type="danger"
      />
    </div>
  );
}
