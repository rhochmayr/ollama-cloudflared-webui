/*
  # Fix anon update policy for ollama instances

  1. Changes
    - Drop existing anon update policy
    - Create new simplified policy with correct subquery references
    - Policy ensures only status, endpoint, and error can be modified
    - Other fields (user_id, created_at, expires_at) must remain unchanged
*/

-- Drop existing anon policy
DROP POLICY IF EXISTS "Anon can update instance status" ON ollama_instances;

-- Create new simplified policy with correct subquery references
CREATE POLICY "Anon can update instance status"
  ON ollama_instances
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (
    -- Only allow updating status, endpoint, and error fields
    -- All other fields must remain unchanged
    user_id = (SELECT orig.user_id FROM ollama_instances orig WHERE orig.id = ollama_instances.id) AND
    created_at = (SELECT orig.created_at FROM ollama_instances orig WHERE orig.id = ollama_instances.id) AND
    expires_at = (SELECT orig.expires_at FROM ollama_instances orig WHERE orig.id = ollama_instances.id) AND
    status IN ('starting', 'ready', 'error')
  );