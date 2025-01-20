import React, { useEffect, useState } from 'react';
import { Auth } from './components/Auth';
import { Chat } from './components/Chat';
import { supabase } from './lib/supabase';

function App() {
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {!session ? <Auth /> : <Chat />}
    </div>
  );
}

export default App;