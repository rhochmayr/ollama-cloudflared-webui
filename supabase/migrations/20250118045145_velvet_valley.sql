/*
  # Update Ollama Instances Policies

  1. Changes
    - Add DELETE policy for ollama instances
    - Verify and recreate existing policies
    - Add index on status for performance

  2. Security
    - Maintain RLS
    - Users can only manage their own instances
*/

-- Drop existing policies to ensure clean state
DROP POLICY IF EXISTS "Users can create instance requests" ON ollama_instances;
DROP POLICY IF EXISTS "Users can read own instances" ON ollama_instances;
DROP POLICY IF EXISTS "Users can update own instances" ON ollama_instances;
DROP POLICY IF EXISTS "Users can delete own instances" ON ollama_instances;

-- Recreate policies with clear permissions
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

CREATE POLICY "Users can delete own instances"
  ON ollama_instances
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add index on status for better query performance
CREATE INDEX IF NOT EXISTS ollama_instances_status_idx ON ollama_instances(status);

-- Verify RLS is enabled
ALTER TABLE ollama_instances FORCE ROW LEVEL SECURITY;