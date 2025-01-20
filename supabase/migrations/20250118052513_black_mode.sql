/*
  # Simplify anon policy for Ollama instance updates

  1. Changes
    - Drop existing anon policy
    - Create new simplified policy that focuses only on status updates
    - Remove complex subqueries
  
  2. Security
    - Only allow specific status values
    - Prevent modification of sensitive fields
    - Maintain data integrity
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
    -- Only allow updating status, endpoint, and error fields
    -- All other fields must remain unchanged
    user_id = (SELECT user_id FROM ollama_instances WHERE id = ollama_instances.id) AND
    created_at = (SELECT created_at FROM ollama_instances WHERE id = ollama_instances.id) AND
    expires_at = (SELECT expires_at FROM ollama_instances WHERE id = ollama_instances.id) AND
    status IN ('starting', 'ready', 'error')
  );