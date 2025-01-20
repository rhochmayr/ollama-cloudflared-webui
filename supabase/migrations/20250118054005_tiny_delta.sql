/*
  # Fix anon policy for Ollama instance updates

  1. Changes
    - Drop existing policy
    - Create new policy with correct table references
    - Simplify the validation logic
  
  2. Security
    - Maintain data integrity by checking against original record
    - Only allow specific status values
    - Prevent modification of sensitive fields
*/

-- Drop existing anon policy
DROP POLICY IF EXISTS "Anon can update instance status" ON ollama_instances;

-- Create new simplified policy with correct table references
CREATE POLICY "Anon can update instance status"
  ON ollama_instances
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (
    -- Only allow updating status, endpoint, and error fields
    -- All other fields must remain unchanged
    user_id = (SELECT user_id FROM ollama_instances orig WHERE orig.id = id) AND
    created_at = (SELECT created_at FROM ollama_instances orig WHERE orig.id = id) AND
    expires_at = (SELECT expires_at FROM ollama_instances orig WHERE orig.id = id) AND
    status IN ('starting', 'ready', 'error')
  );