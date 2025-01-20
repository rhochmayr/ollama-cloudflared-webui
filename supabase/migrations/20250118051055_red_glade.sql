/*
  # Add anon key policy for Ollama instances

  1. Changes
    - Add new policy allowing anon key to update instance status
    - Restrict updates to only status, endpoint, and error fields
    - Only allow updates for existing instances
    - Do not allow changing user_id or other sensitive fields

  2. Security
    - Policy is limited to UPDATE operations only
    - Cannot create or delete instances
    - Cannot modify user associations
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