import { create } from 'zustand';
import { supabase } from './supabase';
import { debounce } from './utils';
import { endpointManager } from './endpoint';
import type { Message, OllamaInstance, ErrorLog } from '../types';

const POLL_INTERVAL = 1000; // 1 second
const POLL_TIMEOUT = 5 * 60 * 1000; // 5 minutes

interface ChatStore {
  messages: Message[];
  isLoading: boolean;
  ollamaEndpoint: string;
  selectedModel: string;
  ollamaInstance: OllamaInstance | null;
  init: () => Promise<void>;
  setOllamaEndpoint: (endpoint: string) => void;
  setSelectedModel: (model: string) => void;
  addMessage: (content: string, role: 'user' | 'assistant') => Promise<void>;
  updateLastMessage: (content: string) => void;
  fetchMessages: () => Promise<void>;
  clearMessages: () => Promise<void>;
  logError: (message: string, details?: ErrorLog['details']) => Promise<void>;
  requestOllamaInstance: () => Promise<void>;
  checkInstanceStatus: () => Promise<void>;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  isLoading: false,
  ollamaEndpoint: '',
  selectedModel: '',
  ollamaInstance: null,

  init: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      // Check for existing instance
      const { data: instances, error } = await supabase
        .from('ollama_instances')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'ready')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get the most recent ready instance
      const instance = instances?.[0];
      
      if (instance && instance.endpoint) {
        // Start monitoring the endpoint
        endpointManager.startMonitoring(instance.endpoint, true, true);

        set({ 
          ollamaInstance: instance,
          ollamaEndpoint: instance.endpoint
        });
      }
    } catch (error) {
      // Only log real errors, not "no results" cases
      if (error.code !== 'PGRST116') {
        console.error('Failed to check for existing instance:', error);
        await get().logError('Failed to check for existing instance', { error });
      }
    }
  },

  setOllamaEndpoint: (endpoint: string) => {
    set({ ollamaEndpoint: endpoint });
  },

  setSelectedModel: (model: string) => {
    set({ selectedModel: model });
  },

  addMessage: async (content: string, role: 'user' | 'assistant') => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const newMessage = {
      content,
      role,
      user_id: user.id,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('messages')
      .insert([newMessage])
      .select()
      .single();

    if (error) {
      console.error('Error adding message:', error);
      await get().logError('Failed to add message', { error });
      return null;
    }

    // Only update the messages array if this is a new message (not replacing a temp message)
    if (role === 'user' || !get().messages.some(m => m.id === 'temp')) {
      set(state => ({
        messages: [...state.messages, data as Message],
      }));
    } else {
      // Replace the temporary message with the real one
      set(state => ({
        messages: state.messages.map(m => 
          m.id === 'temp' ? (data as Message) : m
        ),
      }));
    }

    return data as Message;
  },

  updateLastMessage: (content: string) => {
    set(state => {
      const messages = [...state.messages];
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.role === 'assistant') {
          // Only update the message in the UI state
          messages[messages.length - 1] = { ...lastMessage, content };
        }
      }
      return { messages };
    });
  },

  fetchMessages: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      await get().logError('Failed to fetch messages', { error });
      return;
    }

    set({ messages: data as Message[] });
  },

  clearMessages: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      console.error('Error clearing messages:', error);
      await get().logError('Failed to clear messages', { error });
      return;
    }

    set({ messages: [] });
  },

  logError: async (message: string, details?: ErrorLog['details']) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      await supabase
        .from('error_logs')
        .insert([{
          user_id: user.id,
          error_message: message,
          error_details: details || {}
        }]);
    } catch (error) {
      console.error('Failed to log error:', error);
    }
  },

  requestOllamaInstance: debounce(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    // Pause health checks when requesting new instance
    endpointManager.pause();

    try {
      const requestId = crypto.randomUUID();
      
      // Create a new instance request in Supabase
      const { error: dbError } = await supabase
        .from('ollama_instances')
        .insert([{
          id: requestId,
          user_id: user.id,
          status: 'requested'
        }]);

      if (dbError) throw dbError;

      // Update local state to show requesting status
      set({ 
        ollamaInstance: { 
          id: requestId, 
          status: 'requested' 
        }
      });

      // Start polling for status updates
      const checkStatus = get().checkInstanceStatus;
      const pollInterval = setInterval(checkStatus, POLL_INTERVAL);

      // Stop polling after timeout
      setTimeout(() => {
        clearInterval(pollInterval);
        const currentInstance = get().ollamaInstance;
        if (currentInstance?.status === 'requested' || currentInstance?.status === 'starting') {
          set({ 
            ollamaInstance: { 
              ...currentInstance,
              status: 'error',
              error: 'Instance request timed out'
            }
          });
        }
      }, POLL_TIMEOUT);

    } catch (error) {
      console.error('Failed to request Ollama instance:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to request instance';
      set({ 
        ollamaInstance: { 
          id: '', 
          status: 'error',
          error: errorMessage
        }
      });
      await get().logError('Failed to request Ollama instance', { error });
    }
  }, 1000),

  checkInstanceStatus: async () => {
    const instance = get().ollamaInstance;
    if (!instance || instance.status === 'ready' || instance.status === 'error') return;

    try {
      const { data, error } = await supabase
        .from('ollama_instances')
        .select('*')
        .eq('id', instance.id)
        .single();

      if (error) throw error;

      if (data.status === 'ready' && data.endpoint) {
        // When instance is ready, start monitoring the endpoint
        endpointManager.startMonitoring(data.endpoint, true, true);
        
        // Update local state with the new endpoint
        get().setOllamaEndpoint(data.endpoint);
        
        // Update instance status but don't mark as ready until we can connect
        set({ 
          ollamaInstance: {
            ...instance,
            status: data.status,
            endpoint: data.endpoint
          }
        });

        // Resume monitoring after DNS resolution delay
        setTimeout(() => {
          endpointManager.resume();
        }, 5000);
      } else if (data.status === 'error') {
        // Stop monitoring when instance is in error state
        if (instance.endpoint) {
          endpointManager.stopMonitoring(instance.endpoint);
        }
        
        set({ 
          ollamaInstance: {
            ...instance,
            status: 'error',
            error: data.error || 'Unknown error occurred'
          },
          ollamaEndpoint: '' // Clear the endpoint when in error state
        });
      } else {
        set({ ollamaInstance: data });
      }
    } catch (error) {
      console.error('Failed to check instance status:', error);
      await get().logError('Failed to check instance status', { 
        instanceId: instance.id,
        error 
      });
    }
  }
}));