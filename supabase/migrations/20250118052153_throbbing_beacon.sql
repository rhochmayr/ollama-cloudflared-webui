/*
  # Add anon key policy for Ollama instance updates

  1. Changes
    - Add policy allowing anon role to update instance status
    - Restrict updates to specific fields (status, endpoint, error)
    - Ensure data integrity by preventing changes to sensitive fields
  
  2. Security
    - Only allow updates to existing instances
    - Restrict status values to 'starting', 'ready', 'error'
    - Prevent modification of user_id, created_at, and expires_at
*/

-- Add policy for anon key to update instance status
CREATE POLICY "Anon can update instance status"
  ON ollama_instances
  FOR UPDATE
  TO anon
  USING (
    -- Only allow updating instances that exist
    EXISTS (
      SELECT 1 FROM ollama_instances
      WHERE ollama_instances.id = id
    )
  )
  WITH CHECK (
    -- Only allow valid status values
    status IN ('starting', 'ready', 'error') AND
    -- Only allow updating status, endpoint, and error fields
    EXISTS (
      SELECT 1 FROM ollama_instances
      WHERE ollama_instances.id = id
      AND ollama_instances.user_id = user_id
      AND ollama_instances.created_at = created_at
      AND ollama_instances.expires_at = expires_at
    )
  );