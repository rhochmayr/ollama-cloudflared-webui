/*
  # Ollama Instances Schema

  1. Tables
    - `ollama_instances`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `status` (text, enum: requested, starting, ready, error)
      - `endpoint` (text, nullable)
      - `error` (text, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `expires_at` (timestamptz)

  2. Security
    - RLS enabled
    - Policies for insert, select, and update
    - Users can only access their own instances

  3. Features
    - Auto-updating timestamps
    - User ID indexing
    - Status validation
*/

-- Create the table
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

-- Create policies
CREATE POLICY "Users can create instance requests"
  ON ollama_instances
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own instances"
  ON ollama_instances
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own instances"
  ON ollama_instances
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX ollama_instances_user_id_idx ON ollama_instances(user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for auto-updating timestamps
CREATE TRIGGER update_ollama_instances_updated_at
  BEFORE UPDATE ON ollama_instances
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();