/*
  # Create Ollama instances table

  1. New Tables
    - `ollama_instances`
      - `id` (uuid, primary key) - Unique identifier for the instance
      - `user_id` (uuid) - Reference to auth.users
      - `status` (text) - Current status of the instance (requested, starting, ready, error)
      - `endpoint` (text) - The URL where the Ollama instance is accessible
      - `error` (text) - Error message if something goes wrong
      - `created_at` (timestamptz) - When the instance was requested
      - `updated_at` (timestamptz) - Last status update
      - `expires_at` (timestamptz) - When the instance will be terminated

  2. Security
    - Enable RLS on `ollama_instances` table
    - Add policies for authenticated users to:
      - Create new instance requests
      - Read their own instances
      - Update their own instances (for the serverless container)
*/

CREATE TABLE IF NOT EXISTS ollama_instances (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  status text NOT NULL CHECK (status IN ('requested', 'starting', 'ready', 'error')),
  endpoint text,
  error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '1 hour')
);

-- Enable RLS
ALTER TABLE ollama_instances ENABLE ROW LEVEL SECURITY;

-- Allow users to create new instance requests
CREATE POLICY "Users can create instance requests"
  ON ollama_instances
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow users to read their own instances
CREATE POLICY "Users can read own instances"
  ON ollama_instances
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow users to update their own instances
CREATE POLICY "Users can update own instances"
  ON ollama_instances
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create an index for faster lookups
CREATE INDEX ollama_instances_user_id_idx ON ollama_instances(user_id);

-- Create a function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a trigger to automatically update updated_at
CREATE TRIGGER update_ollama_instances_updated_at
  BEFORE UPDATE ON ollama_instances
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();