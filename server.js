import express from 'express';
import cors from 'cors';
import { createServer } from 'vite';
import fetch from 'node-fetch';

const app = express();

// Configure CORS with more specific options
app.use(cors({
  origin: true, // Allow all origins
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-ollama-endpoint', 'Authorization'],
  credentials: true
}));

app.use(express.json());

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