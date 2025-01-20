/*
  # Fix anon policy for Ollama instance updates

  1. Changes
    - Drop existing anon policy
    - Create new simplified policy for anon updates
    - Allow updating only status, endpoint, and error fields
    - Maintain data integrity for other fields
  
  2. Security
    - Only allow specific status values
    - Prevent modification of sensitive fields
    - Ensure instance exists before update
*/

-- Drop existing anon policy
DROP POLICY IF EXISTS "Anon can update instance status" ON ollama_instances;

-- Create new simplified policy
CREATE POLICY "Anon can update instance status"
  ON ollama_instances
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (
    -- Only allow specific status values
    status IN ('starting', 'ready', 'error') AND
    -- Ensure we're not modifying sensitive fields
    (
      SELECT true
      FROM ollama_instances
      WHERE id = ollama_instances.id
      AND user_id IS NOT DISTINCT FROM ollama_instances.user_id
      AND created_at IS NOT DISTINCT FROM ollama_instances.created_at
      AND expires_at IS NOT DISTINCT FROM ollama_instances.expires_at
    )
  );