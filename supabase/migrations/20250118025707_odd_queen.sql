/*
  # Add delete policy for messages

  1. Security Changes
    - Add policy to allow users to delete their own messages
*/

CREATE POLICY "Users can delete own messages"
  ON messages
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);