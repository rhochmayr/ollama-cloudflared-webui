import express from 'express';
import cors from 'cors';
import { createServer } from 'vite';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { config } from 'dotenv';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: `${__dirname}/.env` });

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

const app = express();

// Configure CORS with more specific options
app.use(cors({
  origin: true, // Allow all origins
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-ollama-endpoint', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// Endpoint for updating instance status
app.post('/api/proxy/instance-status', async (req, res) => {
  const { endpoint, status, error } = req.body;

  if (!endpoint || !status) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Find the instance by endpoint
    const { data: instances, error: findError } = await supabase
      .from('ollama_instances')
      .select('id')
      .eq('endpoint', endpoint)
      .limit(1);

    if (findError) throw findError;
    if (!instances || instances.length === 0) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    // Update the instance status
    const { data: updateData, error: updateError } = await supabase
      .from('ollama_instances')
      .update({ 
        status, 
        error: error || null  // Ensure error is null when not provided
      })
      .eq('id', instances[0].id);

    if (updateError) throw updateError;

    res.json({ success: true, data: updateData });
  } catch (error) {
    console.error('Failed to update instance status:', error);
    res.status(500).json({ 
      error: 'Failed to update instance status',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// Improved error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error('Server error:', err);
  // Don't expose internal error details to client
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
  });
};

// Proxy endpoint for Ollama API with better error handling
app.post('/api/proxy/generate', async (req, res, next) => {
  const ollamaEndpoint = req.headers['x-ollama-endpoint'];
  if (!ollamaEndpoint) {
    return res.status(400).json({ error: 'Ollama endpoint not provided' });
  }

  try {
    const response = await fetch(`${ollamaEndpoint}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(req.body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ 
        error: `Ollama API error: ${response.status}`,
        details: errorText
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Generate endpoint error:', error);
    next(error);
  }
});

// Models endpoint with improved error handling and response parsing
app.get('/api/proxy/models', async (req, res, next) => {
  const ollamaEndpoint = req.headers['x-ollama-endpoint'];
  if (!ollamaEndpoint) {
    return res.status(400).json({ error: 'Ollama endpoint not provided' });
  }

  try {
    const response = await fetch(`${ollamaEndpoint}/api/tags`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ 
        error: `Ollama API error: ${response.status}`,
        details: errorText
      });
    }

    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`Invalid JSON response: ${text}`);
      }
    }

    // Ensure we have a valid models array
    const models = Array.isArray(data.models) ? data.models : [];
    res.json({ models });
  } catch (error) {
    console.error('Models endpoint error:', error);
    next(error);
  }
});

// Create Vite server in middleware mode with better error handling
let vite;
try {
  vite = await createServer({
    server: { 
      middlewareMode: true,
      hmr: {
        protocol: 'ws',
        host: 'localhost'
      }
    },
    appType: 'spa'
  });
} catch (error) {
  console.error('Vite server creation error:', error);
  process.exit(1);
}

// Use Vite's connect instance as middleware
app.use(vite.middlewares);

// Apply error handling middleware last
app.use(errorHandler);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const port = process.env.PORT || 5173;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});