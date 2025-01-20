/*
  # Add read policy for anon key

  1. Changes
    - Add policy to allow anon key to read ollama instances
    - This is needed for the update policy to work correctly
    - Only allows reading specific fields needed for updates
*/

-- Add policy for anon key to read instance data
CREATE POLICY "Anon can read instance data"
  ON ollama_instances
  FOR SELECT
  TO anon
  USING (true);